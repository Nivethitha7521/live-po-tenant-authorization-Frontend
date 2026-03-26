from datetime import datetime
import logging
import traceback
from typing import Any, Dict, List, Literal, Optional
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from pymongo import ReturnDocument, UpdateOne
import pytz
from grn.models import Grn, ReturnGRNRequest, ReturnReason
from grn.routes import get_current_date_and_time
from utils.database import get_apinvoice_collection, get_vendor_collection, get_inventory_collection, get_outgoingpayment_collection, get_debit_collection, get_grn_collection, get_return_reasons_collection

from .utils import calculate_item_financialsReturn, generate_note_random_id, get_current_ist_datetime, is_valid_object_id

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

def update_inventory_only_for_return(item_updates: List[Dict], tenant_id: str, location_id: str = None, return_date: datetime = None) -> Dict:
    """
    UPDATE ONLY INVENTORY COLLECTION FOR RETURNS - NO ITEM MASTER UPDATE
    Update stock quantities in inventory collection (location-based stock) for returns.
    
    For returns, we SUBTRACT the quantities from inventory (stock decreases).
    
    Returns detailed item-level stock changes.
    """
    try:
        if not return_date:
            return_date = datetime.now(pytz.timezone('Asia/Kolkata'))
        
        inventory_updates = 0
        inventory_creates = 0
        inventory_not_found = 0
        inventory_errors = 0
        stock_validation_failures = 0
        
        detailed_results = []
        
        logging.info("=" * 100)
        logging.info(f"INVENTORY ONLY UPDATE FOR RETURN - SUBTRACTING STOCK")
        logging.info(f"Timestamp: {return_date}")
        logging.info(f"Total items to process: {len(item_updates)}")
        logging.info("=" * 100)
        
        for idx, update_info in enumerate(item_updates, 1):
            random_id = update_info.get('randomId') or update_info.get('item_rand')
            item_name = update_info.get('itemName', 'Unknown')
            quantity_to_return = update_info.get('quantityToReduce', update_info.get('returnedQuantity', 0))
            
            # ===== CRITICAL: Get location from item or use provided location_id =====
            # Priority: 1. location_id from function param, 2. locationId from item, 3. "WH001" as fallback
            item_location_id = location_id or update_info.get('locationId') or "WH001"
            
            if not random_id or quantity_to_return <= 0:
                continue
            
            logging.info(f"\n--- Processing Return Item {idx}/{len(item_updates)} ---")
            logging.info(f"Item RandomId: {random_id}")
            logging.info(f"Item Name: {item_name}")
            logging.info(f"Location: {item_location_id}")
            logging.info(f"Quantity to Return (Subtract): {quantity_to_return}")
            
            # Initialize result for this item
            item_result = {
                "randomId": random_id,
                "itemName": item_name,
                "stockChange": 0,  # Item Master stock change - set to 0 (NO UPDATE)
                "newStock": 0,      # Item Master new total stock - set to 0 (NO UPDATE)
                "locationStockChange": 0,  # Location-specific stock change
                "newLocationStock": 0,      # Location-specific new stock
                "locationId": item_location_id,
                "status": "success",
                "reason": None
            }
            
            try:
                # ========== STEP 1: SKIP PURCHASEITEM UPDATE (NO ITEM MASTER UPDATE) ==========
                logging.info(f"⏭️ SKIPPING PURCHASEITEM UPDATE - No item master stock change for return")
                
                # ========== STEP 2: UPDATE ONLY INVENTORY COLLECTION (LOCATION-BASED) ==========
                try:
                    inventory_collection = get_inventory_collection()
                    
                    # Find inventory by BOTH randomId AND locationId
                    inventory_item = inventory_collection.find_one({
                        "randomId": random_id,
                        "locationId": item_location_id
                    })
                    
                    if inventory_item:
                        # EXISTING LOCATION - UPDATE systemStock ONLY
                        current_system_stock = inventory_item.get('systemStock', 0)
                        
                        # ===== STOCK VALIDATION FOR RETURN =====
                        if current_system_stock < quantity_to_return:
                            # Not enough stock at this location!
                            error_msg = f"Insufficient stock at location {item_location_id} for return: Available {current_system_stock:.2f}, Need to return {quantity_to_return:.2f}"
                            logging.error(f"❌ {error_msg}")
                            
                            item_result["status"] = "failed"
                            item_result["reason"] = error_msg
                            detailed_results.append(item_result)
                            stock_validation_failures += 1
                            inventory_errors += 1
                            continue  # Skip this item, don't update
                        
                        # Calculate new stock (subtract for return)
                        new_system_stock = current_system_stock - quantity_to_return
                        
                        logging.info(f"Location Stock Calculation: {current_system_stock:.2f} - {quantity_to_return:.2f} = {new_system_stock:.2f}")
                        
                        # Ensure stock doesn't go negative (safety check)
                        if new_system_stock < 0:
                            actual_location_change = -current_system_stock
                            new_system_stock = 0
                            logging.warning(f"⚠️ Location stock would become negative. Capping at 0. Actual removed: {current_system_stock:.2f}")
                            item_result["reason"] = f"Location stock capped at 0 (attempted to return {quantity_to_return:.2f}, only {current_system_stock:.2f} available)"
                        else:
                            actual_location_change = -quantity_to_return
                        
                        # UPDATE ONLY systemStock - NO OTHER FIELDS CHANGED
                        inventory_update_data = {
                            "systemStock": new_system_stock,
                        }
                        
                        
                        inventory_result = inventory_collection.update_one(
                            {
                                "randomId": random_id,
                                "locationId": item_location_id
                            },
                            {"$set": inventory_update_data}
                        )
                        
                        if inventory_result.modified_count > 0:
                            inventory_updates += 1
                        
                        actual_location_change = new_system_stock - current_system_stock
                        item_result["locationStockChange"] = actual_location_change
                        item_result["newLocationStock"] = new_system_stock
                        
                        logging.info(f"✅ INVENTORY UPDATED for Return at Location {item_location_id}: {current_system_stock:.2f} -> {new_system_stock:.2f} (Change: {actual_location_change:+.2f})")
                        
                    else:
                        # For return, if location record doesn't exist, we can't subtract from it
                        inventory_not_found += 1
                        item_result["status"] = "failed"
                        item_result["reason"] = f"No inventory record found for location {item_location_id} to return from"
                        logging.warning(f"⚠️ No existing inventory record for location {item_location_id} to return from. Cannot subtract stock.")
                    
                except Exception as inv_error:
                    inventory_errors += 1
                    item_result["status"] = "failed"
                    item_result["reason"] = f"Inventory update failed: {str(inv_error)}"
                    logging.error(f"❌ Inventory update failed: {str(inv_error)}")
            
            except Exception as item_error:
                item_result["status"] = "failed"
                item_result["reason"] = str(item_error)
                logging.error(f"❌ Error processing item {random_id}: {str(item_error)}")
            
            detailed_results.append(item_result)
        
        # Calculate summary
        successful_items = sum(1 for r in detailed_results if r["status"] == "success")
        failed_items = sum(1 for r in detailed_results if r["status"] == "failed")
        
        summary = {
            "success": failed_items == 0,
            "totalProcessed": len(detailed_results),
            "successful": successful_items,
            "failed": failed_items,
            "items": detailed_results,
            "timestamp": return_date.isoformat(),
            "purchaseitem_updates": 0,  # Always 0 - we don't update item master
            "inventory_updates": inventory_updates,
            "inventory_creates": inventory_creates,
            "inventory_not_found": inventory_not_found,
            "stock_validation_failures": stock_validation_failures,
            "errors": inventory_errors
        }
        
        # Log final summary
        summary_lines = []
        summary_lines.append("=" * 100)
        summary_lines.append("📊 INVENTORY ONLY RETURN UPDATE COMPLETE SUMMARY")
        summary_lines.append("=" * 100)
        summary_lines.append(f"Operation Type: RETURN (SUBTRACT)")
        summary_lines.append(f"Total Items Processed: {len(detailed_results)}")
        summary_lines.append(f"Successful: {successful_items}")
        summary_lines.append(f"Failed: {failed_items}")
        summary_lines.append("")
        summary_lines.append("📍 INVENTORY UPDATES (Location-Based ONLY - NO ITEM MASTER):")
        summary_lines.append(f"   - Location Updates: {inventory_updates}")
        summary_lines.append(f"   - Location Creates: {inventory_creates}")
        summary_lines.append(f"   - Location Not Found: {inventory_not_found}")
        summary_lines.append(f"   - Stock Validation Failures: {stock_validation_failures}")
        summary_lines.append(f"   - Errors: {inventory_errors}")
        summary_lines.append("=" * 100)
        
        logging.info("\n".join(summary_lines))
        
        # Log to inventory logger
        inventory_logger.info(f"INVENTORY_ONLY_RETURN|items={len(detailed_results)}|updates={inventory_updates}|not_found={inventory_not_found}|validation_failures={stock_validation_failures}|location={location_id}")
        
        return summary
        
    except Exception as e:
        error_msg = f"❌ Error updating inventory for return: {str(e)}"
        logging.error(error_msg)
        logging.exception("Full traceback:")
        error_logger.error(error_msg)
        raise

async def check_debit_note_availability(document_type: str, document_id: str, requested_amount: float, tenant_id: str) -> Dict[str, Any]:
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
    tenant_id: str
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
async def get_return_reasons(request: Request, user = Depends(validate_token),
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
async def process_grn_return(httprequest: Request, grn_id: str, request: ReturnGRNRequest):
    tenant_id = httprequest.state.tenant_id
    grn_collection = get_grn_collection(tenant_id)
    # REMOVED: purchase_item_collection - we don't need it anymore
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

    # ===== CRITICAL: Get location from GRN =====
    # Check both possible field names that might store the location
    grn_location_id = grn.get('locationId')  # Try locationId first
    if not grn_location_id:
        # If locationId not found, try receivingLocation (which might be name)
        grn_location_name = grn.get('receivingLocation')
        # Default to WH001 if no location found, but log it
        grn_location_id = "WH001"
        logging.warning(f"⚠️ No locationId found in GRN {grn_id}, using default: {grn_location_id}")
        logging.warning(f"   receivingLocation field contains: {grn_location_name}")
    else:
        grn_location_name = grn.get('receivingLocation', 'Unknown Location')
    
    logging.info(f"📍 GRN RETURN LOCATION DETECTED: ID={grn_location_id}, Name={grn_location_name}")
    return_logger.info(f"RETURN_LOCATION|grn_id={grn_id}|location={grn_location_id}|name={grn_location_name}")

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
    
    # Store items for new debit note creation and stock updates
    current_return_items = []
    stock_update_list = []  # For inventory update (NO purchaseitem updates)

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
            
            # Add to stock update list for inventory ONLY - WITH LOCATION
            stock_update_list.append({
                "randomId": item.get("item_rand"),
                "itemName": item_name,
                "quantityToReduce": remaining,
                "itemId": item_id,
                "locationId": grn_location_id  # ADD LOCATION HERE
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
                "reason": request.comments or "Full GRN return",
                "locationId": grn_location_id  # ADD LOCATION HERE
            })

            updated_item["returnHistory"] = updated_item.get("returnHistory", []) + [{
                "date": returned_date_ist.isoformat(),
                "by": request.returnedBy,
                "nos": updated_item.get("nos", 1),
                "eachQuantity": updated_item.get("eachQuantity", current_received),
                "totalUnits": remaining,
                "reason": request.comments or "Full GRN return",
                "timestamp": current_date_and_time['utc_datetime'],
                "status": updated_item["status"],
                "locationId": grn_location_id  # ADD LOCATION HERE
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
            
            # Add to stock update list for inventory ONLY - WITH LOCATION
            stock_update_list.append({
                "randomId": item.get("item_rand"),
                "itemName": item_name,
                "quantityToReduce": units_to_return,
                "itemId": item_id,
                "locationId": grn_location_id  # ADD LOCATION HERE
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
                "reason": return_item.get("returnReason") or request.comments or "Partial GRN return",
                "locationId": grn_location_id  # ADD LOCATION HERE
            })

            updated_item["returnHistory"] = updated_item.get("returnHistory", []) + [{
                "date": returned_date_ist.isoformat(),
                "by": request.returnedBy,
                "nos": return_item["nos"],
                "eachQuantity": return_item["eachQuantity"],
                "totalUnits": units_to_return,
                "reason": return_item.get("returnReason") or request.comments or "Partial GRN return",
                "timestamp": current_date_and_time['utc_datetime'],
                "status": return_status,
                "locationId": grn_location_id  # ADD LOCATION HERE
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
                "randomId": await generate_note_random_id(tenant_id),
                "locationId": grn_location_id  # ADD LOCATION HERE
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
                        "locationId": grn_location_id  # ADD LOCATION HERE
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

    # ========== REMOVED: UPDATE STOCK IN PURCHASEITEM COLLECTION ==========
    # NO ITEM MASTER UPDATE DURING RETURN
    
    # ========== UPDATE ONLY INVENTORY COLLECTION FOR RETURN ==========
    inventory_update_result = None
    
    if stock_update_list and any_items_returned:
        # Pass the GRN location to the inventory-only update function
        inventory_update_result = update_inventory_only_for_return(
            stock_update_list,
            tenant_id,
            location_id=grn_location_id,  # PASS THE DYNAMIC LOCATION HERE
            return_date=current_date_and_time['utc_datetime']
        )

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
    if any_items_returned and inventory_update_result:
        updated_grn_dict["stockUpdateResult"] = inventory_update_result
        updated_grn_dict["returnStockUpdateResult"] = inventory_update_result
    else:
        updated_grn_dict["stockUpdateResult"] = {
            "success": True,
            "totalProcessed": 0,
            "successful": 0,
            "failed": 0,
            "items": [],
            "purchaseitem_updates": 0,
            "inventory_updates": 0,
            "inventory_not_found": 0,
            "errors": 0,
            "message": "No stock updates performed",
            "locationUsed": grn_location_id
        }
        updated_grn_dict["returnStockUpdateResult"] = updated_grn_dict["stockUpdateResult"]

    # Add location info to response
    updated_grn_dict["returnLocation"] = {
        "id": grn_location_id,
        "name": grn_location_name
    }
    
    # Add note about item master update
    updated_grn_dict["itemMasterUpdated"] = False
    updated_grn_dict["note"] = "Item master (purchaseitem) not updated during return - only inventory stock reduced"

    return_logger.info(f"RETURN_COMPLETE|grn_id={grn_id}|status={new_status}|items={len(current_return_items)}|amount={total_returned_amount}|location={grn_location_id}")
    audit_logger.info(f"GRN_RETURN|grn_id={grn_id}|returned_by={request.returnedBy}|location={grn_location_id}")

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
async def create_amount_debit_note(httprequest: Request, request: CreateAmountDebitNoteRequest):
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
        
        note_id = await generate_note_random_id(tenant_id)
        
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
        
        # Get location from source document if it's a GRN
        source_location_id = None
        source_location_name = None
        if document_type == "grn":
            source_location_id = source_doc.get('locationId')
            source_location_name = source_doc.get('receivingLocation')
        
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
                "totalExistingDebit": availability_check.get("total_existing_debit", 0),
                "locationId": source_location_id,
                "locationName": source_location_name
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
                "isAmountOnly": True,
                "locationId": source_location_id
            }]
        }

        if document_type == "grn":
            debit_note_doc["grnId"] = document_id
            debit_note_doc["sourceDocumentType"] = "grn"
            debit_note_doc["locationId"] = source_location_id
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

        audit_logger.info(f"AMOUNT_DEBIT_NOTE_CREATED|note_id={note_id}|type={document_type}|location={source_location_id}")
        
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
            "noteNumber": note_id,
            "locationId": source_location_id,
            "locationName": source_location_name
        }
  
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        error_logger.error(f"Error creating amount debit note: {str(e)}")
        error_logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error"
        )