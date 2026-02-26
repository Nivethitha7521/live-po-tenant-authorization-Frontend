from datetime import datetime
import logging
from typing import Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException,Depends,Request
import pytz
from grn.routes import custom_round, generate_grnrandom_id
from purchaseOrder.models import PurchaseOrderPatch
from utils.database import get_grn_collection,get_inventory_collection,get_purchaseorder_collection,get_purchaseitem_collection
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from database import db



router = APIRouter()

def update_stock_quantities(grn_item_details: List[Dict],tenant_id:str):
    item_collection = get_purchaseitem_collection(tenant_id)
    """
    Update stock quantities for received items
    """
    try:
        for item in grn_item_details:
            random_id = item['item_rand']
            received_quantity = item['receivedQuantity']
            
            purchase_item = item_collection.find_one({"randomId": random_id})
            if purchase_item:
                current_stock = purchase_item.get('stockQuantity', 0)
                new_stock = current_stock + received_quantity
                
                item_collection.update_one(
                    {"randomId": random_id},
                    {"$set": {
                        "stockQuantity": new_stock,
                        "lastUpdatedDate": datetime.now(pytz.timezone('Asia/Kolkata'))
                    }}
                )
                logging.info(f"Updated stock for item {random_id}: {current_stock} -> {new_stock}")
            else:
                logging.warning(f"Purchase item not found for randomId: {random_id}")
    except Exception as e:
        logging.error(f"Error updating stock quantities: {str(e)}")
        raise
async def get_user_id_by_username(username: str):
    user = await db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return str(user["_id"])
@router.patch("/receivedupdates/{purchaseOrderId}")
async def patch_received_count(request:Request,
    purchaseOrderId: str,
    purchaseOrderPatch: PurchaseOrderPatch,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_approved", "edit"))
) -> Dict:
    tenant_id = request.state.tenant_id

    po_collection = get_purchaseorder_collection(tenant_id)
    grn_collection = get_grn_collection(tenant_id)
    item_collection = get_purchaseitem_collection(tenant_id)

    try:
        # Validate purchaseOrderId
        if not purchaseOrderId or not ObjectId.is_valid(purchaseOrderId):
            logging.error(f"Invalid or missing purchaseOrderId: {purchaseOrderId}")
            raise HTTPException(status_code=400, detail="Invalid or missing purchaseOrderId")
        
        # Retrieve the existing purchase order
        existing_purchaseorder = po_collection.find_one({"_id": ObjectId(purchaseOrderId)})
        if not existing_purchaseorder:
            logging.error(f"Purchase order not found for ID: {purchaseOrderId}")
            raise HTTPException(status_code=404, detail="Purchase order not found")

        # Log the incoming patch payload for debugging
        logging.info(f"Received patch payload for PO {purchaseOrderId}: {purchaseOrderPatch.dict()}")

        # ========== FREIGHT PROCESSING ==========
        current_freights = purchaseOrderPatch.freights or []
        total_freight_amount = 0
        total_freight_tax = 0
        
        for freight in current_freights:
            total_freight_amount += freight.amt
            total_freight_tax += freight.tAmt
        
        logging.info(f"Processing {len(current_freights)} freight charges for current receipt: Total Amount={total_freight_amount}, Total Tax={total_freight_tax}")

        # Initialize totals
        total_discount = total_amount_before_tax = total_tax = total_amount_after_tax = 0
        total_pending_discount = total_pending_tax = total_amount_pending_before_tax = 0
        total_amount_pending_after_tax = 0
        updated_items = []
        all_items_received = True
        
        # Apply overall PO discount from patch
        po_discount = purchaseOrderPatch.grndiscountPrice or 0
        existing_purchaseorder["discountPrice"] = po_discount
        existing_purchaseorder["pendingDiscountAmount"] = po_discount
        
        # Process roundOff amount from GRN
        round_off_amount = purchaseOrderPatch.grnRoundOffAmount or 0
        logging.info(f"GRN RoundOff amount applied: {round_off_amount}")
        
        # Get ALL items from existing PO
        all_po_items = existing_purchaseorder.get('items', [])
        
        # Create a map of itemId to existing item for quick lookup
        existing_items_map = {item['itemId']: item.copy() for item in all_po_items}
        
        # Process each item in the patch
        processed_item_ids = set()
        
        # Track items that have NEW receipts in this GRN
        newly_received_items = []
        
        # First process items from the patch
        for item_patch in purchaseOrderPatch.items:
            updated_item = existing_items_map.get(item_patch.itemId)
            if not updated_item:
                logging.warning(f"Item with ID {item_patch.itemId} not found in PO {purchaseOrderId}")
                continue
            
            # Store original values
            original_total_received = updated_item.get('totalReceivedQuantity', 0)
            original_status = updated_item.get('status', 'NotYetCome')
            
            # Update expiryDate and discounts from item_patch
            if item_patch.expiryDate is not None:
                logging.info(f"Updating expiryDate for item {item_patch.itemId}: {item_patch.expiryDate}")
                updated_item['expiryDate'] = item_patch.expiryDate
            else:
                updated_item['expiryDate'] = None
            
            # Validate discount percentages
            bef_tax_discount = max(0, min(100, item_patch.befTaxDiscount or 0))
            af_tax_discount = max(0, item_patch.afTaxDiscount or 0)
            
            updated_item['befTaxDiscount'] = bef_tax_discount
            updated_item['afTaxDiscount'] = af_tax_discount
            
            # Handle GRN price
            if item_patch.grnPrice is not None:
                updated_item['grnPrice'] = item_patch.grnPrice
                logging.info(f"Updated grnPrice for item {item_patch.itemId}: {item_patch.grnPrice}")
            elif 'grnPrice' in updated_item:
                logging.info(f"Using existing grnPrice for item {item_patch.itemId}: {updated_item['grnPrice']}")
            else:
                updated_item['grnPrice'] = updated_item.get('newPrice', 0)
                logging.info(f"Using newPrice as fallback for item {item_patch.itemId}: {updated_item['grnPrice']}")
            
            # Get current values
            current_pending_count = updated_item.get('pendingCount', 0)
            current_pending_quantity = updated_item.get('pendingQuantity', 0)
            current_count = updated_item.get('count', 0)
            current_total_received_quantity = updated_item.get('totalReceivedQuantity', 0)
            current_pending_total_quantity = updated_item.get('pendingTotalQuantity', 0)
            po_quantity = updated_item.get('poQuantity', 0)
            
            # Validate received quantity
            received_quantity = item_patch.receivedQuantity or 0
            if received_quantity < 0:
                logging.error(f"Invalid receivedQuantity ({received_quantity}) for item {item_patch.itemId} in PO {purchaseOrderId}")
                raise HTTPException(status_code=400, detail="Received quantity cannot be negative")
            
            if received_quantity > current_pending_total_quantity:
                logging.error(f"Received quantity {received_quantity} exceeds pending total quantity {current_pending_total_quantity} for item {item_patch.itemId}")
                raise HTTPException(status_code=400, detail=f"Received quantity {received_quantity} exceeds pending total quantity {current_pending_total_quantity}")
            
            # Update quantities based on receipt
            if received_quantity == 0:
                # No quantity received in this GRN
                updated_item['pendingCount'] = current_pending_count
                updated_item['pendingQuantity'] = current_pending_quantity
                updated_item['count'] = current_count
                updated_item['eachQuantity'] = current_pending_quantity
                updated_item['receivedQuantity'] = 0
                updated_item['totalReceivedQuantity'] = current_total_received_quantity
            else:
                # Quantity received in this GRN
                is_count_based = current_pending_count > 1
                if is_count_based:
                    expected_quantity_per_count = po_quantity / current_pending_count
                    units_received = received_quantity / expected_quantity_per_count
                    full_packages_received = int(units_received)
                    partial_quantity = received_quantity % expected_quantity_per_count
                    
                    if partial_quantity == 0:
                        updated_item['count'] = full_packages_received
                        updated_item['eachQuantity'] = expected_quantity_per_count
                        updated_item['pendingCount'] = current_pending_count - full_packages_received
                        updated_item['pendingQuantity'] = expected_quantity_per_count
                    else:
                        updated_item['count'] = 1
                        updated_item['eachQuantity'] = received_quantity
                        remaining_quantity = current_pending_total_quantity - received_quantity
                        updated_item['pendingCount'] = 1 if remaining_quantity > 0 else 0
                        updated_item['pendingQuantity'] = remaining_quantity if remaining_quantity > 0 else 0
                else:
                    # Simple quantity-based receipt
                    updated_item['count'] = 1
                    updated_item['eachQuantity'] = received_quantity
                    updated_item['pendingCount'] = 1 if (current_pending_total_quantity - received_quantity) > 0 else 0
                    updated_item['pendingQuantity'] = max(0, current_pending_total_quantity - received_quantity)
                
                updated_item['receivedQuantity'] = received_quantity
                updated_item['totalReceivedQuantity'] = current_total_received_quantity + received_quantity
                
                # Check if this is a NEW receipt
                if received_quantity > 0:
                    newly_received_items.append({
                        'itemId': item_patch.itemId,
                        'receivedQuantity': received_quantity,
                        'original_total': original_total_received,
                        'new_total': updated_item['totalReceivedQuantity'],
                        'item_random_id': updated_item.get('randomId')
                    })
            
            # Calculate total quantities
            pending_total_quantity = updated_item['pendingCount'] * updated_item['pendingQuantity']
            updated_item['pendingTotalQuantity'] = pending_total_quantity
            updated_item['quantity'] = updated_item['totalReceivedQuantity']
            
            # Determine item status
            if pending_total_quantity == 0:
                updated_item['status'] = "Received"
                logging.info(f"Item {item_patch.itemId} fully received: {updated_item['totalReceivedQuantity']}/{po_quantity}")
            elif updated_item['totalReceivedQuantity'] > 0:
                updated_item['status'] = "Pending"
                logging.info(f"Item {item_patch.itemId} partially received: {updated_item['totalReceivedQuantity']}/{po_quantity}, Pending: {pending_total_quantity}")
            else:
                updated_item['status'] = "NotYetCome"
                logging.info(f"Item {item_patch.itemId} not received yet: 0/{po_quantity}")
            
            # Update all_items_received flag
            if pending_total_quantity > 0:
                all_items_received = False
                logging.info(f"Item {item_patch.itemId} has pending quantity: {pending_total_quantity}, marking all_items_received as False")
            
            # Calculate amounts using GRN price
            final_grn_price = updated_item['grnPrice']
            tax_percentage = updated_item.get('taxPercentage', 0)
            
            received_quantity_actual = received_quantity
            total_received_quantity_actual = updated_item['totalReceivedQuantity']
            pending_quantity_actual = updated_item['pendingTotalQuantity']
            
            # RECEIVED ITEMS calculations
            received_total_price = received_quantity_actual * final_grn_price
            received_bef_tax_discount_amount = received_total_price * (bef_tax_discount / 100)
            received_price_after_bef_discount = received_total_price - received_bef_tax_discount_amount
            received_tax_amount = received_price_after_bef_discount * (tax_percentage / 100)
            received_price_after_tax = received_price_after_bef_discount + received_tax_amount
            received_af_tax_discount_amount = received_price_after_tax * (af_tax_discount / 100)
            
            # PENDING ITEMS calculations
            pending_total_price = pending_quantity_actual * final_grn_price
            pending_bef_tax_discount_amount = pending_total_price * (bef_tax_discount / 100)
            pending_price_after_bef_discount = pending_total_price - pending_bef_tax_discount_amount
            pending_tax_amount = pending_price_after_bef_discount * (tax_percentage / 100)
            pending_price_after_tax = pending_price_after_bef_discount + pending_tax_amount
            pending_af_tax_discount_amount = pending_price_after_tax * (af_tax_discount / 100)
            
            # Update item fields for received
            updated_item['totalPrice'] = round(received_total_price, 2)
            updated_item['befTaxDiscountAmount'] = round(received_bef_tax_discount_amount, 2)
            updated_item['discountAmount'] = round(received_bef_tax_discount_amount, 2)
            updated_item['taxAmount'] = round(received_tax_amount, 2)
            updated_item['afTaxDiscountAmount'] = round(received_af_tax_discount_amount, 2)
            received_final_price = max(0, received_price_after_tax - received_af_tax_discount_amount)
            updated_item['finalPrice'] = round(received_final_price, 2)
            
            # Update item fields for pending
            updated_item['pendingTotalPrice'] = round(pending_total_price, 2)
            updated_item['pendingBefTaxDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
            updated_item['pendingDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
            updated_item['pendingTaxAmount'] = round(pending_tax_amount, 2)
            updated_item['pendingAfTaxDiscountAmount'] = round(pending_af_tax_discount_amount, 2)
            pending_final_price = max(0, pending_price_after_tax - pending_af_tax_discount_amount)
            updated_item['pendingFinalPrice'] = round(pending_final_price, 2)
            
            # Calculate CGST/SGST/IGST for received
            item_cgst = item_sgst = item_igst = 0
            if updated_item.get('taxType') == 'cgst_sgst':
                item_cgst = received_tax_amount / 2
                item_sgst = received_tax_amount / 2
            elif updated_item.get('taxType') == 'igst':
                item_igst = received_tax_amount
            updated_item['cgst'] = round(item_cgst, 2)
            updated_item['sgst'] = round(item_sgst, 2)
            updated_item['igst'] = round(item_igst, 2)
            
            # Calculate CGST/SGST/IGST for pending
            pending_cgst = pending_sgst = pending_igst = 0
            if updated_item.get('taxType') == 'cgst_sgst':
                pending_cgst = pending_tax_amount / 2
                pending_sgst = pending_tax_amount / 2
            elif updated_item.get('taxType') == 'igst':
                pending_igst = pending_tax_amount
            updated_item['pendingCgst'] = round(pending_cgst, 2)
            updated_item['pendingSgst'] = round(pending_sgst, 2)
            updated_item['pendingIgst'] = round(pending_igst, 2)
            
            # Add to totals
            total_amount_before_tax += received_total_price
            total_discount += received_bef_tax_discount_amount + received_af_tax_discount_amount
            total_tax += received_tax_amount
            total_amount_after_tax += received_final_price
            
            total_amount_pending_before_tax += pending_total_price
            total_pending_discount += pending_bef_tax_discount_amount + pending_af_tax_discount_amount
            total_pending_tax += pending_tax_amount
            total_amount_pending_after_tax += pending_final_price
            
            # Mark this item as processed
            processed_item_ids.add(item_patch.itemId)
            updated_items.append(updated_item.copy())
        
        # Process items NOT in patch
        for item_id, existing_item in existing_items_map.items():
            if item_id not in processed_item_ids:
                logging.info(f"Preserving item {item_id} that was not in patch")
                
                pending_count = existing_item.get('pendingCount', 0)
                pending_quantity = existing_item.get('pendingQuantity', 0)
                pending_total_quantity = pending_count * pending_quantity
                
                existing_item['pendingTotalQuantity'] = pending_total_quantity
                
                if pending_total_quantity > 0:
                    pending_quantity_actual = pending_total_quantity
                    final_grn_price = existing_item.get('grnPrice', existing_item.get('newPrice', 0))
                    tax_percentage = existing_item.get('taxPercentage', 0)
                    bef_tax_discount = existing_item.get('befTaxDiscount', 0)
                    af_tax_discount = existing_item.get('afTaxDiscount', 0)
                    
                    pending_total_price = pending_quantity_actual * final_grn_price
                    pending_bef_tax_discount_amount = pending_total_price * (bef_tax_discount / 100)
                    pending_price_after_bef_discount = pending_total_price - pending_bef_tax_discount_amount
                    pending_tax_amount = pending_price_after_bef_discount * (tax_percentage / 100)
                    pending_price_after_tax = pending_price_after_bef_discount + pending_tax_amount
                    pending_af_tax_discount_amount = pending_price_after_tax * (af_tax_discount / 100)
                    pending_final_price = max(0, pending_price_after_tax - pending_af_tax_discount_amount)
                    
                    existing_item['pendingTotalPrice'] = round(pending_total_price, 2)
                    existing_item['pendingBefTaxDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
                    existing_item['pendingDiscountAmount'] = round(pending_bef_tax_discount_amount, 2)
                    existing_item['pendingTaxAmount'] = round(pending_tax_amount, 2)
                    existing_item['pendingAfTaxDiscountAmount'] = round(pending_af_tax_discount_amount, 2)
                    existing_item['pendingFinalPrice'] = round(pending_final_price, 2)
                    
                    total_amount_pending_before_tax += pending_total_price
                    total_pending_discount += pending_bef_tax_discount_amount + pending_af_tax_discount_amount
                    total_pending_tax += pending_tax_amount
                    total_amount_pending_after_tax += pending_final_price
                
                if pending_total_quantity > 0:
                    all_items_received = False
                else:
                    if existing_item.get('totalReceivedQuantity', 0) > 0:
                        existing_item['status'] = "Received"
                    else:
                        existing_item['status'] = "NotYetCome"
                
                updated_items.append(existing_item.copy())
        
        # ========== CALCULATE FINAL TOTALS ==========
        total_discount += po_discount
        total_amount_after_discount = total_amount_before_tax - total_discount
        final_total_after_tax = total_amount_after_discount + total_tax
        
        total_received_amount_before_roundoff = final_total_after_tax + total_freight_amount + total_freight_tax
        total_received_amount_after_roundoff = total_received_amount_before_roundoff + round_off_amount
        
        if total_received_amount_after_roundoff < 0:
            logging.error(f"Round off amount {round_off_amount} would make total negative: {total_received_amount_after_roundoff}")
            raise HTTPException(
                status_code=400,
                detail=f"Round off amount cannot make total amount negative. Current total: {total_received_amount_before_roundoff:.2f}, Round off: {round_off_amount:.2f}"
            )
        
        totalOrderAmount = custom_round(total_received_amount_after_roundoff)
        
        total_pending_discount += po_discount
        total_amount_pending_after_discount = total_amount_pending_before_tax - total_pending_discount
        final_total_pending_after_tax = total_amount_pending_after_discount + total_pending_tax
        pendingOrderAmount = custom_round(final_total_pending_after_tax)
        
        # ========== DETERMINE STATUSES ==========
        item_status = "ItemReceived" if all_items_received else "Pending"
        
        if all_items_received:
            po_status = "GRNConverted"
            username = user.get("username")
            user_id = await get_user_id_by_username(username)
            logging.info(f"All items fully received for PO {purchaseOrderId}, setting status to GRNConverted")
        else:
            any_items_received = any(item.get('totalReceivedQuantity', 0) > 0 for item in updated_items)
            if any_items_received:
                po_status = "PartiallyReceived"
                logging.info(f"Some items partially received for PO {purchaseOrderId}, setting status to PartiallyReceived")
            else:
                po_status = "Pending"
                logging.info(f"No items received yet for PO {purchaseOrderId}, setting status to Pending")
        
        # ========== GRN MANAGEMENT - SIMPLIFIED ==========
        grn_id = None
        grn_created = False
        grn_updated = False
        target_grn_random_id = None
        update_type = "new"  # Default to new GRN
        is_revert_scenario = False
        
        # ========== SIMPLE RULE: Only reverted GRNs can be updated ==========
        # Check if there's a pendingGrnId that can be re-updated
        pending_grn_id = existing_purchaseorder.get('pendingGrnId')
        if pending_grn_id and ObjectId.is_valid(pending_grn_id) and newly_received_items:
            pending_grn = grn_collection.find_one({"_id": ObjectId(pending_grn_id)})
            
            if pending_grn and pending_grn.get('status') == 'Po Reverted' and pending_grn.get('canBeReUpdated', False):
                is_revert_scenario = True
                target_grn_random_id = pending_grn['randomId']
                update_type = "reverted"
                logging.info(f"REVERT SCENARIO: Found pending GRN {pending_grn_id} that can be re-updated")
        
        # ========== ALL OTHER CASES: Create NEW GRN ==========
        if not is_revert_scenario and newly_received_items:
            # NORMAL RECEIPT SCENARIO: ALWAYS CREATE NEW GRN
            target_grn_random_id = generate_grnrandom_id(tenant_id)
            update_type = "new"
            logging.info(f"NORMAL RECEIPT: Creating NEW GRN with randomId {target_grn_random_id}")
        
        # ========== CREATE/UPDATE GRN ==========
        grn_item_details = []
        if newly_received_items and target_grn_random_id:
            logging.info(f"Processing {len(newly_received_items)} newly received items for GRN {target_grn_random_id}")
            
            # Prepare current receipt items for GRN
            for new_receipt in newly_received_items:
                item_id = new_receipt['itemId']
                received_quantity = new_receipt['receivedQuantity']
                
                updated_item = next((i for i in updated_items if i['itemId'] == item_id), None)
                if not updated_item or received_quantity <= 0:
                    continue
                
                # Calculate item details for GRN
                receipt_unit_price = updated_item['grnPrice']
                receipt_final_price = updated_item['finalPrice']
                receipt_bef_discount = updated_item['befTaxDiscountAmount']
                receipt_af_discount = updated_item['afTaxDiscountAmount']
                receipt_tax = updated_item['taxAmount']
                receipt_total_price = updated_item['totalPrice']
                
                tax_amount = receipt_tax
                sgst = cgst = igst = 0
                if updated_item.get('taxType') == 'cgst_sgst':
                    sgst = tax_amount / 2
                    cgst = tax_amount / 2
                elif updated_item.get('taxType') == 'igst':
                    igst = tax_amount
                
                grn_item_detail = {
                    "itemId": item_id,
                    "itemName": updated_item.get('itemName'),
                    "uom": updated_item.get('uom'),
                    "nos": updated_item.get('count', 0),
                    "eachQuantity": updated_item.get('eachQuantity', 0),
                    "taxType": updated_item.get('taxType'),
                    "purchasecategoryName": updated_item.get('purchasecategoryName'),
                    "purchasesubcategoryName": updated_item.get('purchasesubcategoryName'),
                    "sgst": round(sgst, 2),
                    "cgst": round(cgst, 2),
                    "igst": round(igst, 2),
                    "quantity": received_quantity,
                    "receivedQuantity": received_quantity,
                    "totalQuantity": received_quantity,
                    "befTaxDiscount": updated_item.get('befTaxDiscount', 0),
                    "befTaxDiscountAmount": round(receipt_bef_discount, 2),
                    "afTaxDiscount": updated_item.get('afTaxDiscount', 0),
                    "afTaxDiscountAmount": round(receipt_af_discount, 2),
                    "discountAmount": round(receipt_bef_discount + receipt_af_discount, 2),
                    "purchasetaxName": updated_item.get('taxPercentage', 0),
                    "taxAmount": round(tax_amount, 2),
                    "unitPrice": receipt_unit_price,
                    "hsnCode": updated_item.get('hsnCode', ''),
                    "totalPrice": round(receipt_total_price, 2),
                    "finalPrice": round(receipt_final_price, 2),
                    "expiryDate": updated_item.get('expiryDate'),
                    "status": "Received",
                    "poQuantity": updated_item.get('poQuantity', 0),
                    "item_rand": updated_item.get("randomId"),
                    "batchTimestamp": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat(),
                    "isCurrentReceipt": True
                }
                grn_item_details.append(grn_item_detail)
            
            if grn_item_details:
                # Calculate GRN totals for current receipt
                items_total = sum(item['finalPrice'] for item in grn_item_details)
                precise_grn_total_before_roundoff = items_total + total_freight_amount + total_freight_tax
                total_grn_amount_after_roundoff = custom_round(precise_grn_total_before_roundoff + round_off_amount)
                
                if total_grn_amount_after_roundoff < 0:
                    logging.error(f"GRN Round off amount would make GRN total negative")
                    raise HTTPException(
                        status_code=400,
                        detail=f"GRN Round off amount cannot make GRN total negative"
                    )
                
                current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
                grn_date = purchaseOrderPatch.grnDate or current_datetime
                
                if is_revert_scenario:
                    # ===== REVERT SCENARIO: UPDATE EXISTING GRN =====
                    existing_grn = grn_collection.find_one({"randomId": target_grn_random_id})
                    if existing_grn:
                        # Store previous receipt data in history
                        previous_receipts = existing_grn.get('receiptHistory', [])
                        previous_receipts.append({
                            'timestamp': existing_grn.get('lastUpdatedDate'),
                            'itemDetails': existing_grn.get('itemDetails', []),
                            'totalAmount': existing_grn.get('totalReceivedAmount', 0),
                            'invoiceNo': existing_grn.get('invoiceNo'),
                            'invoiceDate': existing_grn.get('invoiceDate'),
                            'isRevertedReceipt': True
                        })
                        
                        # Update the existing GRN with new data - SAME ID, SAME randomId
                        grn_data = {
                            "purchaseOrderId": purchaseOrderId,
                            "poRandomID": existing_purchaseorder.get('randomId'),
                            "vendorName": existing_purchaseorder.get('vendorName', ''),
                            "vendorId": existing_purchaseorder.get('vendorId', ''),
                            "grnDate": grn_date,
                            "poDate": existing_purchaseorder.get('orderDate'),
                            "receivingLocation": "",
                            "itemDetails": grn_item_details,
                            "inspectionStatus": "Pending",
                            "receivedBy": "",
                            "totalReceivedAmount": total_grn_amount_after_roundoff,
                            "grnAmount": total_grn_amount_after_roundoff,
                            "totalDiscount": custom_round(sum(item['discountAmount'] for item in grn_item_details)),
                            "totalTax": custom_round(sum(item['taxAmount'] for item in grn_item_details) + total_freight_tax),
                            "grnRoundOffAmount": round_off_amount,
                            "totalAmountBeforeRoundOff": precise_grn_total_before_roundoff,
                            "comments": existing_purchaseorder.get('comments', ''),
                            "attachments": existing_purchaseorder.get('attachments'),
                            "createdDate": existing_grn.get('createdDate', current_datetime),
                            "invoiceDate": purchaseOrderPatch.invoiceDate,
                            "invoiceNo": purchaseOrderPatch.invoiceNo,
                            "discountPrice": po_discount,
                            "paymentTerms": existing_purchaseorder.get('paymentTerms', ''),
                            "status": "active",  # ALWAYS reset to active
                            "contactpersonEmail": existing_purchaseorder.get('contactpersonEmail', ''),
                            "city": existing_purchaseorder.get('city', ''),
                            "state": existing_purchaseorder.get('state', ''),
                            "country": existing_purchaseorder.get('country', ''),
                            "address": existing_purchaseorder.get('address', ''),
                            "postalCode": existing_purchaseorder.get('postalCode', ''),
                            "gstNumber": existing_purchaseorder.get('gstNumber', ''),
                            "shippingAddress": existing_purchaseorder.get('shippingAddress', ''),
                            "billingAddress": existing_purchaseorder.get('billingAddress', ''),
                            "agingDay": 0,
                            
                            "randomId": target_grn_random_id,  # SAME randomId
                            "freights": [freight.dict() for freight in current_freights],
                            "totalFreightAmount": total_freight_amount,
                            "totalFreightTaxAmount": total_freight_tax,
                            "receiptBatch": current_datetime.strftime("%Y%m%d_%H%M%S"),
                            "isPartialReceipt": not all_items_received,
                            "isReverted": False,
                            "canBeReUpdated": False,
                            "receiptHistory": previous_receipts,
                            "currentReceiptDate": current_datetime,
                            "lastUpdatedDate": current_datetime
                        }
                        
                        update_result = grn_collection.update_one(
                            {"_id": ObjectId(pending_grn_id)},  # Update by original ID
                            {"$set": grn_data}
                        )
                        
                        if update_result.modified_count > 0:
                            grn_id = pending_grn_id
                            grn_updated = True
                            logging.info(f"REVERT SCENARIO: Updated existing GRN {pending_grn_id} with new data")
                        else:
                            logging.error(f"Failed to update existing GRN {pending_grn_id}")
                    else:
                        logging.error(f"GRN not found for revert scenario: {pending_grn_id}")
                else:
                    # ===== NORMAL RECEIPT SCENARIO: CREATE NEW GRN =====
                    grn_data = {
                        "purchaseOrderId": purchaseOrderId,
                        "poRandomID": existing_purchaseorder.get('randomId'),
                        "vendorName": existing_purchaseorder.get('vendorName', ''),
                        "vendorId": existing_purchaseorder.get('vendorId', ''),
                        "grnDate": grn_date,
                        "poDate": existing_purchaseorder.get('orderDate'),
                        "receivingLocation": "",
                        "itemDetails": grn_item_details,
                        "inspectionStatus": "Pending",
                        "receivedBy": "",
                        "totalReceivedAmount": total_grn_amount_after_roundoff,
                        "grnAmount": total_grn_amount_after_roundoff,
                        "totalDiscount": custom_round(sum(item['discountAmount'] for item in grn_item_details)),
                        "totalTax": custom_round(sum(item['taxAmount'] for item in grn_item_details) + total_freight_tax),
                        "grnRoundOffAmount": round_off_amount,
                        "totalAmountBeforeRoundOff": precise_grn_total_before_roundoff,
                        "comments": existing_purchaseorder.get('comments', ''),
                        "attachments": existing_purchaseorder.get('attachments'),
                        "createdDate": current_datetime,
                        "invoiceDate": purchaseOrderPatch.invoiceDate,
                        "invoiceNo": purchaseOrderPatch.invoiceNo,
                        "discountPrice": po_discount,
                        "paymentTerms": existing_purchaseorder.get('paymentTerms', ''),
                        "status": "active",  # ALL NEW GRNs start as active
                        "contactpersonEmail": existing_purchaseorder.get('contactpersonEmail', ''),
                        "city": existing_purchaseorder.get('city', ''),
                        "state": existing_purchaseorder.get('state', ''),
                        "country": existing_purchaseorder.get('country', ''),
                        "address": existing_purchaseorder.get('address', ''),
                        "postalCode": existing_purchaseorder.get('postalCode', ''),
                        "gstNumber": existing_purchaseorder.get('gstNumber', ''),
                        "shippingAddress": existing_purchaseorder.get('shippingAddress', ''),
                        "billingAddress": existing_purchaseorder.get('billingAddress', ''),
                        "agingDay": 0,
                       
                        "randomId": target_grn_random_id,  # NEW randomId
                        "freights": [freight.dict() for freight in current_freights],
                        "totalFreightAmount": total_freight_amount,
                        "totalFreightTaxAmount": total_freight_tax,
                        "receiptBatch": current_datetime.strftime("%Y%m%d_%H%M%S"),
                        "isPartialReceipt": not all_items_received,
                        "isReverted": False,
                        "canBeReUpdated": False,
                        "receiptHistory": [],
                        "currentReceiptDate": current_datetime,
                        "lastUpdatedDate": current_datetime
                    }
                    
                    grn_result = grn_collection.insert_one(grn_data)
                    grn_id = str(grn_result.inserted_id)
                    grn_collection.update_one(
                        {"_id": grn_result.inserted_id},
                        {"$set": {"grnId": grn_id}}
                    )
                    grn_created = True
                    logging.info(f"NORMAL RECEIPT: Created NEW GRN with ID: {grn_id} for PO: {purchaseOrderId}")
                
                # Update stock quantities
                update_stock_quantities(grn_item_details,tenant_id)
        
        # ========== UPDATE PO ==========
        existing_freights = existing_purchaseorder.get('freights', [])
        all_freights_for_po = current_freights
        
        total_freight_amount_po = sum(freight.amt for freight in all_freights_for_po)
        total_freight_tax_po = sum(freight.tAmt for freight in all_freights_for_po)
        
        # Clear pendingGrnId if we used it in revert scenario
        new_pending_grn_id = existing_purchaseorder.get('pendingGrnId')
        if is_revert_scenario and new_pending_grn_id == pending_grn_id:
            new_pending_grn_id = None
            logging.info(f"Cleared pendingGrnId after revert scenario")
        
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
            "invoiceNo": purchaseOrderPatch.invoiceNo or existing_purchaseorder.get('invoiceNo'),
            "invoiceDate": purchaseOrderPatch.invoiceDate or existing_purchaseorder.get('invoiceDate'),
            "items": updated_items,
            "lastUpdatedDate": datetime.now(pytz.timezone('Asia/Kolkata')),
            "grnRoundOffAmount": round_off_amount,
            "freights": [freight.dict() for freight in all_freights_for_po],
            "totalFreightAmount": total_freight_amount_po,
            "totalFreightTaxAmount": total_freight_tax_po,
            "pendingGrnId": new_pending_grn_id,
            "lastRevertedGrnId": existing_purchaseorder.get('lastRevertedGrnId') if not grn_updated else None,
            "GrnConvertedPerson": user_id,
        }
        
        result = po_collection.update_one(
            {"_id": ObjectId(purchaseOrderId)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            logging.error(f"Failed to update purchase order {purchaseOrderId}")
            raise HTTPException(status_code=500, detail="Failed to update purchase order")
        
        # Log summary
        logging.info(f"PO {purchaseOrderId} updated: poStatus={po_status}")
        logging.info(f"GRN handled: Created={grn_created}, Updated={grn_updated}, ID={grn_id}")
        logging.info(f"Scenario: {'REVERT' if is_revert_scenario else 'NORMAL RECEIPT'}")
        logging.info(f"Update Type: {update_type}")
        logging.info(f"Total items in PO: {len(updated_items)}, New receipts: {len(newly_received_items)}")
        
        # ========== RETURN RESPONSE ==========
        return {
            "message": "Purchase order updated successfully",
            "purchaseOrderId": purchaseOrderId,
            "poStatus": po_status,
            "itemStatus": item_status,
            "totalOrderAmount": totalOrderAmount,
            "pendingOrderAmount": pendingOrderAmount,
            "grnCreated": grn_created,
            "grnUpdated": grn_updated,
            "grnId": grn_id,
            "grnRandomId": target_grn_random_id,
            "newlyReceivedItems": len(newly_received_items),
            "freightCharges": {
                "count": len(current_freights),
                "totalAmount": total_freight_amount,
                "totalTax": total_freight_tax
            },
            "scenario": "revert" if is_revert_scenario else "normal",
            "updateType": update_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Unexpected error in patch_received_count for PO {purchaseOrderId}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ========== GRN REVERT ENDPOINT ==========
def update_stock_quantities_revert(grn_item_details: List[Dict],tenant_id:str,reverse: bool = False):
    item_collection = get_purchaseitem_collection(tenant_id)

    """
    Update stock quantities for received items. If reverse=True, subtract quantities (for revert).
    """
    try:
        for item in grn_item_details:
            item_id = item['item_rand']
            quantity_delta = item['receivedQuantity']
            if reverse:
                quantity_delta = -quantity_delta
           
            # Find the purchase item
            purchase_item = item_collection.find_one({"randomId": item_id})
            if purchase_item:
                # Update stock quantity
                current_stock = purchase_item.get('stockQuantity', 0)
                new_stock = current_stock + quantity_delta
               
                item_collection.update_one(
                    {"randomId": item_id},
                    {"$set": {
                        "stockQuantity": new_stock,
                        "lastUpdatedDate": datetime.now(pytz.timezone('Asia/Kolkata'))
                    }}
                )
                logging.info(f"Updated stock for item {item_id}: {current_stock} -> {new_stock} (reverse: {reverse})")
            else:
                logging.warning(f"Purchase item not found for ID: {item_id}")
    except Exception as e:
        logging.error(f"Error updating stock quantities: {str(e)}")
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
       
        # Reverse only this GRN's received quantity (assumes totalReceivedQuantity tracks cumulative)
        po_item['totalReceivedQuantity'] -= received_quantity
        po_item['quantity'] = po_item['totalReceivedQuantity'] # Update received quantity display
       
        # Recalculate pending from PO quantity
        po_quantity = po_item.get('poQuantity', 0)
        pending_total = max(0, po_quantity - po_item['totalReceivedQuantity'])
        po_item['pendingTotalQuantity'] = pending_total
       
        # Revert count/pendingCount logic (simplified; adjust for count-based if needed)
        # Note: For precise count-based reversal, you may need to store original pendingCount per GRN or recalculate
        if pending_total > 0:
            # Restore pending based on original PO logic (e.g., full pending if count-based)
            # Assuming simple quantity-based for now; enhance as needed
            po_item['pendingCount'] = 1 # Or fetch from PO original
            po_item['pendingQuantity'] = pending_total / po_item['pendingCount'] if po_item['pendingCount'] > 0 else pending_total
            po_item['count'] = po_item['totalReceivedQuantity'] / po_item['pendingQuantity'] if po_item['pendingQuantity'] > 0 else 0
            po_item['eachQuantity'] = po_item['pendingQuantity']
            po_item['receivedQuantity'] = 0 # Clear current (this GRN's) receipt
        else:
            po_item['pendingCount'] = 0
            po_item['pendingQuantity'] = 0
       
        # Clear expiryDate on this item during reversal
        po_item['expiryDate'] = None
       
        # Update status based on new totals
        if po_item['totalReceivedQuantity'] == 0:
            po_item['status'] = "NotYetCome"
        elif po_item['pendingTotalQuantity'] > 0:
            po_item['status'] = "Approved" # Changed from "Pending" to "Approved" as per request
        else:
            po_item['status'] = "Received"
       
        logging.info(f"Reversed GRN for item {item_id}: totalReceivedQuantity now {po_item['totalReceivedQuantity']}, pending {po_item['pendingTotalQuantity']}, expiryDate cleared")
   
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
    totalOrderAmount = round(final_total_after_tax, 2) # Or use custom_round if available
   
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
async def revert_grn(request:Request,grnId: str,
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp", "purchaseorders_approved", "edit")
    )) -> Dict:
    tenant_id = request.state.tenant_id

    po_collection = get_purchaseorder_collection(tenant_id)
    grn_collection = get_grn_collection(tenant_id)
    item_collection = get_purchaseitem_collection(tenant_id)
  
    """
    Revert a specific GRN and reverse its effects on the associated PO and stock.
    This is the individual route for GRN revert (GRN -> PO flow).
    Clears invoiceNo, invoiceDate on PO and expiryDate on items during reversal.
    Marks GRN as 'Po Reverted' with canBeReUpdated=True
    """
    try:
        # Validate grnId
        if not grnId or not ObjectId.is_valid(grnId):
            logging.error(f"Invalid or missing grnId: {grnId}")
            raise HTTPException(status_code=400, detail="Invalid or missing grnId")

        # Retrieve the GRN
        grn_to_revert = grn_collection.find_one({"_id": ObjectId(grnId)})
        if not grn_to_revert:
            logging.error(f"GRN not found for ID: {grnId}")
            raise HTTPException(status_code=404, detail="GRN not found")

        # Validate PO association and fetch PO
        purchase_order_id = grn_to_revert.get('purchaseOrderId')
        if not purchase_order_id or not ObjectId.is_valid(purchase_order_id):
            raise HTTPException(status_code=400, detail="Invalid PO ID in GRN")
       
        existing_purchaseorder = po_collection.find_one({"_id": ObjectId(purchase_order_id)})
        if not existing_purchaseorder:
            logging.error(f"Purchase order not found for ID: {purchase_order_id}")
            raise HTTPException(status_code=404, detail="Associated PO not found")

        if grn_to_revert.get('status') == 'Po Reverted':
            raise HTTPException(status_code=400, detail="GRN is already reverted")

        logging.info(f"Initiating revert for GRN {grnId} associated with PO {purchase_order_id}")

        # Step 1: Reverse receipts in PO items (clears expiryDate on items)
        updated_items = reverse_grn_receipts(grn_to_revert.get('itemDetails', []), existing_purchaseorder.get('items', []))

        # Step 2: Reverse stock quantities
        update_stock_quantities_revert(grn_to_revert.get('itemDetails', []),tenant_id, reverse=True)

        # Step 3: Recalculate PO totals and update item fields
        po_discount = existing_purchaseorder.get('discountPrice', 0)
        totals = recalculate_po_totals(updated_items, po_discount)

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

        logging.info(f"After reversal: PO status={po_status}, All received={all_items_received}, Any received={any_items_received}")

        # Step 5: Mark GRN as reverted with update flag
        current_datetime = datetime.now(pytz.timezone('Asia/Kolkata'))
        grn_collection.update_one(
            {"_id": ObjectId(grnId)},
            {
                "$set": {
                    "status": "Po Reverted",
                    "revertedDate": current_datetime,
                    "lastUpdatedDate": current_datetime,
                    "isReverted": True,
                    "canBeReUpdated": True,  # Flag to allow updating this GRN with NEW data
                    "originalReceiptData": grn_to_revert.get('itemDetails', []),  # Save original for reference
                    "originalTotal": grn_to_revert.get('totalReceivedAmount', 0)
                }
            }
        )

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
            # Clear PO-level invoice fields
            "invoiceNo": None,
            "invoiceDate": None,
            "pendingGrnId": grnId,  # Store which GRN can be updated next
            "lastRevertedGrnId": grnId
        }
        result = po_collection.update_one(
            {"_id": ObjectId(purchase_order_id)},
            {"$set": update_data}
        )
        if result.modified_count == 0:
            logging.error(f"Failed to update PO {purchase_order_id} after GRN revert")
            raise HTTPException(status_code=500, detail="Failed to update associated PO")

        # Log success
        logging.info(f"GRN {grnId} successfully reverted. PO {purchase_order_id} updated to status {po_status}")
        logging.info(f"GRN {grnId} marked as canBeReUpdated=True for future updates")

        # Step 7: Return response
        return {
            "message": "GRN reverted and associated PO updated successfully",
            "grnId": grnId,
            "purchaseOrderId": str(purchase_order_id),  # Ensure string
            "poStatus": po_status,
            "itemStatus": item_status,
            "totalOrderAmount": totals['totalOrderAmount'],
            "pendingOrderAmount": totals['pendingOrderAmount'],
            "reversedItemsCount": len(grn_to_revert.get('itemDetails', [])),
            "canBeReUpdated": True,
            "pendingGrnId": grnId
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Unexpected error in revert_grn for GRN {grnId}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")