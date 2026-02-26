from datetime import datetime
import logging
from typing import Dict, List
from bson import ObjectId
from fastapi import APIRouter, HTTPException,Request
import pytz
from utils.database import get_grn_collection
from utils.database import get_inventory_collection, get_purchaseorder_collection
from utils.database import get_purchaseitem_collection

router = APIRouter()

def update_stock_quantities(tenant_id: str,grn_item_details: List[Dict], reverse: bool = False):
    """
    Update stock quantities for received items. If reverse=True, subtract quantities (for revert).
    """
    try:
        purchase_item_collection = get_purchaseitem_collection(tenant_id)
        for item in grn_item_details:
            item_id = item['item_rand']
            quantity_delta = item['receivedQuantity']
            if reverse:
                quantity_delta = -quantity_delta
           
          
            purchase_item = purchase_item_collection.find_one({"randomId": item_id})

            if purchase_item:
                # Update stock quantity
                current_stock = purchase_item.get('stockQuantity', 0)
                new_stock = current_stock + quantity_delta
               
                purchase_item_collection.update_one(
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
async def revert_grn( request: Request,grnId: str) -> Dict:
    tenant_id = request.state.tenant_id
    grn_collection = get_grn_collection(tenant_id)
    po_collection = get_purchaseorder_collection(tenant_id)

    """
    Revert a specific GRN and reverse its effects on the associated PO and stock.
    This is the individual route for GRN revert (GRN -> PO flow).
    Clears invoiceNo, invoiceDate on PO and expiryDate on items during reversal.
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
        update_stock_quantities(tenant_id,grn_to_revert.get('itemDetails', []), reverse=True)

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