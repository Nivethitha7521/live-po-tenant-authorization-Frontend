from typing import Dict
from pydantic import BaseModel
from fastapi import APIRouter, Query,Depends,Request
from decimal import Decimal, ROUND_HALF_UP  # Import Decimal for precision in adjustment
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission  

from purchaseOrder.models import OverallDiscountRequest

router = APIRouter()

@router.post("/items/calculate-overall-discount")
async def calculate_overall_discount_for_items( httprequest: Request,request: OverallDiscountRequest,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "edit"))) -> Dict:
    tenant_id = httprequest.state.tenant_id
    try:
        items_result = []
        total_subtotal_all_items = 0
        
        # Step 1: Calculate subtotal for each item (after tax, before overall discount)
        items_subtotals = []
        
        for item in request.items:
            # Calculate total price before any discount
            total_price_before_discount = item.pendingTotalQuantity * item.newPrice
            
            # Calculate before-tax discount
            bef_tax_discount_amount = 0
            if item.befTaxDiscount and item.befTaxDiscount > 0:
                if item.befTaxDiscountType == "percentage":
                    bef_tax_discount_amount = total_price_before_discount * (item.befTaxDiscount / 100)
                elif item.befTaxDiscountType == "amount":
                    bef_tax_discount_amount = item.befTaxDiscountAmount or 0
            
            # Price after before-tax discount
            price_after_bef_discount = total_price_before_discount - bef_tax_discount_amount
            
            # Calculate tax
            sgst_amount = cgst_amount = igst_amount = 0
            if item.taxType == "cgst_sgst":
                sgst_amount = price_after_bef_discount * (item.taxPercentage / 2 / 100)
                cgst_amount = price_after_bef_discount * (item.taxPercentage / 2 / 100)
                total_tax_amount = sgst_amount + cgst_amount
            else:
                igst_amount = price_after_bef_discount * (item.taxPercentage / 100)
                total_tax_amount = igst_amount
            
            # Calculate existing item-level after-tax discount
            existing_af_tax_discount_amount = 0
            price_after_tax = price_after_bef_discount + total_tax_amount
            if item.afTaxDiscount and item.afTaxDiscount > 0:
                if item.afTaxDiscountType == "percentage":
                    existing_af_tax_discount_amount = price_after_tax * (item.afTaxDiscount / 100)
                elif item.afTaxDiscountType == "amount":
                    existing_af_tax_discount_amount = item.afTaxDiscountAmount or 0
            
            # Subtotal for this item (after tax, after existing item discount)
            item_subtotal = price_after_tax - existing_af_tax_discount_amount
            
            items_subtotals.append({
                'item': item,
                'subtotal': item_subtotal,
                'total_price_before_discount': total_price_before_discount,
                'bef_tax_discount_amount': bef_tax_discount_amount,
                'price_after_bef_discount': price_after_bef_discount,
                'total_tax_amount': total_tax_amount,
                'sgst_amount': sgst_amount,
                'cgst_amount': cgst_amount,
                'igst_amount': igst_amount,
                'existing_af_tax_discount_amount': existing_af_tax_discount_amount,
                'price_after_tax': price_after_tax
            })
            
            total_subtotal_all_items += item_subtotal
        
        # Step 2: Calculate overall discount amount
        overall_discount_total_amount = 0
        if request.applyOverallDiscount and total_subtotal_all_items > 0:
            if request.overallDiscountType == "percentage" and request.overallDiscount > 0:
                overall_discount_total_amount = total_subtotal_all_items * (request.overallDiscount / 100)
            elif request.overallDiscountType == "amount" and request.overallDiscountAmount > 0:
                overall_discount_total_amount = min(request.overallDiscountAmount, total_subtotal_all_items)
        
        overall_discount_total_amount = round(overall_discount_total_amount, 2)  # Ensure rounded to 2 decimals
        
        # Step 3: Distribute overall discount proportionally with rounding adjustment for exact sum
        prelim_item_overall_discounts = []
        for item_data in items_subtotals:
            proportion = item_data['subtotal'] / total_subtotal_all_items if total_subtotal_all_items > 0 else 0
            item_overall = overall_discount_total_amount * proportion
            prelim_item_overall_discounts.append(item_overall)
        
        # Round each to 2 decimals
        rounded_item_overall_discounts = [round(d, 2) for d in prelim_item_overall_discounts]
        
        # Calculate the adjustment to make sum exact
        sum_rounded = sum(rounded_item_overall_discounts)
        adjustment = overall_discount_total_amount - sum_rounded
        
        if items_subtotals:
            # Add adjustment to the last item
            last_idx = len(rounded_item_overall_discounts) - 1
            rounded_item_overall_discounts[last_idx] += adjustment
            # Re-round the last item to ensure it's still at 2 decimals
            rounded_item_overall_discounts[last_idx] = round(rounded_item_overall_discounts[last_idx], 2)
        
        # Step 4: Apply distributed discounts to each item
        for i, item_data in enumerate(items_subtotals):
            item_overall_discount_amount = rounded_item_overall_discounts[i]
            
            # Add overall discount to existing after-tax discount
            total_af_tax_discount_amount = item_data['existing_af_tax_discount_amount'] + item_overall_discount_amount
            
            # Calculate new after-tax discount percentage
            price_after_tax = item_data['price_after_tax']
            af_tax_discount_percentage = (total_af_tax_discount_amount / price_after_tax * 100) if price_after_tax > 0 else 0
            
            # Calculate final price
            final_price = price_after_tax - total_af_tax_discount_amount
            total_discount_amount = item_data['bef_tax_discount_amount'] + total_af_tax_discount_amount
            
            # Calculate discount percentages
            bef_tax_discount_percentage = 0
            if item_data['total_price_before_discount'] > 0:
                bef_tax_discount_percentage = (item_data['bef_tax_discount_amount'] / item_data['total_price_before_discount'] * 100)
            
            # Prepare result for this item
            item_result = {
                "id": item_data['item'].id,
                "pendingTotalPrice": round(item_data['total_price_before_discount'], 2),
                "pendingBefTaxDiscountAmount": round(item_data['bef_tax_discount_amount'], 2),
                "pendingAfTaxDiscountAmount": round(total_af_tax_discount_amount, 2),
                "afTaxDiscountAmount": round(total_af_tax_discount_amount, 2),  # Add this field
                "pendingDiscountAmount": round(total_discount_amount, 2),
                "pendingTaxAmount": round(item_data['total_tax_amount'], 2),
                "pendingSgst": round(item_data['sgst_amount'], 2),
                "pendingCgst": round(item_data['cgst_amount'], 2),
                "pendingIgst": round(item_data['igst_amount'], 2),
                "pendingFinalPrice": round(final_price, 2),
                "pendingOrderAmount": round(final_price, 2),
                "befTaxDiscount": round(bef_tax_discount_percentage, 2),
                "afTaxDiscount": round(af_tax_discount_percentage, 2),
                "itemOverallDiscountAmount": round(item_overall_discount_amount, 2),
                "proportion": round((item_data['subtotal'] / total_subtotal_all_items * 100) if total_subtotal_all_items > 0 else 0, 4),
                "subtotalBeforeOverallDiscount": round(item_data['subtotal'], 2),
                "poQuantity": round(item_data['item'].poQuantity or item_data['item'].pendingTotalQuantity, 2),
                "quantity": round(item_data['item'].poQuantity or item_data['item'].pendingTotalQuantity, 2),
            }
            
            items_result.append(item_result)
        
        # Calculate summary totals
        total_final_amount = sum(item["pendingFinalPrice"] for item in items_result)
        total_tax_amount = sum(item["pendingTaxAmount"] for item in items_result)
        total_discount_amount_summary = sum(item["pendingDiscountAmount"] for item in items_result)
        
        return {
            "success": True,
            "items": items_result,
            "summary": {
                "totalSubtotal": round(total_subtotal_all_items, 2),
                "overallDiscountTotalAmount": overall_discount_total_amount,
                "overallDiscountPercentage": round((overall_discount_total_amount / total_subtotal_all_items * 100) if total_subtotal_all_items > 0 else 0, 2),
                "totalFinalAmount": round(total_final_amount, 2),
                "totalTaxAmount": round(total_tax_amount, 2),
                "totalDiscountAmount": round(total_discount_amount_summary, 2),
                "totalItems": len(items_result)
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "items": [],
            "summary": {}
        }