from datetime import datetime
import logging
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter, Query,Request
from decimal import Decimal, ROUND_HALF_UP
from purchaseOrder.models import OverallDiscountRequest  # Adjust import as needed

    
class Item(BaseModel):
    itemId: str  # Item ID that needs to be updated
    receivedQuantity: Optional[float] = None  # Received quantity to be updated
    damagedQuantity: Optional[float] = None  # Damaged quantity to be updated
    receivedQuantity:Optional[float] = None  # Damaged quantity to be updated
    befTaxDiscount: Optional[float] = None
    afTaxDiscount: Optional[float] = None
    expiryDate: Optional[datetime] = None
    grnPrice: Optional[float] = None
    model_config = ConfigDict(extra='allow')  # Pydantic v2; or class Config: extra = 'allow' for v1
    
class OverallDiscountRequest(BaseModel):
    """
    Request model for calculating overall discount on GRN items.
    
    - items: List of items with received quantities and prices for GRN context.
    - applyOverallDiscount: Flag to apply the overall discount.
    - overallDiscountAmount: The fixed amount to distribute proportionally across items.
    - discount_type: 'before' to apply before tax (adjusts base for tax calc), 'after' to apply after tax.
    
    Response:
    - success: bool
    - items: List of updated item calcs with new discount percentages applied.
    - summary: Totals including final amount after discount.
    """
    items: List[Item]
    applyOverallDiscount: bool = False
    overallDiscountAmount: Optional[float] = None
    discount_type: Optional[str] = "after"
    model_config = ConfigDict(extra='allow')  # Same as above

router = APIRouter()
@router.post("/items/grn/calculate-overall-discount")
async def calculate_overall_discount_for_items(httprequest: Request,request: OverallDiscountRequest) -> Dict:
    tenant_id = httprequest.state.tenant_id

    try:
        items_result = []
        total_subtotal_all_items = 0  # Sum of subtotals after individual discounts (for summary)
        
        # Step 1: Calculate per-item bases (use .dict() for extra fields safety)
        items_subtotals = []
        price_after_bef_list = []
        price_after_tax_list = []
        existing_af_list = []
        
        for item in request.items:
            item_dict = item.dict()  # Safe access to all fields (known + extra)
            qty = item_dict.get('receivedQuantity') or item_dict.get('pendingTotalQuantity', 0) or 0
            price = item_dict.get('grnPrice') or item_dict.get('newPrice', 0) or 0
            total_price_before_discount = qty * price
            
            # Existing before-tax discount (percentage)
            bef_tax_discount = item_dict.get('befTaxDiscount', 0)
            bef_tax_discount_amount = total_price_before_discount * (bef_tax_discount / 100) if bef_tax_discount > 0 else 0
            
            price_after_bef_discount = total_price_before_discount - bef_tax_discount_amount
            price_after_bef_list.append(price_after_bef_discount)
            
            # Tax calculation
            tax_percentage = item_dict.get('taxPercentage', 0)
            tax_type = item_dict.get('taxType', 'igst')
            sgst_amount = cgst_amount = igst_amount = 0
            if tax_type == "cgst_sgst" and tax_percentage > 0:
                half_rate = tax_percentage / 2 / 100
                sgst_amount = price_after_bef_discount * half_rate
                cgst_amount = price_after_bef_discount * half_rate
                total_tax_amount = sgst_amount + cgst_amount
            elif tax_percentage > 0:
                igst_amount = price_after_bef_discount * (tax_percentage / 100)
                total_tax_amount = igst_amount
            else:
                total_tax_amount = 0
            
            price_after_tax = price_after_bef_discount + total_tax_amount
            price_after_tax_list.append(price_after_tax)
            
            # Existing after-tax discount (percentage)
            af_tax_discount = item_dict.get('afTaxDiscount', 0)
            existing_af_tax_discount_amount = price_after_tax * (af_tax_discount / 100) if af_tax_discount > 0 else 0
            existing_af_list.append(existing_af_tax_discount_amount)
            
            item_subtotal = price_after_tax - existing_af_tax_discount_amount
            items_subtotals.append({
                'item': item_dict,
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
            total_subtotal_all_items += item_subtotal  # For summary (after individual discounts)
        
        # Step 2: Determine base, cap, and uniform additional %
        discount_type = request.discount_type or "after"
        if discount_type == "before":
            bases = price_after_bef_list
            sum_bases = sum(bases)
            max_additional_per = 100.0  # Always cap at 100% of base (after ind. bef)
        else:  # after
            bases = price_after_tax_list
            sum_bases = sum(bases)
            max_additional_per = 100.0
            for i, item_dict in enumerate([d['item'] for d in items_subtotals]):
                existing_per = item_dict.get('afTaxDiscount', 0)
                max_additional_per = min(max_additional_per, 100 - existing_per)
        
        max_overall = (max_additional_per / 100.0) * sum_bases if sum_bases > 0 else 0
        overall_discount_total_amount = min(request.overallDiscountAmount or 0, max_overall)
        overall_discount_total_amount = round(overall_discount_total_amount, 2)
        
        additional_per = (overall_discount_total_amount / sum_bases * 100) if sum_bases > 0 else 0
        
        # Step 3: Distribute uniformly (per item base share), round, adjust last
        prelim_item_overall_discounts = []
        for i, item_data in enumerate(items_subtotals):
            proportion = bases[i] / sum_bases if sum_bases > 0 else 0
            item_overall = overall_discount_total_amount * proportion
            prelim_item_overall_discounts.append(item_overall)
        
        rounded_item_overall_discounts = [round(d, 2) for d in prelim_item_overall_discounts]
        sum_rounded = sum(rounded_item_overall_discounts)
        adjustment = overall_discount_total_amount - sum_rounded
        if items_subtotals:
            last_idx = len(rounded_item_overall_discounts) - 1
            rounded_item_overall_discounts[last_idx] += adjustment
            rounded_item_overall_discounts[last_idx] = round(rounded_item_overall_discounts[last_idx], 2)
        
        # Step 4: Apply to each item (recalc tax for "before")
        for i, item_data in enumerate(items_subtotals):
            item_overall_discount_amount = rounded_item_overall_discounts[i]
            item_dict = item_data['item']
            
            total_price_before_discount = item_data['total_price_before_discount']
            existing_bef_tax_discount_amount = item_data['bef_tax_discount_amount']
            price_after_bef_discount = item_data['price_after_bef_discount']
            total_tax_amount = item_data['total_tax_amount']
            price_after_tax = item_data['price_after_tax']
            existing_af_tax_discount_amount = item_data['existing_af_tax_discount_amount']
            
            sgst_amount = item_data['sgst_amount']
            cgst_amount = item_data['cgst_amount']
            igst_amount = item_data['igst_amount']
            tax_percentage = item_dict.get('taxPercentage', 0)
            tax_type = item_dict.get('taxType', 'igst')
            
            if discount_type == "before":
                total_bef_tax_discount_amount = existing_bef_tax_discount_amount + item_overall_discount_amount
                price_after_bef_discount = total_price_before_discount - total_bef_tax_discount_amount
                # Recalc tax
                if tax_type == "cgst_sgst" and tax_percentage > 0:
                    half_rate = tax_percentage / 2 / 100
                    sgst_amount = price_after_bef_discount * half_rate
                    cgst_amount = price_after_bef_discount * half_rate
                    total_tax_amount = sgst_amount + cgst_amount
                elif tax_percentage > 0:
                    igst_amount = price_after_bef_discount * (tax_percentage / 100)
                    total_tax_amount = igst_amount
                else:
                    total_tax_amount = 0
                price_after_tax = price_after_bef_discount + total_tax_amount
                total_af_tax_discount_amount = existing_af_tax_discount_amount
            else:  # after
                total_bef_tax_discount_amount = existing_bef_tax_discount_amount
                total_af_tax_discount_amount = existing_af_tax_discount_amount + item_overall_discount_amount
            
            final_price = price_after_tax - total_af_tax_discount_amount
            total_discount_amount = total_bef_tax_discount_amount + total_af_tax_discount_amount
            
            # Updated percentages (total, including individual + overall)
            bef_tax_discount_percentage = (total_bef_tax_discount_amount / total_price_before_discount * 100) if total_price_before_discount > 0 else 0
            af_tax_discount_percentage = (total_af_tax_discount_amount / price_after_tax * 100) if price_after_tax > 0 else 0
            
            item_result = {
                "itemId": item_dict['itemId'],
                "pendingTotalPrice": round(total_price_before_discount, 2),
                "pendingBefTaxDiscountAmount": round(total_bef_tax_discount_amount, 2),
                "pendingAfTaxDiscountAmount": round(total_af_tax_discount_amount, 2),
                "afTaxDiscountAmount": round(total_af_tax_discount_amount, 2),
                "pendingDiscountAmount": round(total_discount_amount, 2),
                "pendingTaxAmount": round(total_tax_amount, 2),
                "pendingSgst": round(sgst_amount, 2),
                "pendingCgst": round(cgst_amount, 2),
                "pendingIgst": round(igst_amount, 2),
                "pendingFinalPrice": round(final_price, 2),
                "pendingOrderAmount": round(final_price, 2),
                "befTaxDiscount": round(bef_tax_discount_percentage, 2),
                "afTaxDiscount": round(af_tax_discount_percentage, 2),
                "itemOverallDiscountAmount": round(item_overall_discount_amount, 2),
                "proportion": round(proportion * 100, 4),
                "subtotalBeforeOverallDiscount": round(item_data['subtotal'], 2),
                "poQuantity": round(item_dict.get('poQuantity', qty), 2),
                "quantity": round(qty, 2),
                "receivedQuantity": round(qty, 2),
                "discount_type_applied": discount_type
            }
            items_result.append(item_result)
        
        total_final_amount = sum(item["pendingFinalPrice"] for item in items_result)
        total_tax_amount_summary = sum(item["pendingTaxAmount"] for item in items_result)
        total_discount_amount_summary = sum(item["pendingDiscountAmount"] for item in items_result)
        
        return {
            "success": True,
            "items": items_result,
            "summary": {
                "totalSubtotal": round(total_subtotal_all_items, 2),
                "overallDiscountTotalAmount": overall_discount_total_amount,
                "overallDiscountType": discount_type,
                "totalFinalAmount": round(total_final_amount, 2),
                "totalTaxAmount": round(total_tax_amount_summary, 2),
                "totalDiscountAmount": round(total_discount_amount_summary, 2),
                "totalItems": len(items_result)
            }
        }
    
    except Exception as e:
        logging.error(f"Error in calculate_overall_discount_for_items: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "items": [],
            "summary": {}
        }