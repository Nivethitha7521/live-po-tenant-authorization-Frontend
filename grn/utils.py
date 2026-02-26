from datetime import datetime
import logging
from typing import Dict
from fastapi import HTTPException
import requests  # Add this separate import
from pymongo import MongoClient
from bson import ObjectId
import pytz
from utils.database import get_debit_collection



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_item_financials(item: Dict, units: float) -> Dict:
    """
    Calculate financial details for an item based on unit price, discounts, tax type, and quantity.
    
    Args:
        item: Dictionary containing unitPrice, befTaxDiscount, afTaxDiscount, purchasetaxName, taxType, itemId
        units: Quantity received for the item (e.g., receivedQuantity)
    
    Returns:
        Dictionary with calculated financial fields
    """
    unit_price = item.get("unitPrice", 0) or 0
    if unit_price <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid unitPrice for item {item.get('itemId', 'unknown')}")
    if units <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid units {units} for item {item.get('itemId', 'unknown')}")

    # Calculate total price before discount
    base_amount = unit_price * units

    # Calculate before-tax discount amount
    bef_tax_discount = item.get("befTaxDiscount", 0) or 0
    bef_tax_discount_amount = base_amount * (bef_tax_discount / 100) if bef_tax_discount > 0 else 0.0
    taxable_amount = base_amount - bef_tax_discount_amount

    # Calculate tax amount 
    tax_rate = item.get("purchasetaxName", 0) or 0
    tax_amount = taxable_amount * (tax_rate / 100) if tax_rate > 0 else 0.0
    sgst = cgst = igst = 0.0
    tax_type = item.get("taxType", "cgst_sgst")
    if tax_type == "igst":
        igst = tax_amount
    else:  # cgst_sgst
        sgst = tax_amount / 2
        cgst = tax_amount / 2

    # Calculate total price after tax
    amount_before_af_tax_discount = taxable_amount + tax_amount

    # Calculate after-tax discount amount
    af_tax_discount = item.get("afTaxDiscount", 0) or 0
    af_tax_discount_amount = amount_before_af_tax_discount * (af_tax_discount / 100) if af_tax_discount > 0 else 0.0

    # Calculate final price
    final_price = amount_before_af_tax_discount - af_tax_discount_amount
    if final_price < 0:
        raise HTTPException(status_code=400, detail=f"Negative finalPrice calculated for item {item.get('itemId', 'unknown')}")

    return {
        "totalPrice": round(base_amount, 2),
        "befTaxDiscountAmount": round(bef_tax_discount_amount, 2),
        "afTaxDiscountAmount": round(af_tax_discount_amount, 2),
        "taxAmount": round(tax_amount, 2),
        "sgst": round(sgst, 2),
        "cgst": round(cgst, 2),
        "igst": round(igst, 2),
        "finalPrice": round(final_price, 2)
    }
def is_valid_object_id(id_str: str) -> bool:
    try:
        ObjectId(id_str)
        return True
    except (ValueError, TypeError) as e:
        return False
def calculate_item_financialsReturn(item: Dict, units: float) -> Dict:
    logger.debug(f"Calculating return financials for item: {item}, quantity: {units}")
    unit_price = item.get("unitPrice", 0) or 0
    if unit_price <= 0 or units <= 0:
        logger.warning(f"Invalid unitPrice {unit_price} or units {units} for item {item.get('itemId', 'unknown')}")
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
        logger.warning(f"Negative finalPrice calculated for item {item.get('itemId', 'unknown')}: {final_price}")
        final_price = 0.0

    result = {
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
    logger.debug(f"Return financials calculated: {result}")
    return result

def generate_note_random_id(tenant_id: str):
        collection = get_debit_collection(tenant_id)
        pipeline = [
            {"$match": {"randomId": {"$regex": "^NOTE\\d+$"}}},
            {"$project": {
                "_id": 0,
                "noteNumber": {
                    "$toInt": {"$substr": ["$randomId", 4, -1]}
                }
            }},
            {"$sort": {"noteNumber": -1}},
            {"$limit": 1}
        ]
        result = list(collection.aggregate(pipeline))
        next_number = 1 if not result else result[0]["noteNumber"] + 1
        return f"NOTE{next_number}"

def get_current_ist_datetime() -> datetime:
    try:
        response = requests.get("https://yenerp.com/liveapi/datetime", timeout=5)
        response.raise_for_status()
        data = response.json()

        date_str = data.get("current_date", "")      # "16-01-2026"
        time_str = data.get("current_time", "")      # "03:56 PM" or "15:56"

        if not date_str or not time_str:
            raise ValueError("Invalid datetime response from API")

        day, month, year = map(int, date_str.split('-'))

        # Handle both 12h AM/PM and 24h formats
        if "AM" in time_str.upper() or "PM" in time_str.upper():
            time_part, meridiem = time_str.split()
            hour, minute = map(int, time_part.split(':'))
            if meridiem.upper() == "PM" and hour != 12:
                hour += 12
            if meridiem.upper() == "AM" and hour == 12:
                hour = 0
        else:
            hour, minute = map(int, time_str.split(':'))

        ist = pytz.timezone("Asia/Kolkata")
        dt = ist.localize(datetime(year, month, day, hour, minute, second=0, microsecond=0))

        logger.info(f"API datetime fetched: {dt.isoformat()}")
        return dt

    except Exception as e:
        logger.error(f"Failed to fetch datetime from API: {str(e)} → using server fallback")
        ist = pytz.timezone("Asia/Kolkata")
        fallback = ist.localize(datetime.now())
        logger.info(f"Fallback datetime used: {fallback.isoformat()}")
        return fallback