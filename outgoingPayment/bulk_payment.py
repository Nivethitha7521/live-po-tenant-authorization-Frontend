# Full updated bulk_payment.py
import logging
from bson import ObjectId
from fastapi import APIRouter, HTTPException,Depends,Request
from fastapi.responses import JSONResponse
from typing import List
from datetime import datetime, date
import pytz
import pymongo
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from utils.database import get_vendor_collection
from utils.database import get_debit_collection
from outgoingPayment.bulkpayment_models import BulkPaymentRequest, BulkPaymentResponse, PaymentResult
from utils.database import get_advancepayment_collection, get_outgoingpayment_collection,get_apinvoice_collection

# Define IST timezone
IST = pytz.timezone('Asia/Kolkata')

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_payment_random_id(tenant_id: str):
    """
    Generates the next sequential Payment ID in the format PV0001, PV0002, etc.
    Uses a counter to maintain continuity across single and bulk operations.
    """
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    counter_collection = outgoing_collection.database["counters"]
    counter = counter_collection.find_one_and_update(
        {"_id": "paymentId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    payment_id = f"PV{counter['sequence_value']:04d}"
    return payment_id

def update_ap_invoice_status(tenant_id: str,ap_invoice_id: str, outgoing_status: str, payment_date: datetime):
    """Update AP invoice status to match outgoing payment status exactly"""
    try:
        apinvoice_collection = get_apinvoice_collection(tenant_id)
        if apinvoice_collection is None:  # FIXED: Compare with None explicitly
            logger.error("AP invoice collection not available")
            return False
        
        # Use the exact same status as outgoing payment
        new_ap_status = outgoing_status
        
        # Prepare update data
        update_data = {
            "status": new_ap_status,
            "lastUpdatedDate": payment_date
        }
        
        # Set payment date for fully paid/paid status
        if new_ap_status in ["Fully Paid", "Paid", "Completed"]:
            update_data["paymentDate"] = payment_date
        
        result = apinvoice_collection.update_one(
            {"_id": ObjectId(ap_invoice_id)},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated AP invoice {ap_invoice_id} status to match outgoing: {outgoing_status}")
            return True
        else:
            logger.warning(f"No AP invoice found with ID: {ap_invoice_id} or no changes made")
            return False
            
    except Exception as e:
        logger.error(f"Error updating AP invoice status: {str(e)}")
        return False

def update_ap_invoice_payment_details(tenant_id:str,ap_invoice_id: str, payment_amount: float, total_payable: float, payment_date: datetime, outgoing_status: str):
    """Update AP invoice payment details while maintaining the same status as outgoing"""
    try:
        apinvoice_collection = get_apinvoice_collection(tenant_id)
        if apinvoice_collection is None:  # FIXED: Compare with None explicitly
            logger.error("AP invoice collection not available")
            return False
        
        # Get current AP invoice
        ap_invoice = apinvoice_collection.find_one({"_id": ObjectId(ap_invoice_id)})
        if not ap_invoice:
            logger.warning(f"AP invoice {ap_invoice_id} not found")
            return False
        
        # Calculate payment details
        current_paid = ap_invoice.get("paidAmount", 0.0)
        new_paid_amount = current_paid + payment_amount
        invoice_total = ap_invoice.get("totalAmount", total_payable)
        
        # Calculate paid percentage (for information only, not for status)
        paid_percentage = round((new_paid_amount / invoice_total) * 100, 2) if invoice_total > 0 else 0
        
        # Use the exact same status as outgoing payment
        new_ap_status = outgoing_status
        
        update_data = {
            "paidAmount": round(new_paid_amount, 2),
            "pendingAmount": round(max(0, invoice_total - new_paid_amount), 2),
            "paidPercentage": paid_percentage,
            "status": new_ap_status,  # Exact same status as outgoing
            "lastUpdatedDate": payment_date
        }
        
        # Set payment date for paid statuses
        if new_ap_status in ["Fully Paid", "Paid", "Completed"]:
            update_data["paymentDate"] = payment_date
        
        result = apinvoice_collection.update_one(
            {"_id": ObjectId(ap_invoice_id)},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated AP invoice {ap_invoice_id}: status={new_ap_status}, paid={new_paid_amount}/{invoice_total} ({paid_percentage}%)")
            return True
        else:
            logger.warning(f"No changes made to AP invoice {ap_invoice_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating AP invoice payment details: {str(e)}")
        return False

@router.patch("/bulk/bulk-payment", response_model=BulkPaymentResponse)
async def process_bulk_payments( request: Request,bulk_payment: BulkPaymentRequest,user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp", "outgoingpayment", "read")
    )): 
    tenant_id = request.state.tenant_id
    """ 
    Process multiple outgoing payments in a single transaction
    Handles advance payments, debit notes, and vendor balance updates
    """
    logger.info(f"Starting bulk payment processing for {len(bulk_payment.outgoingIds)} outgoing payments")

    # Validate input lengths
    if len(bulk_payment.payments) != len(bulk_payment.outgoingIds):
        logger.error(f"Mismatch between payments ({len(bulk_payment.payments)}) and outgoing IDs ({len(bulk_payment.outgoingIds)})")
        raise HTTPException(status_code=400, detail="Number of payments must match number of outgoing IDs")

    # Generate a single shared Payment ID for this entire bulk operation
    generated_payment_id = generate_payment_random_id(tenant_id)
    logger.info(f"Generated shared payment ID for bulk operation: {generated_payment_id}")

    # Get database collections
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    debit_collection = get_debit_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    advance_collection = get_advancepayment_collection(tenant_id)
    apinvoice_collection = get_apinvoice_collection(tenant_id)

    # FIXED: Compare each collection with None explicitly
    if (outgoing_collection is None or debit_collection is None or 
        vendor_collection is None or advance_collection is None or 
        apinvoice_collection is None):
        logger.error("One or more database collections are unavailable")
        raise HTTPException(status_code=500, detail="Database connection error")

    # Handle paymentDate as date (Pydantic parses input string to date automatically)
    if bulk_payment.paymentDate:
        payment_date_obj = bulk_payment.paymentDate  # Already a date object
        # Get current time in IST to preserve timezone awareness
        ist_now = datetime.now(IST)
        current_time = ist_now.time()
        # Combine and attach IST timezone info
        payment_datetime = datetime.combine(payment_date_obj, current_time).replace(tzinfo=IST)
        logger.info(f"Using provided payment date: {payment_date_obj} with current IST time")
    else:
        # Use current datetime in IST
        payment_datetime = datetime.now(IST)
        logger.info(f"Using current IST datetime: {payment_datetime}")

    results = []
    errors = []
    
    # Batch operations for efficiency
    outgoing_updates = []
    debit_updates = []
    advance_updates = []
    vendor_updates = {}

    # Track vendor totals for final update
    vendor_totals = {}

    # Process each payment
    for i, (payment_info, outgoing_id) in enumerate(zip(bulk_payment.payments, bulk_payment.outgoingIds)):
        try:
            logger.info(f"Processing payment {i+1} for outgoing ID: {outgoing_id}")

            # Validate outgoing ID
            if not isinstance(outgoing_id, str) or not outgoing_id.strip():
                errors.append({"outgoingId": outgoing_id, "error": "Invalid or empty outgoing ID"})
                logger.error(f"Invalid or empty outgoing ID: {outgoing_id}")
                continue

            outgoing_id = outgoing_id.strip()

            # Validate ObjectId format
            if not ObjectId.is_valid(outgoing_id):
                errors.append({"outgoingId": outgoing_id, "error": "Invalid outgoing ID format"})
                logger.error(f"Invalid ObjectId format: {outgoing_id}")
                continue

            # Get outgoing document
            outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
            if not outgoing:
                errors.append({"outgoingId": outgoing_id, "error": "Outgoing payment not found"})
                logger.error(f"No outgoing found for _id: {outgoing_id}")
                continue

            vendor_name = outgoing.get("vendorName")
            if not vendor_name:
                errors.append({"outgoingId": outgoing_id, "error": "Vendor name not found in outgoing document"})
                logger.error(f"Vendor name not found for outgoing ID: {outgoing_id}")
                continue

            # Get AP invoice ID from outgoing for status update
            ap_invoice_id = outgoing.get("invoiceId")
            if not ap_invoice_id:
                logger.warning(f"No AP invoice ID found in outgoing document {outgoing_id}")
            else:
                logger.info(f"Found AP invoice ID: {ap_invoice_id} for outgoing {outgoing_id}")
                
                # Verify AP invoice exists
                ap_invoice = apinvoice_collection.find_one({"_id": ObjectId(ap_invoice_id)})
                if not ap_invoice:
                    logger.error(f"AP invoice with ID {ap_invoice_id} not found in database")
                else:
                    logger.info(f"AP invoice found: {ap_invoice.get('randomId', 'N/A')}, current status: {ap_invoice.get('status', 'N/A')}")

            # Initialize vendor tracking
            if vendor_name not in vendor_totals:
                vendor = vendor_collection.find_one({"vendorName": vendor_name})
                vendor_totals[vendor_name] = {
                    'current_payable': float(vendor.get('payableAmount', 0.0)) if vendor else 0.0,
                    'total_reduction': 0.0
                }

            # Get current amounts
            original_total_payable = outgoing.get("originalTotalPayableAmount", outgoing.get("totalPayableAmount", 0))
            current_total_payable = float(outgoing.get("totalPayableAmount", 0))
            current_paid_amount = float(outgoing.get("paidAmount", 0))
            current_total_debit = float(outgoing.get("debitAmount", 0))
            current_advance = float(outgoing.get("advanceAmount", 0.0))
            payment_history = outgoing.get("paymentHistory", [])

            if "originalTotalPayableAmount" not in outgoing:
                original_total_payable = current_total_payable

            # Calculate effective payment amount
            effective_payment_amount = (
                payment_info.fullPaymentAmount
                if payment_info.paymentType == "full"
                else payment_info.partialAmount
                if payment_info.paymentType == "partial"
                else 0
            )
            
            if effective_payment_amount < 0:
                errors.append({"outgoingId": outgoing_id, "error": "Payment amount cannot be negative"})
                continue
            if effective_payment_amount > current_total_payable:
                errors.append({"outgoingId": outgoing_id, "error": f"Payment amount {effective_payment_amount} exceeds payable {current_total_payable}"})
                continue

            logger.info(f"Outgoing {outgoing_id}: payable={current_total_payable}, payment={effective_payment_amount}")

            # Temporary remaining for debit/advance allocation
            temp_remaining = round(current_total_payable - effective_payment_amount, 2)
            if temp_remaining < 0:
                errors.append({"outgoingId": outgoing_id, "error": "Payment exceeds remaining payable amount"})
                continue

            # Process debit notes
            current_debit_amount = 0.0
            applied_debit_notes = []
            
            if payment_info.selectedDebitNotes:
                logger.info(f"Processing {len(payment_info.selectedDebitNotes)} debit notes for {outgoing_id}")
                
                for debit_note_id in payment_info.selectedDebitNotes:
                    debit_note = debit_collection.find_one({"randomId": debit_note_id})
                    if not debit_note:
                        errors.append({"outgoingId": outgoing_id, "debitNoteId": debit_note_id, "error": "Debit note not found"})
                        continue
                    
                    if debit_note.get("status") == "Cleared":
                        errors.append({"outgoingId": outgoing_id, "debitNoteId": debit_note_id, "error": "Debit note already cleared"})
                        continue
                    
                    if debit_note.get("vendorName") != vendor_name:
                        errors.append({"outgoingId": outgoing_id, "debitNoteId": debit_note_id, "error": "Debit note does not belong to vendor"})
                        continue

                    # Calculate available debit amount
                    pending = debit_note.get("pendingAmount", debit_note.get("finalAmount", 0))
                    used = min(float(pending), temp_remaining)
                    
                    if used > 0:
                        current_debit_amount += used
                        temp_remaining -= used
                        applied_debit_notes.append(debit_note_id)
                        
                        new_pending = round(float(pending) - used, 2)
                        new_status = "Cleared" if new_pending <= 0 else "Partially Cleared"
                        
                        # Prepare debit note update
                        debit_update = {
                            "filter": {"randomId": debit_note_id},
                            "update": {
                                "$set": {
                                    "pendingAmount": new_pending,
                                    "status": new_status,
                                    "lastUpdatedDate": payment_datetime
                                },
                                "$push": {
                                    "paymentHistory": {
                                        "amount": round(used, 2),
                                        "paymentDate": payment_datetime,
                                        "paymentMethod": "debit",
                                        "paymentMode": "Debit",
                                        "remarks": f"Used {used} in outgoing payment {outgoing_id}"
                                    }
                                }
                            }
                        }
                        
                        if new_status == "Cleared":
                            debit_update["update"]["$set"].update({
                                "clearedBy": "System",
                                "clearedDate": payment_datetime,
                                "clearedAgainstOutgoing": outgoing_id
                            })
                        
                        debit_updates.append(debit_update)
                        logger.info(f"Applied debit note {debit_note_id}: {used} used")

            current_debit_amount = round(current_debit_amount, 2)

            # Process advance payments
            current_advance_amount = 0.0
            applied_advance_payments = []
            
            if payment_info.selectedAdvancePayments:
                logger.info(f"Processing {len(payment_info.selectedAdvancePayments)} advance payments for {outgoing_id}")
                
                for advance_id in payment_info.selectedAdvancePayments:
                    advance = advance_collection.find_one({"randomId": advance_id})
                    if not advance:
                        errors.append({"outgoingId": outgoing_id, "advanceId": advance_id, "error": "Advance payment not found"})
                        continue
                    
                    if advance.get("status") == "Completed":
                        errors.append({"outgoingId": outgoing_id, "advanceId": advance_id, "error": "Advance payment already completed"})
                        continue
                    
                    if advance.get("vendorName") != vendor_name:
                        errors.append({"outgoingId": outgoing_id, "advanceId": advance_id, "error": "Advance payment does not belong to vendor"})
                        continue

                    # Calculate available advance amount
                    pending = advance.get("pendingAmount", 0)
                    used = min(float(pending), temp_remaining)
                    
                    if used > 0:
                        current_advance_amount += used
                        temp_remaining -= used
                        applied_advance_payments.append(advance_id)
                        
                        new_pending = round(float(pending) - used, 2)
                        new_status = "Completed" if new_pending <= 0 else "Partially Cleared"
                        
                        # Prepare advance update
                        advance_update = {
                            "filter": {"randomId": advance_id},
                            "update": {
                                "$set": {
                                    "pendingAmount": new_pending,
                                    "status": new_status,
                                    "lastUpdatedDate": payment_datetime
                                },
                                "$push": {
                                    "paymentHistory": {
                                        "amount": round(used, 2),
                                        "paymentDate": payment_datetime,
                                        "paymentMethod": "advance",
                                        "paymentMode": "Advance", 
                                        "remarks": f"Used {used} in outgoing payment {outgoing_id}"
                                    }
                                }
                            }
                        }
                        
                        if new_status == "Completed":
                            advance_update["update"]["$set"].update({
                                "completedBy": "System",
                                "completedDate": payment_datetime,
                                "completedAgainstOutgoing": outgoing_id
                            })
                        
                        advance_updates.append(advance_update)
                        logger.info(f"Applied advance {advance_id}: {used} used")

            current_advance_amount = round(current_advance_amount, 2)

            # Calculate new amounts
            new_advance = current_advance + current_advance_amount
            new_paid_amount = current_paid_amount + effective_payment_amount
            new_total_debit = current_total_debit + current_debit_amount
            new_total_payable = current_total_payable - effective_payment_amount - current_debit_amount - current_advance_amount

            # Determine status
            if abs(new_total_payable) < 0.01:  # Fully paid
                new_status = "Fully Paid"
                new_total_payable = 0.0
            elif effective_payment_amount > 0 or current_debit_amount > 0 or current_advance_amount > 0:
                new_status = "Partially Paid"
            else:
                new_status = outgoing.get("status", "Pending")

            # Prepare outgoing update data
            update_data = {
                "originalTotalPayableAmount": original_total_payable,
                "totalPayableAmount": round(new_total_payable, 2),
                "paidAmount": round(new_paid_amount, 2),
                "debitAmount": round(new_total_debit, 2),
                "advanceAmount": round(new_advance, 2),
                "hasDebitCreditNotes": outgoing.get("hasDebitCreditNotes", False) or bool(applied_debit_notes) or bool(applied_advance_payments),
                "paymentType": payment_info.paymentType,
                "paymentMode": payment_info.paymentMode,
                "paymentId": generated_payment_id,  # Set shared PaymentID field in outgoing document
                "status": new_status,
                "lastUpdatedDate": payment_datetime,
                "paymentDate": payment_datetime,
                "bankName": "",
                "neftNo": "",
                "rtgsNo": "",
                "impsNo": "",
                "upi": "",
                "cashAmount": 0.0,
            }

            # Set payment method
            update_data["paymentMethod"] = payment_info.paymentMethod

            # Add payment mode specific fields
            if payment_info.paymentMode == "Bank":
                if payment_info.paymentMethod not in ["neft", "rtgs", "imps", "upi"]:
                    errors.append({"outgoingId": outgoing_id, "error": "Invalid bank payment method"})
                    continue

                # Set the appropriate reference field based on payment method
                if payment_info.paymentMethod == "neft":
                    update_data["neftNo"] = getattr(payment_info, 'neftNo', '') or ''
                elif payment_info.paymentMethod == "rtgs":
                    update_data["rtgsNo"] = getattr(payment_info, 'rtgsNo', '') or ''
                elif payment_info.paymentMethod == "imps":
                    update_data["impsNo"] = getattr(payment_info, 'impsNo', '') or ''
                elif payment_info.paymentMethod == "upi":
                    update_data["upi"] = getattr(payment_info, 'upi', '') or ''

                update_data["bankName"] = payment_info.bankName or ""
                update_data["cashAmount"] = 0.0

            elif payment_info.paymentMode == "Cash":
                if payment_info.paymentMethod != "cash":
                    errors.append({"outgoingId": outgoing_id, "error": "Payment method for Cash must be 'cash'"})
                    continue
                
                update_data["cashAmount"] = round(effective_payment_amount, 2)
                update_data["bankName"] = ""
            else:
                errors.append({"outgoingId": outgoing_id, "error": "Invalid payment mode"})
                continue

            # Prepare payment history entry
            new_payment_history_entry = {
                "amount": round(effective_payment_amount, 2),
                "paymentType": payment_info.paymentType,
                "paymentMethod": payment_info.paymentMethod,
                "paymentMode": payment_info.paymentMode,
                "cashAmount": update_data["cashAmount"],
                "bankName": update_data["bankName"],
                "impsNo": update_data["impsNo"],
                "neftNo": update_data["neftNo"],
                "rtgsNo": update_data["rtgsNo"],
                "upi": update_data["upi"],
                "date": payment_datetime,
                "debitNotesApplied": applied_debit_notes,
                "debitAmount": round(current_debit_amount, 2),
                "advanceAmount": round(current_advance_amount, 2),
                "advancePaymentsApplied": applied_advance_payments,
                "paymentId": generated_payment_id,  # Set shared PaymentID in history entry
            }

            # Queue outgoing update
            outgoing_updates.append({
                "filter": {"_id": ObjectId(outgoing_id)},
                "update": {
                    "$set": update_data,
                    "$push": {"paymentHistory": new_payment_history_entry},
                    "$addToSet": {
                        "selectedDebitNotes": {"$each": applied_debit_notes},
                        "selectedAdvancePayments": {"$each": applied_advance_payments}
                    }
                }
            })

            # UPDATE AP INVOICE STATUS TO MATCH OUTGOING EXACTLY
            ap_status_success = False
            ap_payment_success = False

            if ap_invoice_id:
                logger.info(f"Processing AP invoice updates for {ap_invoice_id} to match outgoing status: {new_status}")
                
                # Calculate total payment amount (cash only for AP invoice tracking)
                total_payment_for_ap = effective_payment_amount
                
                # Update AP invoice status to match outgoing exactly
                ap_status_success = update_ap_invoice_status(tenant_id,ap_invoice_id, new_status, payment_datetime)
                
                # Update AP invoice payment details with the same status
                ap_payment_success = update_ap_invoice_payment_details(
                    tenant_id,
                    ap_invoice_id, 
                    total_payment_for_ap, 
                    original_total_payable, 
                    payment_datetime,
                    new_status  # Pass the exact outgoing status
                )
                
                if ap_status_success and ap_payment_success:
                    logger.info(f"Successfully synchronized AP invoice {ap_invoice_id} status with outgoing: {new_status}")
                else:
                    logger.warning(f"Partial synchronization for AP invoice {ap_invoice_id} - status sync: {ap_status_success}, payment sync: {ap_payment_success}")

            # Calculate vendor reduction
            vendor_reduction = effective_payment_amount + current_debit_amount + current_advance_amount
            vendor_totals[vendor_name]['total_reduction'] += vendor_reduction

            # Add to results (pass date object for paymentDate)
            results.append(PaymentResult(
                outgoingId=outgoing_id,
                message=f"{payment_info.paymentMode} payment processed successfully",
                paymentId=generated_payment_id,  # Include shared PaymentID
                effectivePaymentAmount=round(effective_payment_amount, 2),
                debitAmount=round(current_debit_amount, 2),
                advanceAmount=round(current_advance_amount, 2),
                originalTotalPayableAmount=round(original_total_payable, 2),
                remainingPayableAmount=round(new_total_payable, 2),
                totalPaidAmount=round(new_paid_amount, 2),
                totalDebitAmount=round(new_total_debit, 2),
                status=new_status,
                vendorPayableReduction=round(vendor_reduction, 2),
                debitNotesApplied=applied_debit_notes,
                advancePaymentsApplied=applied_advance_payments,
                paymentDate=payment_datetime.date(),  # Extract date part for the model
                apInvoiceUpdates={
                    "invoiceId": ap_invoice_id,
                    "statusUpdated": ap_status_success,
                    "paymentDetailsUpdated": ap_payment_success,
                    "newApStatus": new_status  # Same status as outgoing
                } if ap_invoice_id else None
            ))

            logger.info(f"Successfully processed payment for outgoing {outgoing_id}")

        except Exception as e:
            logger.error(f"Error processing payment for {outgoing_id}: {str(e)}")
            errors.append({"outgoingId": outgoing_id, "error": str(e)})

    # Execute all bulk operations
    try:
        # Update outgoing payments
        if outgoing_updates:
            outgoing_ops = [
                pymongo.UpdateOne(update["filter"], update["update"]) 
                for update in outgoing_updates
            ]
            result = outgoing_collection.bulk_write(outgoing_ops, ordered=False)
            logger.info(f"Updated {result.modified_count} outgoing documents")

        # Update debit notes
        if debit_updates:
            debit_ops = [
                pymongo.UpdateOne(update["filter"], update["update"])
                for update in debit_updates
            ]
            result = debit_collection.bulk_write(debit_ops, ordered=False)
            logger.info(f"Updated {result.modified_count} debit notes")

        # Update advance payments
        if advance_updates:
            advance_ops = [
                pymongo.UpdateOne(update["filter"], update["update"])
                for update in advance_updates
            ]
            result = advance_collection.bulk_write(advance_ops, ordered=False)
            logger.info(f"Updated {result.modified_count} advance payments")

        # Update vendor payable amounts
        for vendor_name, totals in vendor_totals.items():
            if totals['total_reduction'] > 0:
                new_payable = max(0.0, totals['current_payable'] - totals['total_reduction'])
                vendor_collection.update_one(
                    {"vendorName": vendor_name},
                    {"$set": {
                        "payableAmount": round(new_payable, 2),
                        "updatedDate": payment_datetime
                    }}
                )
                logger.info(f"Updated vendor {vendor_name} payable: {totals['current_payable']} -> {new_payable}")

    except Exception as e:
        logger.error(f"Bulk operation error: {str(e)}")
        errors.append({"error": f"Database update failed: {str(e)}"})

    # Prepare response
    total_vendor_reduction = sum(totals['total_reduction'] for totals in vendor_totals.values())
    
    response = BulkPaymentResponse(
        results=results,
        errors=errors,
        totalProcessed=len(results),
        totalFailed=len(errors),
        totalVendorReduction=round(total_vendor_reduction, 2),
        paymentId=generated_payment_id  # Include shared PaymentID in response
    )

    logger.info(f"Bulk payment processing completed: {len(results)} successful, {len(errors)} failed")

    # Return 207 Multi-Status with response body
    return JSONResponse(
        status_code=207,
        content=response.model_dump(mode='json')  # Ensures serialization (Pydantic v2); dates serialize to 'YYYY-MM-DD'
    )