from datetime import datetime
from ast import Dict
import logging
import traceback
from typing import Any, Dict, List, Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException,Depends,Request
from pydantic import BaseModel, Field
from pymongo import ReturnDocument, UpdateOne
import pytz
from utils.database import get_apinvoice_collection,get_vendor_collection,get_purchaseitem_collection,get_inventory_collection,get_outgoingpayment_collection,get_debit_collection, get_grn_collection, get_return_reasons_collection

from grn.models import Grn, ReturnGRNRequest, ReturnReason
from grn.routes import get_current_date_and_time

from .utils import calculate_item_financialsReturn, generate_note_random_id, get_current_ist_datetime, is_valid_object_id
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from database import db
from fastapi import HTTPException

async def get_user_id_by_username(username: str,tenant_id:str):
    user = await db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found in database")
    return str(user["_id"])

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CreateAmountDebitNoteRequest(BaseModel):
    documentId: str = Field(..., description="ID of source document")
    documentType: Literal["grn", "ap_invoice", "outgoing_payment"] = Field(..., description="Type of source document")
    totalAmount: float = Field(..., gt=0, description="Total amount for debit note")
    reason: str = Field(..., description="Reason for the amount debit")
    createdBy: str = Field(..., description="Person creating the note")
    comments: Optional[str] = None
async def check_debit_note_availability(tenant_id:str,document_type: str, document_id: str, requested_amount: float) -> Dict[str, Any]:
    """
    Check if a debit note can be created for the document.
    Validates that total debit notes don't exceed original payable amount.
    """
    try:
        # Fetch the source document
        source_doc = None
        original_payable_amount = 0
        
        if document_type == "outgoing_payment":
            collection = get_outgoingpayment_collection(tenant_id)
            source_doc = collection.find_one({"_id": ObjectId(document_id)})
            if source_doc:
                # Use totalPayableAmount as the original amount
                original_payable_amount = source_doc.get("totalPayableAmount", 0)
                logger.info(f"Outgoing payment found: original_payable_amount={original_payable_amount}")
                
        elif document_type == "grn":
            collection = get_grn_collection(tenant_id)
            source_doc = collection.find_one({"_id": ObjectId(document_id)})
            if source_doc:
                original_payable_amount = source_doc.get("grandTotal", 0) or source_doc.get("totalReceivedAmount", 0) or 0
                
        elif document_type == "ap_invoice":
            collection = get_apinvoice_collection(tenant_id)
            source_doc = collection.find_one({"_id": ObjectId(document_id)})
            if source_doc:
                original_payable_amount = source_doc.get("payableAmount", 0) or source_doc.get("invoiceAmount", 0) or 0
        
        if not source_doc:
            return {
                "can_create": False,
                "available_amount": 0,
                "message": f"Document not found: {document_id}"
            }
        
        # Fetch existing debit notes for this document
        debit_collection = get_debit_collection(tenant_id)
        existing_notes = list(debit_collection.find({
            "$or": [
                {"documentId": document_id},
                {"outgoingPaymentId": document_id}
            ],
            "status": {"$in": ["Active", "Partially Cleared"]}
        }))
        
        logger.info(f"Found {len(existing_notes)} existing debit notes for document {document_id}")
        
        # Calculate total from existing active debit notes
        total_existing_debit = 0
        for note in existing_notes:
            if note.get("isAmountOnly") or note.get("noteType") == "amount_only":
                total_existing_debit += note.get("totalAmount", note.get("debitAmount", 0))
            else:
                total_existing_debit += note.get("netAmount", 0)
        
        logger.info(f"Total existing debit: {total_existing_debit}")
        
        # Calculate remaining available amount
        remaining_available = original_payable_amount - total_existing_debit
        
        # Check if requested amount exceeds available
        if requested_amount > remaining_available:
            return {
                "can_create": False,
                "available_amount": remaining_available,
                "requested_amount": requested_amount,
                "message": f"Requested amount {requested_amount} exceeds available amount {remaining_available}. Total existing debit: {total_existing_debit}",
                "existing_notes_count": len(existing_notes),
                "total_existing_debit": total_existing_debit,
                "original_payable_amount": original_payable_amount,
                "remaining_available": remaining_available
            }
        
        return {
            "can_create": True,
            "available_amount": remaining_available,
            "remaining_available": remaining_available - requested_amount,
            "existing_notes": existing_notes,
            "existing_notes_count": len(existing_notes),
            "total_existing_debit": total_existing_debit,
            "original_payable_amount": original_payable_amount
        }
        
    except Exception as e:
        logger.error(f"Error checking debit note availability: {str(e)}\n{traceback.format_exc()}")
        return {
            "can_create": False,
            "available_amount": 0,
            "message": f"Error checking availability: {str(e)}"
        }


async def update_source_document_for_debit_note(
    tenant_id:str,
    document_type: str,
    document_id: str,
    total_amount: float,
    update_datetime: datetime
):
    """
    Updates source document to mark that it has debit notes.
    For outgoing_payment: DO NOT modify payable amounts, only record debit notes.
    """
    try:
        if document_type == "grn":
            collection = get_grn_collection(tenant_id)
            collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$inc": {"totalDebitAmount": total_amount},
                    "$set": {
                        "lastUpdatedDate": update_datetime,
                        "hasDebitCreditNotes": True
                    }
                }
            )

        elif document_type == "ap_invoice":
            collection = get_apinvoice_collection(tenant_id)
            collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$inc": {"debitAmount": total_amount},
                    "$set": {
                        "lastUpdatedDate": update_datetime,
                        "hasDebitCreditNotes": True
                    }
                }
            )

        elif document_type == "outgoing_payment":
            collection = get_outgoingpayment_collection(tenant_id)
            # For outgoing_payment: Update debit tracking fields ONLY
            collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$inc": {
                        "debitAmount": total_amount,  # Track total debit amount
                        "existingDebitNotesCount": 1  # Increment count of debit notes
                    },
                    "$set": {
                        "lastUpdatedDate": update_datetime,
                        "hasDebitCreditNotes": True
                    }
                    # IMPORTANT: DO NOT modify totalPayableAmount, payableAmount, totalPrice, etc.
                }
            )
            logger.info(f"Updated outgoing payment {document_id} with debit amount {total_amount}")

        else:
            raise ValueError(f"Unsupported document type: {document_type}")

        logger.info(f"Updated {document_type} {document_id} with debit note tracking")

    except Exception as e:
        logger.error(f"Failed to update source document {document_type} {document_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update source document after creating debit note"
        )


@router.get("/getgrn/return-reasons", response_model=List[ReturnReason])
async def get_return_reasons(request:Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    return_reasons_collection = get_return_reasons_collection(tenant_id)

    try:
       
        reasons = list(return_reasons_collection.find({}, {"reason": 1, "createdDate": 1, "_id": 0}))
        # Convert MongoDB documents to Pydantic models
        return [ReturnReason(**reason) for reason in reasons]
    except Exception as e:
        logger.error(f"Error fetching return reasons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch return reasons: {str(e)}")
    
@router.post("/return-reasons")
async def add_return_reason(request:Request,reason: ReturnReason,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    return_reasons_collection = get_return_reasons_collection(tenant_id)

    try:
       
        existing_reason = return_reasons_collection.find_one({"reason": reason.reason})
        if existing_reason:
            return {"message": "Reason already exists"}
        reason.createdDate = datetime.now(pytz.timezone("Asia/Kolkata"))
        return_reasons_collection.insert_one(reason.dict())
        return {"message": "Reason added successfully", "reason": reason.reason}
    except Exception as e:
        logger.error(f"Error adding return reason: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add return reason: {str(e)}")
@router.patch("/{grn_id}/return", response_model=Grn)
async def process_grn_return(request:Request,grn_id: str, request_data: ReturnGRNRequest,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "edit"))):
    tenant_id = request.state.tenant_id

    # Get logged in user from JWT
    username = user.get("username")
    user_id = await get_user_id_by_username(username,tenant_id)

    grn_collection = get_grn_collection(tenant_id)
    purchase_item_collection = get_purchaseitem_collection(tenant_id)
    debit_credit_note_collection = get_debit_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    current_date_and_time = get_current_date_and_time()

    # Parse returnedDate to IST
    try:
        returned_date = request_data.returnedDate
        if returned_date.tzinfo is None:
            returned_date = returned_date.replace(tzinfo=pytz.UTC)
        returned_date_ist = returned_date.astimezone(pytz.timezone("Asia/Kolkata"))
    except ValueError:
        logger.error(f"Invalid returnedDate format: {request_data.returnedDate}")
        raise HTTPException(status_code=400, detail="Invalid returnedDate format")

    # Fetch GRN
    grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
    if not grn:
        logger.error(f"GRN not found for ID: {grn_id}")
        raise HTTPException(status_code=404, detail="GRN not found")

    # Sanitize grnDate
    if not isinstance(grn.get("grnDate"), datetime):
        logger.warning(f"Invalid grnDate in GRN {grn_id}: {grn.get('grnDate')}")
        try:
            if isinstance(grn.get("grnDate"), dict):
                grn["grnDate"] = datetime(
                    grn["grnDate"].get("year", 2025),
                    grn["grnDate"].get("month", 1),
                    grn["grnDate"].get("day", 1),
                    tzinfo=pytz.UTC
                )
            else:
                grn["grnDate"] = current_date_and_time['utc_datetime']
        except Exception as e:
            logger.error(f"Failed to parse grnDate for GRN {grn_id}: {e}")
            grn["grnDate"] = current_date_and_time['utc_datetime']

    if grn.get("status") == "Fully Returned":
        logger.error(f"GRN {grn_id} already fully returned")
        raise HTTPException(status_code=400, detail="GRN already fully returned")

    # Validate request
    if request_data.scenario == "partial" and not request_data.items:
        logger.error("Items list required for partial return")
        raise HTTPException(status_code=400, detail="Items list required for partial return")

    # Initialize item quantities
    item_details = grn.get("itemDetails", [])
    for item in item_details:
        item["nos"] = item.get("nos", 1) if item.get("nos", 1) > 0 else 1
        item["eachQuantity"] = item.get("eachQuantity", item.get("receivedQuantity", 0))
        item["totalQuantity"] = item.get("receivedQuantity", 0)

    item_map: Dict[str, dict] = {item["itemId"]: item.copy() for item in item_details}
    updated_items = []
    total_returned_amount = 0
    total_returned_tax = 0
    total_returned_discount = 0
    stock_updates = {}

    # Store items for new debit note creation
    current_return_items = []

    if request_data.scenario == "full":
        for item in item_details:
            item_id = item["itemId"]
            current_received = item.get("receivedQuantity", 0)
            current_returned = item.get("returnedQuantity", 0) or 0
            remaining = round(current_received - current_returned, 2)

            if remaining <= 0:
                logger.debug(f"Skipping item {item_id} with no remaining quantity")
                updated_items.append(item.copy())
                continue

            if remaining > current_received:
                logger.error(f"Invalid return: remaining {remaining} exceeds received {current_received} for item {item_id}")
                raise HTTPException(status_code=400, detail=f"Invalid return quantity for item {item_id}")

            item_name = item.get("itemName")
            unit_price = item.get("unitPrice", 0)
            stock_updates[item_id] = stock_updates.get(item_id, {"itemName": item_name, "quantityToReduce": 0})
            stock_updates[item_id]["quantityToReduce"] = round(stock_updates[item_id]["quantityToReduce"] + remaining, 2)

            returned_financials = calculate_item_financialsReturn(item.copy(), remaining)
            returned_financials = {k: round(v, 2) for k, v in returned_financials.items()}

            total_returned_amount += returned_financials["finalPrice"]
            total_returned_tax += returned_financials["taxAmount"]
            total_returned_discount += returned_financials.get("discountAmount", 0)

            updated_item = item.copy()
            updated_item["returnedQuantity"] = round(current_returned + remaining, 2)
            updated_item["grnReturnNos"] = updated_item.get("nos", 1)
            updated_item["grnReturnEachQuantity"] = updated_item.get("eachQuantity", current_received)
            updated_item["status"] = "FullyReturned" if remaining >= current_received else "PartiallyReturned"

            prev_returned_total = updated_item.get("returnedTotalPrice", 0) or 0
            prev_returned_tax = updated_item.get("returnedTaxAmount", 0) or 0
            prev_returned_discount = updated_item.get("returnedDiscountAmount", 0) or 0
            prev_returned_final = updated_item.get("returnedFinalPrice", 0) or 0
            prev_returned_sgst = updated_item.get("returnedSgst", 0) or 0
            prev_returned_cgst = updated_item.get("returnedCgst", 0) or 0
            prev_returned_bef_discount = updated_item.get("returnedBefTaxDiscountAmount", 0) or 0
            prev_returned_af_discount = updated_item.get("returnedAfTaxDiscountAmount", 0) or 0

            updated_item.update({
                "returnedTotalPrice": round(prev_returned_total + returned_financials["totalPrice"], 2),
                "returnedTaxAmount": round(prev_returned_tax + returned_financials["taxAmount"], 2),
                "returnedDiscountAmount": round(prev_returned_discount + returned_financials.get("discountAmount", 0), 2),
                "returnedFinalPrice": round(prev_returned_final + returned_financials["finalPrice"], 2),
                "returnedSgst": round(prev_returned_sgst + returned_financials["sgst"], 2),
                "returnedCgst": round(prev_returned_cgst + returned_financials["cgst"], 2),
                "returnedBefTaxDiscountAmount": round(prev_returned_bef_discount + returned_financials["befTaxDiscountAmount"], 2),
                "returnedAfTaxDiscountAmount": round(prev_returned_af_discount + returned_financials["afTaxDiscountAmount"], 2)
            })

            # Store for current debit note
            current_return_items.append({
                "itemId": item["itemId"],
                "itemName": item["itemName"],
                "noteType": "debit",
                "quantity": remaining,  # Only the current return quantity
                "unitPrice": item.get("unitPrice", 0),
                "totalPrice": returned_financials["totalPrice"],
                "taxAmount": returned_financials["taxAmount"],
                "discountAmount": returned_financials.get("discountAmount", 0),
                "finalPrice": returned_financials["finalPrice"],
                "sgst": returned_financials["sgst"],
                "cgst": returned_financials["cgst"],
                "reason": request_data.comments or "Full GRN return"
            })

            updated_item["returnHistory"] = updated_item.get("returnHistory", []) + [{
                "date": returned_date_ist.isoformat(),
                "by": username,
                "nos": updated_item.get("nos", 1),
                "eachQuantity": updated_item.get("eachQuantity", current_received),
                "totalUnits": remaining,
                "reason": request_data.comments or "Full GRN return",
                "timestamp": current_date_and_time['utc_datetime'],
                "status": updated_item["status"]
            }]

            updated_items.append(updated_item)
    else:  # partial scenario
        items_to_process = [item.dict() if hasattr(item, 'dict') else item for item in request_data.items]
        item_ids = {item["itemId"] for item in items_to_process}

        if len(item_ids) != len(items_to_process):
            logger.error("Duplicate item IDs in request")
            raise HTTPException(status_code=400, detail="Duplicate item IDs in request")

        for return_item in items_to_process:
            item_id = return_item["itemId"]
            item = item_map.get(item_id)
            if not item:
                logger.error(f"Item ID {item_id} not found in GRN {grn_id}")
                raise HTTPException(status_code=404, detail=f"Item ID {item_id} not found")

            current_received = item.get("receivedQuantity", 0)
            current_returned = item.get("returnedQuantity", 0) or 0
            remaining = round(current_received - current_returned, 2)

            units_to_return = round(return_item["nos"] * return_item["eachQuantity"], 2)
            if units_to_return > remaining:
                logger.error(f"Cannot return {units_to_return} units for item {item_id}. Only {remaining} available")
                raise HTTPException(status_code=400, detail=f"Cannot return {units_to_return} units for item {item_id}. Only {remaining} available")
            if units_to_return <= 0:
                logger.debug(f"Skipping item {item_id} with zero units to return")
                continue

            return_status = "FullyReturned" if units_to_return >= remaining else "PartiallyReturned"

            item_name = item.get("itemName")
            unit_price = item.get("unitPrice", 0)
            stock_updates[item_id] = stock_updates.get(item_id, {"itemName": item_name, "quantityToReduce": 0})
            stock_updates[item_id]["quantityToReduce"] = round(stock_updates[item_id]["quantityToReduce"] + units_to_return, 2)

            returned_financials = calculate_item_financialsReturn(item.copy(), units_to_return)
            returned_financials = {k: round(v, 2) for k, v in returned_financials.items()}

            total_returned_amount += returned_financials["finalPrice"]
            total_returned_tax += returned_financials["taxAmount"]
            total_returned_discount += returned_financials.get("discountAmount", 0)

            updated_item = item.copy()
            updated_item["returnedQuantity"] = round(current_returned + units_to_return, 2)
            updated_item["grnReturnNos"] = round((updated_item.get("grnReturnNos", 0) or 0) + return_item["nos"], 2)
            updated_item["grnReturnEachQuantity"] = round((updated_item.get("grnReturnEachQuantity", 0) or 0) + return_item["eachQuantity"], 2)
            updated_item["status"] = return_status

            prev_returned_total = updated_item.get("returnedTotalPrice", 0) or 0
            prev_returned_tax = updated_item.get("returnedTaxAmount", 0) or 0
            prev_returned_discount = updated_item.get("returnedDiscountAmount", 0) or 0
            prev_returned_final = updated_item.get("returnedFinalPrice", 0) or 0
            prev_returned_sgst = updated_item.get("returnedSgst", 0) or 0
            prev_returned_cgst = updated_item.get("returnedCgst", 0) or 0
            prev_returned_bef_discount = updated_item.get("returnedBefTaxDiscountAmount", 0) or 0
            prev_returned_af_discount = updated_item.get("returnedAfTaxDiscountAmount", 0) or 0

            updated_item.update({
                "returnedTotalPrice": round(prev_returned_total + returned_financials["totalPrice"], 2),
                "returnedTaxAmount": round(prev_returned_tax + returned_financials["taxAmount"], 2),
                "returnedDiscountAmount": round(prev_returned_discount + returned_financials.get("discountAmount", 0), 2),
                "returnedFinalPrice": round(prev_returned_final + returned_financials["finalPrice"], 2),
                "returnedSgst": round(prev_returned_sgst + returned_financials["sgst"], 2),
                "returnedCgst": round(prev_returned_cgst + returned_financials["cgst"], 2),
                "returnedBefTaxDiscountAmount": round(prev_returned_bef_discount + returned_financials["befTaxDiscountAmount"], 2),
                "returnedAfTaxDiscountAmount": round(prev_returned_af_discount + returned_financials["afTaxDiscountAmount"], 2)
            })

            # Store for current debit note
            current_return_items.append({
                "itemId": item["itemId"],
                "itemName": item["itemName"],
                "noteType": "debit",
                "quantity": units_to_return,  # Only the current return quantity
                "unitPrice": item.get("unitPrice", 0),
                "totalPrice": returned_financials["totalPrice"],
                "taxAmount": returned_financials["taxAmount"],
                "discountAmount": returned_financials.get("discountAmount", 0),
                "finalPrice": returned_financials["finalPrice"],
                "sgst": returned_financials["sgst"],
                "cgst": returned_financials["cgst"],
                "reason": return_item.get("returnReason") or request_data.comments or "Partial GRN return"
            })

            updated_item["returnHistory"] = updated_item.get("returnHistory", []) + [{
                "date": returned_date_ist.isoformat(),
                "by": username,
                "nos": return_item["nos"],
                "eachQuantity": return_item["eachQuantity"],
                "totalUnits": units_to_return,
                "reason": return_item.get("returnReason") or request_data.comments or "Partial GRN return",
                "timestamp": current_date_and_time['utc_datetime'],
                "status": return_status
            }]

            updated_items.append(updated_item)

        for item_id, item in item_map.items():
            if item_id not in item_ids:
                updated_items.append(item.copy())

    # Determine GRN status
    all_items_fully_returned = True
    any_items_returned = False

    for item in updated_items:
        received_qty = item.get("receivedQuantity", 0)
        returned_qty = item.get("returnedQuantity", 0) or 0
        if returned_qty > received_qty:
            logger.error(f"Invalid return: returned quantity {returned_qty} exceeds received quantity {received_qty} for item {item['itemId']}")
            raise HTTPException(status_code=400, detail="exceeds received quantity for item {item['itemId']}")
        if returned_qty > 0:
            any_items_returned = True
        if received_qty > returned_qty:
            all_items_fully_returned = False

    # Only update status if not APInvoiceConverted
    current_status = grn.get("status")
    if current_status != "APInvoiceConverted":
        new_status = "Fully Returned" if all_items_fully_returned and any_items_returned else "Partially Returned" if any_items_returned else "Active"
    else:
        new_status = current_status  # Keep the status as APInvoiceConverted
        logger.info(f"GRN {grn_id} status remains APInvoiceConverted, no status change allowed")

    # Create or update debit note for current return
    if any_items_returned and current_return_items:
        note_total_amount = sum(item["totalPrice"] for item in current_return_items)
        note_total_tax = sum(item["taxAmount"] for item in current_return_items)
        note_total_discount = sum(item["discountAmount"] for item in current_return_items)
        note_final_amount = sum(item["finalPrice"] for item in current_return_items)

        # Check if there's an existing debit note for this GRN and vendor
        existing_debit_note = debit_credit_note_collection.find_one({
            "grnId": grn_id,
            "vendorName": grn.get("vendorName"),
            "noteType": "debit"
        })

        should_create_new_note = True
        
        if existing_debit_note:
            # Check if existing debit note status is "Active"
            if existing_debit_note.get("status") == "Active":
                # Don't create new note, combine with existing Active note
                should_create_new_note = False
                logger.info(f"Combining with existing Active debit note {existing_debit_note.get('randomId')} for GRN {grn_id}")
            elif existing_debit_note.get("status") == "Cleared":
                # Existing note is cleared, create new individual note
                should_create_new_note = True
                logger.info(f"Creating new debit note for GRN {grn_id} as existing note {existing_debit_note.get('randomId')} is cleared")
            else:
                # Any other status, create new individual note
                should_create_new_note = True
                logger.info(f"Creating new debit note for GRN {grn_id} as existing note {existing_debit_note.get('randomId')} status is {existing_debit_note.get('status')}")

        if should_create_new_note:
            # Create new individual debit note
            note_data = {
                "documentId": grn_id,      
                "documentType": "grn",
                "grnId": grn_id,
                "vendorName": grn.get("vendorName"),
                "invoiceNo":grn.get('invoiceNo'),
                "itemDetails": current_return_items,
                "createdDate": current_date_and_time['utc_datetime'],
                "createdBy": username,
                "lastUpdatedDate": current_date_and_time['utc_datetime'],
                "totalAmount": round(note_total_amount, 2),
                "totalTax": round(note_total_tax, 2),
                "totalDiscount": round(note_total_discount, 2),
                "finalAmount": round(note_final_amount, 2),
                "noteType": "debit",
                "status": "Active",
                "returnDate": returned_date_ist.isoformat(),
                "randomId": generate_note_random_id(tenant_id)
            }

            # Insert new individual debit note
            insert_result = debit_credit_note_collection.insert_one(note_data)
            debit_credit_note_collection.update_one(
                {"_id": insert_result.inserted_id},
                {"$set": {"noteId": str(insert_result.inserted_id)}}
            )

            logger.info(f"Created new individual debit note {note_data['randomId']} for GRN {grn_id} with amount {note_final_amount}")

        else:
            # Combine with existing Active debit note
            existing_items = existing_debit_note.get("itemDetails", [])
            combined_items = existing_items + current_return_items
            
            # Calculate new totals
            new_total_amount = existing_debit_note.get("totalAmount", 0) + note_total_amount
            new_total_tax = existing_debit_note.get("totalTax", 0) + note_total_tax
            new_total_discount = existing_debit_note.get("totalDiscount", 0) + note_total_discount
            new_final_amount = existing_debit_note.get("finalAmount", 0) + note_final_amount
            
            # Update existing debit note with combined data
            debit_credit_note_collection.update_one(
                {"_id": existing_debit_note["_id"]},
                {
                    "$set": {
                        "itemDetails": combined_items,
                        "lastUpdatedDate": current_date_and_time['utc_datetime'],
                        "totalAmount": round(new_total_amount, 2),
                        "totalTax": round(new_total_tax, 2),
                        "totalDiscount": round(new_total_discount, 2),
                        "finalAmount": round(new_final_amount, 2),
                    }
                }
            )
            
            logger.info(f"Combined return with existing Active debit note {existing_debit_note.get('randomId')} for GRN {grn_id}. New total: {new_final_amount}")

        # Update vendor outstanding amount
        vendor = vendor_collection.find_one({"vendorName": grn.get("vendorName")})
        if vendor:
            current_outstanding = vendor.get("outstandingAmount", 0) or 0
            new_outstanding = max(0, current_outstanding - note_final_amount)
            vendor_collection.update_one(
                {"vendorName": grn.get("vendorName")},
                {
                    "$set": {
                        "outstandingAmount": round(new_outstanding, 2),
                        "lastUpdatedDate": current_date_and_time['utc_datetime']
                    }
                }
            )

        # Update outgoing payment
        outgoing = outgoing_collection.find_one({"grnId": grn_id})
        if outgoing:
            current_debit_amount = outgoing.get("debitAmount", 0) or 0
            current_invoiceplusdebit = outgoing.get("invoiceplusdebit", 0) or 0
            
            new_debit_amount = current_debit_amount + note_final_amount
            new_invoiceplusdebit = current_invoiceplusdebit + note_final_amount
            
            outgoing_collection.update_one(
                {"grnId": grn_id},
                {
                    "$set": {
                        "debitAmount": round(new_debit_amount, 2),
                        "hasDebitCreditNotes": True,
                        "invoiceplusdebit": round(new_invoiceplusdebit, 2),
                        "lastUpdatedDate": current_date_and_time['utc_datetime']
                    }
                }
            )

    # Update stock quantities
    bulk_operations = []
    for item_id, update_info in stock_updates.items():
        purchase_item = purchase_item_collection.find_one({
            "$or": [
                {"purchaseitemId": item_id},
                {"_id": ObjectId(item_id) if is_valid_object_id(item_id) else None},
                {"itemName": update_info["itemName"]}
            ]
        })
        if purchase_item:
            current_stock = purchase_item.get("stockQuantity", 0) or 0
            new_stock = round(max(0, current_stock - update_info["quantityToReduce"]), 2)
            bulk_operations.append(
                UpdateOne(
                    {"_id": purchase_item["_id"]},
                    {"$set": {
                        "stockQuantity": new_stock,
                        "lastUpdatedDate": current_date_and_time['utc_datetime']
                    }}
                )
            )
    if bulk_operations:
        purchase_item_collection.bulk_write(bulk_operations, ordered=False)

    # Update GRN
    update_data = {
        "itemDetails": updated_items,
        "status": new_status,
        "grnReturnedDate": returned_date_ist if any_items_returned else None,
        
        "grnReturnedPerson": username if any_items_returned else None,
        "grnReturnedPersonId": user_id if any_items_returned else None,                
        "comments": request_data.comments,
        "totalReturnedAmount": round(sum(item.get("returnedFinalPrice", 0) or 0 for item in updated_items), 2),
        "totalReturnedTax": round(sum(item.get("returnedTaxAmount", 0) or 0 for item in updated_items), 2),
        "totalReturnedDiscount": round(sum(item.get("returnedDiscountAmount", 0) or 0 for item in updated_items), 2),
        "totalReturnedUnits": round(sum(item.get("returnedQuantity", 0) or 0 for item in updated_items), 2),
        "lastUpdatedDate": current_date_and_time['utc_datetime'],
        "hasDebitCreditNotes": any_items_returned
    }

    updated_grn = grn_collection.find_one_and_update(
        {"_id": ObjectId(grn_id)},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER
    )

    updated_grn["grnId"] = str(updated_grn["_id"])
    updated_grn.pop("_id", None)
    return Grn(**updated_grn)

def calculate_item_financialsReturn(item: Dict, units: float) -> Dict:
    logger.debug(f"Calculating return financials for item: {item}, quantity: {units}")
    unit_price = item.get("unitPrice", 0) or 0
    if unit_price <= 0 or units <= 0:
        logger.warning(f"Invalid unitPrice {unit_price} or units {units} for item {item.get('itemId', 'unknown')}")
        return {
            "totalPrice": 0.0,
            "befTaxDiscountAmount": 0.0,
            "afTaxDiscountAmount": 0.0,
            "taxAmount": 0.0,
            "sgst": 0.0,
            "cgst": 0.0,
            "igst": 0.0,
            "discountAmount": 0.0,
            "finalPrice": 0.0
        }

    base_amount = unit_price * units
    bef_tax_discount = item.get("befTaxDiscount", 0) or 0
    bef_tax_discount_amount = base_amount * (bef_tax_discount / 100) if bef_tax_discount > 0 else 0.0
    taxable_amount = base_amount - bef_tax_discount_amount
    tax_rate = item.get("purchasetaxName", 0) or 0
    tax_amount = taxable_amount * (tax_rate / 100) if tax_rate > 0 else 0.0
    sgst = cgst = igst = 0.0
    tax_type = item.get("taxType", "cgst_sgst")
    if tax_type == "igst":
        igst = tax_amount
    else:
        sgst = tax_amount / 2
        cgst = tax_amount / 2
    amount_before_af_tax_discount = taxable_amount + tax_amount
    af_tax_discount = item.get("afTaxDiscount", 0) or 0
    af_tax_discount_amount = amount_before_af_tax_discount * (af_tax_discount / 100) if af_tax_discount > 0 else 0.0
    final_price = amount_before_af_tax_discount - af_tax_discount_amount
    if final_price < 0:
        logger.warning(f"Negative finalPrice calculated for item {item.get('itemId', 'unknown')}: {final_price}")
        final_price = 0.0

    result = {
        "totalPrice": round(base_amount, 2),
        "befTaxDiscountAmount": round(bef_tax_discount_amount, 2),
        "afTaxDiscountAmount": round(af_tax_discount_amount, 2),
        "taxAmount": round(tax_amount, 2),
        "sgst": round(sgst, 2),
        "cgst": round(cgst, 2),
        "igst": round(igst, 2),
        "discountAmount": round(bef_tax_discount_amount + af_tax_discount_amount, 2),
        "finalPrice": round(final_price, 2)
    }
    logger.debug(f"Return financials calculated: {result}")
    return result
@router.post("/returnprocess/AmountDebitNote/create")
async def create_amount_debit_note(request:Request,request_data: CreateAmountDebitNoteRequest,user = Depends(validate_token)):
    tenant_id = request.state.tenant_id

    """
    Create amount-only debit note for GRN, AP Invoice, or Outgoing Payment
    WITH VALIDATION: Checks available payable amount and existing debit notes
    For outgoing_payment: Does NOT modify payable amounts, only records debit note
    """
    try:
        username = user.get("username")
        if not is_valid_object_id(request_data.documentId):
            raise HTTPException(status_code=400, detail="Invalid document ID format")

        # Log the incoming request
        logger.info(f"Creating amount debit note: {request_data.dict()}")

        # Check if debit note can be created based on available amount
        availability_check = await check_debit_note_availability(
            tenant_id,
            request_data.documentType,
            request_data.documentId,
            request_data.totalAmount
        )
        
        if not availability_check["can_create"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": availability_check["message"],
                    "available_amount": availability_check["available_amount"],
                    "requested_amount": request_data.totalAmount,
                    "existing_notes_count": availability_check.get("existing_notes_count", 0),
                    "total_existing_debit": availability_check.get("total_existing_debit", 0),
                    "remaining_available": availability_check.get("remaining_available", 0)
                }
            )
        
        # Generate sequential note ID FIRST - Use the SAME function as item-wise notes
        note_id = generate_note_random_id(tenant_id)
        logger.info(f"Generated amount-wise debit note ID: {note_id} for {request_data.documentType}")
        
        # Determine document type and fetch document
        source_doc = None
        document_type = request_data.documentType
        document_id = request_data.documentId

        if document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            source_doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
            
            if not source_doc:
                # Also try finding by randomId if _id doesn't match
                source_doc = outgoing_collection.find_one({"randomId": document_id})
                
            if not source_doc:
                logger.error(f"Outgoing Payment not found: ID={document_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Outgoing Payment not found with ID: {document_id}"
                )
            
            logger.info(f"Found outgoing payment: {source_doc.get('randomId')}, vendor: {source_doc.get('vendorName')}")

        elif document_type == "grn":
            grn_collection = get_grn_collection(tenant_id)
            source_doc = grn_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                source_doc = grn_collection.find_one({"randomId": document_id})
                
        elif document_type == "ap_invoice":
            ap_collection = get_apinvoice_collection(tenant_id)
            source_doc = ap_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                source_doc = ap_collection.find_one({"randomId": document_id})

        if not source_doc:
            raise HTTPException(
                status_code=404,
                detail=f"{document_type.replace('_', ' ').title()} not found with ID: {document_id}"
            )

        # Get current timestamp
        now_ist = get_current_ist_datetime()
        
        # Calculate remaining payable amount after this debit note
        remaining_payable_amount = availability_check.get("remaining_available", 0)
        
        # Create debit note document with PROPER structure
        debit_note_doc = {
            "_id": ObjectId(),  # MongoDB _id
            "noteId": note_id, 
            "randomId": note_id,  # ALSO set randomId to the same value
            "documentId": document_id,
            "documentType": document_type,
            "vendorName": source_doc.get("vendorName", ""),
            "invoiceNo": source_doc.get("invoiceNo"),
            "address": source_doc.get("address", ""),
            "city": source_doc.get("city", ""),
            "state": source_doc.get("state", ""),
            "country": source_doc.get("country", ""),
            "gstNumber": source_doc.get("gstNumber", ""),
            "totalAmount": request_data.totalAmount,
            "debitAmount": request_data.totalAmount,
            "finalAmount": request_data.totalAmount,  # IMPORTANT: Add finalAmount
            "reason": request_data.reason,
            "createdDate": now_ist,
            "createdBy": username,
            "lastUpdatedDate": now_ist,
            "comments": request_data.comments or "",
            "status": "Active",
            "noteType": "amount_only",
            "returnDate": now_ist.isoformat(),
            "isAmountOnly": True,
            "remainingPayableAmount": remaining_payable_amount,
            "sourceDocument": {
                "type": document_type,
                "id": document_id,
                "randomId": source_doc.get("randomId"),
                "vendorName": source_doc.get("vendorName"),
                "originalPayableAmount": availability_check.get("original_payable_amount", 0),
                "existingDebitNotesCount": availability_check.get("existing_notes_count", 0),
                "totalExistingDebit": availability_check.get("total_existing_debit", 0),
                # Include original financial data for reference
                "totalPayableAmount": source_doc.get("totalPayableAmount"),
                "payableAmount": source_doc.get("payableAmount"),
                "totalPrice": source_doc.get("totalPrice"),
                "debitAmount": source_doc.get("debitAmount", 0)
            },
            # Add dummy itemDetails for consistency
            "itemDetails": [{
                "itemId": document_id,
                "itemName": f"Amount Adjustment - {request_data.reason}",
                "noteType": "debit",
                "quantity": 1,
                "uom": "NOS",
                "unitPrice": request_data.totalAmount,
                "totalPrice": request_data.totalAmount,
                "finalPrice": request_data.totalAmount,
                "reason": request_data.reason,
                "isAmountOnly": True
            }]
        }

        # Add document-specific references
        if document_type == "grn":
            debit_note_doc["grnId"] = document_id
            debit_note_doc["sourceDocumentType"] = "grn"
        elif document_type == "ap_invoice":
            debit_note_doc["apInvoiceId"] = document_id
            debit_note_doc["sourceDocumentType"] = "ap_invoice"
        elif document_type == "outgoing_payment":
            debit_note_doc["outgoingPaymentId"] = document_id
            debit_note_doc["sourceDocumentType"] = "outgoing_payment"

        # Insert into debit collection
        debit_collection = get_debit_collection(tenant_id)
        insert_result = debit_collection.insert_one(debit_note_doc)
        mongo_id = str(insert_result.inserted_id)

        # Update source document WITHOUT modifying financial amounts
        await update_source_document_for_debit_note(
            tenant_id,
            document_type,
            document_id,
            request_data.totalAmount,
            now_ist
        )

        logger.info(f"Amount debit note created successfully: {note_id} (MongoDB ID: {mongo_id})")
        
        # Prepare response
        response_data = {
            "success": True,
            "noteId": note_id,  # Sequential note ID (NOTE-001, NOTE-002, etc.)
            "mongoId": mongo_id,  # MongoDB _id
            "message": "Amount-only debit note created successfully",
            "totalAmount": request_data.totalAmount,
            "finalAmount": request_data.totalAmount, 
            "reason": request_data.reason,
            "remainingPayableAmount": remaining_payable_amount,
            "createdAt": now_ist.isoformat(),
            "noteNumber": note_id,  # Same as noteId for compatibility
            "availability_check": {
                "original_payable_amount": availability_check.get("original_payable_amount", 0),
                "existing_debit_notes": availability_check.get("existing_notes_count", 0),
                "total_existing_debit": availability_check.get("total_existing_debit", 0),
                "remaining_available_after": remaining_payable_amount
            },
            "sourceDocument": {
                "type": document_type,
                "id": document_id,
                "randomId": source_doc.get("randomId"),
                "available_before": availability_check.get("available_amount", 0),
                "existing_notes_before": availability_check.get("existing_notes_count", 0),
                "original_totalPayableAmount": source_doc.get("totalPayableAmount"),
                "original_payableAmount": source_doc.get("payableAmount")
            }
        }
        
        # For outgoing_payment, add a note that amounts were not modified
        if document_type == "outgoing_payment":
            response_data["note"] = "Outgoing payment amounts remain unchanged. Debit note recorded separately."
            response_data["originalAmounts"] = {
                "totalPayableAmount": source_doc.get("totalPayableAmount"),
                "payableAmount": source_doc.get("payableAmount"),
                "totalPrice": source_doc.get("totalPrice")
            }
  
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating amount debit note: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )