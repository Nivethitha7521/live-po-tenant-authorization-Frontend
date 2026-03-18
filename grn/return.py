from datetime import datetime
import logging
import traceback
from typing import Any, Dict, List, Literal, Optional
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from bson import ObjectId
from fastapi import APIRouter, HTTPException,Request,Depends
from pydantic import BaseModel, Field
from pymongo import ReturnDocument, UpdateOne
import pytz
from grn.models import Grn, ReturnGRNRequest, ReturnReason
from grn.routes import get_current_date_and_time
from utils.database import get_apinvoice_collection,get_vendor_collection,get_purchaseitem_collection,get_inventory_collection,get_outgoingpayment_collection,get_debit_collection, get_grn_collection, get_return_reasons_collection

from .utils import calculate_item_financialsReturn, generate_note_random_id, get_current_ist_datetime,  is_valid_object_id

router = APIRouter()

# Set up logging - keep only essential logs
logging.basicConfig(level=logging.WARNING)  # Change to WARNING to reduce noise
logger = logging.getLogger(__name__)

# Keep file loggers for debugging when needed
def create_file_logger(logger_name, filename):
    """Helper function to create specialized file loggers"""
    import os
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    file_logger = logging.getLogger(logger_name)
    file_logger.setLevel(logging.WARNING)  # Change to WARNING
    file_logger.handlers.clear()
    
    file_handler = logging.FileHandler(os.path.join(log_dir, filename), encoding='utf-8')
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
    file_logger.addHandler(file_handler)
    
    return file_logger

# Create loggers for different operations
return_logger = create_file_logger('returns', 'grn_returns.log')
inventory_logger = create_file_logger('inventory', 'inventory_stock.log')
stock_logger = create_file_logger('stock_updates', 'stock_updates.log')
error_logger = create_file_logger('errors', 'errors.log')
audit_logger = create_file_logger('audit_trail', 'audit_trail.log')

class CreateAmountDebitNoteRequest(BaseModel):
    documentId: str = Field(..., description="ID of source document")
    documentType: Literal["grn", "ap_invoice", "outgoing_payment"] = Field(..., description="Type of source document")
    totalAmount: float = Field(..., gt=0, description="Total amount for debit note")
    reason: str = Field(..., description="Reason for the amount debit")
    createdBy: str = Field(..., description="Person creating the note")
    comments: Optional[str] = None

def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    return localized_now

def update_stock_for_return(item_updates: List[Dict],tenant_id: str,location_id: str = "WH001", return_date: datetime = None):
    """
    Update stock quantities for returned items in both:
    - purchaseitem collection (total stock)
    - inventory collection (location-based stock)
    """
    try:
        if not return_date:
            return_date = datetime.now(pytz.timezone('Asia/Kolkata'))
        
        purchaseitem_updates = 0
        inventory_updates = 0
        inventory_not_found = 0
        inventory_errors = 0
        
        for idx, update_info in enumerate(item_updates, 1):
            random_id = update_info.get('randomId') or update_info.get('item_rand')
            item_name = update_info.get('itemName', 'Unknown')
            quantity_to_return = update_info.get('quantityToReduce', update_info.get('returnedQuantity', 0))
            
            if not random_id or quantity_to_return <= 0:
                continue
                
            # For return, quantity is negative
            quantity_delta = -quantity_to_return
            
            # ========== STEP 1: UPDATE PURCHASEITEM COLLECTION ==========
            purchase_item = get_purchaseitem_collection(tenant_id).find_one({"randomId": random_id})
            if purchase_item:
                current_stock = purchase_item.get('stockQuantity', 0)
                new_stock = current_stock + quantity_delta
                
                if new_stock < 0:
                    new_stock = max(0, new_stock)
                
                purchaseitem_result = get_purchaseitem_collection(tenant_id).update_one(
                    {"randomId": random_id},
                    {"$set": {
                        "stockQuantity": new_stock,
                        "lastUpdatedDate": return_date
                    }}
                )
                
                if purchaseitem_result.modified_count > 0:
                    purchaseitem_updates += 1
                
                # ========== STEP 2: UPDATE INVENTORY COLLECTION ==========
                try:
                    inventory_collection = get_inventory_collection()
                    
                    inventory_item = inventory_collection.find_one({
                        "randomId": random_id,
                        "locationId": location_id
                    })
                    
                    if inventory_item:
                        current_system_stock = inventory_item.get('systemStock', 0)
                        new_system_stock = current_system_stock + quantity_delta
                        
                        if new_system_stock < 0:
                            new_system_stock = max(0, new_system_stock)
                        
                        inventory_result = inventory_collection.update_one(
                            {
                                "randomId": random_id,
                                "locationId": location_id
                            },
                            {"$set": {"systemStock": new_system_stock}}
                        )
                        
                        if inventory_result.modified_count > 0:
                            inventory_updates += 1
                        
                    else:
                        inventory_not_found += 1
                    
                except Exception:
                    inventory_errors += 1
                    
            else:
                inventory_errors += 1
        
        return {
            "success": True,
            "purchaseitem_updates": purchaseitem_updates,
            "inventory_updates": inventory_updates,
            "inventory_not_found": inventory_not_found,
            "inventory_errors": inventory_errors
        }
        
    except Exception as e:
        error_logger.error(f"Error updating stock for return: {str(e)}")
        raise

async def check_debit_note_availability(document_type: str, document_id: str, requested_amount: float,tenant_id: str) -> Dict[str, Any]:
    """
    Check if a debit note can be created for the document.
    """
    try:
        source_doc = None
        original_payable_amount = 0
        
        if document_type == "outgoing_payment":
            collection = get_outgoingpayment_collection(tenant_id)
            source_doc = collection.find_one({"_id": ObjectId(document_id)})
            if source_doc:
                original_payable_amount = source_doc.get("totalPayableAmount", 0)
                
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
        
        debit_collection = get_debit_collection(tenant_id)
        existing_notes = list(debit_collection.find({
            "$or": [
                {"documentId": document_id},
                {"outgoingPaymentId": document_id}
            ],
            "status": {"$in": ["Active", "Partially Cleared"]}
        }))
        
        total_existing_debit = 0
        for note in existing_notes:
            if note.get("isAmountOnly") or note.get("noteType") == "amount_only":
                total_existing_debit += note.get("totalAmount", note.get("debitAmount", 0))
            else:
                total_existing_debit += note.get("netAmount", 0)
        
        remaining_available = original_payable_amount - total_existing_debit
        
        if requested_amount > remaining_available:
            return {
                "can_create": False,
                "available_amount": remaining_available,
                "requested_amount": requested_amount,
                "message": f"Requested amount exceeds available amount",
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
        error_logger.error(f"Error checking debit note availability: {str(e)}")
        return {
            "can_create": False,
            "available_amount": 0,
            "message": f"Error checking availability"
        }


async def update_source_document_for_debit_note(
    document_type: str,
    document_id: str,
    total_amount: float,
    update_datetime: datetime,
    tenant_id:str
):
    """
    Updates source document to mark that it has debit notes.
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
            collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$inc": {
                        "debitAmount": total_amount,
                        "existingDebitNotesCount": 1
                    },
                    "$set": {
                        "lastUpdatedDate": update_datetime,
                        "hasDebitCreditNotes": True
                    }
                }
            )

        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    except Exception as e:
        error_logger.error(f"Failed to update source document: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update source document after creating debit note"
        )


@router.get("/getgrn/return-reasons", response_model=List[ReturnReason])
async def get_return_reasons(request: Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","grns","read"))):
    tenant_id = request.state.tenant_id
    try:
        return_reasons_collection = get_return_reasons_collection(tenant_id)
        reasons = list(return_reasons_collection.find({}, {"reason": 1, "createdDate": 1, "_id": 0}))
        return [ReturnReason(**reason) for reason in reasons]
    except Exception as e:
        error_logger.error(f"Error fetching return reasons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch return reasons")
    
@router.post("/return-reasons")
async def add_return_reason(request: Request, reason: ReturnReason):
    tenant_id = request.state.tenant_id
    try:
        return_reasons_collection = get_return_reasons_collection(tenant_id)
        existing_reason = return_reasons_collection.find_one({"reason": reason.reason})
        if existing_reason:
            return {"message": "Reason already exists"}
        reason.createdDate = get_current_ist_datetime()
        return_reasons_collection.insert_one(reason.dict())
        return {"message": "Reason added successfully", "reason": reason.reason}
    except Exception as e:
        error_logger.error(f"Error adding return reason: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add return reason")

@router.patch("/{grn_id}/return", response_model=Grn)
async def process_grn_return(httprequest: Request,grn_id: str, request: ReturnGRNRequest):
    tenant_id = httprequest.state.tenant_id
    grn_collection = get_grn_collection(tenant_id)
    purchase_item_collection = get_purchaseitem_collection(tenant_id)
    debit_credit_note_collection = get_debit_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    current_date_and_time = get_current_date_and_time()

    # Parse returnedDate to IST
    try:
        returned_date = request.returnedDate
        if returned_date.tzinfo is None:
            returned_date = pytz.UTC.localize(returned_date)
        returned_date_ist = returned_date.astimezone(pytz.timezone("Asia/Kolkata"))
    except ValueError:
        error_logger.error(f"Invalid returnedDate format")
        raise HTTPException(status_code=400, detail="Invalid returnedDate format")

    # Fetch GRN
    grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
    if not grn:
        error_logger.error(f"GRN not found for ID: {grn_id}")
        raise HTTPException(status_code=404, detail="GRN not found")

    # Sanitize grnDate
    if not isinstance(grn.get("grnDate"), datetime):
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
        except Exception:
            grn["grnDate"] = current_date_and_time['utc_datetime']

    if grn.get("status") == "Fully Returned":
        error_logger.error(f"GRN already fully returned")
        raise HTTPException(status_code=400, detail="GRN already fully returned")

    # Validate request
    if request.scenario == "partial" and not request.items:
        error_logger.error("Items list required for partial return")
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
    
    # Store items for new debit note creation and stock updates
    current_return_items = []
    stock_update_list = []  # For inventory update

    if request.scenario == "full":
        for item in item_details:
            item_id = item["itemId"]
            current_received = item.get("receivedQuantity", 0)
            current_returned = item.get("returnedQuantity", 0) or 0
            remaining = round(current_received - current_returned, 2)

            if remaining <= 0:
                updated_items.append(item.copy())
                continue

            if remaining > current_received:
                error_logger.error(f"Invalid return quantity for item {item_id}")
                raise HTTPException(status_code=400, detail=f"Invalid return quantity for item {item_id}")

            item_name = item.get("itemName")
            
            # Track for stock updates
            stock_updates[item_id] = stock_updates.get(item_id, {"itemName": item_name, "quantityToReduce": 0, "randomId": item.get("item_rand")})
            stock_updates[item_id]["quantityToReduce"] = round(stock_updates[item_id]["quantityToReduce"] + remaining, 2)
            
            # Get current stock before update for tracking
            purchase_item = purchase_item_collection.find_one({
                "$or": [
                    {"purchaseitemId": item_id},
                    {"_id": ObjectId(item_id) if is_valid_object_id(item_id) else None},
                    {"itemName": item_name}
                ]
            })
            
            before_stock = purchase_item.get("stockQuantity", 0) if purchase_item else 0
            
            # Add to stock update list for inventory
            stock_update_list.append({
                "randomId": item.get("item_rand"),
                "itemName": item_name,
                "quantityToReduce": remaining,
                "itemId": item_id,
                "beforeStock": before_stock
            })

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
                "quantity": remaining,
                "unitPrice": item.get("unitPrice", 0),
                "totalPrice": returned_financials["totalPrice"],
                "taxAmount": returned_financials["taxAmount"],
                "discountAmount": returned_financials.get("discountAmount", 0),
                "finalPrice": returned_financials["finalPrice"],
                "sgst": returned_financials["sgst"],
                "cgst": returned_financials["cgst"],
                "reason": request.comments or "Full GRN return"
            })

            updated_item["returnHistory"] = updated_item.get("returnHistory", []) + [{
                "date": returned_date_ist.isoformat(),
                "by": request.returnedBy,
                "nos": updated_item.get("nos", 1),
                "eachQuantity": updated_item.get("eachQuantity", current_received),
                "totalUnits": remaining,
                "reason": request.comments or "Full GRN return",
                "timestamp": current_date_and_time['utc_datetime'],
                "status": updated_item["status"]
            }]

            updated_items.append(updated_item)
    else:  # partial scenario
        items_to_process = [item.dict() if hasattr(item, 'dict') else item for item in request.items]
        item_ids = {item["itemId"] for item in items_to_process}

        if len(item_ids) != len(items_to_process):
            error_logger.error("Duplicate item IDs in request")
            raise HTTPException(status_code=400, detail="Duplicate item IDs in request")

        for return_item in items_to_process:
            item_id = return_item["itemId"]
            item = item_map.get(item_id)
            if not item:
                error_logger.error(f"Item ID {item_id} not found in GRN")
                raise HTTPException(status_code=404, detail=f"Item ID {item_id} not found")

            current_received = item.get("receivedQuantity", 0)
            current_returned = item.get("returnedQuantity", 0) or 0
            remaining = round(current_received - current_returned, 2)

            units_to_return = round(return_item["nos"] * return_item["eachQuantity"], 2)
            if units_to_return > remaining:
                error_logger.error(f"Cannot return {units_to_return} units for item {item_id}. Only {remaining} available")
                raise HTTPException(status_code=400, detail=f"Cannot return {units_to_return} units for item {item_id}. Only {remaining} available")
            if units_to_return <= 0:
                continue

            return_status = "FullyReturned" if units_to_return >= remaining else "PartiallyReturned"

            item_name = item.get("itemName")
            
            # Track for stock updates
            stock_updates[item_id] = stock_updates.get(item_id, {"itemName": item_name, "quantityToReduce": 0, "randomId": item.get("item_rand")})
            stock_updates[item_id]["quantityToReduce"] = round(stock_updates[item_id]["quantityToReduce"] + units_to_return, 2)
            
            # Get current stock before update for tracking
            purchase_item = purchase_item_collection.find_one({
                "$or": [
                    {"purchaseitemId": item_id},
                    {"_id": ObjectId(item_id) if is_valid_object_id(item_id) else None},
                    {"itemName": item_name}
                ]
            })
            
            before_stock = purchase_item.get("stockQuantity", 0) if purchase_item else 0
            
            # Add to stock update list for inventory
            stock_update_list.append({
                "randomId": item.get("item_rand"),
                "itemName": item_name,
                "quantityToReduce": units_to_return,
                "itemId": item_id,
                "beforeStock": before_stock
            })

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
                "quantity": units_to_return,
                "unitPrice": item.get("unitPrice", 0),
                "totalPrice": returned_financials["totalPrice"],
                "taxAmount": returned_financials["taxAmount"],
                "discountAmount": returned_financials.get("discountAmount", 0),
                "finalPrice": returned_financials["finalPrice"],
                "sgst": returned_financials["sgst"],
                "cgst": returned_financials["cgst"],
                "reason": return_item.get("returnReason") or request.comments or "Partial GRN return"
            })

            updated_item["returnHistory"] = updated_item.get("returnHistory", []) + [{
                "date": returned_date_ist.isoformat(),
                "by": request.returnedBy,
                "nos": return_item["nos"],
                "eachQuantity": return_item["eachQuantity"],
                "totalUnits": units_to_return,
                "reason": return_item.get("returnReason") or request.comments or "Partial GRN return",
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
            error_logger.error(f"Invalid return: returned quantity exceeds received quantity")
            raise HTTPException(status_code=400, detail="exceeds received quantity for item")
        if returned_qty > 0:
            any_items_returned = True
        if received_qty > returned_qty:
            all_items_fully_returned = False

    # Only update status if not APInvoiceConverted
    current_status = grn.get("status")
    if current_status != "APInvoiceConverted":
        new_status = "Fully Returned" if all_items_fully_returned and any_items_returned else "Partially Returned" if any_items_returned else "Active"
    else:
        new_status = current_status

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
            if existing_debit_note.get("status") == "Active":
                should_create_new_note = False

        if should_create_new_note:
            # Create new individual debit note
            note_data = {
                "documentId": grn_id,      
                "documentType": "grn",
                "grnId": grn_id,
                "vendorName": grn.get("vendorName"),
                "invoiceNo": grn.get('invoiceNo'),
                "itemDetails": current_return_items,
                "createdDate": current_date_and_time['utc_datetime'],
                "createdBy": request.returnedBy,
                "lastUpdatedDate": current_date_and_time['utc_datetime'],
                "totalAmount": round(note_total_amount, 2),
                "totalTax": round(note_total_tax, 2),
                "totalDiscount": round(note_total_discount, 2),
                "finalAmount": round(note_final_amount, 2),
                "noteType": "debit",
                "status": "Active",
                "returnDate": returned_date_ist.isoformat(),
                "randomId": await generate_note_random_id(tenant_id)
            }

            insert_result = debit_credit_note_collection.insert_one(note_data)
            debit_credit_note_collection.update_one(
                {"_id": insert_result.inserted_id},
                {"$set": {"noteId": str(insert_result.inserted_id)}}
            )

        else:
            # Combine with existing Active debit note
            existing_items = existing_debit_note.get("itemDetails", [])
            combined_items = existing_items + current_return_items
            
            new_total_amount = existing_debit_note.get("totalAmount", 0) + note_total_amount
            new_total_tax = existing_debit_note.get("totalTax", 0) + note_total_tax
            new_total_discount = existing_debit_note.get("totalDiscount", 0) + note_total_discount
            new_final_amount = existing_debit_note.get("finalAmount", 0) + note_final_amount
            
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

    # ========== UPDATE STOCK IN PURCHASEITEM COLLECTION ==========
    purchase_item_updates_count = 0
    detailed_item_updates = []
    
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
            
            purchase_item_collection.update_one(
                {"_id": purchase_item["_id"]},
                {"$set": {
                    "stockQuantity": new_stock,
                    "lastUpdatedDate": current_date_and_time['utc_datetime']
                }}
            )
            purchase_item_updates_count += 1
            
            detailed_item_updates.append({
                "randomId": update_info.get("randomId"),
                "itemName": update_info["itemName"],
                "quantityToReduce": update_info["quantityToReduce"],
                "beforeStock": current_stock,
                "afterStock": new_stock,
                "status": "success",
                "beforeLocationStock": current_stock,
                "afterLocationStock": new_stock
            })
        else:
            detailed_item_updates.append({
                "randomId": update_info.get("randomId"),
                "itemName": update_info["itemName"],
                "quantityToReduce": update_info["quantityToReduce"],
                "beforeStock": None,
                "afterStock": None,
                "status": "failed",
                "reason": "Purchase item not found"
            })

    # ========== UPDATE INVENTORY COLLECTION FOR RETURN ==========
    inventory_update_result = None
    
    if stock_update_list and any_items_returned:
        for update in stock_update_list:
            purchase_item = purchase_item_collection.find_one({"randomId": update["randomId"]})
            if purchase_item:
                update["beforeStock"] = purchase_item.get("stockQuantity", 0)
        
        inventory_update_result = update_stock_for_return(
            stock_update_list,
            tenant_id,
            location_id="WH001",
            return_date=current_date_and_time['utc_datetime']
        )
        
        # Update detailed item updates with inventory info
        for item_update in detailed_item_updates:
            matching_inventory = next(
                (inv for inv in stock_update_list if inv.get("randomId") == item_update["randomId"]),
                None
            )
            if matching_inventory:
                item_update["beforeLocationStock"] = matching_inventory.get("beforeStock", 0)
                item_update["afterLocationStock"] = max(0, matching_inventory.get("beforeStock", 0) - item_update["quantityToReduce"])

    # Update GRN
    update_data = {
        "itemDetails": updated_items,
        "status": new_status,
        "grnReturnedDate": returned_date_ist if any_items_returned else None,
        "grnReturnedPerson": request.returnedBy if any_items_returned else None,
        "comments": request.comments,
        "totalReturnedAmount": round(sum(item.get("returnedFinalPrice", 0) or 0 for item in updated_items), 2),
        "totalReturnedTax": round(sum(item.get("returnedTaxAmount", 0) or 0 for item in updated_items), 2),
        "totalReturnedDiscount": round(sum(item.get("returnedDiscountAmount", 0) or 0 for item in updated_items), 2),
        "totalReturnedUnits": round(sum(item.get("returnedQuantity", 0) or 0 for item in updated_items), 2),
        "lastUpdatedDate": current_date_and_time['utc_datetime'],
        "hasDebitCreditNotes": any_items_returned,
    }

    updated_grn = grn_collection.find_one_and_update(
        {"_id": ObjectId(grn_id)},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER
    )

    # Prepare the response
    updated_grn_dict = dict(updated_grn)
    updated_grn_dict["grnId"] = str(updated_grn_dict["_id"])
    updated_grn_dict.pop("_id", None)

    # ========== ADD STOCK UPDATE RESULT TO RESPONSE ==========
    stock_update_result = None
    if any_items_returned and detailed_item_updates:
        stock_update_result = {
            "purchaseitem_updates": purchase_item_updates_count,
            "inventory_updates": inventory_update_result.get("inventory_updates", 0) if inventory_update_result else 0,
            "inventory_not_found": inventory_update_result.get("inventory_not_found", 0) if inventory_update_result else 0,
            "inventory_errors": inventory_update_result.get("inventory_errors", 0) if inventory_update_result else 0,
            "items": detailed_item_updates,
            "success": True,
            "message": f"Stock updated for {len(detailed_item_updates)} items"
        }
        
        updated_grn_dict["stockUpdateResult"] = stock_update_result
        updated_grn_dict["returnStockUpdateResult"] = stock_update_result
    else:
        stock_update_result = {
            "purchaseitem_updates": 0,
            "inventory_updates": 0,
            "inventory_not_found": 0,
            "inventory_errors": 0,
            "items": [],
            "success": True,
            "message": "No stock updates performed"
        }
        updated_grn_dict["stockUpdateResult"] = stock_update_result
        updated_grn_dict["returnStockUpdateResult"] = stock_update_result

    return_logger.info(f"RETURN_COMPLETE|grn_id={grn_id}|status={new_status}|items={len(current_return_items)}|amount={total_returned_amount}")
    audit_logger.info(f"GRN_RETURN|grn_id={grn_id}|returned_by={request.returnedBy}")

    return updated_grn_dict

def calculate_item_financialsReturn(item: Dict, units: float) -> Dict:
    unit_price = item.get("unitPrice", 0) or 0
    if unit_price <= 0 or units <= 0:
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
        final_price = 0.0

    return {
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

@router.post("/returnprocess/AmountDebitNote/create")
async def create_amount_debit_note(httprequest:Request,request: CreateAmountDebitNoteRequest):
    tenant_id = httprequest.state.tenant_id
    """
    Create amount-only debit note for GRN, AP Invoice, or Outgoing Payment
    """
    try:
        if not is_valid_object_id(request.documentId):
            raise HTTPException(status_code=400, detail="Invalid document ID format")

        availability_check = await check_debit_note_availability(
            request.documentType,
            request.documentId,
            request.totalAmount,
            tenant_id
        )
        
        if not availability_check["can_create"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": availability_check["message"],
                    "available_amount": availability_check["available_amount"],
                    "requested_amount": request.totalAmount
                }
            )
        
        note_id =await generate_note_random_id(tenant_id)
        
        source_doc = None
        document_type = request.documentType
        document_id = request.documentId

        if document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            source_doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                source_doc = outgoing_collection.find_one({"randomId": document_id})
                
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
                detail=f"Document not found with ID: {document_id}"
            )

        now_ist = get_current_ist_datetime()
        remaining_payable_amount = availability_check.get("remaining_available", 0)
        
        debit_note_doc = {
            "_id": ObjectId(),
            "noteId": note_id, 
            "randomId": note_id,
            "documentId": document_id,
            "documentType": document_type,
            "vendorName": source_doc.get("vendorName", ""),
            "invoiceNo": source_doc.get("invoiceNo"),
            "address": source_doc.get("address", ""),
            "city": source_doc.get("city", ""),
            "state": source_doc.get("state", ""),
            "country": source_doc.get("country", ""),
            "gstNumber": source_doc.get("gstNumber", ""),
            "totalAmount": request.totalAmount,
            "debitAmount": request.totalAmount,
            "finalAmount": request.totalAmount,
            "reason": request.reason,
            "createdDate": now_ist,
            "createdBy": request.createdBy,
            "lastUpdatedDate": now_ist,
            "comments": request.comments or "",
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
                "totalExistingDebit": availability_check.get("total_existing_debit", 0)
            },
            "itemDetails": [{
                "itemId": document_id,
                "itemName": f"Amount Adjustment - {request.reason}",
                "noteType": "debit",
                "quantity": 1,
                "uom": "NOS",
                "unitPrice": request.totalAmount,
                "totalPrice": request.totalAmount,
                "finalPrice": request.totalAmount,
                "reason": request.reason,
                "isAmountOnly": True
            }]
        }

        if document_type == "grn":
            debit_note_doc["grnId"] = document_id
            debit_note_doc["sourceDocumentType"] = "grn"
        elif document_type == "ap_invoice":
            debit_note_doc["apInvoiceId"] = document_id
            debit_note_doc["sourceDocumentType"] = "ap_invoice"
        elif document_type == "outgoing_payment":
            debit_note_doc["outgoingPaymentId"] = document_id
            debit_note_doc["sourceDocumentType"] = "outgoing_payment"

        debit_collection = get_debit_collection(tenant_id)
        insert_result = debit_collection.insert_one(debit_note_doc)
        mongo_id = str(insert_result.inserted_id)

        await update_source_document_for_debit_note(
            document_type,
            document_id,
            request.totalAmount,
            now_ist,
            tenant_id
        )

        audit_logger.info(f"AMOUNT_DEBIT_NOTE_CREATED|note_id={note_id}|type={document_type}")
        
        response_data = {
            "success": True,
            "noteId": note_id,
            "mongoId": mongo_id,
            "message": "Amount-only debit note created successfully",
            "totalAmount": request.totalAmount,
            "finalAmount": request.totalAmount, 
            "reason": request.reason,
            "remainingPayableAmount": remaining_payable_amount,
            "createdAt": now_ist.isoformat(),
            "noteNumber": note_id
        }
  
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        error_logger.error(f"Error creating amount debit note: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error"
        )