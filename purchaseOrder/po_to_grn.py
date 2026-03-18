from datetime import datetime
import logging
import os
from typing import Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request
import pytz
from grn.routes import custom_round, generate_grnrandom_id
from utils.database import get_grn_collection, get_inventory_collection, get_purchaseorder_collection, get_purchaseitem_collection
from purchaseOrder.models import PurchaseOrderPatch
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from database import db

router = APIRouter()

# ========== OPTIMIZED LOGGING ==========
log_dir = "logs"
os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'inventory_operations.log'), encoding='utf-8')
    ],
    force=True
)

logger = logging.getLogger('inventory_ops')
logger.propagate = False

# ========== OPTIMIZED STOCK AND PRICE UPDATE FUNCTION ==========
def update_stock_and_prices_with_master(grn_item_details: List[Dict], tenant_id: str, is_revert: bool = False):
    """
    Update stock quantities in inventory AND prices in item master
    - Inventory: ALWAYS update stock quantities (location-based)
    - Item Master: Update purchasePrice based on priority: grnPrice → newPrice
      - Current purchasePrice moves to oldPrice
      - New price (grnPrice/newPrice) becomes new purchasePrice
    
    For revert operations (is_revert=True), NO price updates are performed
    """
    try:
        current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
        price_updates_count = 0
        stock_updates_count = 0
        success_items = []
        failed_items = []
        
        RECEIVING_LOCATION_ID = "WH001"
        CREATED_BY = "grn"
        
        # Batch operations for better performance
        purchaseitem_collection = get_purchaseitem_collection(tenant_id)
        inventory_collection = get_inventory_collection()
        
        # Get all item_rand values at once
        item_rand_list = [item['item_rand'] for item in grn_item_details]
        
        # Fetch all purchase items in one query
        purchase_items = {
            item['randomId']: item 
            for item in purchaseitem_collection.find(
                {"randomId": {"$in": item_rand_list}},
                {"randomId": 1, "stockQuantity": 1, "purchasePrice": 1, "oldPrice": 1, "itemName": 1}
            )
        }
        
        # Fetch all inventory items in one query
        inventory_items = {
            (item['randomId'], item['locationId']): item
            for item in inventory_collection.find({
                "randomId": {"$in": item_rand_list},
                "locationId": RECEIVING_LOCATION_ID
            })
        }
        
        # Prepare batch updates
        purchaseitem_updates = []
        inventory_updates = []
        inventory_inserts = []
        
        for item in grn_item_details:
            random_id = item['item_rand']
            received_quantity = item['receivedQuantity']
            
            # PRIORITY 1: grnPrice, PRIORITY 2: unitPrice (newPrice)
            grn_price = item.get('grnPrice') or item.get('unitPrice', 0)
            item_name = item.get('itemName', 'Unknown')
            
            purchase_item = purchase_items.get(random_id)
            if not purchase_item:
                failed_items.append({
                    'randomId': random_id,
                    'itemName': item_name,
                    'stockChange': 0,
                    'newStock': 0,
                    'locationStockChange': 0,
                    'newLocationStock': 0,
                    'locationId': RECEIVING_LOCATION_ID,
                    'priceUpdated': False,
                    'reason': 'Item not found in master',
                    'status': 'failed'
                })
                continue
            
            # ========== STEP 1: INVENTORY UPDATE (ALWAYS) ==========
            inventory_key = (random_id, RECEIVING_LOCATION_ID)
            inventory_item = inventory_items.get(inventory_key)
            
            if inventory_item:
                current_system_stock = inventory_item.get('systemStock', 0)
                if is_revert:
                    new_system_stock = current_system_stock - received_quantity
                    location_stock_change = -received_quantity
                else:
                    new_system_stock = current_system_stock + received_quantity
                    location_stock_change = +received_quantity
                
                inventory_updates.append({
                    "filter": {"randomId": random_id, "locationId": RECEIVING_LOCATION_ID},
                    "update": {"$set": {"systemStock": new_system_stock, "lastUpdatedDate": current_datetime}}
                })
            else:
                new_system_stock = received_quantity if not is_revert else 0  # Can't have negative for new record
                location_stock_change = new_system_stock
                
                inventory_inserts.append({
                    "randomId": random_id,
                    "locationId": RECEIVING_LOCATION_ID,
                    "systemStock": new_system_stock,
                    "createdBy": CREATED_BY,
                    "createdDate": current_datetime,
                    "lastUpdatedDate": current_datetime
                })
            
            # ========== STEP 2: ITEM MASTER PRICE UPDATE ==========
            # Current values from item master
            current_master_price = purchase_item.get('purchasePrice', 0)
            
            price_updated = False
            update_data = {
                "lastUpdatedDate": current_datetime
            }
            
            # Only update prices for normal receipt (not revert)
            if not is_revert and grn_price > 0 and received_quantity > 0:
                
                # Check if the new price (grn_price) is different from current master price
                if current_master_price != grn_price:
                    # CORRECT LOGIC:
                    # 1. Move current purchasePrice to oldPrice
                    # 2. Set new purchasePrice to grn_price
                    update_data["oldPrice"] = current_master_price
                    update_data["purchasePrice"] = grn_price
                    price_updated = True
                    
                    logger.info(f"PRICE_UPDATE|item={random_id}|old_master_price={current_master_price}|new_master_price={grn_price}")
            
            # Queue purchaseitem update (even if only lastUpdatedDate changes)
            purchaseitem_updates.append({
                "filter": {"randomId": random_id},
                "update": {"$set": update_data}
            })
            
            # Track success with detailed price info
            success_items.append({
                'randomId': random_id,
                'itemName': purchase_item.get('itemName', item_name),
                'stockChange': 0,  # Item Master stock NOT updated during receipt
                'newStock': purchase_item.get('stockQuantity', 0),  # Keep original stock
                'locationStockChange': location_stock_change,
                'newLocationStock': new_system_stock,
                'locationId': RECEIVING_LOCATION_ID,
                'priceUpdated': price_updated,
                'status': 'success',
                'oldMasterPrice': current_master_price if price_updated else None,
                'newMasterPrice': grn_price if price_updated else None,
                'oldPriceMovedTo': 'oldPrice' if price_updated else None
            })
            
            if price_updated:
                price_updates_count += 1
            if not is_revert:  # Only count stock updates for normal receipt
                stock_updates_count += 1
        
        # Execute batch updates
        if purchaseitem_updates:
            for update in purchaseitem_updates:
                result = purchaseitem_collection.update_one(update["filter"], update["update"])
                if result.modified_count > 0:
                    logger.info(f"MASTER_UPDATE|item={update['filter']['randomId']}|modified={result.modified_count}")
        
        if inventory_updates:
            for update in inventory_updates:
                result = inventory_collection.update_one(update["filter"], update["update"])
                logger.info(f"INVENTORY_UPDATE|item={update['filter']['randomId']}|location={update['filter']['locationId']}|modified={result.modified_count}")
        
        if inventory_inserts:
            result = inventory_collection.insert_many(inventory_inserts)
            logger.info(f"INVENTORY_INSERT|count={len(result.inserted_ids)}")
        
        # Log summary
        logger.info(f"UPDATE_COMPLETE|loc={RECEIVING_LOCATION_ID}|total={len(grn_item_details)}|success={len(success_items)}|fail={len(failed_items)}|price={price_updates_count}")
        
        return {
            'success': len(failed_items) == 0,
            'total_processed': len(grn_item_details),
            'successful': len(success_items),
            'failed': len(failed_items),
            'items': success_items + failed_items,
            'stock_updates': stock_updates_count,
            'price_updates': price_updates_count,
            'operation': 'revert' if is_revert else 'normal'
        }
        
    except Exception as e:
        logger.error(f"ERROR|{str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'error': str(e),
            'total_processed': len(grn_item_details) if 'grn_item_details' in locals() else 0,
            'successful': 0,
            'failed': len(grn_item_details) if 'grn_item_details' in locals() else 0,
            'items': [],
            'stock_updates': 0,
            'price_updates': 0
        }
@router.patch("/receivedupdates/{purchaseOrderId}")
async def patch_received_count(request: Request,
    purchaseOrderId: str,
    purchaseOrderPatch: PurchaseOrderPatch,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_approved", "edit"))
) -> Dict:
    tenant_id = request.state.tenant_id
    
    # Get logged-in user ID
    username = user.get("username")
    user_data = await db["user"].find_one({"username": username})
    user_id = str(user_data["_id"]) if user_data else None
    
    """Main endpoint - ALWAYS CREATE NEW GRN, NEVER REUSE OLD ID"""
    try:
        if not ObjectId.is_valid(purchaseOrderId):
            raise HTTPException(status_code=400, detail="Invalid purchaseOrderId")
        
        # Get PO - single query
        existing_purchaseorder = get_purchaseorder_collection(tenant_id).find_one(
            {"_id": ObjectId(purchaseOrderId)}
        )
        if not existing_purchaseorder:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        logger.info(f"PATCH_START|po={purchaseOrderId}")

        # Process freights
        current_freights = purchaseOrderPatch.freights or []
        total_freight_amount = sum(f.amt for f in current_freights)
        total_freight_tax = sum(f.tAmt for f in current_freights)

        # Initialize
        total_discount = total_amount_before_tax = total_tax = total_amount_after_tax = 0
        total_pending_discount = total_pending_tax = total_amount_pending_before_tax = 0
        total_amount_pending_after_tax = 0
        updated_items = []
        all_items_received = True
        
        po_discount = purchaseOrderPatch.grndiscountPrice or 0
        round_off_amount = purchaseOrderPatch.grnRoundOffAmount or 0
        
        # Process items
        all_po_items = existing_purchaseorder.get('items', [])
        existing_items_map = {item['itemId']: item.copy() for item in all_po_items}
        processed_item_ids = set()
        newly_received_items = []
        price_changes = []
        
        # Batch fetch master prices
        item_random_ids = []
        for item_patch in purchaseOrderPatch.items:
            if item_patch.itemId in existing_items_map:
                item_random_ids.append(existing_items_map[item_patch.itemId].get('randomId'))
        
        # Get all master prices in one query
        master_prices = {}
        if item_random_ids:
            master_items = get_purchaseitem_collection(tenant_id).find(
                {"randomId": {"$in": item_random_ids}},
                {"randomId": 1, "purchasePrice": 1}
            )
            master_prices = {item['randomId']: item.get('purchasePrice', 0) for item in master_items}
        
        # Process items from patch
        for item_patch in purchaseOrderPatch.items:
            updated_item = existing_items_map.get(item_patch.itemId)
            if not updated_item:
                continue
            
            # Get master price
            current_master_price = master_prices.get(updated_item.get('randomId'), 0)
            
            # ===== CRITICAL: Determine grn price with correct priority =====
            # PRIORITY 1: grnPrice from patch
            # PRIORITY 2: newPrice from existing item
            if item_patch.grnPrice is not None and item_patch.grnPrice > 0:
                grn_price_value = item_patch.grnPrice
                price_source = "grnPrice"
                logger.info(f"PRICE_SOURCE|item={item_patch.itemId}|using=grnPrice|value={grn_price_value}")
            elif updated_item.get('newPrice', 0) > 0:
                grn_price_value = updated_item.get('newPrice', 0)
                price_source = "newPrice"
                logger.info(f"PRICE_SOURCE|item={item_patch.itemId}|using=newPrice|value={grn_price_value}")
            else:
                grn_price_value = updated_item.get('grnPrice', updated_item.get('newPrice', 0))
                price_source = "existing"
                logger.info(f"PRICE_SOURCE|item={item_patch.itemId}|using=existing|value={grn_price_value}")
            
            # ===== CRITICAL CHANGE 1: Update newPrice in PO item with grnPrice =====
            # This ensures newPrice reflects the actual received price
            updated_item['newPrice'] = grn_price_value
            
            # Also set grnPrice for reference
            updated_item['grnPrice'] = grn_price_value
            
            # ===== CRITICAL CHANGE 2: Track price changes for item master update =====
            # Store current master price to move to oldPrice later
            received_quantity = item_patch.receivedQuantity or 0
            if received_quantity > 0 and current_master_price and grn_price_value != current_master_price:
                # This will be used by update_stock_and_prices_with_master
                # The function will move current_master_price to oldPrice
                # and set new purchasePrice to grn_price_value
                
                price_changes.append({
                    'itemId': item_patch.itemId,
                    'itemName': updated_item.get('itemName'),
                    'randomId': updated_item.get('randomId'),
                    'oldMasterPrice': current_master_price,  # This will become oldPrice
                    'newMasterPrice': grn_price_value,       # This will become new purchasePrice
                    'priceSource': price_source,
                    'poNewPriceUpdated': True  # Indicating newPrice in PO was updated
                })
                logger.info(f"PRICE_CHANGE_DETECTED|item={item_patch.itemId}|old_master={current_master_price}|new_master={grn_price_value}|source={price_source}|po_new_price_updated={grn_price_value}")
            
            # Update expiry
            if item_patch.expiryDate:
                updated_item['expiryDate'] = item_patch.expiryDate
            
            # Discounts
            updated_item['befTaxDiscount'] = max(0, min(100, item_patch.befTaxDiscount or 0))
            updated_item['afTaxDiscount'] = max(0, min(100, item_patch.afTaxDiscount or 0))
            
            # Get current values
            current_total_received = updated_item.get('totalReceivedQuantity', 0)
            current_pending_total = updated_item.get('pendingTotalQuantity', 0)
            
            if received_quantity > 0:
                # Update quantities
                updated_item['receivedQuantity'] = received_quantity
                updated_item['totalReceivedQuantity'] = current_total_received + received_quantity
                updated_item['pendingTotalQuantity'] = max(0, current_pending_total - received_quantity)
                
                # Simple receipt
                updated_item['count'] = 1
                updated_item['eachQuantity'] = received_quantity
                updated_item['pendingCount'] = 1 if updated_item['pendingTotalQuantity'] > 0 else 0
                updated_item['pendingQuantity'] = updated_item['pendingTotalQuantity']
                
                newly_received_items.append({
                    'itemId': item_patch.itemId,
                    'receivedQuantity': received_quantity,
                    'item_random_id': updated_item.get('randomId'),
                    'grnPrice': grn_price_value,
                    'unitPrice': grn_price_value,
                    'oldPrice': updated_item.get('oldPrice'),
                    'itemName': updated_item.get('itemName'),
                    'priceSource': price_source
                })
            else:
                updated_item['receivedQuantity'] = 0
                updated_item['count'] = 0
            
            # Calculate amounts (use grn_price_value for all calculations)
            tax_percentage = updated_item.get('taxPercentage', 0)
            bef_tax_discount = updated_item['befTaxDiscount']
            af_tax_discount = updated_item['afTaxDiscount']
            
            # Received calculations
            received_total_price = received_quantity * grn_price_value
            received_bef_discount = received_total_price * (bef_tax_discount / 100)
            received_price_after_bef = received_total_price - received_bef_discount
            received_tax = received_price_after_bef * (tax_percentage / 100)
            received_price_after_tax = received_price_after_bef + received_tax
            received_af_discount = received_price_after_tax * (af_tax_discount / 100)
            received_final = max(0, received_price_after_tax - received_af_discount)
            
            updated_item['totalPrice'] = round(received_total_price, 2)
            updated_item['befTaxDiscountAmount'] = round(received_bef_discount, 2)
            updated_item['taxAmount'] = round(received_tax, 2)
            updated_item['afTaxDiscountAmount'] = round(received_af_discount, 2)
            updated_item['finalPrice'] = round(received_final, 2)
            
            # Tax breakdown
            if updated_item.get('taxType') == 'cgst_sgst':
                updated_item['cgst'] = round(received_tax / 2, 2)
                updated_item['sgst'] = round(received_tax / 2, 2)
            else:
                updated_item['igst'] = round(received_tax, 2)
            
            # Pending calculations (use the SAME grn_price_value for pending items)
            pending_quantity = updated_item['pendingTotalQuantity']
            if pending_quantity > 0:
                pending_total_price = pending_quantity * grn_price_value
                pending_bef_discount = pending_total_price * (bef_tax_discount / 100)
                pending_price_after_bef = pending_total_price - pending_bef_discount
                pending_tax = pending_price_after_bef * (tax_percentage / 100)
                pending_price_after_tax = pending_price_after_bef + pending_tax
                pending_af_discount = pending_price_after_tax * (af_tax_discount / 100)
                pending_final = max(0, pending_price_after_tax - pending_af_discount)
                
                updated_item['pendingTotalPrice'] = round(pending_total_price, 2)
                updated_item['pendingBefTaxDiscountAmount'] = round(pending_bef_discount, 2)
                updated_item['pendingTaxAmount'] = round(pending_tax, 2)
                updated_item['pendingAfTaxDiscountAmount'] = round(pending_af_discount, 2)
                updated_item['pendingFinalPrice'] = round(pending_final, 2)
                
                total_amount_pending_before_tax += pending_total_price
                total_pending_discount += pending_bef_discount + pending_af_discount
                total_pending_tax += pending_tax
                total_amount_pending_after_tax += pending_final
                all_items_received = False
            
            # Update totals
            total_amount_before_tax += received_total_price
            total_discount += received_bef_discount + received_af_discount
            total_tax += received_tax
            total_amount_after_tax += received_final
            
            # Determine status
            if pending_quantity == 0 and received_quantity > 0:
                updated_item['status'] = "Received"
            elif pending_quantity > 0 and received_quantity > 0:
                updated_item['status'] = "PartiallyReceived"
            elif received_quantity == 0:
                updated_item['status'] = "NotYetCome"
            
            processed_item_ids.add(item_patch.itemId)
            updated_items.append(updated_item.copy())
        
        # Process items NOT in patch
        for item_id, existing_item in existing_items_map.items():
            if item_id not in processed_item_ids:
                pending_count = existing_item.get('pendingCount', 0)
                pending_quantity = existing_item.get('pendingQuantity', 0)
                pending_total = pending_count * pending_quantity
                
                existing_item['pendingTotalQuantity'] = pending_total
                
                if pending_total > 0:
                    # Use newPrice for pending calculations (which would have been updated if received earlier)
                    grn_price = existing_item.get('newPrice', existing_item.get('grnPrice', 0))
                    tax_percentage = existing_item.get('taxPercentage', 0)
                    bef_discount = existing_item.get('befTaxDiscount', 0)
                    af_discount = existing_item.get('afTaxDiscount', 0)
                    
                    pending_total_price = pending_total * grn_price
                    pending_bef_discount = pending_total_price * (bef_discount / 100)
                    pending_price_after_bef = pending_total_price - pending_bef_discount
                    pending_tax = pending_price_after_bef * (tax_percentage / 100)
                    pending_price_after_tax = pending_price_after_bef + pending_tax
                    pending_af_discount = pending_price_after_tax * (af_discount / 100)
                    pending_final = max(0, pending_price_after_tax - pending_af_discount)
                    
                    existing_item['pendingTotalPrice'] = round(pending_total_price, 2)
                    existing_item['pendingBefTaxDiscountAmount'] = round(pending_bef_discount, 2)
                    existing_item['pendingTaxAmount'] = round(pending_tax, 2)
                    existing_item['pendingAfTaxDiscountAmount'] = round(pending_af_discount, 2)
                    existing_item['pendingFinalPrice'] = round(pending_final, 2)
                    
                    total_amount_pending_before_tax += pending_total_price
                    total_pending_discount += pending_bef_discount + pending_af_discount
                    total_pending_tax += pending_tax
                    total_amount_pending_after_tax += pending_final
                    all_items_received = False
                    
                    existing_item['status'] = "Pending"
                else:
                    existing_item['status'] = "Received" if existing_item.get('totalReceivedQuantity', 0) > 0 else "NotYetCome"
                
                updated_items.append(existing_item.copy())
        
        # Calculate final totals
        total_discount += po_discount
        total_amount_after_discount = total_amount_before_tax - total_discount
        final_total_after_tax = total_amount_after_discount + total_tax
        
        total_received_before_roundoff = final_total_after_tax + total_freight_amount + total_freight_tax
        total_received_after_roundoff = total_received_before_roundoff + round_off_amount
        
        if total_received_after_roundoff < 0:
            raise HTTPException(status_code=400, detail="Round off would make total negative")
        
        totalOrderAmount = custom_round(total_received_after_roundoff)
        
        total_pending_discount += po_discount
        total_amount_pending_after_discount = total_amount_pending_before_tax - total_pending_discount
        final_total_pending_after_tax = total_amount_pending_after_discount + total_pending_tax
        pendingOrderAmount = custom_round(final_total_pending_after_tax)
        
        # Determine status
        item_status = "ItemReceived" if all_items_received else "Pending"
        
        if all_items_received:
            po_status = "GRNConverted"
        else:
            any_received = any(item.get('totalReceivedQuantity', 0) > 0 for item in updated_items)
            po_status = "PartiallyReceived" if any_received else "Approved"
        
        # GRN Management - ALWAYS CREATE NEW GRN
        grn_id = None
        grn_created = False
        stock_update_result = None
        
        logger.info(f"GRN_CREATION|po={purchaseOrderId}|pendingGrnId={existing_purchaseorder.get('pendingGrnId')}|creating_new=true")
        
        # Create new GRN if there are received items
        if newly_received_items:
            # Generate new random ID for GRN
            target_grn_random_id =await generate_grnrandom_id(tenant_id)
            
            # Build GRN items
            grn_item_details = []
            for receipt in newly_received_items:
                item = next((i for i in updated_items if i['itemId'] == receipt['itemId']), None)
                if not item:
                    continue
                
                grn_item = {
                    "itemId": receipt['itemId'],
                    "itemName": item.get('itemName'),
                    "uom": item.get('uom'),
                    "nos": item.get('count', 0),
                    "eachQuantity": item.get('eachQuantity', 0),
                    "taxType": item.get('taxType'),
                    "quantity": receipt['receivedQuantity'],
                    "receivedQuantity": receipt['receivedQuantity'],
                    "befTaxDiscount": item.get('befTaxDiscount', 0),
                    "befTaxDiscountAmount": item.get('befTaxDiscountAmount', 0),
                    "afTaxDiscount": item.get('afTaxDiscount', 0),
                    "afTaxDiscountAmount": item.get('afTaxDiscountAmount', 0),
                    "taxAmount": item.get('taxAmount', 0),
                    "unitPrice": receipt['grnPrice'],
                    "grnPrice": receipt['grnPrice'],
                    "hsnCode": item.get('hsnCode', ''),
                    "totalPrice": item.get('totalPrice', 0),
                    "finalPrice": item.get('finalPrice', 0),
                    "expiryDate": item.get('expiryDate'),
                    "item_rand": receipt['item_random_id'],
                    "purchasetaxName": item.get('taxPercentage', 0)  # ← ADD THIS LINE - map taxPercentage to purchasetaxName
                }
                
                # Tax breakdown
                if item.get('taxType') == 'cgst_sgst':
                    grn_item['cgst'] = item.get('cgst', 0)
                    grn_item['sgst'] = item.get('sgst', 0)
                else:
                    grn_item['igst'] = item.get('igst', 0)
                
                grn_item_details.append(grn_item)
            
            if grn_item_details:
                current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
                
                # Calculate GRN total
                items_total = sum(i['finalPrice'] for i in grn_item_details)
                grn_total_before_round = items_total + total_freight_amount + total_freight_tax
                grn_total = custom_round(grn_total_before_round + round_off_amount)
                
                # Create new GRN
                grn_data = {
                    "purchaseOrderId": purchaseOrderId,
                    "poRandomID": existing_purchaseorder.get('randomId'),
                    "vendorName": existing_purchaseorder.get('vendorName', ''),
                    "vendorId": existing_purchaseorder.get('vendorId', ''),
                    "grnDate": purchaseOrderPatch.grnDate or current_datetime,
                    "poDate": existing_purchaseorder.get('orderDate'),
                    "warehouseId":"WH001",
                    "itemDetails": grn_item_details,
                    "totalReceivedAmount": grn_total,
                    "grnAmount": grn_total,
                    "totalDiscount": custom_round(sum(i.get('befTaxDiscountAmount', 0) + i.get('afTaxDiscountAmount', 0) for i in grn_item_details)),
                    "totalTax": custom_round(sum(i.get('taxAmount', 0) for i in grn_item_details) + total_freight_tax),
                    "grnRoundOffAmount": round_off_amount,
                    "totalAmountBeforeRoundOff": grn_total_before_round,
                    "invoiceDate": purchaseOrderPatch.invoiceDate,
                    "invoiceNo": purchaseOrderPatch.invoiceNo,
                    "discountPrice": po_discount,
                    "randomId": target_grn_random_id,
                    "freights": [f.dict() for f in current_freights],
                    "totalFreightAmount": total_freight_amount,
                    "totalFreightTaxAmount": total_freight_tax,
                    "createdDate": current_datetime,
                    "lastUpdatedDate": current_datetime,
                    "status": "active",
                    "isPartialReceipt": not all_items_received
                }
                
                result = get_grn_collection(tenant_id).insert_one(grn_data)
                grn_id = str(result.inserted_id)
                grn_created = True
                
                # Update with grnId
                get_grn_collection(tenant_id).update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"grnId": grn_id}}
                )
                
                # ===== CRITICAL: Update stock and prices =====
                # This function will:
                # 1. Move current purchasePrice to oldPrice in item master
                # 2. Set new purchasePrice to grn_price in item master
                # 3. Update inventory stock
                stock_update_result = update_stock_and_prices_with_master(grn_item_details, tenant_id, is_revert=False)
                
                logger.info(f"NEW_GRN_CREATED|po={purchaseOrderId}|grn_id={grn_id}|random_id={target_grn_random_id}|items={len(grn_item_details)}")
        
        # Default stock result if no updates
        if stock_update_result is None:
            stock_update_result = {
                'success': True,
                'total_processed': 0,
                'successful': 0,
                'failed': 0,
                'items': [],
                'stock_updates': 0,
                'price_updates': 0
            }
        
        # Update PO - set pendingGrnId to the NEW GRN ID
        update_data = {
            "totalOrderAmount": totalOrderAmount,
            "pendingOrderAmount": pendingOrderAmount,
            "pendingDiscountAmount": total_pending_discount,
            "pendingTaxAmount": total_pending_tax,
            "discountPrice": po_discount,
            "totalDiscount": total_discount,
            "totalTax": total_tax + total_freight_tax,
            "itemStatus": item_status,
            "poStatus": po_status,
            "items": updated_items,
            "lastUpdatedDate": datetime.now(pytz.timezone('Asia/Kolkata')),
            "grnRoundOffAmount": round_off_amount,
            "freights": [f.dict() for f in current_freights],
            "totalFreightAmount": total_freight_amount,
            "totalFreightTaxAmount": total_freight_tax,
            "GrnConvertedPerson": user_id,
        }
        
        # If this is a full receipt, clear any revert flags
        if all_items_received:
            update_data["lastRevertedGrnId"] = None
        
        get_purchaseorder_collection(tenant_id).update_one(
            {"_id": ObjectId(purchaseOrderId)},
            {"$set": update_data}
        )
        
        logger.info(f"PATCH_COMPLETE|po={purchaseOrderId}|status={po_status}|new_grn={grn_id}|items={len(newly_received_items)}|price_updates={len(price_changes)}")
        
        return {
            "message": "Purchase order updated successfully with NEW GRN",
            "purchaseOrderId": purchaseOrderId,
            "poStatus": po_status,
            "itemStatus": item_status,
            "totalOrderAmount": totalOrderAmount,
            "pendingOrderAmount": pendingOrderAmount,
            "grnCreated": grn_created,
            "grnId": grn_id,
            "grnRandomId": target_grn_random_id if 'target_grn_random_id' in locals() else None,
            "newlyReceivedItems": len(newly_received_items),
            "priceUpdates": len(price_changes),
            "priceChanges": price_changes,
            "stockUpdate": stock_update_result,
            "note": "New GRN created - PO item newPrice updated with grnPrice",
            "summary": {
                "poNewPriceUpdated": True,
                "itemMasterUpdated": stock_update_result.get('price_updates', 0) > 0,
                "oldPriceMovedToOldPriceField": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR|po={purchaseOrderId}|{str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))