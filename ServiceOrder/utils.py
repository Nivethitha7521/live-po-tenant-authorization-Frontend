from decimal import ROUND_HALF_UP, Decimal
import logging
import os
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import date, datetime
import pytz
from utils.database import get_serviceworkorder_collection

logger = logging.getLogger(__name__)



def get_serviceworkorder_collection_by_tenant(tenant_id):
    return get_serviceworkorder_collection(tenant_id)

def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    """Get current date and time in specified timezone."""
    try:
        tz = pytz.timezone(timezone)
        localized_now = datetime.now(tz)
        utc_now = localized_now.astimezone(pytz.UTC)
        return {
            "datetime": utc_now,
            "date": localized_now.strftime("%Y-%m-%d"),
            "time": localized_now.strftime("%H:%M:%S"),
            "datetime_ist": localized_now,
            "date_ist": localized_now.strftime("%Y-%m-%d"),
            "time_ist": localized_now.strftime("%H:%M:%S")
        }
    except pytz.UnknownTimeZoneError:
        raise ValueError(f"Invalid timezone: {timezone}")

def parse_date_only(date_input: Optional[Any]) -> Optional[date]:
    if date_input is None:
        return None
    try:
        if isinstance(date_input, str):
            y, m, d = map(int, date_input.split('-'))
            return date(y, m, d)
        elif hasattr(date_input, 'year'):
            return date(date_input.year, date_input.month, date_input.day)
        else:
            raise ValueError
    except:
        raise ValueError(f"Invalid date format: {date_input}")

def validate_service(service_id: str, service_collection):
    """Validate service ID and fetch service"""
    if not ObjectId.is_valid(service_id):
        logger.error(f"Invalid Service ID: {service_id}")
        raise HTTPException(status_code=400, detail="Invalid Service ID")
    service = service_collection.find_one({"_id": ObjectId(service_id)})
    if not service:
        logger.error(f"Service not found for ID: {service_id}")
        raise HTTPException(status_code=404, detail="Service not found")
    return service

def to_decimal(value):
    """Safely convert any value to Decimal."""
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except:
        return Decimal('0')

def custom_round(value: float) -> float:
    """Round to 2 decimal places using banker's rounding."""
    if value is None:
        return 0.0
    try:
        dec_value = Decimal(str(value))
        rounded = dec_value.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        return float(rounded)
    except:
        return round(value, 2)

def get_current_date_only():
    now = datetime.now(pytz.UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)

def calculate_single_description_totals(
    description: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    tax_type: str = "cgst_sgst",
    fee: float = 0.0,  # PER UNIT WITH TAX
    tax_per: float = 0.0,
    discount: float = 0.0,  # LINE DISCOUNT AMOUNT
    quantity: float = 1.0
) -> dict:
    """
    Calculate totals for a single service description.
    
    CRITICAL FIX: 
    - fee is PER UNIT WITH TAX
    - quantity is separate
    - DO NOT apply discount here (discount is for backend calculation only)
    """
    from decimal import Decimal, ROUND_HALF_UP
    
    fee_dec = Decimal(str(fee))
    qty_dec = Decimal(str(quantity))
    tax_per_dec = Decimal(str(tax_per))
    discount_dec = Decimal(str(discount))
    
    # Line total with tax
    line_total_with_tax = fee_dec * qty_dec
    
    # Calculate base amount WITHOUT tax
    if tax_per_dec > 0:
        tax_rate = Decimal('1') + (tax_per_dec / Decimal('100'))
        base_amount_without_tax = (line_total_with_tax / tax_rate).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        tax_amount = line_total_with_tax - base_amount_without_tax
    else:
        base_amount_without_tax = line_total_with_tax
        tax_amount = Decimal('0')
    
    # Calculate per unit WITHOUT tax
    if tax_per_dec > 0:
        base_per_unit = (fee_dec / (Decimal('1') + (tax_per_dec / Decimal('100')))).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    else:
        base_per_unit = fee_dec
    
    # Split tax
    sgst = cgst = igst = Decimal('0')
    if tax_type == "cgst_sgst":
        sgst = (tax_amount / Decimal('2')).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        cgst = (tax_amount / Decimal('2')).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    else:  # igst
        igst = tax_amount.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    
    return {
        "description": description,
        "quantity": quantity,
        "baseAmount": float(base_amount_without_tax.quantize(Decimal('0.00'))),  # Total base WITHOUT tax
        "base_per_unit": float(base_per_unit),  # PER UNIT WITHOUT TAX
        "fee": fee,  # PER UNIT WITH TAX
        "totalFee": float(base_amount_without_tax.quantize(Decimal('0.00'))),  # Total base WITHOUT tax
        "sgst": float(sgst),
        "cgst": float(cgst),
        "igst": float(igst),
        "totalTax": float(tax_amount.quantize(Decimal('0.00'))),  # Total tax
        "total": float(line_total_with_tax.quantize(Decimal('0.00'))),  # Total WITH tax
        "from_date": from_date.isoformat() if from_date else None,
        "to_date": to_date.isoformat() if to_date else None,
        "remarks": "",
    }
def calculate_service_totals_with_proportional_discount(service: dict) -> dict:
    """
    COMPLETELY FIXED: BEFORE TAX and AFTER TAX modes working correctly for BOTH overall and individual discounts
    """
    
    from decimal import Decimal, ROUND_HALF_UP
    
    def safe_to_decimal(value):
        if value is None:
            return Decimal('0')
        if isinstance(value, Decimal):
            return value
        try:
            return Decimal(str(value))
        except:
            return Decimal('0')
    
    # ===== GET INPUT ARRAYS =====
    fees = service.get("fees", [])
    quantities = service.get("quantity", [])
    tax_types = service.get("desc_tax_types", [])
    tax_pers = service.get("desc_tax_pers", [])
    
    # Get individual discounts
    individual_discounts = service.get("desc_individual_discount_amounts", [])
    if not individual_discounts:
        individual_discounts = service.get("desc_discount_amounts", [])
    
    # Get overall discount
    overall_value = service.get("overallDiscountValue", 0)
    overall_discount_applied_on = service.get("overallDiscountAppliedOn", "after_tax")
    discount_type = service.get("overallDiscountType", "percentage")
    
    print(f"🎯 DISCOUNT MODE: {overall_discount_applied_on}")
    
    # ===== DECIDE DISCOUNT TYPE =====
    use_overall_discount = False
    use_individual_discounts = False
    
    if overall_value and float(overall_value) > 0:
        print(f"✅ USING OVERALL DISCOUNT: {overall_value} ({overall_discount_applied_on})")
        use_overall_discount = True
        use_individual_discounts = False
        individual_discounts = [0] * max(len(fees), 1)
    else:
        ind_discounts_float = [float(d) for d in individual_discounts if d is not None]
        has_individual = any(d > 0 for d in ind_discounts_float)
        
        if has_individual:
            print(f"✅ USING INDIVIDUAL DISCOUNTS: {individual_discounts} ({overall_discount_applied_on})")
            use_overall_discount = False
            use_individual_discounts = True
            overall_value = 0
        else:
            print("✅ NO DISCOUNTS")
            use_overall_discount = False
            use_individual_discounts = False
            individual_discounts = [0] * max(len(fees), 1)
            overall_value = 0
    
    # ===== ENSURE ARRAY LENGTHS =====
    max_len = max(
        len(fees), len(quantities), len(tax_types), 
        len(tax_pers), len(individual_discounts)
    )
    
    while len(fees) < max_len: fees.append(0)
    while len(quantities) < max_len: quantities.append(1)
    while len(tax_types) < max_len: tax_types.append("cgst_sgst")
    while len(tax_pers) < max_len: tax_pers.append(0)
    while len(individual_discounts) < max_len: individual_discounts.append(0)
    
    # ===== STEP 1: Calculate original amounts =====
    original_base_amounts = []
    original_tax_amounts = []
    original_totals_with_tax = []
    original_base_per_units = []
    
    for i in range(max_len):
        fee_per_unit = safe_to_decimal(fees[i])
        quantity = safe_to_decimal(quantities[i])
        tax_per = safe_to_decimal(tax_pers[i])
        
        line_total_with_tax = fee_per_unit * quantity
        
        if tax_per > 0:
            tax_rate = Decimal('1') + (tax_per / Decimal('100'))
            base_line_without_tax = (line_total_with_tax / tax_rate).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
            tax_amount = line_total_with_tax - base_line_without_tax
        else:
            base_line_without_tax = line_total_with_tax
            tax_amount = Decimal('0')
        
        if quantity > 0:
            base_per_unit = (base_line_without_tax / quantity).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        else:
            base_per_unit = Decimal('0')
        
        original_base_amounts.append(base_line_without_tax)
        original_tax_amounts.append(tax_amount)
        original_totals_with_tax.append(line_total_with_tax)
        original_base_per_units.append(float(base_per_unit))
    
    # ===== STEP 2: Apply discounts =====
    if use_individual_discounts:
        # ===== INDIVIDUAL DISCOUNTS - NOW RESPECTS DISCOUNT MODE =====
        print(f"🔵 Calculating with INDIVIDUAL discounts in {overall_discount_applied_on} mode")
        
        after_discount_base = []
        after_discount_tax = []
        after_discount_total = []
        desc_individual_discounts_output = []
        
        for i in range(max_len):
            ind_discount = safe_to_decimal(individual_discounts[i])
            
            if ind_discount > 0:
                if overall_discount_applied_on == "before_tax":
                    # ===== BEFORE TAX MODE for INDIVIDUAL DISCOUNTS =====
                    # Apply discount to BASE
                    new_base = original_base_amounts[i] - ind_discount
                    if new_base < 0: new_base = Decimal('0')
                    
                    # Calculate tax on NEW BASE
                    tax_per = safe_to_decimal(tax_pers[i])
                    if new_base > 0 and tax_per > 0:
                        new_tax = (new_base * tax_per / Decimal('100')).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                    else:
                        new_tax = Decimal('0')
                    
                    new_total = new_base + new_tax
                    
                else:
                    # ===== AFTER TAX MODE for INDIVIDUAL DISCOUNTS =====
                    # Apply discount to TOTAL
                    new_total = original_totals_with_tax[i] - ind_discount
                    if new_total < 0: new_total = Decimal('0')
                    
                    # Calculate tax on NEW TOTAL
                    tax_per = safe_to_decimal(tax_pers[i])
                    if new_total > 0 and tax_per > 0:
                        tax_rate = tax_per / (Decimal('100') + tax_per)
                        new_tax = (new_total * tax_rate).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                        new_base = new_total - new_tax
                        if new_base < 0:
                            new_base = Decimal('0')
                            new_tax = new_total
                    else:
                        new_tax = Decimal('0')
                        new_base = new_total
                
                desc_individual_discounts_output.append(float(ind_discount))
            else:
                new_base = original_base_amounts[i]
                new_tax = original_tax_amounts[i]
                new_total = original_totals_with_tax[i]
                desc_individual_discounts_output.append(0)
            
            after_discount_base.append(new_base)
            after_discount_tax.append(new_tax)
            after_discount_total.append(new_total)
            
            # Debug
            print(f"    Item {i+1}: Mode={overall_discount_applied_on}")
            print(f"      Original: Base={float(original_base_amounts[i])}, Tax={float(original_tax_amounts[i])}, Total={float(original_totals_with_tax[i])}")
            print(f"      New: Base={float(new_base)}, Tax={float(new_tax)}, Total={float(new_total)}")
        
        desc_final_base = [float(b.quantize(Decimal('0.00'))) for b in after_discount_base]
        desc_final_tax = [float(t.quantize(Decimal('0.00'))) for t in after_discount_tax]
        desc_final_total = [float(tot.quantize(Decimal('0.00'))) for tot in after_discount_total]
        desc_combined_discounts = desc_individual_discounts_output
        desc_overall_discounts_output = [0] * max_len
        total_overall_discount = Decimal('0')
        
    elif use_overall_discount:
        # ===== OVERALL DISCOUNT =====
        print(f"🔵 Calculating with OVERALL discount: {overall_discount_applied_on}")
        
        overall_discount_value = safe_to_decimal(overall_value)
        
        # Calculate totals before discount
        total_before_discount = sum(original_totals_with_tax)
        total_base_before_discount = sum(original_base_amounts)
        
        # Calculate total discount amount
        if discount_type == "percentage":
            if overall_discount_applied_on == "before_tax":
                discount_base = total_base_before_discount
            else:
                discount_base = total_before_discount
            
            if discount_base > 0:
                total_overall_discount = (discount_base * overall_discount_value / Decimal('100')).quantize(
                    Decimal('0.00'), rounding=ROUND_HALF_UP
                )
            else:
                total_overall_discount = Decimal('0')
        else:
            total_overall_discount = overall_discount_value.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        
        print(f"  Total discount amount: {float(total_overall_discount)}")
        
        # ===== DISTRIBUTE DISCOUNT =====
        discount_distribution = []
        
        if total_overall_discount > 0:
            if overall_discount_applied_on == "before_tax":
                # BEFORE TAX: Distribute based on BASE amounts
                distribution_base = total_base_before_discount
                if distribution_base > 0:
                    for i in range(max_len):
                        proportion = original_base_amounts[i] / distribution_base
                        line_discount = (total_overall_discount * proportion).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                        discount_distribution.append(line_discount)
                else:
                    discount_distribution = [Decimal('0')] * max_len
            else:
                # AFTER TAX: Distribute based on TOTAL amounts
                if total_before_discount > 0:
                    for i in range(max_len):
                        proportion = original_totals_with_tax[i] / total_before_discount
                        line_discount = (total_overall_discount * proportion).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                        discount_distribution.append(line_discount)
                else:
                    discount_distribution = [Decimal('0')] * max_len
            
            # Adjust for rounding
            if discount_distribution:
                sum_distributed = sum(discount_distribution)
                if sum_distributed != total_overall_discount and max_len > 0:
                    diff = total_overall_discount - sum_distributed
                    if overall_discount_applied_on == "before_tax":
                        max_index = max(range(max_len), key=lambda i: float(original_base_amounts[i]))
                    else:
                        max_index = max(range(max_len), key=lambda i: float(original_totals_with_tax[i]))
                    discount_distribution[max_index] += diff
        else:
            discount_distribution = [Decimal('0')] * max_len
        
        print(f"  Discount distribution: {[float(d) for d in discount_distribution]}")
        
        # ===== APPLY DISCOUNT =====
        after_discount_base = []
        after_discount_tax = []
        after_discount_total = []
        desc_overall_discounts_output = []
        
        for i in range(max_len):
            line_discount = discount_distribution[i]
            desc_overall_discounts_output.append(float(line_discount))
            
            if overall_discount_applied_on == "before_tax":
                # ===== BEFORE TAX MODE =====
                new_base = original_base_amounts[i] - line_discount
                if new_base < 0: new_base = Decimal('0')
                
                tax_per = safe_to_decimal(tax_pers[i])
                if new_base > 0 and tax_per > 0:
                    new_tax = (new_base * tax_per / Decimal('100')).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                else:
                    new_tax = Decimal('0')
                
                new_total = new_base + new_tax
                
            else:
                # ===== AFTER TAX MODE =====
                new_total = original_totals_with_tax[i] - line_discount
                if new_total < 0: new_total = Decimal('0')
                
                tax_per = safe_to_decimal(tax_pers[i])
                if new_total > 0 and tax_per > 0:
                    tax_rate = tax_per / (Decimal('100') + tax_per)
                    new_tax = (new_total * tax_rate).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                    new_base = new_total - new_tax
                    if new_base < 0:
                        new_base = Decimal('0')
                        new_tax = new_total
                else:
                    new_tax = Decimal('0')
                    new_base = new_total
            
            after_discount_base.append(new_base)
            after_discount_tax.append(new_tax)
            after_discount_total.append(new_total)
            
            print(f"    Item {i+1}: Mode={overall_discount_applied_on}")
            print(f"      Original: Base={float(original_base_amounts[i])}, Tax={float(original_tax_amounts[i])}, Total={float(original_totals_with_tax[i])}")
            print(f"      New: Base={float(new_base)}, Tax={float(new_tax)}, Total={float(new_total)}")
        
        desc_final_base = [float(b.quantize(Decimal('0.00'))) for b in after_discount_base]
        desc_final_tax = [float(t.quantize(Decimal('0.00'))) for t in after_discount_tax]
        desc_final_total = [float(tot.quantize(Decimal('0.00'))) for tot in after_discount_total]
        desc_combined_discounts = [float(d) for d in discount_distribution]
        desc_individual_discounts_output = [0] * max_len
        
    else:
        # ===== NO DISCOUNTS =====
        print("🔵 NO DISCOUNTS applied")
        
        after_discount_base = original_base_amounts
        after_discount_tax = original_tax_amounts
        after_discount_total = original_totals_with_tax
        
        desc_final_base = [float(b.quantize(Decimal('0.00'))) for b in original_base_amounts]
        desc_final_tax = [float(t.quantize(Decimal('0.00'))) for t in original_tax_amounts]
        desc_final_total = [float(tot.quantize(Decimal('0.00'))) for tot in original_totals_with_tax]
        
        desc_individual_discounts_output = [0] * max_len
        desc_overall_discounts_output = [0] * max_len
        desc_combined_discounts = [0] * max_len
        total_overall_discount = Decimal('0')
    
    # ===== STEP 3: Calculate SGST/CGST/IGST =====
    desc_sgst = []
    desc_cgst = []
    desc_igst = []
    
    for i in range(max_len):
        tax_type = tax_types[i]
        tax_amount = after_discount_tax[i]
        
        if tax_type == "cgst_sgst":
            sgst = (tax_amount / Decimal('2')).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
            cgst = (tax_amount / Decimal('2')).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
            desc_sgst.append(float(sgst))
            desc_cgst.append(float(cgst))
            desc_igst.append(0.0)
        else:
            desc_sgst.append(0.0)
            desc_cgst.append(0.0)
            desc_igst.append(float(tax_amount.quantize(Decimal('0.00'))))
    
    # ===== STEP 4: Calculate discount percentages =====
    desc_discount_percentages = []
    for i in range(max_len):
        if original_totals_with_tax[i] > 0:
            if use_individual_discounts:
                discount_amt = desc_individual_discounts_output[i]
            elif use_overall_discount:
                discount_amt = desc_overall_discounts_output[i]
            else:
                discount_amt = 0
            
            pct = (discount_amt / float(original_totals_with_tax[i])) * 100
            desc_discount_percentages.append(round(pct, 2))
        else:
            desc_discount_percentages.append(0)
    
    # ===== STEP 5: Calculate final totals =====
    total_original_with_tax = sum(original_totals_with_tax)
    total_final_amount_decimal = sum(Decimal(str(x)) for x in desc_final_total)
    total_final_tax_decimal = sum(Decimal(str(x)) for x in desc_final_tax)
    total_final_base_decimal = sum(Decimal(str(x)) for x in desc_final_base)
    
    if use_individual_discounts:
        total_discount_value = float(sum(desc_individual_discounts_output))
        total_discount_summary = float(sum(desc_individual_discounts_output))
    elif use_overall_discount:
        total_discount_value = float(total_overall_discount)
        total_discount_summary = float(total_overall_discount)
    else:
        total_discount_value = 0
        total_discount_summary = 0
    
    print(f"🔍 FINAL RESULTS:")
    print(f"  Mode: {overall_discount_applied_on}")
    print(f"  Type: {'Individual' if use_individual_discounts else 'Overall' if use_overall_discount else 'None'}")
    print(f"  Original Base: {[float(b) for b in original_base_amounts]}")
    print(f"  Final Base: {desc_final_base}")
    print(f"  Original Tax: {[float(t) for t in original_tax_amounts]}")
    print(f"  Final Tax: {desc_final_tax}")
    print(f"  Original Total: {float(total_original_with_tax)}")
    print(f"  Discount: {total_discount_value}")
    print(f"  Final Amount: {float(total_final_amount_decimal)}")
    
    # ===== ROUND OFF & FREIGHT =====
    round_off = safe_to_decimal(service.get("roundOffValue", 0))
    total_with_roundoff = total_final_amount_decimal + round_off
    
    freight_total = safe_to_decimal(service.get("totalFreightAmount", 0))
    freight_tax = safe_to_decimal(service.get("totalFreightTaxAmount", 0))
    total_freight_with_tax = freight_total + freight_tax
    total_final_with_freight = total_with_roundoff + total_freight_with_tax
    
    return {
        "total_service_fees": float(total_final_base_decimal.quantize(Decimal('0.00'))),  # Amount BEFORE tax after discount
        "total_service_tax": float(total_final_tax_decimal.quantize(Decimal('0.00'))),    # Tax amount after discount
        "total_service_discount": total_discount_value,                                    # Discount amount
        "total_service_amount": float(total_final_amount_decimal.quantize(Decimal('0.00'))), # Amount AFTER tax after discount
        
        "total_fees": float(total_final_base_decimal.quantize(Decimal('0.00'))),          # Amount BEFORE tax after discount
        "total_tax": float(total_final_tax_decimal.quantize(Decimal('0.00'))),            # Tax amount after discount
        "total_discount": total_discount_summary,                                          # Discount amount
        "total_amount": float(total_final_amount_decimal.quantize(Decimal('0.00'))),      # Amount AFTER tax after discount
        
        "original_total_fees": float(total_original_with_tax.quantize(Decimal('0.00'))),  # Original BEFORE tax
        "original_total_amount": float(total_original_with_tax.quantize(Decimal('0.00'))), # Original amount BEFORE discount
        
        "desc_tax_amounts": desc_final_tax,                                                # Tax per line after discount
        "desc_totals": desc_final_total,                                                   # Total WITH TAX per line after discount
        "desc_base_amounts": desc_final_base,                                              # Base WITHOUT TAX per line after discount
        "desc_base_per_units": original_base_per_units,                                    # Base per unit WITHOUT TAX
        "desc_original_base_amounts": [float(x) for x in original_base_amounts],          # Original base per line
        "desc_sgst": desc_sgst,
        "desc_cgst": desc_cgst,
        "desc_igst": desc_igst,
        
        "desc_individual_discount_amounts": desc_individual_discounts_output,
        "desc_overall_discounts": desc_overall_discounts_output,
        "desc_discount_amounts": desc_combined_discounts,
        "desc_discount_percentages": desc_discount_percentages,
        
        "desc_fees": [float(f) for f in fees],
        "desc_quantity": [float(q) for q in quantities],
        "remarks": service.get("remarks", [''] * max_len),
        "sacCode": service.get("sacCode", [''] * max_len),
        "descriptions": service.get("descriptions", [''] * max_len),
        "include_tax": service.get("include_tax", [True] * max_len),
        
        "total_with_roundoff": float(total_with_roundoff.quantize(Decimal('0.00'))),
        "total_final_amount": float(total_final_with_freight.quantize(Decimal('0.00'))),
        "total_freight_amount": float(freight_total.quantize(Decimal('0.00'))),
        "total_freight_tax": float(freight_tax.quantize(Decimal('0.00'))),
    }