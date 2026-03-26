from datetime import datetime
import logging
import os
from typing import Dict, List
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
import pytz
from utils.database import get_grn_collection
from utils.database import get_inventory_collection, get_purchaseorder_collection

router = APIRouter()

# ========== LOGGING CONFIGURATION ==========
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

def create_file_logger(logger_name, filename):
    """Helper function to create specialized file loggers"""
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    
    file_handler = logging.FileHandler(os.path.join(log_dir, filename), encoding='utf-8')
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
    logger.addHandler(file_handler)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(console_handler)
    
    return logger

# Create loggers
stock_logger = create_file_logger('stock_updates', 'stock_updates.log')
inventory_logger = create_file_logger('inventory', 'inventory_stock.log')
grn_logger = create_file_logger('grn_operations', 'grn_operations.log')
po_logger = create_file_logger('po_updates', 'po_updates.log')
error_logger = create_file_logger('errors', 'errors.log')
audit_logger = create_file_logger('audit_trail', 'audit_trail.log')

def update_inventory_only(tenant_id: str, grn_item_details: List[Dict], reverse: bool = False) -> Dict:
    """
    UPDATE ONLY INVENTORY COLLECTION - NO ITEM MASTER UPDATE
    Update stock quantities in inventory collection (location-based stock)
    
    For reverse=True (revert operation), we SUBTRACT the quantities.
    For reverse=False (normal receipt), we ADD the quantities.
    
    Returns detailed item-level stock changes for UI display.
    """
    try:
        current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
        
        # Track detailed results for each item
        detailed_results = []
        
        # Track counts for summary
        inventory_updates = 0
        inventory_creates = 0
        inventory_errors = 0
        inventory_not_found = 0
        stock_validation_failures = 0
        
        operation_type = "REVERT (SUBTRACT)" if reverse else "RECEIPT (ADD)"
        quantity_multiplier = -1 if reverse else 1
        
        logging.info("=" * 100)
        logging.info(f"INVENTORY ONLY UPDATE - {operation_type}")
        logging.info(f"Timestamp: {current_datetime}")
        logging.info(f"Total items to process: {len(grn_item_details)}")
        logging.info("=" * 100)
        
        for idx, item in enumerate(grn_item_details, 1):
            random_id = item['item_rand']
            received_quantity = item['receivedQuantity']
            location_id = item.get('locationId')
            item_name = item.get('itemName', 'Unknown')
            
            if not location_id:
                error_msg = f"❌ CRITICAL: No locationId provided for item {random_id} - {item_name}"
                logging.error(error_msg)
                error_logger.error(error_msg)
                item_result = {
                    "randomId": random_id,
                    "itemName": item_name,
                    "stockChange": 0,
                    "newStock": 0,
                    "locationStockChange": 0,
                    "newLocationStock": 0,
                    "locationId": "MISSING",
                    "priceUpdated": False,
                    "status": "failed",
                    "reason": "No location ID provided"
                }
                detailed_results.append(item_result)
                inventory_errors += 1
                continue
            
            quantity_delta = received_quantity * quantity_multiplier
            operation = "SUBTRACT" if reverse else "ADD"
            
            logging.info(f"\n--- Processing Item {idx}/{len(grn_item_details)} ---")
            logging.info(f"Item RandomId: {random_id}")
            logging.info(f"Item Name: {item_name}")
            logging.info(f"Location: {location_id}")
            logging.info(f"Quantity Change: {quantity_delta:+.2f} ({operation} {received_quantity})")
            
            item_result = {
                "randomId": random_id,
                "itemName": item_name,
                "stockChange": 0,  # Item Master stock change - set to 0 (NO UPDATE)
                "newStock": 0,      # Item Master new total stock - set to 0 (NO UPDATE)
                "locationStockChange": 0,
                "newLocationStock": 0,
                "locationId": location_id,
                "priceUpdated": False,
                "status": "success",
                "reason": None
            }
            
            try:
                # ========== STEP 1: SKIP PURCHASEITEM UPDATE (NO ITEM MASTER UPDATE) ==========
                logging.info(f"⏭️ SKIPPING PURCHASEITEM UPDATE - No item master stock change during REVERT")
                
                # ========== STEP 2: UPDATE ONLY INVENTORY COLLECTION (LOCATION-BASED) ==========
                try:
                    inventory_collection = get_inventory_collection()
                    
                    inventory_item = inventory_collection.find_one({
                        "randomId": random_id,
                        "locationId": location_id
                    })
                    
                    if inventory_item:
                        current_system_stock = inventory_item.get('systemStock', 0)
                        
                        # Stock validation for revert
                        if reverse and current_system_stock < received_quantity:
                            error_msg = f"Insufficient stock at location {location_id}: Available {current_system_stock:.2f}, Need to revert {received_quantity:.2f}"
                            logging.error(f"❌ {error_msg}")
                            
                            item_result["status"] = "failed"
                            item_result["reason"] = error_msg
                            detailed_results.append(item_result)
                            stock_validation_failures += 1
                            continue
                        
                        new_system_stock = current_system_stock + quantity_delta
                        
                        logging.info(f"Location Stock Calculation: {current_system_stock:.2f} + ({quantity_delta:+.2f}) = {new_system_stock:.2f}")
                        
                        if new_system_stock < 0:
                            actual_location_delta = -current_system_stock
                            new_system_stock = 0
                            logging.warning(f"⚠️ Location stock would become negative. Capping at 0. Actual removed: {current_system_stock:.2f}")
                            item_result["reason"] = f"Location stock capped at 0 (attempted to remove {received_quantity:.2f}, only {current_system_stock:.2f} available)"
                        else:
                            actual_location_delta = quantity_delta
                        
                        inventory_update_data = {
                            "systemStock": new_system_stock,
                        }
                        
                        
                        inventory_result = inventory_collection.update_one(
                            {
                                "randomId": random_id,
                                "locationId": location_id
                            },
                            {"$set": inventory_update_data}
                        )
                        
                        if inventory_result.modified_count > 0:
                            inventory_updates += 1
                        
                        actual_location_change = new_system_stock - current_system_stock
                        item_result["locationStockChange"] = actual_location_change
                        item_result["newLocationStock"] = new_system_stock
                        
                        logging.info(f"✅ INVENTORY UPDATED for Location {location_id}: {current_system_stock:.2f} -> {new_system_stock:.2f} (Change: {actual_location_change:+.2f})")
                        
                    else:
                        if reverse:
                            inventory_not_found += 1
                            item_result["status"] = "failed"
                            item_result["reason"] = f"No inventory record found for location {location_id} to revert"
                            logging.warning(f"⚠️ No existing inventory record for location {location_id} to revert. Cannot subtract stock.")
                        else:
                            new_system_stock = quantity_delta
                            location_change = quantity_delta
                            
                            new_inventory_item = {
                                "randomId": random_id,
                                "locationId": location_id,
                                "systemStock": new_system_stock,
                            }
                            
                            inventory_result = inventory_collection.insert_one(new_inventory_item)
                            inventory_creates += 1
                            
                            item_result["locationStockChange"] = location_change
                            item_result["newLocationStock"] = new_system_stock
                            
                            logging.info(f"✅ INVENTORY CREATED for Location {location_id} with stock: {new_system_stock:.2f}")
                    
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
        
        successful_items = sum(1 for r in detailed_results if r["status"] == "success")
        failed_items = sum(1 for r in detailed_results if r["status"] == "failed")
        
        summary = {
            "success": failed_items == 0,
            "totalProcessed": len(detailed_results),
            "successful": successful_items,
            "failed": failed_items,
            "items": detailed_results,
            "timestamp": current_datetime.isoformat(),
            "purchaseitem_updates": 0,  # Always 0 - we don't update item master during revert
            "inventory_updates": inventory_updates,
            "inventory_creates": inventory_creates,
            "inventory_not_found": inventory_not_found,
            "stock_validation_failures": stock_validation_failures,
            "errors": inventory_errors
        }
        
        logging.info("=" * 100)
        logging.info("📊 INVENTORY ONLY UPDATE COMPLETE SUMMARY")
        logging.info("=" * 100)
        logging.info(f"Operation Type: {operation_type}")
        logging.info(f"Total Items Processed: {len(detailed_results)}")
        logging.info(f"Successful: {successful_items}")
        logging.info(f"Failed: {failed_items}")
        logging.info("")
        logging.info("📍 INVENTORY UPDATES (Location-Based ONLY - NO ITEM MASTER):")
        logging.info(f"   - Location Updates: {inventory_updates}")
        logging.info(f"   - Location Creates: {inventory_creates}")
        logging.info(f"   - Location Not Found: {inventory_not_found}")
        logging.info(f"   - Stock Validation Failures: {stock_validation_failures}")
        logging.info(f"   - Errors: {inventory_errors}")
        logging.info("=" * 100)
        
        return summary
        
    except Exception as e:
        error_msg = f"❌ Error updating inventory only: {str(e)}"
        logging.error(error_msg)
        logging.exception("Full traceback:")
        error_logger.error(error_msg)
        raise

def reverse_grn_receipts_only_po(grn_item_details: List[Dict], po_items: List[Dict]) -> List[Dict]:
    """
    Reverse the receipts from a specific GRN by updating PO items' quantities.
    Returns the updated PO items list.
    Does NOT clear expiryDate - preserves it for future receipts.
    """
    po_items_map = {item['itemId']: item.copy() for item in po_items}
   
    for grn_item in grn_item_details:
        item_id = grn_item['itemId']
        received_quantity = grn_item.get('receivedQuantity', 0)
        returned_quantity = grn_item.get('returnedQuantity', 0) 
        actual_revert_qty = max(0, received_quantity - returned_quantity)
        if actual_revert_qty <= 0:
            continue
        
        po_item = po_items_map.get(item_id)
        if not po_item:
            logging.warning(f"PO item {item_id} not found for GRN reversal")
            continue
       
        po_item['totalReceivedQuantity'] -= actual_revert_qty
        po_item['quantity'] = po_item['totalReceivedQuantity']
       
        po_quantity = po_item.get('poQuantity', 0)
        pending_total = max(0, po_quantity - po_item['totalReceivedQuantity'])
        po_item['pendingTotalQuantity'] = pending_total
       
        if pending_total > 0:
            po_item['pendingCount'] = 1
            po_item['pendingQuantity'] = pending_total / po_item['pendingCount'] if po_item['pendingCount'] > 0 else pending_total
            po_item['count'] = po_item['totalReceivedQuantity'] / po_item['pendingQuantity'] if po_item['pendingQuantity'] > 0 else 0
            po_item['eachQuantity'] = po_item['pendingQuantity']
            po_item['receivedQuantity'] = 0
        else:
            po_item['pendingCount'] = 0
            po_item['pendingQuantity'] = 0
       
        # DO NOT clear expiryDate
        # po_item['expiryDate'] = None
        
        if po_item['totalReceivedQuantity'] == 0:
            po_item['status'] = "NotYetCome"
        elif po_item['pendingTotalQuantity'] > 0:
            po_item['status'] = "Approved"
        else:
            po_item['status'] = "Received"
       
        logging.info(f"Reversed GRN for item {item_id}: totalReceivedQuantity now {po_item['totalReceivedQuantity']:.2f}, pending {po_item['pendingTotalQuantity']:.2f}")
   
    return list(po_items_map.values())

def recalculate_po_totals(items: List[Dict], po_discount: float) -> Dict:
    """Recalculate PO totals after updates"""
    total_amount_before_tax = total_tax = total_amount_after_tax = 0
    total_pending_discount = total_pending_tax = total_amount_pending_before_tax = 0
    total_amount_pending_after_tax = 0
    total_discount = 0

    for item in items:
        received_qty = item.get('totalReceivedQuantity', 0)
        final_grn_price = item.get('grnPrice', item.get('newPrice', 0))
        tax_percentage = item.get('taxPercentage', 0)
        bef_tax_discount = item.get('befTaxDiscount', 0)
        af_tax_discount = item.get('afTaxDiscount', 0)
       
        if received_qty > 0:
            received_total_price = received_qty * final_grn_price
            received_bef_tax_discount_amount = received_total_price * (bef_tax_discount / 100)
            received_price_after_bef_discount = received_total_price - received_bef_tax_discount_amount
            received_tax_amount = received_price_after_bef_discount * (tax_percentage / 100)
            received_price_after_tax = received_price_after_bef_discount + received_tax_amount
            received_af_tax_discount_amount = received_price_after_tax * (af_tax_discount / 100)
            received_final_price = max(0, received_price_after_tax - received_af_tax_discount_amount)
           
            item['totalPrice'] = round(received_total_price, 2)
            item['befTaxDiscountAmount'] = round(received_bef_tax_discount_amount, 2)
            item['discountAmount'] = round(received_bef_tax_discount_amount, 2)
            item['taxAmount'] = round(received_tax_amount, 2)
            item['afTaxDiscountAmount'] = round(received_af_tax_discount_amount, 2)
            item['finalPrice'] = round(received_final_price, 2)
           
            item_cgst = item_sgst = item_igst = 0
            if item.get('taxType') == 'cgst_sgst':
                item_cgst = received_tax_amount / 2
                item_sgst = received_tax_amount / 2
            elif item.get('taxType') == 'igst':
                item_igst = received_tax_amount
            item['cgst'] = round(item_cgst, 2)
            item['sgst'] = round(item_sgst, 2)
            item['igst'] = round(item_igst, 2)
           
            total_amount_before_tax += received_total_price
            total_discount += received_bef_tax_discount_amount + received_af_tax_discount_amount
            total_tax += received_tax_amount
            total_amount_after_tax += received_final_price
       
        pending_qty = item.get('pendingTotalQuantity', 0)
        if pending_qty > 0:
            pending_total_price = pending_qty * final_grn_price
            pending_bef_tax_discount_amount = pending_total_price * (bef_tax_discount / 100)
            pending_price_after_bef_discount = pending_total_price - pending_bef_tax_discount_amount
            pending_tax_amount = pending_price_after_bef_discount * (tax_percentage / 100)
            pending_price_after_tax = pending_price_after_bef_discount + pending_tax_amount
            pending_af_tax_discount_amount = pending_price_after_tax * (af_tax_discount / 100)
            pending_final_price = max(0, pending_price_after_tax - pending_af_tax_discount_amount)
           
            item['pendingTotalPrice'] = round(pending_total_price, 2)
            item['pendingBefTaxDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
            item['pendingDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
            item['pendingTaxAmount'] = round(pending_tax_amount, 2)
            item['pendingAfTaxDiscountAmount'] = round(pending_af_tax_discount_amount, 2)
            item['pendingFinalPrice'] = round(pending_final_price, 2)
           
            pending_cgst = pending_sgst = pending_igst = 0
            if item.get('taxType') == 'cgst_sgst':
                pending_cgst = pending_tax_amount / 2
                pending_sgst = pending_tax_amount / 2
            elif item.get('taxType') == 'igst':
                pending_igst = pending_tax_amount
            item['pendingCgst'] = round(pending_cgst, 2)
            item['pendingSgst'] = round(pending_sgst, 2)
            item['pendingIgst'] = round(pending_igst, 2)
           
            total_amount_pending_before_tax += pending_total_price
            total_pending_discount += pending_bef_tax_discount_amount + pending_af_tax_discount_amount
            total_pending_tax += pending_tax_amount
            total_amount_pending_after_tax += pending_final_price
   
    total_discount += po_discount
    total_pending_discount += po_discount
   
    total_amount_after_discount = total_amount_before_tax - total_discount
    final_total_after_tax = total_amount_after_discount + total_tax
    totalOrderAmount = round(final_total_after_tax, 2)
   
    total_amount_pending_after_discount = total_amount_pending_before_tax - total_pending_discount
    final_total_pending_after_tax = total_amount_pending_after_discount + total_pending_tax
    pendingOrderAmount = round(final_total_pending_after_tax, 2)
   
    return {
        'totalOrderAmount': totalOrderAmount,
        'pendingOrderAmount': pendingOrderAmount,
        'totalDiscount': round(total_discount, 2),
        'pendingDiscountAmount': round(total_pending_discount, 2),
        'totalTax': round(total_tax, 2),
        'pendingTaxAmount': round(total_pending_tax, 2)
    }

@router.patch("/{grnId}/revert")
async def revert_grn(request: Request, grnId: str) -> Dict:
    tenant_id = request.state.tenant_id
    
    """
    Revert a specific GRN and reverse its effects on:
    - Associated PO (quantities, statuses)
    - Inventory ONLY (location-based stock) - SUBTRACT the quantity from systemStock
    - NO ITEM MASTER UPDATE - purchaseitem stock NOT changed during revert
    """
    try:
        if not grnId or not ObjectId.is_valid(grnId):
            error_msg = f"Invalid or missing grnId: {grnId}"
            logging.error(error_msg)
            error_logger.error(error_msg)
            raise HTTPException(status_code=400, detail="Invalid or missing grnId")

        grn_to_revert = get_grn_collection(tenant_id).find_one({"_id": ObjectId(grnId)})
        if not grn_to_revert:
            error_msg = f"GRN not found for ID: {grnId}"
            logging.error(error_msg)
            error_logger.error(error_msg)
            raise HTTPException(status_code=404, detail="GRN not found")

        purchase_order_id = grn_to_revert.get('purchaseOrderId')
        if not purchase_order_id or not ObjectId.is_valid(purchase_order_id):
            raise HTTPException(status_code=400, detail="Invalid PO ID in GRN")
       
        existing_purchaseorder = get_purchaseorder_collection(tenant_id).find_one({"_id": ObjectId(purchase_order_id)})
        if not existing_purchaseorder:
            error_msg = f"Purchase order not found for ID: {purchase_order_id}"
            logging.error(error_msg)
            error_logger.error(error_msg)
            raise HTTPException(status_code=404, detail="Associated PO not found")

        if grn_to_revert.get('status') == 'Po Reverted':
            raise HTTPException(status_code=400, detail="GRN is already reverted")

        logging.info("=" * 100)
        logging.info(f"🔄 INITIATING GRN REVERT - GRN ID: {grnId}")
        logging.info(f"Associated PO ID: {purchase_order_id}")
        logging.info("=" * 100)
        
        # Get the GRN's receiving location
        grn_location_id = grn_to_revert.get('locationId')
        if not grn_location_id:
            grn_location_name = grn_to_revert.get('receivingLocation')
            grn_location_id = "WH001"
            logging.warning(f"⚠️ No locationId found in GRN {grnId}, using default: {grn_location_id}")
        else:
            grn_location_name = grn_to_revert.get('receivingLocation', 'Unknown Location')
        
        logging.info(f"📍 GRN LOCATION DETECTED: ID={grn_location_id}, Name={grn_location_name}")
        
        grn_logger.info(f"GRN_REVERT_START|grn_id={grnId}|po_id={purchase_order_id}|location={grn_location_id}")

        # Step 1: Reverse receipts in PO items (preserves expiryDate)
        updated_items = reverse_grn_receipts_only_po(grn_to_revert.get('itemDetails', []), existing_purchaseorder.get('items', []))
        logging.info(f"✅ Step 1: PO items updated - {len(grn_to_revert.get('itemDetails', []))} items reversed")

        # Step 2: PRE-VALIDATION - Check if enough stock exists at this location
        inventory_collection = get_inventory_collection()
        validation_errors = []
        validation_warnings = []
        
        grn_items_with_location = []
        
        for item in grn_to_revert.get('itemDetails', []):
            item_with_location = item.copy()
            returned_qty = item.get('returnedQuantity', 0)
            actual_qty = item.get('receivedQuantity', 0) - returned_qty
            
            item_with_location['locationId'] = grn_location_id
            item_with_location['receivedQuantity'] = actual_qty
            
            if 'item_rand' not in item_with_location:
                po_item = next((i for i in existing_purchaseorder.get('items', []) if i.get('itemId') == item.get('itemId')), None)
                if po_item:
                    item_with_location['item_rand'] = po_item.get('randomId')
                else:
                    validation_errors.append(f"Item {item.get('itemName', 'Unknown')} missing randomId")
                    continue
            
            if actual_qty > 0:
                inventory_item = inventory_collection.find_one({
                    "randomId": item_with_location['item_rand'],
                    "locationId": grn_location_id
                })
                
                current_stock = inventory_item.get('systemStock', 0) if inventory_item else 0
                
                if current_stock < actual_qty:
                    error_msg = f"Insufficient stock at location {grn_location_id} for item {item.get('itemName', 'Unknown')}: Available {current_stock:.2f}, Need to revert {actual_qty:.2f}"
                    validation_errors.append(error_msg)
                    logging.error(f"❌ {error_msg}")
                elif current_stock == 0:
                    warning_msg = f"⚠️ Zero stock at location {grn_location_id} for item {item.get('itemName', 'Unknown')}"
                    validation_warnings.append(warning_msg)
                    logging.warning(warning_msg)
                else:
                    logging.info(f"✅ Stock validation passed for {item.get('itemName')}: {current_stock:.2f} available, need {actual_qty:.2f}")
            
            grn_items_with_location.append(item_with_location)
        
        if validation_errors:
            error_detail = {
                "message": "Cannot revert GRN due to insufficient stock at the original receiving location",
                "location": grn_location_id,
                "locationName": grn_location_name,
                "errors": validation_errors,
                "warnings": validation_warnings
            }
            logging.error(f"❌ Validation failed: {validation_errors}")
            grn_logger.error(f"GRN_REVERT_FAILED|grn_id={grnId}|reason=insufficient_stock|location={grn_location_id}")
            raise HTTPException(status_code=400, detail=error_detail)
        
        # Use inventory-only update function - NO ITEM MASTER UPDATE DURING REVERT
        stock_result = update_inventory_only(tenant_id, grn_items_with_location, reverse=True)
        
        if stock_result.get('failed', 0) > 0:
            failed_items = [item for item in stock_result.get('items', []) if item.get('status') == 'failed']
            error_detail = {
                "message": "Partial failure during inventory update",
                "location": grn_location_id,
                "failed_count": len(failed_items),
                "failed_items": failed_items[:5]
            }
            logging.error(f"❌ Inventory update had {len(failed_items)} failures")
            raise HTTPException(status_code=500, detail=error_detail)
        
        logging.info(f"✅ Step 2: Inventory ONLY updated at location {grn_location_id} - NO item master changes during revert")
        logging.info(f"   - Inventory updates: {stock_result.get('inventory_updates', 0)}")
        logging.info(f"   - Inventory creates: {stock_result.get('inventory_creates', 0)}")
        logging.info(f"   - Inventory not found: {stock_result.get('inventory_not_found', 0)}")

        # Step 3: Recalculate PO totals
        po_discount = existing_purchaseorder.get('discountPrice', 0)
        totals = recalculate_po_totals(updated_items, po_discount)
        logging.info(f"✅ Step 3: PO totals recalculated")

        # Step 4: Determine updated statuses
        all_items_received = all(item.get('pendingTotalQuantity', 0) == 0 for item in updated_items)
        any_items_received = any(item.get('totalReceivedQuantity', 0) > 0 for item in updated_items)
        
        if all_items_received:
            po_status = "Reverted"
        elif any_items_received:
            po_status = "PartiallyReceived"
        else:
            po_status = "Approved"
        item_status = "ItemReceived" if all_items_received else "Pending"

        # Step 5: Mark GRN as reverted
        current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
        get_grn_collection(tenant_id).update_one(
            {"_id": ObjectId(grnId)},
            {
                "$set": {
                    "status": "Po Reverted",
                    "revertedDate": current_datetime,
                    "lastUpdatedDate": current_datetime,
                    "isReverted": True,
                    "canBeReUpdated": True,
                    "originalReceiptData": grn_to_revert.get('itemDetails', []),
                    "originalTotal": grn_to_revert.get('totalReceivedAmount', 0)
                }
            }
        )

        # Step 6: Update PO
        update_data = {
            "totalOrderAmount": totals['totalOrderAmount'],
            "pendingOrderAmount": totals['pendingOrderAmount'],
            "pendingDiscountAmount": totals['pendingDiscountAmount'],
            "pendingTaxAmount": totals['pendingTaxAmount'],
            "discountPrice": po_discount,
            "totalDiscount": totals['totalDiscount'],
            "totalTax": totals['totalTax'],
            "itemStatus": item_status,
            "poStatus": po_status,
            "items": updated_items,
            "lastUpdatedDate": current_datetime,
            "invoiceNo": None,
            "invoiceDate": None,
            "pendingGrnId": None,
            "lastRevertedGrnId": grnId
        }
        
        result = get_purchaseorder_collection(tenant_id).update_one(
            {"_id": ObjectId(purchase_order_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            error_msg = f"Failed to update PO {purchase_order_id} after GRN revert"
            logging.error(error_msg)
            error_logger.error(error_msg)
            raise HTTPException(status_code=500, detail="Failed to update associated PO")
        
        logging.info(f"✅ PO updated successfully")

        grn_logger.info(f"GRN_REVERT_COMPLETE|grn_id={grnId}|po_id={purchase_order_id}|status={po_status}|location={grn_location_id}")

        return {
            "message": "GRN reverted successfully (Inventory only - No item master update)",
            "grnId": grnId,
            "purchaseOrderId": str(purchase_order_id),
            "poStatus": po_status,
            "itemStatus": item_status,
            "totalOrderAmount": totals['totalOrderAmount'],
            "pendingOrderAmount": totals['pendingOrderAmount'],
            "stockUpdates": stock_result,
            "canBeReUpdated": True,
            "pendingGrnId": None,
            "inventoryOnly": True,
            "itemMasterUpdated": False,
            "locationUsed": {
                "id": grn_location_id,
                "name": grn_location_name
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error in revert_grn for GRN {grnId}: {str(e)}"
        logging.error(error_msg)
        error_logger.error(error_msg)
        logging.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")