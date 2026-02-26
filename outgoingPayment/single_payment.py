from datetime import datetime
from http.client import HTTPException
import logging
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Path, HTTPException,Depends,Request
from pydantic import BaseModel, Field
import pytz
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from utils.database import get_advancepayment_collection, get_outgoingpayment_collection,get_apinvoice_collection,get_vendor_collection,get_debit_collection
from outgoingPayment.models import IST

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseModelWithConfig(BaseModel):
    """Base model with datetime configuration"""
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }
        validate_assignment = True
        allow_population_by_field_name = True

class UpdatePaymentRequest(BaseModelWithConfig):
    # Non-default (required) fields first
    paymentType: str
    totalPayableAmount: float
    paymentMethod: str
    paymentMode: str
    # Default fields follow
    fullPaymentAmount: float = 0
    partialAmount: float = 0
    cashAmount: float = 0
    chequeNo: Optional[str] = None
    upi: Optional[str] = None
    bankName: Optional[str] = None
    impsNo: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    selectedDebitNotes: List[str] = []
    selectedAdvancePayments: List[str] = []
    paymentDate: Optional[datetime] = Field(None, description="ISO format datetime")

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
            "paymentStatus": new_ap_status,
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

def update_ap_invoice_payment_details(tenant_id: str, ap_invoice_id: str, payment_amount: float, total_payable: float, payment_date: datetime, outgoing_status: str):
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
            "paymentStatus": new_ap_status,  # Exact same status as outgoing
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

@router.patch("/{outgoing_id}/payment")
async def update_outgoing_payment(request: Request,
    payment_info: UpdatePaymentRequest,
    outgoing_id: str = Path(..., description="The ID of the outgoing payment to update"),
     user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp", "outgoingpayment", "read"))
):
    tenant_id = request.state.tenant_id
    logger.info(f"Starting update_outgoing_payment for outgoing_id: {outgoing_id}")
    if not ObjectId.is_valid(outgoing_id):
        logger.error(f"Invalid ObjectId format: {outgoing_id}")
        raise HTTPException(status_code=400, detail="Invalid outgoing ID format")

    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    debit_collection = get_debit_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    advance_collection = get_advancepayment_collection(tenant_id)
    apinvoice_collection = get_apinvoice_collection(tenant_id)
    
    # FIXED: Compare each collection with None explicitly
    if (outgoing_collection is None or debit_collection is None or 
        vendor_collection is None or advance_collection is None or 
        apinvoice_collection is None):
        logger.error("One or more collections are None")
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        logger.info(f"Fetching outgoing with _id: {outgoing_id}")
        outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
        if not outgoing:
            logger.warning(f"No outgoing found for _id: {outgoing_id}")
            raise HTTPException(status_code=404, detail="Outgoing payment not found")

        # Generate unique payment ID for this single payment operation
        generated_payment_id = generate_payment_random_id(tenant_id)
        logger.info(f"Generated payment ID for single payment: {generated_payment_id}")

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

        # FIXED: Proper timezone handling for payment date
        if payment_info.paymentDate:
            # If the date has timezone info, convert to IST
            if payment_info.paymentDate.tzinfo is not None:
                current_datetime = payment_info.paymentDate.astimezone(IST)
            else:
                # If it's naive datetime, assume it's already in the correct date
                # and just add IST timezone without changing the date
                current_datetime = IST.localize(payment_info.paymentDate)
            
            logger.info(f"Using provided payment date: {payment_info.paymentDate} -> IST: {current_datetime}")
        else:
            # Default to current IST
            current_datetime = datetime.now(IST)
            logger.info(f"Using current date: {current_datetime}")

        # Extract current values
        original_total_payable = outgoing.get("originalTotalPayableAmount", outgoing.get("totalPayableAmount", 0))
        current_total_payable = outgoing.get("totalPayableAmount", 0)
        current_paid_amount = outgoing.get("paidAmount", 0)
        current_total_debit = outgoing.get("debitAmount", 0)
        current_advance = outgoing.get("advanceAmount", 0.0)
        payment_history = outgoing.get("paymentHistory", [])
        
        logger.info(f"Current values - totalPayable: {current_total_payable}, paidAmount: {current_paid_amount}, debitAmount: {current_total_debit}, advanceAmount: {current_advance}")

        # Calculate effective CASH/BANK payment amount
        effective_payment_amount = (
            payment_info.fullPaymentAmount
            if payment_info.paymentType == "full"
            else payment_info.partialAmount
            if payment_info.paymentType == "partial"
            else 0
        )
        
        if effective_payment_amount < 0:
            logger.error(f"Negative payment amount: {effective_payment_amount}")
            raise HTTPException(status_code=400, detail="Payment amount cannot be negative")
        
        logger.info(f"Cash/Bank payment amount: {effective_payment_amount}")

        # Calculate remaining amount after cash payment
        remaining_after_cash = round(current_total_payable - effective_payment_amount, 2)
        logger.info(f"Remaining after cash payment: {remaining_after_cash}")

        # PROCESS DEBIT NOTES (deductions that reduce payable)
        current_debit_amount = 0
        processed_debit_notes = []
        
        if payment_info.selectedDebitNotes:
            logger.info(f"Processing debit notes: {payment_info.selectedDebitNotes}")
            for debit_note_id in payment_info.selectedDebitNotes:
                logger.info(f"Fetching debit note with randomId: {debit_note_id}")
                debit_note = debit_collection.find_one({"randomId": debit_note_id})
                if not debit_note:
                    logger.warning(f"Debit note {debit_note_id} not found")
                    raise HTTPException(status_code=404, detail=f"Debit note {debit_note_id} not found")
                
                if debit_note.get("status") == "Cleared":
                    logger.warning(f"Debit note {debit_note_id} already cleared")
                    raise HTTPException(status_code=400, detail=f"Debit note {debit_note_id} already cleared")
                
                if debit_note.get("vendorName") != outgoing.get("vendorName"):
                    logger.error(f"Debit note {debit_note_id} vendor mismatch")
                    raise HTTPException(status_code=400, detail=f"Debit note {debit_note_id} does not belong to vendor")

                # Get pending amount
                pending_amount = debit_note.get("pendingAmount", debit_note.get("finalAmount", 0))
                logger.info(f"Debit note {debit_note_id} pending amount: {pending_amount}")

                # Debit note can be applied up to remaining amount after cash
                available_for_debit = min(pending_amount, remaining_after_cash)
                
                if available_for_debit > 0:
                    current_debit_amount += available_for_debit
                    remaining_after_cash -= available_for_debit
                    
                    # Update debit note
                    new_pending = round(pending_amount - available_for_debit, 2)
                    new_status = "Cleared" if new_pending <= 0 else "Partially Cleared"
                    
                    update_dict = {
                        "pendingAmount": new_pending,
                        "status": new_status,
                        "lastUpdatedDate": current_datetime
                    }
                    
                    if new_status == "Cleared":
                        update_dict.update({
                            "clearedBy": "System",
                            "clearedDate": current_datetime,
                            "clearedAgainstOutgoing": outgoing_id
                        })
                    
                    history_entry = {
                        "amount": round(available_for_debit, 2),
                        "paymentDate": current_datetime.isoformat(),
                        "paymentMethod": "debit",
                        "paymentMode": "Debit",
                        "remarks": f"Applied {available_for_debit} against outgoing payment {outgoing.get('randomId', outgoing_id)}"
                    }
                    
                    debit_collection.update_one(
                        {"randomId": debit_note_id},
                        {
                            "$set": update_dict,
                            "$push": {"paymentHistory": history_entry}
                        }
                    )
                    
                    processed_debit_notes.append({
                        "debitNoteId": debit_note_id,
                        "amountUsed": available_for_debit,
                        "newStatus": new_status
                    })
                    
                    logger.info(f"Applied debit note {debit_note_id}: amount {available_for_debit}, new pending {new_pending}, status {new_status}")

        current_debit_amount = round(current_debit_amount, 2)
        logger.info(f"Total debit amount applied: {current_debit_amount}")

        # Calculate remaining after cash + debit
        remaining_after_debit = remaining_after_cash
        logger.info(f"Remaining after cash + debit: {remaining_after_debit}")

        # PROCESS ADVANCE PAYMENTS (pre-paid amounts that reduce payable)
        current_advance_amount = 0
        processed_advances = []
        
        if payment_info.selectedAdvancePayments:
            logger.info(f"Processing advance payments: {payment_info.selectedAdvancePayments}")
            for advance_id in payment_info.selectedAdvancePayments:
                logger.info(f"Fetching advance with randomId: {advance_id}")
                advance = advance_collection.find_one({"randomId": advance_id})
                if not advance:
                    logger.warning(f"Advance {advance_id} not found")
                    raise HTTPException(status_code=404, detail=f"Advance {advance_id} not found")
                
                if advance.get("status") == "Completed":
                    logger.warning(f"Advance {advance_id} already completed")
                    raise HTTPException(status_code=400, detail=f"Advance {advance_id} already completed")
                
                if advance.get("vendorName") != outgoing.get("vendorName"):
                    logger.error(f"Advance {advance_id} vendor mismatch")
                    raise HTTPException(status_code=400, detail=f"Advance {advance_id} does not belong to vendor")
                
                pending = advance.get("pendingAmount", 0)
                
                # Advance can be applied up to remaining amount after cash + debit
                available_for_advance = min(pending, remaining_after_debit)
                
                if available_for_advance > 0:
                    current_advance_amount += available_for_advance
                    remaining_after_debit -= available_for_advance
                    
                    new_pending = round(pending - available_for_advance, 2)
                    new_status = "Completed" if new_pending <= 0 else "Partially Cleared"
                    
                    update_dict = {
                        "pendingAmount": new_pending,
                        "status": new_status,
                        "lastUpdatedDate": current_datetime
                    }
                    
                    if new_status == "Completed":
                        update_dict.update({
                            "completedBy": "System",
                            "completedDate": current_datetime,
                            "completedAgainstOutgoing": outgoing_id
                        })
                    
                    history_entry = {
                        "amount": round(available_for_advance, 2),
                        "paymentDate": current_datetime.isoformat(),
                        "paymentMethod": "advance",
                        "paymentMode": "Advance",
                        "remarks": f"Applied {available_for_advance} advance against outgoing payment {outgoing.get('randomId', outgoing_id)}"
                    }
                    
                    advance_collection.update_one(
                        {"randomId": advance_id},
                        {
                            "$set": update_dict,
                            "$push": {"paymentHistory": history_entry}
                        }
                    )
                    
                    processed_advances.append({
                        "advanceId": advance_id,
                        "amountUsed": available_for_advance,
                        "newStatus": new_status
                    })
                    
                    logger.info(f"Applied advance {advance_id}: amount {available_for_advance}, new pending {new_pending}, status {new_status}")

        # FINAL CALCULATIONS
        # Total reduction = cash payment + debit notes + advances
        total_reduction = effective_payment_amount + current_debit_amount + current_advance_amount
        
        # New totals
        new_advance = current_advance + current_advance_amount
        new_paid_amount = current_paid_amount + effective_payment_amount  # Only cash payments increase paid amount
        new_total_debit = current_total_debit + current_debit_amount
        new_total_payable = current_total_payable - total_reduction
        
        logger.info(f"Final calculation:")
        logger.info(f"  Current total payable: {current_total_payable}")
        logger.info(f"  Reduction - Cash: {effective_payment_amount}, Debit: {current_debit_amount}, Advance: {current_advance_amount}")
        logger.info(f"  New total payable: {new_total_payable}")
        logger.info(f"  New paid amount: {new_paid_amount} (cash only)")
        logger.info(f"  New advance amount: {new_advance}")
        logger.info(f"  New debit amount: {new_total_debit}")

        # Determine status
        if new_total_payable <= 0:
            new_status = "Fully Paid"
        elif new_paid_amount > 0 or new_advance > 0:
            new_status = "Partially Paid"
        else:
            new_status = "Pending"

        logger.info(f"New status: {new_status}")

        # Prepare update data
        update_data = {
            "originalTotalPayableAmount": round(original_total_payable, 2),
            "totalPayableAmount": round(max(0, new_total_payable), 2),
            "paidAmount": round(new_paid_amount, 2),
            "debitAmount": round(new_total_debit, 2),
            "advanceAmount": round(new_advance, 2),
            "hasDebitCreditNotes": outgoing.get("hasDebitCreditNotes", False) or bool(payment_info.selectedDebitNotes),
            "paymentType": payment_info.paymentType,
            "paymentMode": payment_info.paymentMode,
            "paymentId": generated_payment_id,  # Set PaymentID field in outgoing document
            "status": new_status,
            "lastUpdatedDate": current_datetime,
            "paymentDate": current_datetime,
        }

        # Set payment method specific fields
        if payment_info.paymentMode == "Bank":
            update_data.update({
                "paymentMethod": payment_info.paymentMethod,
                "bankName": payment_info.bankName or "",
                "neftNo": payment_info.neftNo or "",
                "rtgsNo": payment_info.rtgsNo or "",
                "impsNo": payment_info.impsNo or "",
                "upi": payment_info.upi or "",
                "cashAmount": 0.0,
            })
        elif payment_info.paymentMode == "Cash":
            update_data.update({
                "paymentMethod": "cash",
                "cashAmount": round(payment_info.cashAmount or effective_payment_amount, 2),
                "bankName": "",
                "neftNo": "",
                "rtgsNo": "",
                "impsNo": "",
                "upi": ""
            })

        # Create payment history entry
        new_payment_history_entry = {
            "amount": round(effective_payment_amount, 2),  # Only cash amount in payment history
            "paymentType": payment_info.paymentType,
            "paymentMethod": payment_info.paymentMethod,
            "paymentMode": payment_info.paymentMode,
            "cashAmount": round(payment_info.cashAmount or effective_payment_amount, 2) if payment_info.paymentMode == "Cash" else 0.0,
            "bankName": payment_info.bankName or "",
            "impsNo": payment_info.impsNo or "",
            "neftNo": payment_info.neftNo or "",
            "rtgsNo": payment_info.rtgsNo or "",
            "upi": payment_info.upi or "",
            "date": current_datetime.isoformat(),
            "debitNotesApplied": payment_info.selectedDebitNotes or [],
            "debitAmount": round(current_debit_amount, 2),
            "advancePaymentsApplied": payment_info.selectedAdvancePayments or [],
            "advanceAmount": round(current_advance_amount, 2),
            "paymentId": generated_payment_id,  # Set PaymentID in history entry
        }

        # Update outgoing document
        result = outgoing_collection.update_one(
            {
                "_id": ObjectId(outgoing_id)
            },
            {
                "$set": update_data,
                "$push": {"paymentHistory": new_payment_history_entry},
                "$addToSet": {
                    "selectedDebitNotes": {"$each": payment_info.selectedDebitNotes or []},
                    "selectedAdvancePayments": {"$each": payment_info.selectedAdvancePayments or []}
                }
            }
        )

        if result.modified_count == 0:
            logger.warning(f"No changes made to outgoing {outgoing_id}")
            raise HTTPException(status_code=409, detail="Update failed - no changes applied")

        # UPDATE AP INVOICE STATUS TO MATCH OUTGOING EXACTLY
        ap_status_success = False
        ap_payment_success = False

        if ap_invoice_id:
            logger.info(f"Processing AP invoice updates for {ap_invoice_id} to match outgoing status: {new_status}")
            
            # Calculate total payment amount (cash only for AP invoice tracking)
            total_payment_for_ap = effective_payment_amount
            
            # Update AP invoice status to match outgoing exactly
            ap_status_success = update_ap_invoice_status(tenant_id,ap_invoice_id, new_status, current_datetime)
            
            # Update AP invoice payment details with the same status
            ap_payment_success = update_ap_invoice_payment_details(tenant_id,
                ap_invoice_id, 
                total_payment_for_ap, 
                original_total_payable, 
                current_datetime,
                new_status  # Pass the exact outgoing status
            )
            
            if ap_status_success and ap_payment_success:
                logger.info(f"Successfully synchronized AP invoice {ap_invoice_id} status with outgoing: {new_status}")
            else:
                logger.warning(f"Partial synchronization for AP invoice {ap_invoice_id} - status sync: {ap_status_success}, payment sync: {ap_payment_success}")
        else:
            logger.warning(f"No AP invoice ID found in outgoing document {outgoing_id}")

        # Update vendor payable amount
        vendor_name = outgoing.get("vendorName")
        if vendor_name:
            vendor = vendor_collection.find_one({"vendorName": vendor_name})
            if vendor:
                current_vendor_payable = vendor.get("payableAmount", 0.0)
                # Vendor payable reduced by TOTAL amount (cash + debit + advance)
                total_reduction = effective_payment_amount + current_debit_amount + current_advance_amount
                new_vendor_payable = max(0.0, current_vendor_payable - total_reduction)
                
                vendor_collection.update_one(
                    {"vendorName": vendor_name},
                    {"$set": {
                        "payableAmount": round(new_vendor_payable, 2),
                        "updatedDate": current_datetime
                    }}
                )
                logger.info(f"Updated vendor {vendor_name} payable from {current_vendor_payable} to {new_vendor_payable}")

        # Return success response
        updated_outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
        updated_payment_history = updated_outgoing.get("paymentHistory", []) if updated_outgoing else payment_history + [new_payment_history_entry]

        logger.info(f"Payment processed successfully for outgoing {outgoing_id}")

        return {
            "message": f"Payment applied successfully",
            "paymentId": generated_payment_id,  # Include generated PaymentID
            "cashPaymentAmount": round(effective_payment_amount, 2),
            "debitAmount": round(current_debit_amount, 2),
            "advanceAmount": round(current_advance_amount, 2),
            "totalReduction": round(total_reduction, 2),
            "originalTotalPayableAmount": round(original_total_payable, 2),
            "remainingPayableAmount": round(max(0, new_total_payable), 2),
            "totalPaidAmount": round(new_paid_amount, 2),
            "totalDebitAmount": round(new_total_debit, 2),
            "totalAdvanceAmount": round(new_advance, 2),
            "status": new_status,
            "paymentHistory": updated_payment_history,
            "paymentDate": current_datetime.isoformat(),
            "processedDebitNotes": processed_debit_notes,
            "processedAdvances": processed_advances,
            "apInvoiceUpdates": {
                "invoiceId": ap_invoice_id,
                "statusUpdated": ap_status_success,
                "paymentDetailsUpdated": ap_payment_success,
                "status": new_status  # Same status as outgoing
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing payment for outgoing {outgoing_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")