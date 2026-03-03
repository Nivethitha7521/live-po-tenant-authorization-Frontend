from datetime import datetime
import logging
import os
from typing import Dict, List
from bson import ObjectId
from fastapi import APIRouter, HTTPException,Request
import pytz
from utils.database import get_grn_collection
from utils.database import get_inventory_collection, get_purchaseorder_collection
from utils.database import get_purchaseitem_collection

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
item_master_logger = create_file_logger('item_master', 'item_master_changes.log')
def update_stock_quantities(tenant_id: str,grn_item_details: List[Dict], reverse: bool = False) -> Dict:
    """
    Update stock quantities for received items in both:
    - purchaseitem collection (item master - total stock)
    - inventory collection (location-based stock)
    
    For reverse=True (revert operation), we SUBTRACT the quantities.
    For reverse=False (normal receipt), we ADD the quantities.
    
    Returns detailed item-level stock changes for UI display.
    """
    try:
        current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
        
        # Track detailed results for each item
        detailed_results = []
        
        # Track counts for summary
        purchaseitem_updates = 0
        inventory_updates = 0
        inventory_creates = 0
        inventory_errors = 0
        
        operation_type = "REVERT (SUBTRACT)" if reverse else "RECEIPT (ADD)"
        quantity_multiplier = -1 if reverse else 1  # For revert, we subtract
        
        logging.info("=" * 100)
        logging.info(f"STOCK UPDATE - {operation_type}")
        logging.info(f"Timestamp: {current_datetime}")
        logging.info(f"Total items to process: {len(grn_item_details)}")
        logging.info("=" * 100)
        
        for idx, item in enumerate(grn_item_details, 1):
            random_id = item['item_rand']
            received_quantity = item['receivedQuantity']
            location_id = item.get('locationId', 'WH001')
            item_name = item.get('itemName', 'Unknown')
            
            # Calculate quantity change (negative for revert, positive for receipt)
            quantity_delta = received_quantity * quantity_multiplier
            operation = "SUBTRACT" if reverse else "ADD"
            
            logging.info(f"\n--- Processing Item {idx}/{len(grn_item_details)} ---")
            logging.info(f"Item RandomId: {random_id}")
            logging.info(f"Item Name: {item_name}")
            logging.info(f"Location: {location_id}")
            logging.info(f"Quantity Change: {quantity_delta:+.2f} ({operation} {received_quantity})")
            
            # Initialize result for this item
            item_result = {
                "randomId": random_id,
                "itemName": item_name,
                "stockChange": 0,  # Item Master stock change
                "newStock": 0,      # Item Master new total stock
                "locationStockChange": 0,  # Location-specific stock change
                "newLocationStock": 0,      # Location-specific new stock
                "locationId": location_id,
                "priceUpdated": False,
                "status": "success",
                "reason": None
            }
            
            try:
                # ========== STEP 1: UPDATE PURCHASEITEM COLLECTION (TOTAL STOCK) ==========
                purchase_item = get_purchaseitem_collection(tenant_id).find_one({"randomId": random_id})
                if purchase_item:
                    current_stock = purchase_item.get('stockQuantity', 0)
                    new_stock = current_stock + quantity_delta  # This will subtract for revert
                    
                    # Log the calculation
                    logging.info(f"Item Master Stock Calculation: {current_stock:.2f} + ({quantity_delta:+.2f}) = {new_stock:.2f}")
                    
                    # Ensure stock doesn't go negative
                    if new_stock < 0:
                        actual_delta = -current_stock  # Only remove what's available
                        new_stock = 0
                        logging.warning(f"⚠️ Stock would become negative. Capping at 0. Actual removed: {current_stock:.2f}")
                        item_result["reason"] = f"Stock capped at 0 (attempted to remove {received_quantity:.2f}, only {current_stock:.2f} available)"
                    else:
                        actual_delta = quantity_delta
                    
                    # Update purchaseitem
                    purchaseitem_result = get_purchaseitem_collection(tenant_id).update_one(
                        {"randomId": random_id},
                        {"$set": {
                            "stockQuantity": new_stock,
                            "lastUpdatedDate": current_datetime
                        }}
                    )
                    
                    if purchaseitem_result.modified_count > 0:
                        purchaseitem_updates += 1
                    
                    # Store the actual change (might be less than requested if stock was insufficient)
                    actual_change = new_stock - current_stock
                    item_result["stockChange"] = actual_change
                    item_result["newStock"] = new_stock
                    
                    logging.info(f"✅ PURCHASEITEM UPDATED - Total Stock: {current_stock:.2f} -> {new_stock:.2f} (Change: {actual_change:+.2f})")
                    
                    # ========== STEP 2: UPDATE INVENTORY COLLECTION (LOCATION-BASED) ==========
                    try:
                        inventory_collection = get_inventory_collection()
                        
                        # Find inventory by BOTH randomId AND locationId
                        inventory_item = inventory_collection.find_one({
                            "randomId": random_id,
                            "locationId": location_id
                        })
                        
                        if inventory_item:
                            # EXISTING LOCATION - UPDATE systemStock
                            current_system_stock = inventory_item.get('systemStock', 0)
                            new_system_stock = current_system_stock + quantity_delta  # This will subtract for revert
                            
                            logging.info(f"Location Stock Calculation: {current_system_stock:.2f} + ({quantity_delta:+.2f}) = {new_system_stock:.2f}")
                            
                            # Ensure stock doesn't go negative at location level
                            if new_system_stock < 0:
                                actual_location_delta = -current_system_stock
                                new_system_stock = 0
                                logging.warning(f"⚠️ Location stock would become negative. Capping at 0. Actual removed: {current_system_stock:.2f}")
                                if not item_result["reason"]:
                                    item_result["reason"] = f"Location stock capped at 0"
                                else:
                                    item_result["reason"] += f", location stock capped at 0"
                            else:
                                actual_location_delta = quantity_delta
                            
                            inventory_update_data = {
                                "systemStock": new_system_stock,
                                "lastUpdatedDate": current_datetime
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
                            # For revert, if location record doesn't exist, we can't subtract from it
                            # So we create it with 0 stock (since we're removing stock that wasn't there)
                            if reverse:
                                new_system_stock = 0
                                location_change = 0
                                logging.info(f"⚠️ No existing inventory record for location {location_id}. Creating with 0 stock.")
                            else:
                                # For receipt, create with positive stock
                                new_system_stock = quantity_delta
                                location_change = quantity_delta
                            
                            new_inventory_item = {
                                "randomId": random_id,
                                "locationId": location_id,
                                "systemStock": new_system_stock,
                                "createdBy": "grn_revert" if reverse else "grn_receipt",
                                "createdDate": current_datetime,
                                "lastUpdatedDate": current_datetime
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
                
                else:
                    item_result["status"] = "failed"
                    item_result["reason"] = f"Purchase item not found for ID: {random_id}"
                    logging.error(f"❌ Purchase item not found for ID: {random_id}")
            
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
            "timestamp": current_datetime.isoformat(),
            "purchaseitem_updates": purchaseitem_updates,
            "inventory_updates": inventory_updates,
            "inventory_creates": inventory_creates,
            "errors": inventory_errors
        }
        
        # Log final summary
        summary_lines = []
        summary_lines.append("=" * 100)
        summary_lines.append("📊 STOCK UPDATE COMPLETE SUMMARY")
        summary_lines.append("=" * 100)
        summary_lines.append(f"Operation Type: {operation_type}")
        summary_lines.append(f"Total Items Processed: {len(detailed_results)}")
        summary_lines.append(f"Successful: {successful_items}")
        summary_lines.append(f"Failed: {failed_items}")
        summary_lines.append("")
        summary_lines.append("📦 PURCHASEITEM UPDATES (Item Master):")
        summary_lines.append(f"   - Total Stock Updates: {purchaseitem_updates}")
        summary_lines.append("")
        summary_lines.append("📍 INVENTORY UPDATES (Location-Based):")
        summary_lines.append(f"   - Location Updates: {inventory_updates}")
        summary_lines.append(f"   - Location Creates: {inventory_creates}")
        summary_lines.append(f"   - Errors: {inventory_errors}")
        summary_lines.append("=" * 100)
        
        logging.info("\n".join(summary_lines))
        
        return summary
        
    except Exception as e:
        error_msg = f"❌ Error updating stock quantities: {str(e)}"
        logging.error(error_msg)
        logging.exception("Full traceback:")
        raise

def reverse_grn_receipts(grn_item_details: List[Dict], po_items: List[Dict]) -> List[Dict]:
    """
    Reverse the receipts from a specific GRN by updating PO items' quantities.
    Returns the updated PO items list.
    Handles multi-GRN scenarios by only reversing this GRN's contribution.
    Also clears expiryDate on items during reversal.
    """
    # Create a map of itemId to PO item for quick lookup
    po_items_map = {item['itemId']: item.copy() for item in po_items}
   
    for grn_item in grn_item_details:
        item_id = grn_item['itemId']
        received_quantity = grn_item['receivedQuantity']
       
        po_item = po_items_map.get(item_id)
        if not po_item:
            logging.warning(f"PO item {item_id} not found for GRN reversal")
            continue
       
        # Reverse only this GRN's received quantity
        po_item['totalReceivedQuantity'] -= received_quantity
        po_item['quantity'] = po_item['totalReceivedQuantity']
       
        # Recalculate pending from PO quantity
        po_quantity = po_item.get('poQuantity', 0)
        pending_total = max(0, po_quantity - po_item['totalReceivedQuantity'])
        po_item['pendingTotalQuantity'] = pending_total
       
        # Revert count/pendingCount logic
        if pending_total > 0:
            po_item['pendingCount'] = 1
            po_item['pendingQuantity'] = pending_total / po_item['pendingCount'] if po_item['pendingCount'] > 0 else pending_total
            po_item['count'] = po_item['totalReceivedQuantity'] / po_item['pendingQuantity'] if po_item['pendingQuantity'] > 0 else 0
            po_item['eachQuantity'] = po_item['pendingQuantity']
            po_item['receivedQuantity'] = 0
        else:
            po_item['pendingCount'] = 0
            po_item['pendingQuantity'] = 0
       
        # Clear expiryDate on this item during reversal
        po_item['expiryDate'] = None
       
        # Update status based on new totals
        if po_item['totalReceivedQuantity'] == 0:
            po_item['status'] = "NotYetCome"
        elif po_item['pendingTotalQuantity'] > 0:
            po_item['status'] = "Approved"
        else:
            po_item['status'] = "Received"
       
        logging.info(f"Reversed GRN for item {item_id}: totalReceivedQuantity now {po_item['totalReceivedQuantity']:.2f}, pending {po_item['pendingTotalQuantity']:.2f}, expiryDate cleared")
        po_logger.info(f"PO_ITEM_REVERT|item_id={item_id}|randomId={po_item.get('randomId')}|qty_removed={received_quantity:.2f}|new_total={po_item['totalReceivedQuantity']:.2f}")
   
    return list(po_items_map.values())

def recalculate_po_totals(items: List[Dict], po_discount: float) -> Dict:
    """
    Recalculate PO totals after updates (used for both receipt and revert).
    Also updates individual item price/discount/tax fields.
    """
    total_amount_before_tax = total_tax = total_amount_after_tax = 0
    total_pending_discount = total_pending_tax = total_amount_pending_before_tax = 0
    total_amount_pending_after_tax = 0
    total_discount = 0

    for item in items:
        # Received calculations
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
           
            # Update item fields for received
            item['totalPrice'] = round(received_total_price, 2)
            item['befTaxDiscountAmount'] = round(received_bef_tax_discount_amount, 2)
            item['discountAmount'] = round(received_bef_tax_discount_amount, 2)
            item['taxAmount'] = round(received_tax_amount, 2)
            item['afTaxDiscountAmount'] = round(received_af_tax_discount_amount, 2)
            item['finalPrice'] = round(received_final_price, 2)
           
            # CGST/SGST/IGST for received
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
       
        # Pending calculations
        pending_qty = item.get('pendingTotalQuantity', 0)
        if pending_qty > 0:
            pending_total_price = pending_qty * final_grn_price
            pending_bef_tax_discount_amount = pending_total_price * (bef_tax_discount / 100)
            pending_price_after_bef_discount = pending_total_price - pending_bef_tax_discount_amount
            pending_tax_amount = pending_price_after_bef_discount * (tax_percentage / 100)
            pending_price_after_tax = pending_price_after_bef_discount + pending_tax_amount
            pending_af_tax_discount_amount = pending_price_after_tax * (af_tax_discount / 100)
            pending_final_price = max(0, pending_price_after_tax - pending_af_tax_discount_amount)
           
            # Update item fields for pending
            item['pendingTotalPrice'] = round(pending_total_price, 2)
            item['pendingBefTaxDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
            item['pendingDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
            item['pendingTaxAmount'] = round(pending_tax_amount, 2)
            item['pendingAfTaxDiscountAmount'] = round(pending_af_tax_discount_amount, 2)
            item['pendingFinalPrice'] = round(pending_final_price, 2)
           
            # CGST/SGST/IGST for pending
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
   
    # Apply PO discount
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
async def revert_grn(request: Request,grnId: str) -> Dict:
    tenant_id = request.state.tenant_id
    
    """
    Revert a specific GRN and reverse its effects on:
    - Associated PO (quantities, statuses)
    - PurchaseItem (total stock) - SUBTRACT the quantity
    - Inventory (location-based stock) - SUBTRACT the quantity
    
    Clears invoiceNo, invoiceDate on PO and expiryDate on items during reversal.
    """
    try:
        # Validate grnId
        if not grnId or not ObjectId.is_valid(grnId):
            error_msg = f"Invalid or missing grnId: {grnId}"
            logging.error(error_msg)
            error_logger.error(error_msg)
            raise HTTPException(status_code=400, detail="Invalid or missing grnId")

        # Retrieve the GRN
        grn_to_revert = get_grn_collection(tenant_id).find_one({"_id": ObjectId(grnId)})
        if not grn_to_revert:
            error_msg = f"GRN not found for ID: {grnId}"
            logging.error(error_msg)
            error_logger.error(error_msg)
            raise HTTPException(status_code=404, detail="GRN not found")

        # Validate PO association and fetch PO
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
        
        grn_logger.info(f"GRN_REVERT_START|grn_id={grnId}|po_id={purchase_order_id}")

        # Step 1: Reverse receipts in PO items (clears expiryDate on items)
        updated_items = reverse_grn_receipts(grn_to_revert.get('itemDetails', []), existing_purchaseorder.get('items', []))
        logging.info(f"✅ Step 1: PO items updated - {len(grn_to_revert.get('itemDetails', []))} items reversed")

        # Step 2: Reverse stock quantities in BOTH purchaseitem AND inventory
        # Add locationId to each GRN item (default to WH001) and item details
        grn_items_with_location = []
        for item in grn_to_revert.get('itemDetails', []):
            item_with_location = item.copy()
            item_with_location['locationId'] = 'WH001'  # Default warehouse
            # Ensure item_rand is present
            if 'item_rand' not in item_with_location:
                # Try to get from PO item if needed
                po_item = next((i for i in existing_purchaseorder.get('items', []) if i.get('itemId') == item.get('itemId')), None)
                if po_item:
                    item_with_location['item_rand'] = po_item.get('randomId')
            grn_items_with_location.append(item_with_location)
        
        stock_result = update_stock_quantities(tenant_id, grn_items_with_location, reverse=True)
        logging.info(f"✅ Step 2: Stock quantities reversed in purchaseitem and inventory")
        logging.info(f"   - PurchaseItem updates: {stock_result.get('purchaseitem_updates', 0)}")
        logging.info(f"   - Inventory updates: {stock_result.get('inventory_updates', 0)}")
        logging.info(f"   - Inventory creates: {stock_result.get('inventory_creates', 0)}")

        # Step 3: Recalculate PO totals and update item fields
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

        logging.info(f"✅ Step 4: Status determined - PO Status: {po_status}, Item Status: {item_status}")

        # Step 5: Mark GRN as reverted with update flag
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
        logging.info(f"✅ Step 5: GRN marked as reverted with canBeReUpdated=True")

        # Step 6: Update PO with reversed data
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
            "pendingGrnId": grnId,
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
        
        logging.info(f"✅ Step 6: PO updated successfully")

        # Final summary
        summary = f"""
{'='*100}
✅ GRN REVERT COMPLETED SUCCESSFULLY
{'='*100}
GRN ID: {grnId}
PO ID: {purchase_order_id}
New PO Status: {po_status}
Items Reversed: {len(grn_to_revert.get('itemDetails', []))}
Stock Updates:
  - PurchaseItem Updates: {stock_result.get('purchaseitem_updates', 0)}
  - Inventory Updates: {stock_result.get('inventory_updates', 0)}
  - Inventory Creates: {stock_result.get('inventory_creates', 0)}
Total Order Amount: {totals['totalOrderAmount']:.2f}
Pending Order Amount: {totals['pendingOrderAmount']:.2f}
Can Be Re-Updated: True
{'='*100}
        """
        logging.info(summary)
        
        grn_logger.info(f"GRN_REVERT_COMPLETE|grn_id={grnId}|po_id={purchase_order_id}|status={po_status}|items_reversed={len(grn_to_revert.get('itemDetails', []))}|stock_updates={stock_result}")
        audit_logger.info(f"GRN_REVERT|grn_id={grnId}|po_id={purchase_order_id}|timestamp={current_datetime}")

        # Return response
        return {
            "message": "GRN reverted and associated PO updated successfully",
            "grnId": grnId,
            "purchaseOrderId": str(purchase_order_id),
            "poStatus": po_status,
            "itemStatus": item_status,
            "totalOrderAmount": totals['totalOrderAmount'],
            "pendingOrderAmount": totals['pendingOrderAmount'],
            "reversedItemsCount": len(grn_to_revert.get('itemDetails', [])),
            "stockUpdates": stock_result,  # This now contains detailed item-level changes
            "canBeReUpdated": True,
            "pendingGrnId": grnId
        }

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error in revert_grn for GRN {grnId}: {str(e)}"
        logging.error(error_msg)
        error_logger.error(error_msg)
        logging.exception("Full traceback:")
        error_logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")