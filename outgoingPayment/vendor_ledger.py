from datetime import datetime, timedelta
import logging
from fastapi import APIRouter, HTTPException,Request
import pytz
from typing import Optional, List, Dict
from utils.database import get_advancepayment_collection, get_outgoingpayment_collection,get_vendor_collection,get_debit_collection
from outgoingPayment.models import TransactionDetail, VendorLedgerResponse
from dateutil import parser
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InvoiceTracker:
    def __init__(self, invoice_no: str, payable_amount: float, invoice_date: datetime):
        self.invoice_no = invoice_no
        self.original_payable = payable_amount
        self.remaining_payable = payable_amount
        self.invoice_date = invoice_date
        self.payments: List[Dict] = []
        self.debit_notes: List[Dict] = []
        self.advances_applied: List[Dict] = []
        self.status = "Open"
@router.get("/vendor/{vendor_name}/ledger", response_model=VendorLedgerResponse)
def get_vendor_ledger(request:Request,
    vendor_name: str,
    opening_balance: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "ledger", "read"))
):
    tenant_id = request.state.tenant_id
    logger.info(f"Generating ledger for vendor: {vendor_name}")
    vendor_collection = get_vendor_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    debit_collection = get_debit_collection(tenant_id)
    advance_collection = get_advancepayment_collection(tenant_id)
    
    if vendor_collection is None or outgoing_collection is None or debit_collection is None or advance_collection is None:
        logger.error("Database connection error: One or more collections are None")
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        # Find vendor
        vendor = vendor_collection.find_one({"vendorName": vendor_name})
        if not vendor:
            logger.warning(f"Vendor not found: {vendor_name}")
            raise HTTPException(status_code=404, detail=f"Vendor {vendor_name} not found")

        vendor_id = vendor.get("vendorId")
        IST = pytz.timezone('Asia/Kolkata')

        # Parse date filters
        start_datetime = None
        if start_date:
            start_parsed = parser.parse(start_date).replace(tzinfo=IST, hour=0, minute=0, second=0, microsecond=0)
            start_datetime = start_parsed
        else:
            start_datetime = datetime.min.replace(tzinfo=IST)

        end_datetime = parser.parse(end_date).replace(tzinfo=IST, hour=23, minute=59, second=59) if end_date else datetime.now(IST)

        def format_datetime_with_time(dt):
            return dt.astimezone(IST).strftime("%d-%m-%Y %I:%M:%S %p") if dt else None

        def parse_date_safely(date):
            if not date:
                return None
            if isinstance(date, dict) and '$date' in date:
                return datetime.fromisoformat(date['$date'].replace('Z', '+00:00')).astimezone(IST)
            if isinstance(date, str):
                return datetime.fromisoformat(date.replace('Z', '+00:00')).astimezone(IST)
            return date.astimezone(IST) if isinstance(date, datetime) else date

        # FIX: Calculate ACTUAL opening balance from all transactions before start date
        def calculate_actual_opening_balance(vendor_name, start_datetime):
            """Calculate the actual opening balance by processing all transactions before start date"""
            balance = 0.0
            
            # Get all transactions for this vendor (without date filter)
            all_outgoing = list(outgoing_collection.find({"vendorName": vendor_name}))
            all_advances = list(advance_collection.find({"vendorName": vendor_name}))
            all_debits = list(debit_collection.find({"vendorName": vendor_name}))
            
            # Process invoices (CREDIT - increases balance)
            for payment in all_outgoing:
                invoice_date = parse_date_safely(payment.get("invoiceDate") or payment.get("grnDate") or payment.get("createdDate"))
                if invoice_date and invoice_date < start_datetime:
                    payable_amount = payment.get("originalTotalPayableAmount", payment.get("payableAmount", 0.0))
                    balance += payable_amount
                    logger.info(f"Pre-start invoice: {payable_amount} added to balance -> {balance}")
            
            # Process payments (DEBIT - decreases balance)
            for payment in all_outgoing:
                payment_history = payment.get("paymentHistory", [])
                for hist_entry in payment_history:
                    payment_date = parse_date_safely(hist_entry.get("date"))
                    if payment_date and payment_date < start_datetime:
                        payment_amount = hist_entry.get("amount", 0.0)
                        balance -= payment_amount
                        logger.info(f"Pre-start payment: {payment_amount} subtracted from balance -> {balance}")
                        
                        # Process advance applications
                        advance_amount = hist_entry.get("advanceAmount", 0.0)
                        if advance_amount > 0:
                            balance -= advance_amount
                            logger.info(f"Pre-start advance applied: {advance_amount} subtracted from balance -> {balance}")
                        
                        # Process debit note applications  
                        debit_amount = hist_entry.get("debitAmount", 0.0)
                        if debit_amount > 0:
                            balance -= debit_amount
                            logger.info(f"Pre-start debit applied: {debit_amount} subtracted from balance -> {balance}")
            
            # Process standalone advances (DEBIT - decreases balance)
            for advance in all_advances:
                advance_date = parse_date_safely(advance.get("createdDate"))
                if advance_date and advance_date < start_datetime:
                    advance_amount = advance.get("amount", advance.get("advanceAmount", 0.0))
                    # Check if this advance was applied to any invoice
                    advance_id = advance.get("randomId")
                    was_applied = False
                    
                    # Check if this advance was applied to any payment
                    for payment in all_outgoing:
                        payment_history = payment.get("paymentHistory", [])
                        for hist_entry in payment_history:
                            applied_advances = hist_entry.get("advancePaymentsApplied", [])
                            if advance_id in applied_advances:
                                was_applied = True
                                break
                        if was_applied:
                            break
                    
                    # Only subtract if NOT applied (applied advances are already accounted for in payment processing)
                    if not was_applied and advance_amount > 0:
                        balance -= advance_amount
                        logger.info(f"Pre-start standalone advance: {advance_amount} subtracted from balance -> {balance}")
            
            # Process standalone debit notes (DEBIT - decreases balance)
            for debit_note in all_debits:
                debit_date = parse_date_safely(debit_note.get("createdDate") or debit_note.get("returnDate"))
                if debit_date and debit_date < start_datetime:
                    debit_amount = debit_note.get("finalAmount", debit_note.get("debitAmount", 0.0))
                    # Check if this debit note was applied to any invoice
                    debit_id = debit_note.get("randomId")
                    was_applied = False
                    
                    # Check if this debit note was applied to any payment
                    for payment in all_outgoing:
                        payment_history = payment.get("paymentHistory", [])
                        for hist_entry in payment_history:
                            applied_debits = hist_entry.get("debitNotesApplied", [])
                            if debit_id in applied_debits:
                                was_applied = True
                                break
                        if was_applied:
                            break
                    
                    # Only subtract if NOT applied (applied debits are already accounted for in payment processing)
                    if not was_applied and debit_amount > 0:
                        balance -= debit_amount
                        logger.info(f"Pre-start standalone debit: {debit_amount} subtracted from balance -> {balance}")
            
            logger.info(f"Final calculated opening balance: {balance}")
            return balance

        # Use calculated opening balance instead of vendor master opening balance
        actual_opening_balance = calculate_actual_opening_balance(vendor_name, start_datetime)
        initial_opening_balance = opening_balance if opening_balance is not None else actual_opening_balance
        
        logger.info(f"Using opening balance: {initial_opening_balance} (calculated: {actual_opening_balance})")

        # Track invoices and their payments
        invoice_trackers: Dict[str, InvoiceTracker] = {}
        all_transactions = []

        # Fetch all advance payments for this vendor
        advance_payments = list(advance_collection.find({"vendorName": vendor_name}))
        
        # Fetch all debit notes for this vendor
        debit_notes = list(debit_collection.find({"vendorName": vendor_name}))
        
        # Fetch all invoices and create trackers
        outgoing_payments = list(outgoing_collection.find({"vendorName": vendor_name}))
        # Sort outgoing by invoice date for consistent processing
        outgoing_payments.sort(key=lambda p: parse_date_safely(p.get("invoiceDate") or p.get("grnDate") or p.get("createdDate")))

        for payment in outgoing_payments:
            invoice_no = payment.get("invoiceNo", f"NO_INVOICE_{payment.get('randomId', '')}")
            payable_amount = payment.get("originalTotalPayableAmount", payment.get("payableAmount", 0.0))
            invoice_date = parse_date_safely(payment.get("invoiceDate") or payment.get("grnDate") or payment.get("createdDate"))
            if payable_amount > 0 and invoice_no not in invoice_trackers:
                invoice_trackers[invoice_no] = InvoiceTracker(
                    invoice_no=invoice_no,
                    payable_amount=payable_amount,
                    invoice_date=invoice_date
                )

        # Track which advances/debit notes get applied to invoices
        advance_application_info = {}  # {advance_id: {'applied_date': date, 'amount': amount}}
        debit_note_application_info = {}  # {debit_id: {'applied_date': date, 'amount': amount}}

        # First, identify all advances and debit notes that get applied to invoices and when
        for payment in outgoing_payments:
            payment_history = payment.get("paymentHistory", [])
            for hist_entry in payment_history:
                application_date = parse_date_safely(hist_entry.get("date"))
                
                # Track applied advances
                applied_adv_ids = hist_entry.get("advancePaymentsApplied", [])
                applied_advance_amount = hist_entry.get("advanceAmount", 0.0)
                for advance_id in applied_adv_ids:
                    if applied_advance_amount > 0:
                        advance_application_info[advance_id] = {
                            'applied_date': application_date,
                            'amount': applied_advance_amount
                        }
                
                # Track applied debit notes
                applied_debit_ids = hist_entry.get("debitNotesApplied", [])
                applied_debit_amount = hist_entry.get("debitAmount", 0.0)
                for debit_id in applied_debit_ids:
                    if applied_debit_amount > 0:
                        debit_note_application_info[debit_id] = {
                            'applied_date': application_date,
                            'amount': applied_debit_amount
                        }

        # Process transactions in chronological order
        transaction_events = []

        # 1. Add advance payment events - ONLY for non-applied advances
        for advance in advance_payments:
            advance_id = advance.get("randomId")
            advance_amount = advance.get("amount", advance.get("advanceAmount", 0.0))
            advance_date = parse_date_safely(advance.get("createdDate"))
            
            if advance_amount > 0 and advance_date:
                application_info = advance_application_info.get(advance_id)
                
                if application_info:
                    # This advance was applied - ONLY show the applied event later
                    # Don't show standalone advance event to avoid double counting
                    pass
                else:
                    # This advance is still OPEN/ACTIVE - show as standalone
                    transaction_events.append({
                        'date': advance_date,
                        'type': 'advance_payment',
                        'advance_doc': advance,
                        'amount': advance_amount,
                        'is_credit': False,  # This is DEBIT (we pay vendor)
                        'status': 'Open'  # Active and available
                    })

        # 2. Add debit note events - ONLY for non-applied debit notes
        for debit_note in debit_notes:
            debit_id = debit_note.get("randomId")
            debit_amount = debit_note.get("finalAmount", debit_note.get("debitAmount", 0.0))
            debit_date = parse_date_safely(debit_note.get("createdDate") or debit_note.get("returnDate"))
            
            if debit_amount > 0 and debit_date:
                application_info = debit_note_application_info.get(debit_id)
                
                if application_info:
                    # This debit note was applied - ONLY show the applied event later
                    # Don't show standalone debit note event to avoid double counting
                    pass
                else:
                    # This debit note is still OPEN/ACTIVE - show as standalone
                    transaction_events.append({
                        'date': debit_date,
                        'type': 'debit_note',
                        'debit_doc': debit_note,
                        'amount': debit_amount,
                        'is_credit': False,  # This is DEBIT (we owe vendor)
                        'status': 'Open'  # Active and available
                    })

        # 3. Add invoice events (CREDIT - vendor provides goods/services)
        for invoice_no, tracker in invoice_trackers.items():
            transaction_events.append({
                'date': tracker.invoice_date,
                'type': 'invoice_created',
                'invoice_no': invoice_no,
                'tracker': tracker,
                'amount': tracker.original_payable,
                'is_credit': True,  # This is CREDIT (vendor provides goods/services)
                'status': 'Open'
            })

        # 4. Add payment events (DEBIT - we pay vendor)
        for payment in outgoing_payments:
            invoice_no = payment.get("invoiceNo", "N/A")
            payment_history = payment.get("paymentHistory", [])
            payment_id = payment.get("randomId", "")
            for hist_entry in payment_history:
                hist_date_str = hist_entry.get("date")
                hist_date = parse_date_safely(hist_date_str)
                hist_amount = hist_entry.get("amount", 0.0)
                if hist_amount > 0 and hist_date:
                    # Add cash/bank payment event
                    transaction_events.append({
                        'date': hist_date,
                        'type': 'invoice_payment',
                        'history_entry': hist_entry,
                        'invoice_no': invoice_no,
                        'amount': hist_amount,
                        'is_credit': False,  # This is DEBIT (we pay vendor)
                        'payment_id': payment_id,
                        'status': 'Cleared'
                    })
                # Add advance applied event if any
                advance_amount = hist_entry.get("advanceAmount", 0.0)
                if advance_amount > 0 and hist_date:
                    transaction_events.append({
                        'date': hist_date,
                        'type': 'advance_applied',
                        'history_entry': hist_entry,
                        'invoice_no': invoice_no,
                        'amount': advance_amount,
                        'is_credit': False,  # This is DEBIT (we use advance to pay)
                        'payment_id': payment_id,
                        'status': 'Cleared'
                    })
                # Add debit applied event if any
                debit_amount = hist_entry.get("debitAmount", 0.0)
                if debit_amount > 0 and hist_date:
                    transaction_events.append({
                        'date': hist_date,
                        'type': 'debit_applied',
                        'history_entry': hist_entry,
                        'invoice_no': invoice_no,
                        'amount': debit_amount,
                        'is_credit': False,  # This is DEBIT (we use debit note to pay)
                        'payment_id': payment_id,
                        'status': 'Cleared'
                    })

        # Custom sort rule: by date
        def event_sort_key(event):
            dt = event['date'] or datetime.min.replace(tzinfo=IST)
            return dt

        transaction_events.sort(key=event_sort_key)

        # Compute final remaining payable for each invoice tracker (all-time)
        for tracker in invoice_trackers.values():
            tracker.remaining_payable = tracker.original_payable
            
        # Track utilization of advances and debit notes for summary
        advance_utilization = {}  # {advance_id: amount_used}
        debit_note_utilization = {}  # {debit_id: amount_used}
        
        for event in transaction_events:
            if event['type'] in ['advance_applied', 'debit_applied']:
                amount = event['amount']
                
                if event['type'] == 'advance_applied':
                    applied_adv_ids = event['history_entry'].get("advancePaymentsApplied", [])
                    # Distribute amount among applied advances (if multiple)
                    per_advance_amount = amount / len(applied_adv_ids) if applied_adv_ids else amount
                    for adv_id in applied_adv_ids:
                        advance_utilization[adv_id] = advance_utilization.get(adv_id, 0) + per_advance_amount
                
                elif event['type'] == 'debit_applied':
                    applied_debit_ids = event['history_entry'].get("debitNotesApplied", [])
                    # Distribute amount among applied debit notes (if multiple)
                    per_debit_amount = amount / len(applied_debit_ids) if applied_debit_ids else amount
                    for debit_id in applied_debit_ids:
                        debit_note_utilization[debit_id] = debit_note_utilization.get(debit_id, 0) + per_debit_amount

        # Initialize all-time totals
        total_invoices = 0.0
        total_payments = 0.0
        total_debit_notes = 0.0
        total_advances = 0.0
        total_active_advances = 0.0
        total_active_debit_notes = 0.0
        
        # FIX: Use the calculated opening balance
        balance_before_start = initial_opening_balance
        logger.info(f"Starting balance calculation with: {balance_before_start}")

        # Process events before start date to accumulate totals
        for event in transaction_events:
            event_date = event['date']
            if not event_date:
                continue

            if event_date < start_datetime:
                # Accumulate totals for transactions before start date
                if event['type'] == 'invoice_created':
                    total_invoices += event['amount']
                elif event['type'] == 'invoice_payment':
                    total_payments += event['amount']
                elif event['type'] == 'advance_applied':
                    total_advances += event['amount']
                elif event['type'] == 'debit_applied':
                    total_debit_notes += event['amount']
                elif event['type'] == 'advance_payment':
                    total_advances += event['amount']
                elif event['type'] == 'debit_note':
                    total_debit_notes += event['amount']

        # Reset running balance for the period - use the calculated opening balance
        running_balance = balance_before_start
        logger.info(f"Running balance at period start: {running_balance}")

        # Process events for the selected period
        opening_added = False
        for event in transaction_events:
            event_date = event['date']
            if not event_date:
                continue

            # Skip events before start date (already processed in opening balance calculation)
            if event_date < start_datetime:
                continue

            # Skip events after end date for transaction list (but accumulate for final balance)
            if event_date > end_datetime:
                # Accumulate all-time totals but don't add to transactions
                if event['type'] == 'invoice_created':
                    total_invoices += event['amount']
                elif event['type'] == 'invoice_payment':
                    total_payments += event['amount']
                elif event['type'] == 'advance_applied':
                    total_advances += event['amount']
                elif event['type'] == 'debit_applied':
                    total_debit_notes += event['amount']
                elif event['type'] == 'advance_payment':
                    total_advances += event['amount']
                elif event['type'] == 'debit_note':
                    total_debit_notes += event['amount']
                
                # Update running balance for events after end date
                if event['is_credit']:
                    running_balance += event['amount']
                else:
                    running_balance -= event['amount']
                continue

            # In range: apply and add transaction
            if not opening_added:
                # Add opening balance transaction showing balance at start date
                opening_date = start_datetime
                all_transactions.append(TransactionDetail(
                    date=opening_date,
                    type="opening_balance",
                    reference_id="OPENING",
                    description="Opening Balance",
                    debit_amount=abs(balance_before_start) if balance_before_start < 0 else 0.0,
                    credit_amount=abs(balance_before_start) if balance_before_start > 0 else 0.0,
                    balance=round(balance_before_start, 2),
                    status="N/A",
                    formatted_date=format_datetime_with_time(opening_date)
                ))
                opening_added = True
                logger.info(f"Added opening balance: {balance_before_start}")

            # Apply the transaction
            old_balance = running_balance
            if event['is_credit']:
                running_balance += event['amount']  # CREDIT increases balance (we owe vendor)
            else:
                running_balance -= event['amount']  # DEBIT decreases balance (vendor owes us)
            
            logger.info(f"Transaction: {event['type']} {event['amount']} | Balance: {old_balance} -> {running_balance}")

            # Accumulate totals
            if event['type'] == 'invoice_created':
                total_invoices += event['amount']
            elif event['type'] == 'invoice_payment':
                total_payments += event['amount']
            elif event['type'] == 'advance_applied':
                total_advances += event['amount']
            elif event['type'] == 'debit_applied':
                total_debit_notes += event['amount']
            elif event['type'] == 'advance_payment':
                total_advances += event['amount']
                # Track active advances for summary
                advance_id = event['advance_doc'].get('randomId')
                amount_used = advance_utilization.get(advance_id, 0)
                unused_amount = event['amount'] - amount_used
                if unused_amount > 0:
                    total_active_advances += unused_amount
            elif event['type'] == 'debit_note':
                total_debit_notes += event['amount']
                # Track active debit notes for summary
                debit_id = event['debit_doc'].get('randomId')
                amount_used = debit_note_utilization.get(debit_id, 0)
                unused_amount = event['amount'] - amount_used
                if unused_amount > 0:
                    total_active_debit_notes += unused_amount

            # Create transaction record
            if event['type'] == 'invoice_created':
                tracker = event['tracker']
                current_status = "Closed" if tracker.remaining_payable <= 0 else "Open"
                transaction = TransactionDetail(
                    date=event['date'],
                    type="invoice",
                    reference_id=tracker.invoice_no,
                    description=f"Bill No. {tracker.invoice_no}",
                    debit_amount=0.0,
                    credit_amount=event['amount'],  # CREDIT amount (we owe vendor)
                    balance=round(running_balance, 2),
                    status=current_status,
                    formatted_date=format_datetime_with_time(event['date'])
                )
                all_transactions.append(transaction)

            elif event['type'] == 'invoice_payment':
                hist_entry = event['history_entry']
                description = f"Payment - {hist_entry.get('paymentMode', 'Unknown')} Against Invoice: {event['invoice_no']}"
                transaction = TransactionDetail(
                    date=event['date'],
                    type="payment",
                    reference_id=event.get('payment_id', ""),
                    description=description,
                    debit_amount=event['amount'],  # DEBIT amount (we pay vendor)
                    credit_amount=0.0,
                    balance=round(running_balance, 2),
                    status="Cleared",
                    payment_method=hist_entry.get("paymentMethod", ""),
                    notes=f"Against Invoice: {event['invoice_no']}",
                    formatted_date=format_datetime_with_time(event['date'])
                )
                all_transactions.append(transaction)

            elif event['type'] == 'advance_applied':
                hist_entry = event['history_entry']
                applied_adv_ids = hist_entry.get("advancePaymentsApplied", [])
                remarks = "Advance payment applied"
                if applied_adv_ids:
                    first_adv_id = applied_adv_ids[0]
                    adv_doc = advance_collection.find_one({"randomId": first_adv_id})
                    if adv_doc:
                        remarks = adv_doc.get("remarks", "Advance payment applied")
                description = f"Advance Payment Applied - {remarks}"
                transaction = TransactionDetail(
                    date=event['date'],
                    type="advance_payment",
                    reference_id="ADV_APPLIED",
                    description=description,
                    debit_amount=event['amount'],  # DEBIT amount (we use advance to pay)
                    credit_amount=0.0,
                    balance=round(running_balance, 2),
                    status="Cleared",
                    payment_method="",  
                    notes=f"Against Invoice: {event['invoice_no']}",
                    formatted_date=format_datetime_with_time(event['date'])
                )
                all_transactions.append(transaction)

            elif event['type'] == 'debit_applied':
                hist_entry = event['history_entry']
                applied_debit_ids = hist_entry.get("debitNotesApplied", [])
                note_id = applied_debit_ids[0] if applied_debit_ids else "NOTE"
                description = f"Debit Note Applied - {note_id} to Invoice: {event['invoice_no']}"
                transaction = TransactionDetail(
                    date=event['date'],
                    type="debit_note",
                    reference_id=note_id,
                    description=description,
                    debit_amount=event['amount'],  # DEBIT amount (we use debit note to pay)
                    credit_amount=0.0,
                    balance=round(running_balance, 2),
                    status="Cleared",
                    notes=f"Applied to Invoice: {event['invoice_no']}",
                    formatted_date=format_datetime_with_time(event['date'])
                )
                all_transactions.append(transaction)

            elif event['type'] == 'advance_payment':
                advance_doc = event['advance_doc']
                advance_id = advance_doc.get('randomId', '')
                original_status = event['status']
                
                # Determine display status based on utilization
                amount_used = advance_utilization.get(advance_id, 0)
                if amount_used >= event['amount']:  # Fully utilized
                    display_status = "Cleared"
                    notes = "Advance fully utilized"
                elif amount_used > 0:  # Partially utilized
                    display_status = "Partially Applied"
                    notes = f"Advance partially used ({amount_used:.2f} of {event['amount']:.2f})"
                else:  # Not utilized
                    display_status = original_status
                    notes = "Advance available for application"
                
                description = f"Advance Payment - {advance_doc.get('remarks', 'Advance payment')}"
                transaction = TransactionDetail(
                    date=event['date'],
                    type="advance_payment",
                    reference_id=advance_id,
                    description=description,
                    debit_amount=event['amount'],  # DEBIT amount (we pay vendor)
                    credit_amount=0.0,
                    balance=round(running_balance, 2),
                    status=display_status,
                    payment_method=advance_doc.get("paymentMethod", ""),
                    notes=notes,
                    formatted_date=format_datetime_with_time(event['date'])
                )
                all_transactions.append(transaction)

            elif event['type'] == 'debit_note':
                debit_doc = event['debit_doc']
                debit_id = debit_doc.get('randomId', '')
                original_status = event['status']
                
                # Determine display status based on utilization
                amount_used = debit_note_utilization.get(debit_id, 0)
                if amount_used >= event['amount']:  # Fully utilized
                    display_status = "Cleared"
                    notes = "Debit note fully utilized"
                elif amount_used > 0:  # Partially utilized
                    display_status = "Partially Applied"
                    notes = f"Debit note partially used ({amount_used:.2f} of {event['amount']:.2f})"
                else:  # Not utilized
                    display_status = original_status
                    notes = "Debit note available for application"
                
                description = f"Debit Note - {debit_doc.get('remarks', 'Debit note')}"
                transaction = TransactionDetail(
                    date=event['date'],
                    type="debit_note",
                    reference_id=debit_id,
                    description=description,
                    debit_amount=event['amount'],  # DEBIT amount (we owe vendor for returns)
                    credit_amount=0.0,
                    balance=round(running_balance, 2),
                    status=display_status,
                    notes=notes,
                    formatted_date=format_datetime_with_time(event['date'])
                )
                all_transactions.append(transaction)

        # If no events in period, still add opening balance
        if not opening_added:
            opening_date = start_datetime
            all_transactions.append(TransactionDetail(
                date=opening_date,
                type="opening_balance",
                reference_id="OPENING",
                description="Opening Balance",
                debit_amount=abs(balance_before_start) if balance_before_start < 0 else 0.0,
                credit_amount=abs(balance_before_start) if balance_before_start > 0 else 0.0,
                balance=round(balance_before_start, 2),
                status="N/A",
                formatted_date=format_datetime_with_time(opening_date)
            ))

        # Final balance is the running balance after processing all transactions
        final_balance_all = running_balance

        # FIX: Ensure final balance is zero if all invoices are paid
        if abs(final_balance_all) < 0.01:  # Allow for floating point precision
            final_balance_all = 0.0
            logger.info("Final balance adjusted to 0.0")

        # All-time metrics
        total_available_credits = total_active_advances + total_active_debit_notes
        total_credit_all = total_invoices
        total_debit_all = total_payments + total_debit_notes + total_advances
        # Outstanding amount is what we need to pay to vendor (positive balance)
        outstanding_amount_all = final_balance_all if final_balance_all > 0 else 0

        last_transaction_date = max([t.date for t in all_transactions]) if all_transactions else None

        logger.info(f"Ledger generated for {vendor_name}: Opening Balance={balance_before_start}, Final Balance={final_balance_all}")

        return VendorLedgerResponse(
            vendorId=vendor_id,
            vendorName=vendor_name,
            totalPayableAmount=round(total_invoices, 2),
            totalPaidAmount=round(total_payments + total_debit_notes + total_advances, 2),
            totalDebitAmount=round(total_debit_all, 2),
            totalCreditAmount=round(total_credit_all, 2),
            outstandingAmount=round(outstanding_amount_all, 2),
            openingBalance=balance_before_start,
            invoices=[],
            transactions=all_transactions,
            lastTransactionDate=last_transaction_date,
            totalActiveAdvances=round(total_active_advances, 2),
            totalActiveDebitNotes=round(total_active_debit_notes, 2),
            totalAvailableCredits=round(total_available_credits, 2)
        )
    except Exception as e:
        logger.error(f"Error generating ledger for {vendor_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating ledger: {str(e)}")