from ast import parse
from datetime import datetime, timedelta
import logging
import math
import ftplib
import io
import math
import os
import re
from pyexpat import errors
import traceback
from typing import Dict, List, Literal, Optional, Union
from fastapi import APIRouter, HTTPException, Query, Response, logger,Depends,Request
from bson import ObjectId
from pymongo import UpdateOne
import pymongo
import pytz

from utils.financial_year import get_business_alias, get_financial_year, get_legacy_counter_value, get_next_counter_value
from .models import  FrontendGrnResponse, Grn, GrnPost
from utils.database import  get_debit_collection, get_grn_collection
from PIL import Image
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
router = APIRouter()
# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


FTP_HOST = "194.233.78.90"
FTP_USER = "yenerp.com_thys677l7kc"
FTP_PASSWORD = "PUTndhivxi6x94^%"
FTP_UPLOAD_DIR = "/httpdocs/share/upload/grn/receipts"
BASE_URL = "https://yenerp.com/share/upload"


def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    try:
        # 1. Get current time in specified timezone (IST by default)
        tz = pytz.timezone(timezone)
        localized_now = datetime.now(tz)  # Correct IST time
        
        # 2. Convert to UTC
        utc_time = localized_now.astimezone(pytz.UTC)
        
        # 3. Format for output
        local_12hr = localized_now.strftime("%I:%M:%S %p")  # 12-hour IST
        utc_12hr = utc_time.strftime("%I:%M:%S %p")         # 12-hour UTC
        
        return {
            "datetime": localized_now,       # IST time (e.g., 9:46 AM/PM)
            "utc_datetime": utc_time,        # UTC time (e.g., 4:16 AM/PM if IST is 9:46 AM)
            "local_12hr": local_12hr,        # "09:46:00 AM" (IST)
            "utc_12hr": utc_12hr,            # "04:16:00 AM" (UTC)
            "iso_datetime": localized_now.isoformat(),      # ISO format IST
            "iso_utc_datetime": utc_time.isoformat(),       # ISO format UTC
            "utc_time": utc_time             # Backward compatibility
        }
    
    except pytz.UnknownTimeZoneError:
        raise ValueError(f"Invalid timezone: {timezone}")
current_time = get_current_date_and_time()  # Default: Asia/Kolkata (IST)

# Current IST time (correct local time)
ist_time = current_time['datetime']  
print("IST Time:", ist_time)  # e.g., 2024-06-15 09:46:00+05:30

# UTC time (automatically adjusted)
utc_time = current_time['utc_datetime']  
print("UTC Time:", utc_time)  # e.g., 2024-06-15 04:16:00+00:00

# 12-hour formatted IST time
print("Local 12hr:", current_time['local_12hr'])  # "09:46:00 AM"

# 12-hour formatted UTC time
print("UTC 12hr:", current_time['utc_12hr'])      # "04:16:00 AM"
async def generate_grnrandom_id(tenant_id: str):
    """
    Generate GRN random ID with TRANSITION LOGIC
    """
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    counter_collection = get_grn_collection(tenant_id).database["counters"]
    
    # ===== BEFORE APRIL 1, 2026 =====
    if current_date < TRANSITION_DATE:
        # ✅ USE COMMON FUNCTION for legacy counter
        counter_value = get_legacy_counter_value(counter_collection, "grnId")
        random_id = f"GN{counter_value:04d}"
        return random_id
    
    # ===== AFTER APRIL 1, 2026 =====
    else:
        financial_year = get_financial_year(current_date)
        business_alias = await get_business_alias(tenant_id)
        
        # ✅ USE COMMON FUNCTION for FY counter
        counter_id = f"grnId_{financial_year}"
        counter_value = get_next_counter_value(counter_collection, counter_id)
        
        random_id = f"{business_alias}/{financial_year}/GN{counter_value:04d}"
        return random_id

# Custom rounding function
def custom_round(amount):
    """ 
    Custom rounding function:
    - If decimal part < 0.5, round down to whole number
    - If decimal part >= 0.56, round up to whole number
    - Always return with 2 decimal places
    """
    if amount is None:
        return 0.00
    
    # Get decimal part
    decimal_part = amount - int(amount)
    
    # Apply rounding rules
    if decimal_part < 0.5:
        result = int(amount)
    elif decimal_part >= 0.56:
        result = int(amount) + 1
    else:
        result = amount
    
    # Ensure two decimal places
    return round(result, 2)
# Local temp folder for processing
LOCAL_UPLOAD_FOLDER = "./temp_uploads"
os.makedirs(LOCAL_UPLOAD_FOLDER, exist_ok=True)

def compress_image(image_bytes: bytes, max_size: int = 800) -> bytes:
    """Compresses an image and converts it to WebP format without resizing."""
    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("RGB")  # Ensure compatibility with WebP format

    # Save as WebP with compression
    compressed_io = io.BytesIO()
    image.save(compressed_io, format="WebP", quality=70)  # WebP for better compression
    return compressed_io.getvalue()


async def upload_to_ftp(file_bytes: bytes, remote_filename: str) -> str:
    """Uploads a file to the FTP server."""
    try:
        ftp = ftplib.FTP()
        ftp.set_pasv(True)
        ftp.connect(FTP_HOST, 21, timeout=200)
        ftp.login(FTP_USER, FTP_PASSWORD)

        # Ensure directory exists
        folders = FTP_UPLOAD_DIR.strip("/").split("/")
        for folder in folders:
            try:
                ftp.cwd(folder)
            except ftplib.error_perm:
                ftp.mkd(folder)
                ftp.cwd(folder)

        # Upload file using binary mode
        with io.BytesIO(file_bytes) as f:
            ftp.storbinary(f"STOR {remote_filename}", f)

        ftp.quit()
        return f"{BASE_URL}/grn/receipts/{remote_filename}"
    
    except Exception as e:
        logging.error(f"FTP Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FTP upload failed: {str(e)}")
# Updated calculate_aging_day function
def calculate_aging_day(grn_date: Optional[datetime | str | dict], timezone: str = "Asia/Kolkata") -> Optional[int]:
    """
    Calculate the aging day as the difference in days between the current date and grn_date.
    Handles datetime, string, or dictionary formats for grn_date.
    """
    if not grn_date:
        logger.warning("Missing grn_date")
        return None

    try:
        # Convert grn_date to datetime
        if isinstance(grn_date, str):
            grn_date = datetime.fromisoformat(grn_date.replace("Z", "+00:00"))
        elif isinstance(grn_date, dict):
            grn_date = datetime(
                year=grn_date.get("year", 1970),
                month=grn_date.get("month", 1),
                day=grn_date.get("day", 1),
                hour=grn_date.get("hour", 0),
                minute=grn_date.get("minute", 0),
                second=grn_date.get("second", 0),
                microsecond=grn_date.get("microsecond", 0),
                tzinfo=pytz.UTC
            )
        elif not isinstance(grn_date, datetime):
            logger.warning(f"Invalid grn_date type: {type(grn_date)}")
            return None

        # Get current date in UTC
        tz = pytz.timezone(timezone)
        current_date = datetime.now(tz).astimezone(pytz.UTC).replace(hour=0, minute=0, second=0, microsecond=0)

        # Ensure grn_date is timezone-aware
        if grn_date.tzinfo is None:
            grn_date = pytz.UTC.localize(grn_date)
        grn_date = grn_date.replace(hour=0, minute=0, second=0, microsecond=0)

        # Calculate days difference
        days_diff = (current_date - grn_date).days
        logger.debug(f"Aging day calculated: current_date={current_date}, grn_date={grn_date}, days_diff={days_diff}")
        return days_diff
    except Exception as e:
        logger.error(f"Error calculating aging day for grn_date {grn_date}: {str(e)}")
        return None
    
@router.post("/", response_model=str)
async def create_grn(request:Request,grn: GrnPost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

  
    
    current_date_and_time = get_current_date_and_time()

    random_id =await generate_grnrandom_id(tenant_id)
    new_grn_data = grn.dict()
    new_grn_data['randomId'] = random_id
    new_grn_data['createdDate'] = current_date_and_time['utc_datetime']  # Add created date
    new_grn_data['grnDate'] = current_date_and_time['utc_datetime']  # Add order date

    result = collection.insert_one(new_grn_data)
    return str(result.inserted_id)

@router.get("/status", response_model=List[Grn])
async def get_grns_by_status(request:Request,status: str,
   user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    
    # Fetch GRNs where the status matches the provided parameter
    grns = list(collection.find({"status": status}))
    
    if not grns:
        raise HTTPException(status_code=404, detail=f"No GRNs found with status '{status}'")
    
    formatted_grns = []
    for grn in grns:
        grn["grnId"] = str(grn["_id"])  # Add GRN ID
        grn.pop("_id", None)  # Remove the _id field for security reasons
        formatted_grns.append(Grn(**grn))

    return formatted_grns
@router.get("/getAll", response_model=List[Grn])
async def get_all_grns( request:Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):

    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    
    # Fetch all GRNs
    grns = list(collection.find())
    
    if not grns:
        raise HTTPException(status_code=404, detail="No GRNs found")
    
    formatted_grns = []
    for grn in grns:
        grn["grnId"] = str(grn["_id"])  # Add GRN ID
        grn.pop("_id", None)  # Remove the _id field for security reasons
        formatted_grns.append(Grn(**grn))

    return formatted_grns

@router.get("/{grn_id}", response_model=Grn)
async def get_grn_by_id(request:Request,grn_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    grn = collection.find_one({"_id": ObjectId(grn_id)})
    if grn:
        grn["grnId"] = str(grn["_id"])
        return Grn(**grn)
    else:
        raise HTTPException(status_code=404, detail="Grn not found")
    


@router.put("/{grn_id}")
async def update_grn(request:Request,grn_id: str, grn: GrnPost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    updated_grn = grn.dict(exclude_unset=True)
    result = collection.update_one({"_id": ObjectId(grn_id)}, {"$set": updated_grn})
    current_date_and_time = get_current_date_and_time()
    updated_grn['lastUpdatedDate'] = current_date_and_time['utc_datetime']
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Grn not found")
    return {"message": "Grn updated successfully"}

@router.patch("/{grn_id}")
async def patch_grn(request:Request,grn_id: str, grn_patch: GrnPost,
   user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    existing_grn = collection.find_one({"_id": ObjectId(grn_id)})
    if not existing_grn:
        raise HTTPException(status_code=404, detail="Grn not found")

    updated_fields = {key: value for key, value in grn_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] =get_current_date_and_time()['utc_datetime']
        result = collection.update_one({"_id": ObjectId(grn_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Grn")

    updated_grn = collection.find_one({"_id": ObjectId(grn_id)})
    updated_grn["_id"] = str(updated_grn["_id"])
    return updated_grn


@router.get("/getOutgoing/itemwise", response_model=List[FrontendGrnResponse])
async def get_related_grns(request:Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

   
    
    try:
        # Fetch only the required fields from the database
        grns = list(collection.find({}, {
            "_id": 1,
            "randomId": 1,
            "vendorName":1,
            "grnDate":1,
            "itemDetails": 1,
        }))
        
        if not grns:
            raise HTTPException(status_code=404, detail="No GRNs found")
        
        formatted_grns = []
        for grn in grns:
            try:
                # Add proper error handling and type conversion
                item_details = []
                for item in grn.get("itemDetails", []):
                    try:
                        item_details.append({
                            "itemId" :str(item.get("itemId","N/A")),
                            "itemName": str(item.get("itemName", "N/A")),
                            "receivedQuantity": int(item.get("receivedQuantity", 0)),
                            "returnedQuantity":int(item.get("returnedQuantity",0)),
                            "unitPrice": float(item.get("unitPrice", 0.0)),
                            "totalPrice": float(item.get("totalPrice", 0.0)),
                            "quantity":float(item.get("quantity",0.0)),
                            "purchasetaxName": str(item.get("purchasetaxName", "N/A")),
                            "discountAmount": float(item.get("discountAmount", 0.0)),
                            "finalPrice": float(item.get("finalPrice", 0.0)),
                        })
                    except Exception as e:
                        continue  # Skip invalid items
                
                formatted_grn = {
                    "grnId": str(grn["_id"]),  # Convert ObjectId to string
                    "randomId": grn.get("randomId", ""),
                    "vendorName":grn.get("vendorName"),
                    "grnDate":grn.get('grnDate'),
                    "itemDetails": item_details
                }
                formatted_grns.append(FrontendGrnResponse(**formatted_grn))
            except Exception as e:
                continue  # Skip invalid GRNs
        
        if not formatted_grns:
            raise HTTPException(status_code=404, detail="No valid GRNs found")
        
        return formatted_grns
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.patch("/items/status/{grn_id}")
async def update_item_status(request:Request,grn_id: str, item_statuses: Dict[str, str],
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    """
    Update the status of multiple items in a GRN.
    """
   

    # Check if the GRN document exists
    grn = collection.find_one({"_id": ObjectId(grn_id)})
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")

    updated_items = []

    for item_id, status in item_statuses.items():
        # Check if the item exists in the GRN
        existing_item = next(
            (item for item in grn.get("itemDetails", []) if item["itemId"] == item_id),
            None
        )
        if not existing_item:
            raise HTTPException(status_code=404, detail=f"Item ID {item_id} not found in GRN")

        # Update the item status
        result = collection.update_one(
            {"_id": ObjectId(grn_id), "itemDetails.itemId": item_id},
            {"$set": {f"itemDetails.$.status": status}}  # Update the item's status
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail=f"Failed to update status for item ID {item_id}")

        # Add the updated item to the response
        updated_items.append({"itemId": item_id, "status": status})

    return {"message": "Item statuses updated successfully", "updatedItems": updated_items}


@router.patch("/invoiceupdate/{grn_id}")
async def patch_invoice_details(request:Request,
    grn_id: str,
    invoiceDate: Optional[datetime] = Query(None),  # Optional invoice date as query parameter
    invoiceNo: Optional[str] = Query(None),       # Optional invoice number as query parameter
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "edit"))        # Optional invoice number as query parameter
):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    grn = collection.find_one({"_id": ObjectId(grn_id)})

    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")

    # Prepare the fields for update
    grn_update_fields = {}

    if invoiceDate:
        grn_update_fields["invoiceDate"] = invoiceDate
    if invoiceNo:
        grn_update_fields["invoiceNo"] = invoiceNo

    # Update the GRN document with the invoice fields and clear all others
    result = collection.update_one(
        {"_id": ObjectId(grn_id)},
        {"$set": grn_update_fields}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No updates were made to the GRN")

    return {
        "invoiceDate": invoiceDate if invoiceDate else grn.get("invoiceDate"),
        "invoiceNo": invoiceNo if invoiceNo else grn.get("invoiceNo"),
    }
@router.get("/dayfilters", response_model=List[Grn])
async def get_grn_by_day_filter(request:Request,
    days_filterdate: Optional[int] = Query(None, title="Days filter", description="Filter based on days (30, 60, 90)"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    """
    Get GRNs filtered by a date difference based on the provided days filter (e.g., 30, 60, 90 days).
    The `agingDay` is calculated as the difference between the current date and `grnDate`.
    """
    try:
        # Retrieve all GRNs from the collection
        grns = list(collection.find())
    except errors.InvalidId as e:
        raise HTTPException(status_code=400, detail=f"Invalid GRN ID format: {str(e)}")

    filtered_grns = []

    # Get the current date
    current_date = datetime.now()

    for grn in grns:
        grn["grnId"] = str(grn["_id"])  # Convert ObjectId to string for JSON response

        # Extract the `grnDate` from the document
        grn_date = grn.get("grnDate")

        if grn_date:
            # Calculate the difference in days between the current date and `grnDate`
            days_diff = (current_date - grn_date).days

            # Calculate the aging day
            aging_day = days_diff
            grn["agingDay"] = aging_day

            # Apply the filter based on the number of days (30, 60, 90, etc.)
            if days_filterdate is None or aging_day <= days_filterdate:
                filtered_grns.append(Grn(**grn))

    # Return the filtered list of GRNs
    return filtered_grns
@router.get("/", response_model=List[Grn])
async def get_filtered_grns(request:Request,
    daysFilterDate: Optional[int] = Query(None, title="Days filter", description="Filter based on aging days <= value"),
    fromDate: Optional[datetime] = Query(None, description="From date (start of day)"),
    toDate: Optional[datetime] = Query(None, description="To date (end of day)"),
    vendorName: Optional[str] = Query(None, description="Vendor name (partial match)"),
    status: Optional[str] = Query(None, description="GRN status (e.g., active, partially returned)"),
    dateFilterField: Optional[str] = Query("grnDate", description="Date field (grnDate, grnVerifiedDate, grnReturnedDate)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=5000),
     user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    valid_date_fields = ["grnDate", "grnVerifiedDate", "grnReturnedDate"]
    if dateFilterField not in valid_date_fields:
        raise HTTPException(status_code=400, detail=f"Invalid date filter field. Choose from {valid_date_fields}.")

    try:
        query = {}
        if not status:
            query["status"] = {"$in": ["Active", "active", "Partially Returned", "PartiallyReturned"]}
        else:
            normalized_status = status.lower().replace(" ", "")
            if normalized_status not in ["active", "partiallyreturned", "apinvoiceconverted"]:
                raise HTTPException(status_code=400, detail="Invalid status.")
            query["status"] = {"$regex": f"^{normalized_status}$", "$options": "i"}

        # Date-wise filter (NAIVE dates to match DB - assume DB stores naive/local times)
        date_query = {}
        if fromDate:
            # Parse input (Z=UTC) to naive (strip tzinfo for DB match)
            naive_from = fromDate.replace(tzinfo=None).replace(hour=0, minute=0, second=0, microsecond=0)
            date_query["$gte"] = naive_from
            logger.info(f"Processed fromDate (naive): {naive_from}")
        if toDate:
            naive_to = toDate.replace(tzinfo=None).replace(hour=23, minute=59, second=59, microsecond=999999)
            date_query["$lte"] = naive_to
            logger.info(f"Processed toDate (naive): {naive_to}")
        if date_query:
            if "$gte" in date_query and "$lte" in date_query and date_query["$gte"] > date_query["$lte"]:
                raise HTTPException(status_code=400, detail="fromDate cannot be after toDate.")
            query[dateFilterField] = date_query

        if vendorName:
            # Escape special chars for regex (e.g., ( ) in vendorName)
            escaped_vendor = re.escape(vendorName)
            query["vendorName"] = {"$regex": escaped_vendor, "$options": "i", "$exists": True, "$ne": ""}  # Exclude empty/null

        logger.info(f"Full MongoDB query: {query}")

        # Count query (with vendorName exclusions if filtered)
        count_query = query.copy()
        total_count = collection.count_documents(count_query)
        logger.info(f"Raw total matching GRNs: {total_count}")

        # Fetch paginated results
        grns_cursor = collection.find(query).sort(dateFilterField, pymongo.DESCENDING).skip(skip).limit(limit)
        grns = list(grns_cursor)
        logger.info(f"Fetched {len(grns)} raw GRNs from cursor")

        if not grns:
            logger.info("No GRNs found matching the criteria")
            return []

        # Aggregate debit/credit notes for hasDebitCreditNotes
        grn_ids = [str(grn["_id"]) for grn in grns if "_id" in grn]
        note_count_map = {}
        if grn_ids:
            note_counts = get_debit_collection(tenant_id).aggregate([
                {"$match": {"grnId": {"$in": grn_ids}}},
                {"$group": {"_id": "$grnId", "count": {"$sum": 1}}}
            ])
            note_count_map = {str(note["_id"]): note["count"] > 0 for note in note_counts}

        filtered_grns = []
        skipped_count = 0
        for grn in grns:
            if "_id" not in grn:
                logger.warning(f"Skipping GRN with missing _id: {grn}")
                skipped_count += 1
                continue

            grn_id = str(grn["_id"])
            grn["grnId"] = grn_id

            # Parse date if string (handle no Z/microsecs)
            selected_date = grn.get(dateFilterField)
            if isinstance(selected_date, str):
                try:
                    # Add Z if missing for ISO parse
                    if 'T' in selected_date and 'Z' not in selected_date:
                        selected_date += 'Z'
                    selected_date = datetime.fromisoformat(selected_date.replace("Z", "+00:00"))
                    logger.debug(f"Parsed {dateFilterField} for GRN {grn_id}: {selected_date}")
                except ValueError as e:
                    logger.warning(f"Invalid date format for {dateFilterField} in GRN {grn_id}: {selected_date}. Error: {e}")
                    selected_date = None

            grn["agingDay"] = calculate_aging_day(selected_date) or 0
            grn["itemDetails"] = grn.get("itemDetails", [])
            grn["hasDebitCreditNotes"] = note_count_map.get(grn_id, False)

            # VALIDATE vendorName (log for debug)
            vendor_name_raw = grn.get("vendorName")
            vendor_name = str(vendor_name_raw).strip() if vendor_name_raw else ""
            logger.info(f"GRN {grn_id}: vendorName raw='{vendor_name_raw}', stripped='{vendor_name}', filter='{vendorName}'")

            # Skip if vendorName empty/missing when filtered (or always if empty for cleanliness)
            if not vendor_name:
                logger.info(f"Skipping GRN {grn_id} due to empty vendorName")
                skipped_count += 1
                continue

            # If vendorName filtered, double-check regex match (edge case)
            if vendorName and not re.search(re.escape(vendorName), vendor_name, re.IGNORECASE):
                logger.info(f"Skipping GRN {grn_id}: vendorName '{vendor_name}' doesn't match filter '{vendorName}'")
                skipped_count += 1
                continue

            logger.info(f"Matched GRN {grn_id}: vendorName='{vendor_name}'")

            # Apply daysFilterDate
            if daysFilterDate is None or grn["agingDay"] <= daysFilterDate:
                try:
                    filtered_grns.append(Grn(**grn))
                except Exception as e:
                    logger.error(f"Pydantic validation failed for GRN {grn_id}: {str(e)}")
                    skipped_count += 1
                    continue

        logger.info(f"Final filtered GRNs: {len(filtered_grns)} (skipped: {skipped_count} total fetched: {len(grns)})")

        return filtered_grns

    except Exception as e:
        logger.error(f"Error fetching GRNs: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/returnprocess/Grnwise", response_model=List[Grn])
async def get_filtered_grns(request:Request,
    daysFilterDate: Optional[int] = Query(None, title="Days filter", description="Filter based on days (e.g., 30, 60, 90 days)"),
    fromDate: Optional[datetime] = Query(None, description="From date"),
    toDate: Optional[datetime] = Query(None, description="To date"),
    vendorName: Optional[str] = Query(None, description="Vendor name to filter by"),
    status: Optional[str] = Query(None, description="GRN status (FullyReturned, PartiallyReturned, APInvoiceConverted)"),
    dateFilterField: Optional[str] = Query("grnReturnedDate", description="Date field to filter by (e.g., 'grnDate', 'grnVerifiedDate', 'grnReturnedDate')"),
    skip: int = Query(0, ge=0, title="Skip", description="Number of records to skip for pagination"),
    limit: int = Query(50, le=5000, title="Limit", description="Maximum number of records to return"),
    response: Response = Response(),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_grn_collection(tenant_id)

    valid_date_fields = ["grnDate", "grnVerifiedDate", "grnReturnedDate"]
    
    if dateFilterField not in valid_date_fields:
        raise HTTPException(status_code=400, detail=f"Invalid date filter field. Choose from {valid_date_fields}.")

    try:
        query = {}
        # Default to only returned statuses - adjust casing if needed based on DB
        if not status:
            query["status"] = {"$in": ["Fully Returned", "Partially Returned", "APInvoiceConverted"]}
        else:
            valid_statuses = ["fully returned", "partially returned", "apinvoiceconverted"]
            if status.lower() not in valid_statuses:
                raise HTTPException(status_code=400, detail="Status must be one of: FullyReturned, PartiallyReturned, APInvoiceConverted")
            query["status"] = {"$regex": f"^{status}$", "$options": "i"}

        if fromDate or toDate:
            if fromDate:
                fromDate = fromDate.replace(hour=0, minute=0, second=0, microsecond=0)
            if toDate:
                toDate = toDate.replace(hour=23, minute=59, second=59, microsecond=999999)
            if fromDate and toDate and fromDate > toDate:
                raise HTTPException(status_code=400, detail="fromDate cannot be after toDate.")
            
            date_query = {}
            if fromDate:
                date_query["$gte"] = fromDate
            if toDate:
                date_query["$lte"] = toDate
            if date_query:  # Only add if there's any date filter
                query[dateFilterField] = date_query
        # No default date filter: fetch all matching status and returned items

        if vendorName:
            query["vendorName"] = {"$regex": f"^{vendorName}", "$options": "i"}

        # Get total count for pagination (approximate, before final filter)
        total = collection.count_documents(query)
        response.headers["X-Total-Count"] = str(total)

        logger.info(f"Executing query: {query}, sort by {dateFilterField}, skip: {skip}, limit: {limit}")
        grns_cursor = collection.find(query).sort(dateFilterField, pymongo.DESCENDING).skip(skip).limit(limit)
        grns = list(grns_cursor)

        if not grns:
            logger.info("No GRNs found matching the criteria")
            return []

        filtered_grns = []
        current_date = datetime.now(pytz.timezone("Asia/Kolkata")).replace(tzinfo=None)

        for grn in grns:
            if "_id" not in grn:
                logger.warning(f"Skipping GRN with missing _id: {grn}")
                continue

            grn["grnId"] = str(grn["_id"])
            selected_date = grn.get(dateFilterField)
            grn_status = grn.get("status", "").lower()

            if selected_date and isinstance(selected_date, datetime):
                try:
                    days_diff = (current_date - selected_date).days
                    grn["agingDay"] = days_diff
                except TypeError as e:
                    logger.warning(f"Invalid date format for {dateFilterField} in GRN {grn['grnId']}: {str(e)}")
                    grn["agingDay"] = None
            else:
                grn["agingDay"] = None
                logger.warning(f"Invalid or missing {dateFilterField} in GRN: {grn['grnId']}")

            # Include all items in itemDetails
            item_details = grn.get("itemDetails", []) if isinstance(grn.get("itemDetails"), list) else []
            grn["itemDetails"] = item_details

            # Check if GRN has any returned items
            has_returned_items = any(item.get('returnedQuantity', 0) > 0 for item in item_details)

            # Apply days filter if provided
            include_grn = has_returned_items
            if include_grn and daysFilterDate is not None and grn["agingDay"] is not None and grn["agingDay"] > daysFilterDate:
                include_grn = False

            if include_grn:
                try:
                    filtered_grns.append(Grn(**grn))
                except Exception as e:
                    logger.error(f"Pydantic validation failed for GRN {grn['grnId']}: {str(e)}")
                    continue

        logger.info(f"Returning {len(filtered_grns)} GRNs")
        return filtered_grns

    except pymongo.errors.ServerSelectionTimeoutError as e:
        logger.error(f"MongoDB connection error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to connect to MongoDB server. Please check the database connection.")
    except Exception as e:
        logger.error(f"Internal Server Error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")