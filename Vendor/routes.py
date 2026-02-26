import csv
from datetime import datetime, timedelta
import io
import re
from typing import Dict, List, Optional
from fastapi import Request
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, Depends
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import pytz
from pymongo import InsertOne, UpdateOne
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from .models import Vendor, VendorName, VendorPost, VendorSearch, VendorSummary
from utils.database import get_vendortype_collection,get_vendor_collection
import logging

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define user-friendly header mappings for CSV
HEADER_MAPPING = {
    "randomId": "Vendor Code",
    "vendorName": "Vendor Name",
    "contactpersonName": "Contact Person Name",
    "contactpersonPhone": "Contact Phone",
    "contactpersonEmail": "Contact Email",
    "address": "Address",
    "country": "Country",
    "state": "State",
    "city": "City",
    "postalCode": "Postal Code",
    "website": "Website",
    "vendorType": "Vendor Type",
    "gstNumber": "GST Number",
    "paymentTerms": "Payment Terms",
    "creditLimit": "Credit Limit",
    "payableAmount": "Payable Amount",
    "preferredpaymentMethod": "Preferred Payment Method",
    "status": "Status",
    "notes": "Notes",
    "bankName": "Bank Name",
    "accountNumber": "Account Number",
    "ifscCode": "IFSC Code",
    "createdDate": "Created Date",
    "updatedDate": "Updated Date"
}
REVERSE_HEADER_MAPPING = {v: k for k, v in HEADER_MAPPING.items()}

def get_current_date_and_time():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    return datetime.now(ist).astimezone(pytz.UTC)

def set_counter_value(tenant_id: str,value: int, counter_id: str = "vendorId"):
    """Set the counter value in the database."""
    counter_collection = get_vendor_collection(tenant_id).database["counters"]
    counter_collection.update_one(
        {"_id": counter_id},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

def get_current_counter_value(tenant_id:str,counter_id: str = "vendorId"):
    """Get the current counter value from the database."""
    counter_collection = get_vendor_collection(tenant_id).database["counters"]
    counter = counter_collection.find_one({"_id": counter_id})
    return counter["sequence_value"] if counter else 0

def initialize_counter_if_needed(tenant_id: str,counter_id: str = "vendorId"):
    """Initialize counter to match highest existing VIxxx ID."""
    collection = get_vendor_collection(tenant_id)
    counter_collection = collection.database["counters"]

    highest_vendor = collection.find_one(
        {"randomId": {"$regex": "^VI\\d+$"}},
        sort=[("randomId", -1)]
    )

    if highest_vendor:
        try:
            last_number = int(highest_vendor["randomId"][2:])
        except (ValueError, TypeError):
            last_number = 0
            logger.warning(f"Malformed randomId found: {highest_vendor['randomId']}")
        counter_collection.update_one(
            {"_id": counter_id},
            {"$set": {"sequence_value": last_number}},
            upsert=True
        )
    else:
        counter_collection.update_one(
            {"_id": counter_id},
            {"$set": {"sequence_value": 0}},
            upsert=True
        )
def sanitize_vendor_name(vendor_name: str) -> str:
    """
    Properly sanitize vendor name for MongoDB regex search
    """
    if not vendor_name:
        return ""
    
    # Remove leading/trailing whitespace
    vendor_name = vendor_name.strip()
    
    # Replace multiple spaces with single space
    vendor_name = re.sub(r'\s+', ' ', vendor_name)
    
    # Escape only special regex characters that could break the query
    # Don't escape spaces, parentheses, hyphens, etc. that are part of normal business names
    special_chars = ['\\', '.', '*', '+', '?', '^', '$', '[', ']', '{', '}', '|']
    sanitized = ""
    for char in vendor_name:
        if char in special_chars:
            sanitized += '\\' + char
        else:
            sanitized += char
    
    return sanitized

def validate_vendor_name_input(vendor_name: str) -> bool:
    """
    Validate if vendor name contains reasonable characters for business names
    """
    if not vendor_name:
        return True
        
    # More permissive pattern for business names
    pattern = r'^[a-zA-Z0-9\s\-\(\)\.\',&+/:@#]+$'
    return bool(re.match(pattern, vendor_name))

def generate_sequential_id(tenant_id: str):
    
    """Generate sequential VIxxx IDs without gap filling during imports."""
    collection = get_vendor_collection(tenant_id)
    counter_collection = collection.database["counters"]

    # Get the current counter value
    counter = counter_collection.find_one({"_id": "vendorId"})
    current_counter = counter["sequence_value"] if counter else 0

    # Increment the counter
    next_number = current_counter + 1
    
    # Update the counter in database
    counter_collection.update_one(
        {"_id": "vendorId"},
        {"$set": {"sequence_value": next_number}},
        upsert=True
    )

    return f"VI{next_number:03d}"
@router.post("/reset-counter")
async def reset_sequence( request: Request):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    """Reset the counter to 0. Next ID will be VI001."""
    set_counter_value(tenant_id,0)
    return {"message": "Counter reset successfully. Next ID will be VI001"}

@router.post("/fix-vendor-ids")
async def fix_vendor_ids(  request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendor", "admin"))):
    tenant_id = request.state.tenant_id
   
    try:
        collection = get_vendor_collection(tenant_id)
        result = collection.update_many(
            {"vendorId": {"$in": [None, "", None]}},
            [{"$set": {"vendorId": {"$toString": "$_id"}}}]
        )
        logger.info(f"Updated {result.modified_count} vendor documents with vendorId")
        return {"message": f"Updated {result.modified_count} vendor documents"}
    except Exception as e:
        logger.error(f"Error fixing vendor IDs: {e}")
        raise HTTPException(status_code=500, detail=f"Error fixing vendor IDs: {str(e)}")

@router.post("/", response_model=str)
async def create_vendor( request: Request,vendor_data: VendorPost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendors", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        initialize_counter_if_needed(tenant_id)
        sequential_id = generate_sequential_id(tenant_id)
        current_date_and_time = get_current_date_and_time()

        new_vendor_data = vendor_data.dict()
        vendor_object_id = ObjectId()

        new_vendor_data.update({
            '_id': vendor_object_id,
            'vendorId': str(vendor_object_id),
            'randomId': sequential_id,
            'createdDate': current_date_and_time,
            'updatedDate': None,
            'status': 'active'
        })

        existing_vendor = collection.find_one({
            'vendorName': new_vendor_data['vendorName'],
            'contactpersonPhone': new_vendor_data['contactpersonPhone']
        })

        if existing_vendor:
            raise HTTPException(
                status_code=400,
                detail="Vendor with this name and phone already exists"
            )

        result = collection.insert_one(new_vendor_data)
        return str(result.inserted_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating vendor: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/", response_model=List[Vendor])
async def get_all_vendor( request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        vendors = list(collection.find().sort("randomId", -1))
        return [Vendor(**vendor) for vendor in vendors]
    except Exception as e:
        logger.error(f"Error fetching vendors: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/vendorname", response_model=List[VendorName])
async def get_all_vendors( request: Request, user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        vendors = list(collection.find({}, {"vendorName": 1}))
        return [VendorName(vendorId=str(vendor["_id"]), vendorName=vendor["vendorName"]) for vendor in vendors]
    except Exception as e:
        logger.error(f"Error occurred while fetching vendors: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/limit", response_model=Dict)
async def get_all_vendors( request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=5000),
    vendorName: Optional[str] = Query(None),
     user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        query = {}
        if vendorName:
            query["vendorName"] = {"$regex": f"^{vendorName}", "$options": "i"}

        total_count = collection.count_documents(query)
        vendors = list(collection.find(query)
                      .sort("randomId", -1)
                      .skip(skip)
                      .limit(limit))

        return {
            "vendors": [Vendor(**vendor) for vendor in vendors],
            "totalVendors": total_count
        }
    except Exception as e:
        logger.error(f"Error occurred while fetching vendors: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/{vendor_id}", response_model=Vendor)
async def get_vendor_by_id( request: Request,vendor_id: str, user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        vendor = collection.find_one({"_id": ObjectId(vendor_id)})
        if vendor:
            return Vendor(**vendor)
        raise HTTPException(status_code=404, detail="Vendor not found")
    except Exception as e:
        logger.error(f"Error fetching vendor: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
@router.get("/exact-name/", response_model=List[VendorSearch])
async def get_vendor_by_name( request: Request,
    vendor_name: Optional[str] = Query(None, description="Vendor name to search for"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        query = {}
        
        if vendor_name:
            # Validate input
            if not validate_vendor_name_input(vendor_name):
                raise HTTPException(
                    status_code=400, 
                    detail="Vendor name contains invalid characters"
                )
            
            # Use simple case-insensitive search - MongoDB handles this better
            query["vendorName"] = {
                "$regex": f"^{re.escape(vendor_name)}", 
                "$options": "i"
            }

        vendors = list(collection.find(query).skip(skip).limit(limit))

        if vendor_name and not vendors:
            raise HTTPException(
                status_code=404, 
                detail=f"No vendors found matching '{vendor_name}'"
            )

        return [VendorSearch(
            vendorId=str(vendor["_id"]),
            vendorName=vendor["vendorName"]
        ) for vendor in vendors]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error occurred while fetching vendors: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.put("/{vendor_id}")
async def update_vendor( request: Request,vendor_id: str, vendor_data: VendorPost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendors", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        current_date_and_time = get_current_date_and_time()
        updated_vendor = vendor_data.dict(exclude_unset=True)
        updated_vendor['updatedDate'] = current_date_and_time

        result = collection.replace_one(
            {"_id": ObjectId(vendor_id)},
            updated_vendor
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return {"message": "Vendor updated successfully"}
    except Exception as e:
        logger.error(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/vendor-names/", response_model=List[VendorSummary])
async def get_vendor_names( request: Request,
    vendor_name: Optional[str] = Query(None, description="Vendor name to search for"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        query = {}
        
        if vendor_name:
            # Validate input
            if not validate_vendor_name_input(vendor_name):
                raise HTTPException(
                    status_code=400, 
                    detail="Vendor name contains invalid characters"
                )
            
            # Use starts-with matching for better performance
            query["vendorName"] = {
                "$regex": f"^{re.escape(vendor_name)}", 
                "$options": "i"
            }

        vendors = list(collection.find(query).skip(skip).limit(limit))

        if vendor_name and not vendors:
            raise HTTPException(
                status_code=404, 
                detail=f"No vendors found matching '{vendor_name}'"
            )

        return [VendorSummary(
            vendorId=str(vendor["_id"]),
            randomId=vendor.get('randomId'),
            vendorName=vendor.get("vendorName"),
            contactpersonPhone=vendor.get("contactpersonPhone"),
            contactpersonEmail=vendor.get("contactpersonEmail"),
            address=vendor.get("address"),
            country=vendor.get("country"),
            paymentTerms=vendor.get("paymentTerms"),
            state=vendor.get("state"),
            city=vendor.get("city"),
            postalCode=vendor.get("postalCode"),
            gstNumber=vendor.get("gstNumber"),
            creditLimit=vendor.get('creditLimit')
        ) for vendor in vendors]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error occurred while fetching vendors: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

# SIMPLE SEARCH - Just works without complex sanitization
@router.get("/search/", response_model=List[VendorSummary])
async def search_vendors( request: Request,
    vendor_name: Optional[str] = Query(None, description="Vendor name to search for"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1)
):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        query = {}
        
        if vendor_name:
            # Simple approach - let MongoDB handle the regex safely
            query["vendorName"] = {
                "$regex": f"^{vendor_name}", 
                "$options": "i"
            }

        vendors = list(collection.find(query).skip(skip).limit(limit))

        if vendor_name and not vendors:
            raise HTTPException(
                status_code=404, 
                detail=f"No vendors found matching '{vendor_name}'"
            )

        return [VendorSummary(
            vendorId=str(vendor["_id"]),
            vendorName=vendor.get("vendorName"),
            contactpersonPhone=vendor.get("contactpersonPhone"),
            contactpersonEmail=vendor.get("contactpersonEmail"),
            address=vendor.get("address"),
            country=vendor.get("country"),
            paymentTerms=vendor.get("paymentTerms"),
            state=vendor.get("state"),
            city=vendor.get("city"),
            postalCode=vendor.get("postalCode"),
            gstNumber=vendor.get("gstNumber"),
            creditLimit=vendor.get('creditLimit')
        ) for vendor in vendors]
        
    except Exception as e:
        logger.error(f"Error occurred while searching vendors: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

# FLEXIBLE SEARCH - For partial matching anywhere in the name
@router.get("/flexible-search/", response_model=List[VendorSummary])
async def flexible_search_vendors( request: Request,
    vendor_name: Optional[str] = Query(None, description="Vendor name to search for (partial matches)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1)
):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        query = {}
        
        if vendor_name:
            # Clean the input - remove extra spaces
            clean_name = ' '.join(vendor_name.strip().split())
            
            # Escape special regex characters
            escaped_name = re.escape(clean_name)
            
            # Search anywhere in the vendor name
            query["vendorName"] = {
                "$regex": escaped_name, 
                "$options": "i"
            }

        vendors = list(collection.find(query).skip(skip).limit(limit))

        if vendor_name and not vendors:
            raise HTTPException(
                status_code=404, 
                detail=f"No vendors found matching '{vendor_name}'"
            )

        return [VendorSummary(
            vendorId=str(vendor["_id"]),
            vendorName=vendor.get("vendorName"),
            contactpersonPhone=vendor.get("contactpersonPhone"),
            contactpersonEmail=vendor.get("contactpersonEmail"),
            address=vendor.get("address"),
            country=vendor.get("country"),
            paymentTerms=vendor.get("paymentTerms"),
            state=vendor.get("state"),
            city=vendor.get("city"),
            postalCode=vendor.get("postalCode"),
            gstNumber=vendor.get("gstNumber"),
            creditLimit=vendor.get('creditLimit')
        ) for vendor in vendors]
        
    except Exception as e:
        logger.error(f"Error occurred while searching vendors: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.patch("/{vendor_id}/deactivate")
async def deactivate_vendor( request: Request,vendor_id: str,
        user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    """Deactivate a vendor with delete permission"""
    try:
        current_date = get_current_date_and_time()
        
        result = collection.update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": {
                'status': 'deactivated',
                'updatedDate': current_date
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        updated_vendor = collection.find_one({"_id": ObjectId(vendor_id)})
        if updated_vendor:
            updated_vendor["_id"] = str(updated_vendor["_id"])
            return updated_vendor
        
        raise HTTPException(status_code=404, detail="Vendor not found after update")
    except Exception as e:
        logger.error(f"Error deactivating vendor: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# ✅ SEPARATE ACTIVATE ENDPOINT  
@router.patch("/{vendor_id}/activate")
async def activate_vendor( request: Request,vendor_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendors", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    """Activate a vendor with delete permission"""
    try:
        current_date = get_current_date_and_time()
        
        result = collection.update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": {
                'status': 'active',
                'updatedDate': current_date
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        updated_vendor = collection.find_one({"_id": ObjectId(vendor_id)})
        if updated_vendor:
            updated_vendor["_id"] = str(updated_vendor["_id"])
            return updated_vendor
        
        raise HTTPException(status_code=404, detail="Vendor not found after update")
    except Exception as e:
        logger.error(f"Error activating vendor: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
@router.patch("/{vendor_id}")
async def patch_vendor( request: Request,vendor_id: str, vendor_patch: VendorPost, user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    try:
        current_date = get_current_date_and_time()
        existing_vendor = collection.find_one({"_id": ObjectId(vendor_id)})
        if not existing_vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        updated_fields = {key: value for key, value in vendor_patch.dict(exclude_unset=True).items() if value is not None}

        if updated_fields:
            updated_fields['updatedDate'] = current_date
            result = collection.update_one(
                {"_id": ObjectId(vendor_id)},
                {"$set": updated_fields}
            )
            if result.modified_count == 0:
                raise HTTPException(status_code=500, detail="Failed to update vendor")

        updated_vendor = collection.find_one({"_id": ObjectId(vendor_id)})
        updated_vendor["_id"] = str(updated_vendor["_id"])
        return updated_vendor
    except Exception as e:
        logger.error(f"Error occurred while patching vendor: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

def parse_date(date_str: str) -> Optional[datetime]:
    """Parse date string in DD/MM/YYYY or YYYY-MM-DD format."""
    if not date_str:
        return None
    try:
        parsed_date = datetime.strptime(date_str, '%d/%m/%Y')
        return pytz.timezone('Asia/Kolkata').localize(parsed_date).astimezone(pytz.UTC)
    except ValueError:
        try:
            parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
            return pytz.timezone('Asia/Kolkata').localize(parsed_date).astimezone(pytz.UTC)
        except ValueError:
            return None

@router.post("/import-csv")
async def import_csv( request: Request,file: UploadFile = File(...), user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendors", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_vendor_collection(tenant_id)
    """Import vendors from a CSV file, ensuring sequential IDs and user-friendly error reporting."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    try:
        initialize_counter_if_needed(tenant_id)
        vendortype_collection = get_vendortype_collection(tenant_id)
        current_date = get_current_date_and_time()

        # Read CSV file
        contents = await file.read()
        decoded = contents.decode('utf-8-sig', errors='replace')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        # Map headers to internal field names
        headers = [REVERSE_HEADER_MAPPING.get(header.strip(), header.strip()) for header in csv_reader.fieldnames or []]
        csv_reader.fieldnames = headers

        # Define required fields
        required_fields = ['vendorName', 'vendorType', 'contactpersonPhone', 'paymentTerms']

        # Check for missing headers
        missing_headers = [field for field in required_fields if field not in headers]
        if missing_headers:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Missing required headers in CSV file",
                    "missing": [HEADER_MAPPING.get(field, field) for field in missing_headers],
                    "required": [HEADER_MAPPING.get(field, field) for field in required_fields]
                }
            )

        # Pre-load valid vendor types from vendortype collection
        valid_vendor_types = set()
        async for doc in vendortype_collection.find({"status": "active"}, {"vendorType": 1}):
            if doc.get("vendorType"):
                valid_vendor_types.add(doc["vendorType"].lower().strip())
        
        # If no active vendor types found, log warning
        if not valid_vendor_types:
            logger.warning("No active vendor types found in vendortype collection")

        # Collect all rows for validation
        rows = []
        seen_vendors = {}  # Track (vendorName, contactpersonPhone) and row numbers
        seen_ids = {}  # Track randomId and row numbers
        for idx, row in enumerate(csv_reader, 1):
            cleaned_row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}
            rows.append((idx, cleaned_row))

            # Track vendor key for duplicates
            vendor_name = cleaned_row.get('vendorName', '').lower()
            contact_phone = cleaned_row.get('contactpersonPhone', '').lower()
            vendor_key = (vendor_name, contact_phone)
            if vendor_key[0] and vendor_key[1]:
                if vendor_key in seen_vendors:
                    seen_vendors[vendor_key].append(idx)
                else:
                    seen_vendors[vendor_key] = [idx]

            # Track randomId for duplicates
            random_id = cleaned_row.get('randomId', '').strip()
            if random_id:
                if random_id in seen_ids:
                    seen_ids[random_id].append(idx)
                else:
                    seen_ids[random_id] = [idx]

        # Preload existing vendors and randomIds
        existing_vendors = {
            (doc["vendorName"].lower(), doc["contactpersonPhone"].lower()): doc
            for doc in collection.find({}, {"vendorName": 1, "contactpersonPhone": 1, "_id": 1, "randomId": 1, "status": 1})
        }
        used_ids = set(collection.distinct("randomId", {"randomId": {"$regex": "^VI\\d+$"}}))

        inserted_count = 0
        updated_count = 0
        successful = []
        updated = []
        failed = []
        batch = []
        
        # Get the highest existing ID number to start from
        highest_vendor = collection.find_one(
            {"randomId": {"$regex": "^VI\\d+$"}},
            sort=[("randomId", -1)]
        )
        
        if highest_vendor:
            try:
                max_id_number = int(highest_vendor["randomId"][2:])
            except (ValueError, TypeError):
                max_id_number = 0
        else:
            max_id_number = 0

        # Validate and process rows
        for idx, row in rows:
            try:
                # Validate required fields
                missing_fields = [field for field in required_fields if not row.get(field)]
                if missing_fields:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Missing required fields: {', '.join([HEADER_MAPPING.get(field, field) for field in missing_fields])}",
                        "missingFields": [HEADER_MAPPING.get(field, field) for field in missing_fields]
                    })
                    continue

                vendor_name = row.get("vendorName")
                contact_phone = row.get("contactpersonPhone")
                vendor_type = row.get("vendorType", "").strip()
                vendor_key = (vendor_name.lower(), contact_phone.lower())

                # Validate vendor type exists in vendortype master
                if vendor_type and vendor_type.lower() not in valid_vendor_types:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Invalid Vendor Type: '{vendor_type}' not found in Vendor Type master. Please add this vendor type first or use an existing one.",
                        "missingFields": []
                    })
                    continue

                # Check for duplicates in CSV
                if vendor_key in seen_vendors and len(seen_vendors[vendor_key]) > 1 and seen_vendors[vendor_key][0] != idx:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Duplicate Vendor in CSV: '{vendor_name}' with phone '{contact_phone}'",
                        "missingFields": []
                    })
                    continue

                # Process status
                status = row.get("status", "active").lower()
                if status not in ['active', 'inactive']:
                    status = 'active'

                # Process dates
                created_date = parse_date(row.get("createdDate")) or current_date
                updated_date = parse_date(row.get("updatedDate")) or current_date

                # Validate randomId
                provided_id = row.get('randomId', '').strip()
                if provided_id:
                    if not (provided_id.startswith('VI') and provided_id[2:].isdigit()):
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Invalid Vendor Code format: '{provided_id}'. Must be 'VI' followed by digits.",
                            "missingFields": []
                        })
                        continue
                    if provided_id in used_ids or (provided_id in seen_ids and len(seen_ids[provided_id]) > 1):
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Duplicate Vendor Code: '{provided_id}'",
                            "missingFields": []
                        })
                        continue

                # Handle numeric fields
                numeric_fields = [
                    ("creditLimit", int, "Credit Limit"),
                    ("payableAmount", float, "Payable Amount"),
                    ("postalCode", int, "Postal Code"),
                    ("accountNumber", int, "Account Number")
                ]
                vendor_data = {}
                for field, cast_type, friendly_name in numeric_fields:
                    value = row.get(field, "").strip()
                    if value:
                        try:
                            if field == "payableAmount" and not re.match(r'^\d*\.?\d*$', value):
                                raise ValueError(f"Invalid {friendly_name}: {value}")
                            if field in ["creditLimit", "postalCode", "accountNumber"] and not value.isdigit():
                                raise ValueError(f"Invalid {friendly_name}: {value}")
                            vendor_data[field] = cast_type(value)
                        except ValueError:
                            failed.append({
                                "row": idx,
                                "data": row,
                                "error": f"Invalid {friendly_name}: '{value}' must be a valid {cast_type.__name__}",
                                "missingFields": []
                            })
                            continue

                # Process existing vendor
                if vendor_key in existing_vendors:
                    existing_vendor = existing_vendors[vendor_key]
                    if existing_vendor['status'] != status:
                        update_data = {
                            'status': status,
                            'updatedDate': updated_date
                        }
                        batch.append(UpdateOne(
                            {'_id': existing_vendor['_id']},
                            {'$set': update_data}
                        ))
                        updated.append({
                            "row": idx,
                            "data": {
                                "randomId": existing_vendor['randomId'] or "N/A",
                                "vendorName": vendor_name,
                                **row
                            },
                            "error": f"Duplicate Vendor updated: '{vendor_name}' with phone '{contact_phone}'"
                        })
                        updated_count += 1
                    continue

                # Prepare new vendor data
                vendor_data.update({
                    "vendorName": vendor_name,
                    "contactpersonName": row.get("contactpersonName", ""),
                    "contactpersonPhone": contact_phone,
                    "contactpersonEmail": row.get("contactpersonEmail", ""),
                    "address": row.get("address", ""),
                    "website": row.get("website", ""),
                    "vendorType": vendor_type,  # Use the validated vendor type
                    "gstNumber": row.get("gstNumber", ""),
                    "paymentTerms": row.get("paymentTerms"),
                    "preferredpaymentMethod": row.get("preferredpaymentMethod", ""),
                    "status": status,
                    "notes": row.get("notes", ""),
                    "country": row.get("country", ""),
                    "state": row.get("state", ""),
                    "city": row.get("city", ""),
                    "bankName": row.get("bankName", ""),
                    "ifscCode": row.get("ifscCode", ""),
                    "createdDate": created_date,
                    "updatedDate": None
                })

                # Generate sequential ID - FIXED LOGIC
                if provided_id and provided_id.startswith('VI') and provided_id[2:].isdigit() and provided_id not in used_ids:
                    # Use the provided ID if valid and unique
                    id_number = int(provided_id[2:])
                    used_ids.add(provided_id)
                    max_id_number = max(max_id_number, id_number)
                    final_id = provided_id
                else:
                    # Generate new sequential ID
                    max_id_number += 1
                    final_id = f"VI{max_id_number:03d}"
                    # Ensure the generated ID is unique
                    while final_id in used_ids:
                        max_id_number += 1
                        final_id = f"VI{max_id_number:03d}"
                    used_ids.add(final_id)

                vendor_object_id = ObjectId()
                vendor_data.update({
                    "_id": vendor_object_id,
                    "vendorId": str(vendor_object_id),
                    "randomId": final_id
                })

                batch.append(InsertOne(vendor_data))
                successful.append({
                    "row": idx,
                    "data": {
                        "randomId": final_id,
                        "vendorName": vendor_name,
                        **row
                    }
                })
                existing_vendors[vendor_key] = vendor_data
                inserted_count += 1

                if len(batch) >= 100:
                    collection.bulk_write(batch, ordered=False)
                    batch = []

            except Exception as e:
                failed.append({
                    "row": idx,
                    "data": row,
                    "error": f"Unexpected error: {str(e)}",
                    "missingFields": []
                })
                logger.error(f"Row {idx} error: {str(e)}")

        # Insert remaining batch
        if batch:
            collection.bulk_write(batch, ordered=False)

        # Update counter to the highest used ID
        set_counter_value(tenant_id,max_id_number)

        # Prepare response with vendor type validation info
        response = {
            "message": "CSV import processed successfully" if not failed else "CSV import completed with errors",
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "successful": successful,
            "updated": updated,
            "failed": failed,
            "errorCount": len(failed),
            "total_processed": inserted_count + updated_count + len(failed),
            "validVendorTypes": list(valid_vendor_types) if valid_vendor_types else []
        }
        logger.info(f"Import response: {response}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during CSV import: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/exportvendor/export-csv")
async def export_vendors_csv(  request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "vendors", "read"))):
    tenant_id = request.state.tenant_id
    
    """Export active vendors to a CSV file with user-friendly headers."""
    try:
        collection = get_vendor_collection(tenant_id)
        vendors = list(collection.find({"status": "active"}, {'_id': 0}))

        if not vendors:
            raise HTTPException(status_code=404, detail="No active vendors found to export")

        csv_stream = io.StringIO()
        fieldnames = list(HEADER_MAPPING.values())
        csv_writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        csv_writer.writeheader()

        ist = pytz.timezone('Asia/Kolkata')

        for vendor in vendors:
            row = {}
            for internal_field, friendly_field in HEADER_MAPPING.items():
                value = vendor.get(internal_field, "")
                if internal_field in ['createdDate', 'updatedDate'] and value and isinstance(value, datetime):
                    if value.tzinfo is None:
                        value = pytz.UTC.localize(value)
                    value = value.astimezone(ist).strftime('%d/%m/%Y')
                row[friendly_field] = value

            csv_writer.writerow(row)

        csv_stream.seek(0)
        filename = f"vendors_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            csv_stream,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        logger.error(f"Error exporting vendors to CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Error exporting vendors: {str(e)}")