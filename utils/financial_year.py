# utils/financial_year.py

from datetime import datetime
from utils.database import get_businessdetails_collection

def get_financial_year(date=None):
    """
    Get financial year string based on date.
    Financial year: April to March
    Format: YY-YY (e.g., 26-27, 27-28)
    """
    if date is None:
        date = datetime.now()
    
    year = date.year
    month = date.month
    
    if month >= 4:
        start_year = year % 100
        end_year = (year + 1) % 100
    else:
        start_year = (year - 1) % 100
        end_year = year % 100
    
    return f"{start_year:02d}-{end_year:02d}"

async def get_business_alias(tenant_id: str) -> str:
    """
    Fetch business alias from database
    Returns "BM" as default if not found
    """
    try:
        business_collection = get_businessdetails_collection(tenant_id)
        business = business_collection.find_one({})
        
        if business and business.get("aliasName"):
            return business["aliasName"].strip().upper()
        else:
            return "BM"
    except Exception as e:
        print(f"Error fetching business alias: {e}")
        return "BM"

def get_next_counter_value(counter_collection, counter_id: str):
    """
    Generic function to get next counter value
    """
    counter = counter_collection.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

def get_legacy_counter_value(counter_collection, counter_name: str):
    """
    Generic function to get legacy counter value
    """
    counter = counter_collection.find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]