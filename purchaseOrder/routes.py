from datetime import datetime, timedelta
import ftplib
import io
import logging
import math
import os
import re
from database import db
# import requests
from typing import Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile,Request
from bson import ObjectId
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ValidationError
import pytz
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token

from utils.financial_year import get_business_alias, get_financial_year, get_legacy_counter_value, get_next_counter_value, reset_counter

# from Business.utils import get_businessdetails_collection
# from Vendor.utils import get_vendor_collection

from .models import PurchaseInvoice, PurchaseOrderPostExtended, PurchaseOrderState, PurchaseOrderPost,Item, PurchaseRandomId
from utils.database import get_businessdetails_collection, get_image_collection, get_inventory_collection, get_purchaseorder_collection, get_vendor_collection
import boto3
from botocore.exceptions import ClientError
import os
from datetime import datetime
# import uuid

router = APIRouter()

# S3 Configuration for Purchase Orders
S3_ACCESS_KEY = "c1735a833c0b52f1e98ae80eb24c2a46"
S3_SECRET_KEY = "cd1f9de28cdb2fe3bac50f2aa2797f1c"
S3_BUCKET_NAME = "yenerp1"      
S3_ENDPOINT_URL = "https://sin1.contabostorage.com"
S3_TENANT_ID = "c165fc5d31cc478399748a550bc96fd3"
S3_UPLOAD_DIR_PO = "purchase_orders/pdf"  # Different folder for POs
S3_BASE_URL = f"{S3_ENDPOINT_URL}/{S3_TENANT_ID}:{S3_BUCKET_NAME}"

# Initialize S3 client for purchase orders
s3_client_po = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT_URL,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY
)
WHATSAPP_API_URL = 'https://backend.askeva.io/v1/message/send-message?token=226b3bc6338f9de4107cc93016924fb2868113776165b8d4b9a76914930e2fa2e47ff2906d87e0281121e425dccf62d84a6a82303c99beb2c24d0f9da7a46c1e32af25b2e74b7e42a7d17ce834c474aeb9b4abecdf454ade5fcd7519b8dd2e3893e0ac008bf50aa0d2ddc59737e381d4166d7d1e45af5cb285d388959efdc897c43af27799a56ea571830eca7cb8d5f08cf4284b28dff365fb85a2ad9d645ee0aaf8a86e8d6103150f29361e0f4556ba02cbf0149bacd06ad35fbe51d0ba630533cf73a51476c02eccc3845d13506638'
def upload_po_to_s3(file_buffer, filename, content_type='application/pdf'):
    """Upload purchase order PDF to S3"""
    try:
        s3_key = f"{S3_UPLOAD_DIR_PO}/{filename}"
        s3_client_po.upload_fileobj(
            file_buffer,
            S3_BUCKET_NAME,
            s3_key,
            ExtraArgs={'ContentType': content_type}
        )
        
        # Generate public URL
        pdf_url = f"{S3_BASE_URL}/{s3_key}"
        return pdf_url
    except ClientError as e:
        print(f"Error uploading PO to S3: {str(e)}")
        return None

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

def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    try:
        
        # 1. Get current time in specified timezone (IST by default)
        tz = pytz.timezone(timezone)
        localized_now = datetime.now(tz)  # Correct IST time
        
        # 2. Convert to UTC

    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")
    
 
    # Return the datetime object directly (without converting it to string)
    return {
        "datetime": localized_now  # This is a Python `datetime` object, not a string
    }
current_time = get_current_date_and_time()  # Default: Asia/Kolkata (IST)

# Current IST time (correct local time)
ist_time = current_time['datetime']  
print("IST Time:", ist_time)  # e.g., 2024-06-15 09:46:00+05:30

# Function to parse the date from the query string
def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if date_str:
        try:
            return datetime.strptime(date_str, "%d-%m-%Y")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected format is dd-MM-yyyy.")
    return None
# services/purchase_order_service.py
async def generate_random_id(tenant_id: str):
    """
    Generate random ID with TRANSITION LOGIC
    - Resets counter to 0 when no documents exist in the collection
    """
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    # Get collections
    purchaseorder_collection = get_purchaseorder_collection(tenant_id)
    counter_collection = purchaseorder_collection.database["counters"]
    
    # Check if there are any documents in the purchase order collection
    document_count = purchaseorder_collection.count_documents({})
    
    # ===== BEFORE APRIL 1, 2026 =====
    if current_date < TRANSITION_DATE:
        # ✅ USE COMMON FUNCTION for legacy counter
        # Counter ID: "purchaseorderId" - persists even if orders deleted
        
        # If no documents exist, reset the counter to 0
        if document_count == 0:
            reset_counter(counter_collection, "purchaseorderId", 0)
        
        counter_value = get_legacy_counter_value(counter_collection, "purchaseorderId")
        random_id = f"PO{counter_value:04d}"
        return random_id
    
    # ===== AFTER APRIL 1, 2026 =====
    else:
        financial_year = get_financial_year(current_date)
        business_alias = await get_business_alias(tenant_id)
        
        # Counter ID includes year: "purchaseorderId_26-27"
        # Each financial year has its own independent sequence
        counter_id = f"purchaseorderId_{financial_year}"
        
        # Check if there are any documents for this specific financial year
        # You might need to query documents that have randomId containing this financial year
        year_pattern = f"{business_alias}/{financial_year}"
        year_document_count = purchaseorder_collection.count_documents({
            "randomId": {"$regex": f"^{year_pattern}"}
        })
        
        # If no documents exist for this financial year, reset the counter
        if year_document_count == 0:
            reset_counter(counter_collection, counter_id, 0)
        
        counter_value = get_next_counter_value(counter_collection, counter_id)
        
        random_id = f"{business_alias}/{financial_year}/PO{counter_value:04d}"
        return random_id
async def get_user_id_by_username(username: str):
    user = await db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found in database")
    return str(user["_id"])

@router.post("/", response_model=PurchaseOrderState)
async def create_purchaseorder(
    request: Request,
    purchaseorder: PurchaseOrderPostExtended,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "add"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    
    # # Reset counter if collection is empty
    # if collection.count_documents({}) == 0:
    #     reset_counter(tenant_id)
    
    # Generate random ID for the purchase order
    random_id = await generate_random_id(tenant_id)
    
    # Convert the input purchase order to a dictionary
    new_purchaseorder_data = purchaseorder.dict()
    
    # IMPORTANT: Ensure orderDate is preserved as UTC midnight
    if 'orderDate' in new_purchaseorder_data and new_purchaseorder_data['orderDate']:
        # If orderDate is a datetime string, ensure it's stored as UTC midnight
        if isinstance(new_purchaseorder_data['orderDate'], str):
            try:
                # Parse the ISO string and convert to UTC midnight
                dt = datetime.fromisoformat(new_purchaseorder_data['orderDate'].replace('Z', '+00:00'))
                # Set to UTC midnight
                dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                new_purchaseorder_data['orderDate'] = dt
            except (ValueError, AttributeError):
                # If parsing fails, use current date at midnight
                current_utc = get_current_date_and_time()['datetime']
                new_purchaseorder_data['orderDate'] = current_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            # If it's already a datetime object, ensure it's midnight UTC
            new_purchaseorder_data['orderDate'] = new_purchaseorder_data['orderDate'].replace(
                hour=0, minute=0, second=0, microsecond=0
            )
    else:
        # If no orderDate provided, use current date at midnight
        current_utc = get_current_date_and_time()['datetime']
        new_purchaseorder_data['orderDate'] = current_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    
    username = user.get("username")
    user_id = await get_user_id_by_username(username)
    new_purchaseorder_data["poCreatedPerson"] = user_id

    # Get the current date and time for createdDate only
    current_date_and_time = get_current_date_and_time()
    
    # Generate ObjectIds for each item
    if new_purchaseorder_data.get('items'):
        for item in new_purchaseorder_data['items']:
            item['itemId'] = str(ObjectId())
    
    # Set status fields based on isHoldOrder
    new_purchaseorder_data['randomId'] = random_id
    if purchaseorder.isHoldOrder:
        new_purchaseorder_data['poStatus'] = 'CreditLimit for Approve'
    else:
        new_purchaseorder_data['poStatus'] = 'Pending for Approve'
           
    # Add createdDate (this is different from orderDate)
    new_purchaseorder_data['createdDate'] = current_date_and_time['datetime']
    
    # Insert the purchase order into the database
    result = collection.insert_one(new_purchaseorder_data)
    
    # Fetch the created purchase order from the database
    created_purchaseorder = collection.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string for the purchase order
    created_purchaseorder["_id"] = str(created_purchaseorder["_id"])
    created_purchaseorder["purchaseOrderId"] = str(created_purchaseorder["_id"])
    
    return created_purchaseorder

@router.get("/getAll", response_model=List[PurchaseOrderState])
async def get_all_purchaseorders(request:Request,
    user = Depends(validate_token),
     permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    purchaseorders = list(collection.find())
    formatted_purchaseorder = []
    for purchaseorder in purchaseorders:
        purchaseorder["purchaseOrderId"] = str(purchaseorder["_id"])
        formatted_purchaseorder.append(PurchaseOrderState(**purchaseorder))
    return formatted_purchaseorder

@router.get("/getRandomId", response_model=List[PurchaseRandomId])
async def get_random_ids(request:Request,
    random_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    try:
        query = {}
        # If random_id is provided, search using case-insensitive and partial match (starts with)
        if random_id:
            # Use MongoDB's $regex for case-insensitive partial matching on randomId
            regex = re.compile(f'^{random_id}', re.IGNORECASE)  # Case-insensitive, starts with 'random_id'
            query = {"randomId": {"$regex": regex}}  # Search at the root level of the document
        
        # Fetch purchase orders with optional search and pagination
        purchaseorders = list(
            collection.find(query, {"_id": 1, "randomId": 1})
            .skip(skip)
            .limit(limit)
        )
        
        formatted_purchaseorder = []
        # Iterate through the purchase orders and reformat them
        for purchaseorder in purchaseorders:
            purchaseOrderId = str(purchaseorder["_id"])  # Extract purchase order ID
            randomId = purchaseorder.get("randomId")  # Extract randomId from the root level
            
            if randomId:  # Only append if randomId exists
                formatted_purchaseorder.append(PurchaseRandomId(
                    purchaseOrderId=purchaseOrderId,
                    randomId=randomId
                ))
        
        # Return the formatted purchase orders (empty list if no matches are found)
        return formatted_purchaseorder

    except Exception as e:
        logging.error(f"Error occurred while fetching purchase orders: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

  
@router.get("/getByInvoiceNo", response_model=List[PurchaseInvoice])
async def get_invoice_no(request:Request
    
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    try:
        # Fetch purchase orders with purchaseOrderId, invoiceNo, and vendorName
        purchaseorders = list(
            collection.find(
                {}, {"_id": 1, "invoiceNo": 1, "vendorName": 1}
            )
        )

        formatted_purchaseorder = []
        for purchaseorder in purchaseorders:
            purchaseOrderId = str(purchaseorder["_id"])
            invoiceNo = purchaseorder.get("invoiceNo", "")
            vendorName = purchaseorder.get("vendorName", "")

            formatted_purchaseorder.append({
                "purchaseOrderId": purchaseOrderId,
                "invoiceNo": invoiceNo if invoiceNo else "",
                "vendorName": vendorName if vendorName else ""
            })

     
        return formatted_purchaseorder

    except Exception as e:
        logging.error(f"Error occurred while fetching purchase orders: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/getByRandomId", response_model=List[PurchaseRandomId])
async def get_random_id(request:Request,
    user = Depends(validate_token),
     permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    try:
        # Fetch all purchase orders from the collection without any filters
        purchaseorders = list(
            collection.find({}, {"_id": 1, "randomId": 1})
        )


        formatted_purchaseorder = []
        # Iterate through the purchase orders and reformat them
        for purchaseorder in purchaseorders:
            purchaseOrderId = str(purchaseorder["_id"])  # Convert ObjectId to string
            invoiceNo = purchaseorder.get("randomId", "")  # Replace None with an empty string if missing

            # Append only purchaseOrderId and invoiceNo
            formatted_purchaseorder.append({
                "purchaseOrderId": purchaseOrderId,
                "randomId": invoiceNo if invoiceNo else ""  # Ensure invoiceNo is a valid string
            })


        # Return the formatted list (all purchase orders)
        return formatted_purchaseorder

    except Exception as e:
        logging.error(f"Error occurred while fetching purchase orders: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/", response_model=List[PurchaseOrderState])
async def get_purchaseorders(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=5000),
    status: Optional[str] = Query(None, description="Comma-separated: Approved,PartiallyReceived,..."),
    vendorName: Optional[str] = Query(None, description="Prefix search, case-insensitive, supports ( ) etc."),
    itemName: Optional[str] = Query(None, description="Prefix search inside items.itemName, case-insensitive"),
    randomId: Optional[str] = Query(None),
    fromDate: Optional[datetime] = Query(None),
    toDate: Optional[datetime] = Query(None),
    filterBy: Optional[str] = Query(
        "orderDate",
        description="Filter by: orderDate | approvedDate | rejectedDate"
    ),
    user = Depends(validate_token)
):
    """
    Get paginated purchase orders with filters.
    - Dates normalized to full days
    - All text filters (vendor, item, randomId, single-status) are prefix + case-insensitive + special-char safe
    - Multi-status uses exact match
    - Tenant isolation applied
    """
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    
    query = {}

    # ── Date field selection ────────────────────────────────────────
    allowed_date_fields = {"orderDate", "approvedDate", "rejectedDate"}
    date_field = filterBy if filterBy in allowed_date_fields else "orderDate"

    # Normalize to full day range
    if fromDate:
        fromDate = datetime.combine(fromDate.date(), datetime.min.time())
    if toDate:
        toDate = datetime.combine(toDate.date(), datetime.max.time())

    if fromDate and toDate:
        query[date_field] = {"$gte": fromDate, "$lte": toDate}
    elif fromDate:
        query[date_field] = {"$gte": fromDate}
    elif toDate:
        query[date_field] = {"$lte": toDate}

    # ── Status filter ───────────────────────────────────────────────
    if status:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if status_list:
            if len(status_list) == 1:
                # Single status → exact match, case-insensitive, escaped
                escaped_status = re.escape(status_list[0])
                query["poStatus"] = {"$regex": f"^{escaped_status}$", "$options": "i"}
            else:
                # Multiple → $in (exact, case-sensitive by default)
                query["poStatus"] = {"$in": status_list}

    # ── Vendor name ─────────────────────────────────────────────────
    if vendorName:
        escaped_vendor = re.escape(vendorName.strip())
        query["vendorName"] = {
            "$regex": f"^{escaped_vendor}",
            "$options": "i"
        }

    # ── Item name (inside items array) ──────────────────────────────
    if itemName:
        escaped_item = re.escape(itemName.strip())
        query["items"] = {
            "$elemMatch": {
                "itemName": {
                    "$regex": f"^{escaped_item}",
                    "$options": "i"
                }
            }
        }

    # ── Random ID ───────────────────────────────────────────────────
    if randomId:
        escaped_random = re.escape(randomId.strip())
        query["randomId"] = {
            "$regex": f"^{escaped_random}",
            "$options": "i"
        }

    # ── Debug logs (very helpful!) ──────────────────────────────────
    print(f"Tenant ID: {tenant_id}")
    print(f"MongoDB query: {query}")
    print(f"Sorting by: {date_field} (desc)")
    
    if vendorName:
        print(f"Vendor → raw: {vendorName!r} | escaped prefix: ^{re.escape(vendorName)}")
    if itemName:
        print(f"Item   → raw: {itemName!r} | escaped prefix: ^{re.escape(itemName)}")
    if status:
        print(f"Status → raw: {status!r} | processed: {status_list}")
    # ────────────────────────────────────────────────────────────────

    # Count for pagination
    total = collection.count_documents(query)

    # Fetch results
    cursor = (
        collection
        .find(query)
        .sort(date_field, -1)  # newest first
        .skip(skip)
        .limit(limit)
    )

    purchases = list(cursor)

    if not purchases:
        return []

    # Format + convert _id → string
    formatted = []
    for doc in purchases:
        doc["purchaseOrderId"] = str(doc.pop("_id"))
        try:
            formatted.append(PurchaseOrderState(**doc))
        except Exception as e:
            print(f"Pydantic validation failed for PO {doc.get('purchaseOrderId')}: {e}")
            continue

    return formatted
@router.put("/{purchaseorder_id}")
async def update_purchaseorder(request:Request,
    purchaseorder_id: str,
    purchaseorder: PurchaseOrderPost,user = Depends(validate_token),
 permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    updated_purchaseorder = purchaseorder.dict(exclude_unset=True)
    current_date_and_time = get_current_date_and_time()
    updated_purchaseorder['lastUpdatedDate'] = current_date_and_time['datetime']
    
    result = collection.update_one({"_id": ObjectId(purchaseorder_id)}, {"$set": updated_purchaseorder})

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")
    return {"message": "PurchaseOrder updated successfully"}
@router.get("/{purchaseorder_id}", response_model=PurchaseOrderState)
async def get_purchaseorder_by_id(
    request: Request,
    purchaseorder_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
    tenant_id = request.state.tenant_id
    print(f"🔍 Tenant ID: {tenant_id}")
    print(f"🔍 PurchaseOrder ID: {purchaseorder_id}")
    
    # Get purchase order collection
    collection = get_purchaseorder_collection(tenant_id)
    
    # Get inventory collection
    try:
        # Check if the function expects tenant_id
        import inspect
        sig = inspect.signature(get_inventory_collection)
        if len(sig.parameters) > 0:
            # Function expects parameters
            inventory_collection = get_inventory_collection(tenant_id)
        else:
            # Function expects no parameters
            inventory_collection = get_inventory_collection()
        
        has_inventory = True
        print("✅ Inventory collection accessed")
    except Exception as e:
        has_inventory = False
        inventory_collection = None
        print(f"⚠️ Inventory collection error: {e}")
    
    # Find the purchase order
    try:
        purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    except Exception as e:
        print(f"❌ Error finding PO: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid PO ID format: {purchaseorder_id}")
    
    if not purchaseorder:
        print(f"❌ Purchase order not found for ID: {purchaseorder_id}")
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    print(f"✅ Purchase order found: {purchaseorder.get('randomId')}")
    
    # Convert ObjectId to string
    purchaseorder["purchaseOrderId"] = str(purchaseorder.pop("_id"))
    
    # --- CRITICAL FIX: Fetch inventory stock for each item ---
    if "items" in purchaseorder and purchaseorder["items"]:
        print(f"📦 PO has {len(purchaseorder['items'])} items")
        
        # Get all randomIds from items
        item_random_ids = []
        for item in purchaseorder["items"]:
            if item.get("randomId"):
                item_random_ids.append(item["randomId"])
            else:
                # If no randomId, set default stock
                item["availableStock"] = 0
                item["locationId"] = ""
        
        # Fetch inventory stock for all items in one query
        # FIX: Check if inventory_collection is not None (not just truthy)
        if item_random_ids and inventory_collection is not None:
            try:
                # Query inventory for all item randomIds
                inventory_cursor = inventory_collection.find(
                    {"randomId": {"$in": item_random_ids}}
                )
                
                # Create a map of randomId -> stock info
                inventory_map = {}
                for inv in inventory_cursor:
                    inventory_map[inv.get("randomId")] = {
                        "systemStock": inv.get("systemStock", 0),
                        "locationId": inv.get("locationId", "")
                    }
                
                print(f"📊 Found inventory for {len(inventory_map)} items")
                
                # Update each item with stock information
                for item in purchaseorder["items"]:
                    random_id = item.get("randomId")
                    if random_id and random_id in inventory_map:
                        item["availableStock"] = inventory_map[random_id]["systemStock"]
                        item["locationId"] = inventory_map[random_id]["locationId"]
                        print(f"  ✅ Item {item.get('itemName')} - Stock: {item['availableStock']}")
                    else:
                        item["availableStock"] = 0
                        item["locationId"] = ""
                        print(f"  ⚠️ No inventory found for {item.get('itemName')} (randomId: {random_id})")
                        
            except Exception as e:
                print(f"❌ Error fetching inventory: {e}")
                # Set default values on error
                for item in purchaseorder["items"]:
                    item["availableStock"] = 0
                    item["locationId"] = ""
        else:
            # No randomIds or no inventory collection
            print("⚠️ No randomIds found or inventory collection unavailable")
            for item in purchaseorder["items"]:
                item["availableStock"] = 0
                item["locationId"] = ""
    
    return purchaseorder
@router.patch("/{purchaseorder_id}")
async def patch_purchaseorder(request:Request,
    purchaseorder_id: str,
    purchaseorder_patch: PurchaseOrderPost,
     user = Depends(validate_token),
     permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    existing_purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    if not existing_purchaseorder:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    updated_fields = {key: value for key, value in purchaseorder_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']
        result = collection.update_one({"_id": ObjectId(purchaseorder_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update PurchaseOrder")

    updated_purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    updated_purchaseorder["_id"] = str(updated_purchaseorder["_id"])
    return updated_purchaseorder
@router.get("/items/totals")
async def get_item_totals(request:Request,
    pendingTotalQuantity: float = Query(..., gt=0),
    poQuantity: float = Query(..., gt=0),
    newPrice: float = Query(..., gt=0),
    befTaxDiscount: Optional[float] = Query(None, ge=0, le=100),
    afTaxDiscount: Optional[float] = Query(None, ge=0, le=100),
    befTaxDiscountAmount: Optional[float] = Query(None, ge=0),
    afTaxDiscountAmount: Optional[float] = Query(None, ge=0),
    befTaxDiscountType: Optional[Literal["percentage", "amount"]] = Query("percentage"),
    afTaxDiscountType: Optional[Literal["percentage", "amount"]] = Query("percentage"),
    taxPercentage: Optional[float] = Query(0, ge=0),
    taxType: Literal["cgst_sgst", "igst"] = Query("cgst_sgst"),
) -> Dict[str, float]:
    
    try:
        # Create an Item instance to validate inputs
        item = Item(
            pendingTotalQuantity=pendingTotalQuantity,
            poQuantity=poQuantity,
            newPrice=newPrice,
            befTaxDiscount=befTaxDiscount,
            afTaxDiscount=afTaxDiscount,
            befTaxDiscountAmount=befTaxDiscountAmount,
            afTaxDiscountAmount=afTaxDiscountAmount,
            befTaxDiscountType=befTaxDiscountType,
            afTaxDiscountType=afTaxDiscountType,
            taxPercentage=taxPercentage,
            taxType=taxType,
        )
    except ValidationError as e:
        return {"error": str(e)}

    # Calculate total price before discount
    total_price_before_discount = pendingTotalQuantity * newPrice

    # Initialize discount amounts and percentages
    bef_tax_discount_amount = 0
    af_tax_discount_amount = 0
    bef_tax_discount_percentage = 0
    af_tax_discount_percentage = 0

    # Calculate before-tax discount
    if item.befTaxDiscount is not None and item.befTaxDiscount > 0:
        if item.befTaxDiscountType == "percentage":
            bef_tax_discount_amount = total_price_before_discount * (item.befTaxDiscount / 100)
            bef_tax_discount_percentage = item.befTaxDiscount
    elif item.befTaxDiscountAmount is not None and item.befTaxDiscountAmount > 0:
        if item.befTaxDiscountType == "amount":
            bef_tax_discount_amount = item.befTaxDiscountAmount
            bef_tax_discount_percentage = (item.befTaxDiscountAmount / total_price_before_discount * 100) if total_price_before_discount > 0 else 0

    # Calculate price after before-tax discount
    total_price_after_bef_discount = total_price_before_discount - bef_tax_discount_amount

    # Calculate tax
    sgst_amount = cgst_amount = igst_amount = 0
    if taxType == "cgst_sgst":
        sgst_amount = total_price_after_bef_discount * (taxPercentage / 2 / 100)
        cgst_amount = total_price_after_bef_discount * (taxPercentage / 2 / 100)
        total_tax_amount = sgst_amount + cgst_amount
    else:
        igst_amount = total_price_after_bef_discount * (taxPercentage / 100)
        total_tax_amount = igst_amount

    # Calculate total price after tax
    total_price_after_tax = total_price_after_bef_discount + total_tax_amount

    # Calculate after-tax discount
    if item.afTaxDiscount is not None and item.afTaxDiscount > 0:
        if item.afTaxDiscountType == "percentage":
            af_tax_discount_amount = total_price_after_tax * (item.afTaxDiscount / 100)
            af_tax_discount_percentage = item.afTaxDiscount
    elif item.afTaxDiscountAmount is not None and item.afTaxDiscountAmount > 0:
        if item.afTaxDiscountType == "amount":
            af_tax_discount_amount = item.afTaxDiscountAmount
            af_tax_discount_percentage = (item.afTaxDiscountAmount / total_price_after_tax * 100) if total_price_after_tax > 0 else 0

    # Calculate final price
    final_price = total_price_after_tax - af_tax_discount_amount
    total_discount_amount = bef_tax_discount_amount + af_tax_discount_amount

    return {
        "pendingTotalPrice": round(total_price_before_discount, 2),
        "pendingBefTaxDiscountAmount": round(bef_tax_discount_amount, 2),
        "pendingAfTaxDiscountAmount": round(af_tax_discount_amount, 2),
        "pendingDiscountAmount": round(total_discount_amount, 2),
        "pendingTaxAmount": round(total_tax_amount, 2),
        "pendingSgst": round(sgst_amount, 2),
        "pendingCgst": round(cgst_amount, 2),
        "pendingIgst": round(igst_amount, 2),
        "pendingFinalPrice": round(final_price, 2),
        "befTaxDiscount": round(bef_tax_discount_percentage, 2),
        "afTaxDiscount": round(af_tax_discount_percentage, 2),
        "poQuantity": round(poQuantity, 2),
        "quantity": round(poQuantity, 2),
    }
    
@router.get("/view/{purchase_id}")
async def get_photo(request:Request,
    purchase_id: str,
    
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    try:
        # Retrieve document from MongoDB
        photo_document = collection.find_one({"_id": purchase_id})

        if photo_document:
            # Retrieve content
            content = photo_document["content"]

            # Return StreamingResponse with the correct media type (image/jpeg or image/png, depending on your image)
            return StreamingResponse(io.BytesIO(content), media_type="image/jpeg")  # Adjust media_type as per your image format

        else:
            raise HTTPException(status_code=404, detail="Photo not found")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/sorted", response_model=List[PurchaseOrderState])
async def get_all_purchaseorders(request:Request,
    sort_by_expected_delivery: Optional[str] = Query(None, title="Sort by Expected Delivery Date", description="Sort by expected delivery date: 'asc' or 'desc'"),
    
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    """
    Get all purchase orders with expected delivery intimations and allow sorting by expected delivery date.
    """
    # Retrieve all purchase orders from the collection
    purchaseorders = list(collection.find())

    formatted_purchaseorders = []
    current_date = datetime.now()

    for purchaseorder in purchaseorders:
        purchaseorder["purchaseOrderId"] = str(purchaseorder["_id"])  # Convert ObjectId to string
        order_date = purchaseorder.get("orderDate")
        expected_delivery_date = purchaseorder.get("expectedDeliveryDate")
        
        if expected_delivery_date:
            # Ensure expected_delivery_date is a datetime object
            expected_delivery_date = datetime.strptime(expected_delivery_date, "%Y-%m-%dT%H:%M:%S")

            # Calculate the days difference between current date and expected delivery date
            days_diff = (current_date - expected_delivery_date).days
            
            # Set the intimation based on the days difference
            if days_diff > 0:
                expected_delivery_intimation = f"Product overdue by {days_diff} days"
            elif days_diff == 0:
                expected_delivery_intimation = "Product is expected today"
            else:
                expected_delivery_intimation = f"Product expected in {abs(days_diff)} days"

            # Calculate intimation days (days from order date to expected delivery)
            if order_date:
                order_date = datetime.strptime(order_date, "%Y-%m-%dT%H:%M:%S")
                order_to_expected_delivery_days = (expected_delivery_date - order_date).days
                intimation_days = order_to_expected_delivery_days - days_diff  # Compare days
                purchaseorder["intimationDays"] = intimation_days
        else:
            expected_delivery_intimation = "No expected delivery date set"

        purchaseorder["expectedDeliveryIntimation"] = expected_delivery_intimation
        formatted_purchaseorders.append(PurchaseOrderState(**purchaseorder))

    # Sort by expected delivery date if the parameter is provided
    if sort_by_expected_delivery:
        reverse_sort = True if sort_by_expected_delivery == 'desc' else False
        formatted_purchaseorders.sort(key=lambda x: x.expectedDeliveryDate, reverse=reverse_sort)

    return formatted_purchaseorders
# ==================== APPROVAL ENDPOINTS ====================

# @router.patch("/approved/{purchaseorder_id}")
# async def approve_purchaseorder_with_whatsapp(purchaseorder_id: str):
#     """
#     Approve Purchase Order:
#     - Generate PDF
#     - Upload to S3
#     - Send WhatsApp to vendor (with fallbacks)
#     """
#     return await _approve_purchaseorder_base(purchaseorder_id, send_whatsapp=True)


# @router.patch("/approved-nosms/{purchaseorder_id}")
# async def approve_purchaseorder_without_whatsapp(purchaseorder_id: str):
#     """
#     Approve Purchase Order WITHOUT sending WhatsApp:
#     - Generate PDF
#     - Upload to S3
#     - Only update status to Approved
#     """
#     return await _approve_purchaseorder_base(purchaseorder_id, send_whatsapp=False)


# async def _approve_purchaseorder_base(purchaseorder_id: str, send_whatsapp: bool = True):
#     """
#     Core approval logic shared by both endpoints.
#     """
#     try:
#         # 1. Fetch Purchase Order
#         po = get_purchaseorder_collection().find_one({"_id": ObjectId(purchaseorder_id)})
#         if not po:
#             raise HTTPException(status_code=404, detail="PurchaseOrder not found")

#         po_number = po.get("randomId", str(purchaseorder_id))
#         print(f"Processing PO {po_number} | Send WhatsApp: {send_whatsapp}")

#         # 2. Fetch Vendor
#         vendor_name = po.get("vendorName")
#         if not vendor_name:
#             raise HTTPException(status_code=400, detail="Vendor name missing in PO")

#         vendor = get_vendor_collection().find_one({
#             "vendorName": {"$regex": f"^{re.escape(vendor_name)}$", "$options": "i"}
#         })
#         if not vendor:
#             raise HTTPException(status_code=404, detail=f"Vendor '{vendor_name}' not found")

#         # 3. Fetch Business Details
#         business = get_businessdetails_collection().find_one({})
#         if not business:
#             business = {
#                 "companyName": "Bestmummy sweet and cakes",
#                 "phoneNo": "Your Contact Number",
#                 "imageUrl": "https://yenerp.com/share/offer.jpg"
#             }

#         # 4. Fetch PO Images (if any)
#         po_images = []
#         try:
#             img_doc = get_image_collection().find_one({"_id": purchaseorder_id}) or \
#                       get_image_collection().find_one({"purchase_id": purchaseorder_id})
#             if img_doc and img_doc.get("photos"):
#                 for photo in img_doc.get("photos", []):
#                     if photo.get("ftp_path"):
#                         po_images.append(photo["ftp_path"])
#         except Exception as e:
#             print(f"Warning: Failed to load PO images: {e}")

#         # 5. Generate PDF
#         try:
#             pdf_bytes = generate_purchase_order_pdf(po, vendor, business, po_images)
#             print(f"PDF generated ({len(pdf_bytes)} bytes)")
#         except Exception as e:
#             print(f"PDF generation failed: {e}")
#             raise HTTPException(status_code=500, detail="Failed to generate PDF")

#         # 6. Upload PDF to S3
#         pdf_url = None
#         try:
#             pdf_buffer = io.BytesIO(pdf_bytes)
#             timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#             filename = f"PO_{po_number}_{timestamp}.pdf"
#             pdf_url = upload_po_to_s3(pdf_buffer, filename)
#             print(f"PDF uploaded: {pdf_url}" if pdf_url else "Warning: S3 upload failed")
#         except Exception as e:
#             print(f"S3 upload failed: {e}")

#         # 7. WhatsApp Logic (only if requested and possible)
#         whatsapp_sent = False
#         vendor_phone = vendor.get("contactpersonPhone")
#         vendor_contact_name = vendor.get("contactpersonName") or vendor.get("vendorName", "Vendor")
#         total_amount = po.get("pendingOrderAmount") or po.get("totalAmount", 0.0)

#         if send_whatsapp and vendor_phone and pdf_url:
#             print(f"Sending WhatsApp to {vendor_phone}...")
#             whatsapp_sent = send_po_whatsapp_to_vendor(
#                 vendor_phone=vendor_phone,
#                 vendor_name=vendor_contact_name,
#                 po_number=po_number,
#                 total_amount=total_amount,
#                 pdf_url=pdf_url
#             )
#             print("WhatsApp sent" if whatsapp_sent else "Warning: WhatsApp failed")
#         elif send_whatsapp:
#             print("Skipping WhatsApp: missing phone or PDF URL")

#         # 8. Update Database
#         updated_fields = {
#             "poStatus": "Approved",
#             "approvedDate": get_current_date_and_time()["datetime"],
#             "pdfUrl": pdf_url,
#             "whatsappSent": whatsapp_sent if send_whatsapp else False,
#             "vendorNotified": whatsapp_sent if send_whatsapp else False,
#             "notificationDate": datetime.now().isoformat() if whatsapp_sent else None,
#             "poImages": po_images
#         }

#         result = get_purchaseorder_collection().update_one(
#             {"_id": ObjectId(purchaseorder_id)},
#             {"$set": updated_fields}
#         )

#         if result.modified_count == 0:
#             raise HTTPException(status_code=500, detail="Failed to update PO status")

#         # 9. Fetch updated PO
#         updated_po = get_purchaseorder_collection().find_one({"_id": ObjectId(purchaseorder_id)})
#         updated_po["_id"] = str(updated_po["_id"])

#         # Clean nested ObjectIds
#         def clean_obj_ids(doc):
#             if isinstance(doc, dict):
#                 return {k: str(v) if isinstance(v, ObjectId) else clean_obj_ids(v) for k, v in doc.items()}
#             elif isinstance(doc, list):
#                 return [clean_obj_ids(i) for i in doc]
#             return doc

#         cleaned_po = clean_obj_ids(updated_po)

#         # 10. Response
#         message = "Purchase order approved"
#         if send_whatsapp:
#             message += " and WhatsApp sent" if whatsapp_sent else " (WhatsApp failed or skipped)"
#         else:
#             message += " (no WhatsApp sent)"

#         return {
#             "success": True,
#             "message": message,
#             "purchaseorder": cleaned_po,
#             "pdf_url": pdf_url,
#             "whatsapp_sent": whatsapp_sent if send_whatsapp else False,
#             "vendor_phone": vendor_phone if send_whatsapp else None,
#             "po_images": po_images
#         }

#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"Error during approval: {e}")
#         raise HTTPException(status_code=500, detail="Internal server error")
        
# def send_po_fallback_whatsapp(phone: str, vendor_name: str, po_number: str, total_amount: float, pdf_url: str) -> bool:
#     """Fallback WhatsApp message matching template content"""
    
#     message = f"""Hi,
# Your Purchase Order {po_number} has been generated from Bestmummy Sweet and Cakes.

# 📄 PO PDF: {pdf_url}
# For Contact Your Contact Number.
# Kindly confirm acceptance of this Purchase Order.

# Regards,
# The Purchase Team"""
    
#     whatsapp_message = {
#         "to": phone,
#         "type": "text",
#         "text": {
#             "body": message
#         }
#     }
    
#     try:
#         response = requests.post(
#             WHATSAPP_API_URL,
#             headers={"Content-Type": "application/json"},
#             json=whatsapp_message,
#             timeout=10
#         )
#         return response.status_code == 200
#     except Exception as e:
#         print(f"Fallback WhatsApp error: {str(e)}")
#         return False
# def send_po_whatsapp_to_vendor(
#     vendor_phone: str,
#     vendor_name: str,
#     po_number: str,
#     total_amount: float,
#     pdf_url: str
# ) -> bool:
#     """
#     Main function: Try official 'po' template → fallback to text if fails
#     """
#     # Clean phone number
#     phone = ''.join(filter(str.isdigit, vendor_phone))
#     if not phone.startswith('91') and len(phone) == 10:
#         phone = f"91{phone}"

#     # Get business phone
#     business = get_businessdetails_collection().find_one({})
#     business_phone = business.get('phoneNo', 'Your Contact Number') if business else 'Your Contact Number'

#     logo_url = "https://yenerp.com/share/offer.jpg"

#     # 1. Try official template (with image header)
#     whatsapp_message = {
#         "to": phone,
#         "type": "template",
#         "template": {
#             "language": {"policy": "deterministic", "code": "en"},
#             "name": "po",
#             "components": [
#                 {
#                     "type": "header",
#                     "parameters": [{"type": "image", "image": {"link": logo_url}}]
#                 },
#                 {
#                     "type": "body",
#                     "parameters": [
#                         {"type": "text", "text": str(po_number)},
#                         {"type": "text", "text": str(pdf_url)},
#                         {"type": "text", "text": str(business_phone)}
#                     ]
#                 }
#             ]
#         }
#     }

#     try:
#         response = requests.post(
#             WHATSAPP_API_URL,
#             headers={"Content-Type": "application/json"},
#             json=whatsapp_message,
#             timeout=30
#         )
#         if response.status_code == 200:
#             print(f"WhatsApp template sent successfully to {phone}")
#             return True
#         else:
#             print(f"Template failed: {response.text}")
#     except Exception as e:
#         print(f"Template error: {e}")

#     # 2. Fallback: Send clean, professional text message
#     return send_simple_whatsapp(phone, vendor_name, po_number, total_amount, pdf_url)


# def send_simple_whatsapp(phone: str, vendor_name: str, po_number: str, total_amount: float, pdf_url: str) -> bool:
#     """
#     Final fallback: Simple, clean, WhatsApp-friendly text message
#     """
#     if not vendor_name or vendor_name.strip() == "":
#         vendor_name = "Vendor"

#     message = f"""*PURCHASE ORDER APPROVED*

# Dear {vendor_name},

# Your PO has been approved!

# *PO Number:* {po_number}
# *Total Amount:* ₹{total_amount:,.2f}

# Download PDF: {pdf_url}

# Please proceed with delivery.

# Thank you!
# Bestmummy Sweet and Cakes"""

#     payload = {
#         "to": phone,
#         "type": "text",
#         "text": {"body": message}
#     }

#     try:
#         response = requests.post(
#             WHATSAPP_API_URL,
#             headers={"Content-Type": "application/json"},
#             json=payload,
#             timeout=15
#         )
#         if response.status_code == 200:
#             print(f"Simple WhatsApp sent to {phone}")
#             return True
#         else:
#             print(f"Simple WhatsApp failed: {response.text}")
#             return False
#     except Exception as e:
#         print(f"Error sending simple WhatsApp: {e}")
#         return False
    
@router.patch("/approved/{purchaseorder_id}")
async def approve_purchaseorder(
    request: Request,
    purchaseorder_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "approve"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)

    try:
        po_id = ObjectId(purchaseorder_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid PurchaseOrder ID format")

    existing_po = collection.find_one({"_id": po_id})
    if not existing_po:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    username = user.get("username")
    user_id = await get_user_id_by_username(username)

    # 🔥 ADMIN CHECK
    is_admin = str(user.get("role_name", "")).lower().strip() == "admin"

    # 🔥 NON-ADMIN VALIDATION
    if not is_admin:
        approval_history = existing_po.get("approvalHistory", [])

        already_approved = any(
            h.get("userId") == user_id for h in approval_history
        )

        if already_approved:
            raise HTTPException(
                status_code=403,
                detail="You already approved this PO once"
            )

    # ✅ UPDATE
    update_data = {
        "$set": {
            "poStatus": "Approved",
            "approvedDate": datetime.utcnow(),
            "poApprovedPerson": user_id
        }
    }

    # 🔥 ONLY NON-ADMIN ADD HISTORY
    if not is_admin:
        update_data["$push"] = {
            "approvalHistory": {
                "userId": user_id,
                "approvedAt": datetime.utcnow()
            }
        }

    result = collection.update_one(
        {"_id": po_id},
        update_data
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to approve PurchaseOrder")

    updated_po = collection.find_one({"_id": po_id})
    updated_po["_id"] = str(updated_po["_id"])

    return updated_po
@router.patch("/rejected/{purchaseorder_id}")
async def reject_purchaseorder(request:Request,
    purchaseorder_id: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "approve"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    existing_purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    if not existing_purchaseorder:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")
    username = user.get("username")
    user_id = await get_user_id_by_username(username)
    updated_fields = {
        'poStatus': "Rejected",
        'rejectedDate': get_current_date_and_time()['datetime'],
        "poRejectedPerson": user_id
    }

    result = collection.update_one(
        {"_id": ObjectId(purchaseorder_id)},
        {"$set": updated_fields}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to approve PurchaseOrder")

    updated_purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    updated_purchaseorder["_id"] = str(updated_purchaseorder["_id"])
    return updated_purchaseorder

@router.patch("/{purchaseOrderId}/items")
async def update_multiple_items(request:Request,
    purchaseOrderId: str,
    payload: Dict, user = Depends(validate_token),
     permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "edit"))
) -> Dict:
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    print(f"Received request to update items for purchaseOrderId: {purchaseOrderId}")
    print(f"Payload received: {payload}")
    
    # Retrieve existing purchase order
    existing_po = collection.find_one({"_id": ObjectId(purchaseOrderId)})
    print(f"Existing Purchase Order: {existing_po}")
    
    if not existing_po:
        print(f"Purchase order not found for ID: {purchaseOrderId}")
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Get freight amounts from existing PO
    total_freight_amount = existing_po.get('totalFreightAmount', 0)
    total_freight_tax_amount = existing_po.get('totalFreightTaxAmount', 0)
    print(f"Freight amounts - Charges: {total_freight_amount}, Tax: {total_freight_tax_amount}")

    # Initialize totals
    total_pending_discount = 0
    total_pending_tax = 0
    total_pending_order_amount = 0
    print("Initialized totals for discount, tax, and order amount")

    # Track updated items
    updated_item_ids = []
    updated_items = existing_po['items'].copy()  # Create a copy to modify

    # Process each item in the payload
    for item_payload in payload.get('items', []):
        item_id = item_payload.get('itemId')
        if not item_id:
            print(f"Skipping item with missing itemId in payload: {item_payload}")
            continue
        
        print(f"Processing item with ID: {item_id}")
        
        # Find the index of the existing item in the items list
        for index, existing_item in enumerate(updated_items):
            if existing_item['itemId'] == item_id:
                print(f"Existing item found: {existing_item}")
                
                # Update editable fields from payload
                updatable_fields = [
                    'pendingCount', 'pendingQuantity', 'newPrice',
                    'taxPercentage', 'befTaxDiscount', 'afTaxDiscount', 'taxType'
                ]
                for field in updatable_fields:
                    if field in item_payload:
                        print(f"Updating {field} from {existing_item.get(field)} to {item_payload[field]}")
                        existing_item[field] = item_payload[field]
                
                # Calculate derived values
                pending_total_quantity = existing_item['pendingCount'] * existing_item['pendingQuantity']
                print(f"Calculated pendingTotalQuantity: {pending_total_quantity}")
                existing_item['pendingTotalQuantity'] = pending_total_quantity
                
                pending_total_price = pending_total_quantity * existing_item['newPrice']
                print(f"Calculated pendingTotalPrice: {pending_total_price}")
                existing_item['pendingTotalPrice'] = round(pending_total_price, 2)
                existing_item['poQuantitypendingTotalPrice'] = round(pending_total_price, 2)
                
                # Calculate discounts
                bef_discount = round(pending_total_price * (existing_item.get('befTaxDiscount', 0) / 100), 2)
                print(f"Calculated before-tax discount: {bef_discount}")
                price_after_bef = round(pending_total_price - bef_discount, 2)
                
                # Calculate tax
                tax_amount = round(price_after_bef * (existing_item.get('taxPercentage', 0) / 100), 2)
                print(f"Calculated tax amount: {tax_amount}")
                
                # Calculate after-tax discount
                af_discount = round((price_after_bef + tax_amount) * (existing_item.get('afTaxDiscount', 0) / 100), 2)
                final_price = round((price_after_bef + tax_amount) - af_discount, 2)
                print(f"Calculated after-tax discount: {af_discount}, final price: {final_price}")

                # Update tax splits
                tax_type = existing_item.get('taxType', 'cgst_sgst')
                cgst = sgst = igst = 0
                if tax_type == 'cgst_sgst':
                    cgst = sgst = round(tax_amount / 2, 2)
                    print(f"Split tax into CGST: {cgst}, SGST: {sgst}")
                elif tax_type == 'igst':
                    igst = tax_amount
                    print(f"Assigned tax to IGST: {igst}")

                # Store calculated values
                existing_item.update({
                    'pendingBefTaxDiscountAmount': bef_discount,
                    'pendingAfTaxDiscountAmount': af_discount,
                    'pendingTaxAmount': tax_amount,
                    'pendingFinalPrice': final_price,
                    'pendingCgst': cgst,
                    'pendingSgst': sgst,
                    'pendingIgst': igst,
                    'poQuantity': pending_total_quantity,  # Explicitly set poQuantity
                    'pendingDiscountAmount': round(bef_discount + af_discount, 2),
                    'poQuantityTaxAmount': tax_amount,
                    'poQuantityDiscountAmount': round(bef_discount + af_discount, 2),
                    'poQuantitypendingFinalPrice': final_price,
                    'poQuantitycgst': cgst,
                    'poQuantitysgst': sgst,
                    'poQuantityigst': igst,
                })
                print(f"Updated item with calculated values: {existing_item}")
                updated_items[index] = existing_item  # Update the item in the copied list
                updated_item_ids.append(item_id)

                # Accumulate totals
                total_pending_discount += bef_discount + af_discount
                total_pending_tax += tax_amount
                total_pending_order_amount += final_price
                print(f"Accumulated totals - Discount: {total_pending_discount}, Tax: {total_pending_tax}, Order Amount: {total_pending_order_amount}")
                break
        else:
            print(f"Item with ID: {item_id} not found in purchase order. Skipping.")

    if not updated_item_ids:
        print(f"No items were updated for purchaseOrderId: {purchaseOrderId}")
        raise HTTPException(status_code=400, detail="No valid items found to update")

    # Apply custom rounding
    def custom_round(value):
        return math.floor(value) if value % 1 < 0.5 else math.ceil(value)

    # ADD FREIGHT CHARGES AND TAX TO FINAL AMOUNT
    total_pending_order_amount_with_freight = total_pending_order_amount + total_freight_amount + total_freight_tax_amount
    total_pending_order_amount = custom_round(total_pending_order_amount_with_freight)
    
    # Include freight tax in total tax
    total_pending_tax_with_freight = total_pending_tax + total_freight_tax_amount
    
    print(f"Final totals with freight - Order Amount: {total_pending_order_amount}, Tax: {total_pending_tax_with_freight}")

    # Prepare update data
    update_data = {
        "items": updated_items,
        "pendingDiscountAmount": round(total_pending_discount, 2),
        "pendingTaxAmount": round(total_pending_tax_with_freight, 2),  # Include freight tax
        "pendingOrderAmount": round(total_pending_order_amount, 2)     # Include freight charges and tax
    }
    print(f"Prepared update data for database: {update_data}")

    # Apply database update
    result = collection.update_one(
        {"_id": ObjectId(purchaseOrderId)},
        {"$set": update_data}
    )
    print(f"Database update result: Matched {result.matched_count}, Modified {result.modified_count}")

    return {
        "status": "success",
        "updatedFields": {
            "pendingOrderAmount": update_data['pendingOrderAmount'],
            "pendingTaxAmount": update_data['pendingTaxAmount'],
            "pendingDiscountAmount": update_data['pendingDiscountAmount']
        },
        "itemCount": len(updated_item_ids),
        "updatedItemIds": updated_item_ids
    }
@router.get("/debug/live-check/{tenant_id}")
async def live_check(tenant_id: str):
    """Check what will happen LIVE"""
    
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    business_alias = await get_business_alias(tenant_id)
    counter_collection = get_purchaseorder_collection(tenant_id).database["counters"]
    
    # Old counter value
    old_counter = counter_collection.find_one({"_id": "purchaseorderId"})
    old_value = old_counter.get("sequence_value", 0) if old_counter else 0
    
    # Current mode
    if current_date < TRANSITION_DATE:
        mode = "🔵 OLD FORMAT"
        next_po = f"PO{old_value + 1:04d}"
        next_change = (TRANSITION_DATE - current_date).days
        message = f"{next_change} days left in old format"
    else:
        mode = "✅ NEW FORMAT"
        current_fy = get_financial_year()
        next_po = f"{business_alias}/{current_fy}/PO{old_value + 1:04d}"
        message = "New format active"
    
    return {
        "live_server_time": current_date.strftime("%d-%m-%Y %H:%M:%S"),
        "mode": mode,
        "next_po": next_po,
        "message": message,
        "april_1_2026": f"{business_alias}/26-27/PO0001 ⭐",
        "guarantee": "This WILL auto-change on April 1, 2026 at 00:00 AM server time!"
    }
@router.get("/download-pdf/{purchaseorder_id}")
async def download_purchase_order_pdf(
    request: Request,
    purchaseorder_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
    """
    Generate and download PDF for a purchase order
    """
    try:
        tenant_id = request.state.tenant_id
        
        # Get collections with tenant isolation
        purchaseorder_collection = get_purchaseorder_collection(tenant_id)
        vendor_collection = get_vendor_collection(tenant_id)
        business_collection = get_businessdetails_collection(tenant_id)
        image_collection = get_image_collection(tenant_id)
        
        # Fetch purchase order
        try:
            purchaseorder = purchaseorder_collection.find_one({"_id": ObjectId(purchaseorder_id)})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid PO ID format: {purchaseorder_id}")
            
        if not purchaseorder:
            raise HTTPException(status_code=404, detail="PurchaseOrder not found")
        
        # Convert ObjectId to string for the response
        purchaseorder["_id"] = str(purchaseorder["_id"])
        purchaseorder["purchaseOrderId"] = purchaseorder["_id"]
        
        # Clean nested ObjectIds in items
        if "items" in purchaseorder and purchaseorder["items"]:
            for item in purchaseorder["items"]:
                if "itemId" in item and isinstance(item["itemId"], ObjectId):
                    item["itemId"] = str(item["itemId"])
        
        # Fetch vendor details
        vendor_name = purchaseorder.get("vendorName")
        vendor = {}
        if vendor_name:
            vendor = vendor_collection.find_one({
                "vendorName": {"$regex": f"^{re.escape(vendor_name)}$", "$options": "i"}
            })
            if vendor:
                vendor["_id"] = str(vendor["_id"])
        
        # Fetch business details
        business = business_collection.find_one({}) or {}
        if business and "_id" in business:
            business["_id"] = str(business["_id"])
        
        # Fetch PO images
        po_images = []
        try:
            img_doc = image_collection.find_one({"purchase_id": purchaseorder_id}) or \
                      image_collection.find_one({"_id": purchaseorder_id})
            if img_doc and img_doc.get("photos"):
                for photo in img_doc.get("photos", []):
                    if photo.get("ftp_path"):
                        po_images.append(photo["ftp_path"])
        except Exception as e:
            print(f"Warning: Failed to load PO images: {e}")
        
        # Generate PDF using your existing function
        # Make sure generate_purchase_order_pdf is properly imported
        from purchaseOrder.approvewhatsapp import generate_purchase_order_pdf
        
        pdf_bytes = generate_purchase_order_pdf(purchaseorder, vendor, business, po_images)
        
        # Generate filename
        vendor_name_clean = re.sub(r'[^\w\s-]', '', str(purchaseorder.get('vendorName')))
        vendor_name_clean = re.sub(r'[-\s]+', '_', vendor_name_clean)
        random_id = purchaseorder.get('randomId', purchaseorder_id)
        filename = f"{vendor_name_clean}_{random_id}.pdf"
        
        # Return PDF as downloadable file
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(pdf_bytes))
            }
        )
        
    except HTTPException:
        raise
    except ImportError as e:
        print(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation module not available: {str(e)}")
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")