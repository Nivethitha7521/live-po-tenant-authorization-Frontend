from datetime import datetime
import io
import csv
import logging
import re
from fastapi import Request
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Form, HTTPException, Query, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from bson import ObjectId
from pydantic import BaseModel, ValidationError
import pytz
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token

from utils.database import get_inventory_collection, get_itemgroup_collection, get_purchaseitem_collection, get_revert_collection
from utils.database import get_storagelocation_collection
from utils.database import get_itemtype_collection
from utils.database import get_purchasecategory_collection
from utils.database import get_purchasesubcategory_collection
from utils.database import get_purchasetax_collection
from utils.database import get_purchaseuom_collection

from .models import PurchaseItem, PurchaseItemPost
from .utils import (
    CSVImportValidator,
    find_max_random_id,
    get_current_counter_value,
    get_current_date_and_time,
    get_next_counter_value,
    initialize_counter_if_needed,
    reset_counter, 
    set_counter_value, 
    generate_random_id, 
    process_row,
)

router = APIRouter()

# User-friendly header mapping for CSV import/export
HEADER_MAPPING = {
    "randomId": "Item Id",
    "itemCode": "Item Code",
    "itemName": "Item Name",
    "purchasecategoryName": "Category",
    "purchasesubcategoryName": "Subcategory",
    "itemgroupName": "Item Group",
    "uom": "UOM",
    "stockQuantity": "Stock Quantity",
    "supplier": "Supplier",
    "purchasePrice": "Purchase Price",
    "purchasetaxName": "Tax Rate",
    "reorderLevel": "Reorder Level",
    "itemType": "Item Type",  # This will be the display name
    "hsnCode": "HSN Code",
    "shelfLife": "Shelf Life",
    "vendorTag": "Vendor Tags",
    "locationName": "Location",
    "barcode": "Barcode",
    "description": "Description",
    "createdDate": "Created Date",
    "lastUpdatedDate": "Last Updated Date",
    "status": "Status"
}

REVERSE_HEADER_MAPPING = {v: k for k, v in HEADER_MAPPING.items()}

class PaginatedPurchaseItemsResponse(BaseModel):
    items: List[PurchaseItem]
    totalItems: int
    currentPage: int
    pageSize: int

class PurchaseItemSummary(BaseModel):
    purchaseitemId: str
    itemName: str

class PurchaseItemWithStockResponse(BaseModel):
    purchaseitemId: str
    itemName: str
    itemCode: Optional[str] = None
    randomId: str
    purchasePrice: float
    purchasetaxName: int
    uom: Optional[str] = None
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[str] = None
    hsnCode: Optional[str] = None
    itemTypeId: Optional[str] = None  # Store the ID
    itemType: Optional[str] = None     # Store the name for display
    availableStock: int = 0
    locationId: Optional[str] = None

class SearchWithStockResponse(BaseModel):
    total: int
    items: List[PurchaseItemWithStockResponse]

@router.post("/", response_model=str)
async def create_purchaseitem(
    request: Request,
    purchaseitem_data: PurchaseItemPost,
    user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "add"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    try:
        # Initialize counter if needed
        initialize_counter_if_needed(tenant_id)
        
        # Find the maximum existing randomId to ensure proper counter value
        max_id = find_max_random_id(tenant_id)
        current_counter = get_current_counter_value(tenant_id)
        
        # Synchronize counter with max_id if necessary
        if max_id >= current_counter:
            set_counter_value(tenant_id, max_id + 1)
            current_counter = max_id + 1
            logging.info(f"Counter synchronized from {current_counter} to {max_id + 1}")
        
        # Generate randomId
        random_id = f"PI{current_counter:03d}"
        
        # Prepare data for insertion
        new_purchaseitem_data = purchaseitem_data.dict()
        new_purchaseitem_data.update({
            'randomId': random_id,
            'createdDate': get_current_date_and_time()['datetime'],
            'status': 'active'
        })
        
        # Insert document
        result = collection.insert_one(new_purchaseitem_data)
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to insert purchase item")
        
        # Increment counter after successful insertion
        set_counter_value(tenant_id, current_counter + 1)
        
        return random_id
    except Exception as e:
        logging.error(f"Error creating purchase item: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/search-with-stock", response_model=SearchWithStockResponse)
async def search_items_with_stock(
    request: Request,
    itemName: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "read"))
):
    tenant_id = request.state.tenant_id
    purchase_collection = get_purchaseitem_collection(tenant_id)
    inventory_collection = get_inventory_collection()
    itemtype_collection = get_itemtype_collection(tenant_id)

    try:
        # Build query based on input parameters
        query = {}
        if itemName:
            escaped_itemName = re.escape(itemName)
            query['itemName'] = {"$regex": escaped_itemName, "$options": "i"}
            
        # Get total count for pagination info
        total = purchase_collection.count_documents(query)
            
        # Fetch items with pagination
        cursor = purchase_collection.find(query).skip(skip).limit(limit)
        
        # Get all randomIds from purchase items
        purchase_items = list(cursor)
        random_ids = [str(item.get("randomId")) for item in purchase_items if item.get("randomId")]
        
        # Fetch inventory stock for all randomIds in one query
        inventory_map = {}
        if random_ids:
            inventory_cursor = inventory_collection.find({"randomId": {"$in": random_ids}})
            for inv in inventory_cursor:
                inventory_map[inv.get("randomId")] = {
                    "systemStock": inv.get("systemStock", 0),
                    "locationId": inv.get("locationId", "")
                }
        
        # Fetch item types for lookup if needed
        itemtypes_by_randomid = {}
        async for itemtype in itemtype_collection.find({"status": "active"}):
            itemtypes_by_randomid[itemtype["randomId"]] = itemtype["itemtypeName"]
        
        # Format items with stock information
        formatted_items = []
        validation_errors = 0
        skipped_items = 0
        
        for item in purchase_items:
            try:
                item_data = dict(item)
                item_data["purchaseitemId"] = str(item_data.pop("_id"))
                random_id = item_data.get("randomId")
                
                # Add stock information from inventory map
                if random_id and random_id in inventory_map:
                    item_data["availableStock"] = inventory_map[random_id]["systemStock"]
                    item_data["locationId"] = inventory_map[random_id]["locationId"]
                else:
                    item_data["availableStock"] = 0
                    item_data["locationId"] = None
                
                # Handle missing or null fields with defaults
                if item_data.get("itemCode") is None:
                    item_data["itemCode"] = ""
                
                if item_data.get("itemName") is None:
                    item_data["itemName"] = ""
                
                if item_data.get("randomId") is None:
                    item_data["randomId"] = ""
                
                if item_data.get("purchasetaxName") is None:
                    item_data["purchasetaxName"] = 0
                
                # Handle itemType fields
                if "itemTypeId" not in item_data or item_data["itemTypeId"] is None:
                    item_data["itemTypeId"] = ""
                
                # If itemType (display name) is missing but we have itemTypeId, try to get it
                if ("itemType" not in item_data or not item_data["itemType"]) and item_data["itemTypeId"]:
                    item_data["itemType"] = itemtypes_by_randomid.get(item_data["itemTypeId"], "")
                
                if "itemType" not in item_data or item_data["itemType"] is None:
                    item_data["itemType"] = ""
                
                # Convert hsnCode to string if it's a number or handle null
                if "hsnCode" in item_data:
                    if item_data["hsnCode"] is None:
                        item_data["hsnCode"] = ""
                    elif isinstance(item_data["hsnCode"], (int, float)):
                        item_data["hsnCode"] = str(item_data["hsnCode"])
                
                # Validate purchasePrice
                if item_data.get("purchasePrice") is None:
                    item_data["purchasePrice"] = 0.0
                elif not isinstance(item_data["purchasePrice"], (int, float)):
                    try:
                        item_data["purchasePrice"] = float(item_data["purchasePrice"])
                    except (ValueError, TypeError):
                        item_data["purchasePrice"] = 0.0
                
                # Validate with model
                validated_item = PurchaseItemWithStockResponse(**item_data)
                formatted_items.append(validated_item)
                
            except ValidationError as ve:
                logging.warning(f"Validation error for item {item.get('_id')}: {ve}")
                validation_errors += 1
                continue
            except Exception as e:
                logging.warning(f"Unexpected error processing item {item.get('_id')}: {e}")
                skipped_items += 1
                continue
        
        if validation_errors > 0 or skipped_items > 0:
            logging.warning(f"Search completed with {validation_errors} validation errors and {skipped_items} skipped items")
        
        return {
            "total": total,
            "items": formatted_items
        }
        
    except Exception as e:
        logging.error(f"Error occurred while fetching purchase items with stock: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    
@router.get("/", response_model=Dict)
async def get_all_items(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=5000),
    itemName: Optional[str] = Query(None),
    purchasecategoryName: Optional[str] = Query(None),
    purchasesubcategoryName: Optional[str] = Query(None),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)
    itemtype_collection = get_itemtype_collection(tenant_id)

    try:
        # Build match stage for aggregation
        match_stage = {}
        if itemName:
            match_stage["itemName"] = {"$regex": itemName, "$options": "i"}
        if purchasecategoryName:
            match_stage["purchasecategoryName"] = {"$regex": purchasecategoryName, "$options": "i"}
        if purchasesubcategoryName:
            match_stage["purchasesubcategoryName"] = {"$regex": purchasesubcategoryName, "$options": "i"}

        # Get total count before pagination
        total_count = collection.count_documents(match_stage)

        # Fetch all item types for lookup
        itemtypes_by_randomid = {}
        async for itemtype in itemtype_collection.find({"status": "active"}):
            itemtypes_by_randomid[itemtype["randomId"]] = itemtype["itemtypeName"]

        # Use aggregation pipeline for proper numeric sorting
        pipeline = []
        if match_stage:
            pipeline.append({"$match": match_stage})
        
        pipeline.extend([
            {
                "$addFields": {
                    "numericId": {
                        "$toInt": {"$substr": ["$randomId", 2, -1]}
                    }
                }
            },
            {"$sort": {"numericId": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {"$unset": "numericId"}
        ])
        
        # Execute aggregation
        cursor = collection.aggregate(pipeline)
        purchaseitems = list(cursor)

        # Format the fetched data
        formatted_items = []
        for item in purchaseitems:
            item["purchaseitemId"] = str(item["_id"])
            
            # Ensure itemType fields are present
            if "itemTypeId" not in item:
                item["itemTypeId"] = ""
            
            # If itemType (display name) is missing but we have itemTypeId, try to get it
            if ("itemType" not in item or not item.get("itemType")) and item.get("itemTypeId"):
                item["itemType"] = itemtypes_by_randomid.get(item["itemTypeId"], "")
            
            if "itemType" not in item or item["itemType"] is None:
                item["itemType"] = ""
            
            if "purchasetaxName" in item and isinstance(item["purchasetaxName"], float):
                item["purchasetaxName"] = round(item["purchasetaxName"])
            
            formatted_items.append(PurchaseItem(**item))

        return {
            "items": formatted_items,
            "totalItems": total_count
        }

    except Exception as e:
        logging.error(f"Error occurred while fetching purchase items: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/getAll", response_model=Dict)
async def get_all_items_without_pagination(
    request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    try:
        # Aggregation pipeline (no filters, no skip/limit)
        pipeline = [
            {
                "$addFields": {
                    "numericId": {
                        "$toInt": {"$substr": ["$randomId", 2, -1]}
                    }
                }
            },
            {"$sort": {"numericId": -1}},
            {"$unset": "numericId"}
        ]

        # Execute aggregation
        cursor = collection.aggregate(pipeline)
        purchaseitems = list(cursor)

        # Format the fetched data
        formatted_items = []
        for item in purchaseitems:
            item["purchaseitemId"] = str(item["_id"])
            
            # Ensure itemType fields are present
            if "itemTypeId" not in item:
                item["itemTypeId"] = ""
            if "itemType" not in item:
                item["itemType"] = item.get("itemTypeId", "")
            
            if "purchasetaxName" in item and isinstance(item["purchasetaxName"], float):
                item["purchasetaxName"] = round(item["purchasetaxName"])
            
            formatted_items.append(PurchaseItem(**item))

        return {
            "items": formatted_items,
            "totalItems": len(formatted_items)
        }

    except Exception as e:
        logging.error(f"Error occurred while fetching all purchase items: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/exact-name/", response_model=List[PurchaseItemSummary])
async def get_items_by_exact_name(
    request: Request,
    item_name: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    try:
        collection = get_purchaseitem_collection(tenant_id)
        query = {}
        if item_name:
            # Change from exact match to partial match
            query["itemName"] = {"$regex": re.escape(item_name), "$options": "i"}
        
        total = collection.count_documents(query)
        if skip >= total and total > 0:
            return []

        items_cursor = collection.find(
            query,
            {"_id": 1, "itemName": 1}
        ).skip(skip).limit(limit)

        all_items = [
            {"purchaseitemId": str(item["_id"]), "itemName": item["itemName"]}
            for item in items_cursor
        ]

        return all_items

    except Exception as e:
        logging.error(f"Error occurred while fetching items: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.put("/{purchaseitem_id}")
async def update_purchaseitem(
    request: Request,
    purchaseitem_id: str, 
    purchaseitem_data: PurchaseItemPost,
    user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    try:
        updated_purchaseitem = purchaseitem_data.dict(exclude_unset=True)
        current_date_and_time = get_current_date_and_time()
        updated_purchaseitem['lastUpdatedDate'] = current_date_and_time['datetime']

        result = collection.replace_one({"_id": ObjectId(purchaseitem_id)}, updated_purchaseitem)
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="PurchaseItem not found")
        
        return {"message": "PurchaseItem updated successfully"}
    
    except Exception as e:
        logging.error(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.patch("/{purchaseitem_id}/deactivate")
async def deactivate_purchaseitem(
    request: Request,
    purchaseitem_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    """Deactivate a purchase item (soft delete)"""
    try:
        current_datetime = get_current_date_and_time()['datetime']
        
        result = collection.update_one(
            {"_id": ObjectId(purchaseitem_id)},
            {"$set": {
                'status': 'deactivated',
                'lastUpdatedDate': current_datetime
            }}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="PurchaseItem not found")
        
        return {"message": "PurchaseItem deactivated successfully"}
    except Exception as e:
        logging.error(f"Error deactivating purchase item: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.patch("/{purchaseitem_id}/activate")
async def activate_purchaseitem(
    request: Request,
    purchaseitem_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    """Activate a purchase item"""
    try:
        current_datetime = get_current_date_and_time()['datetime']
        
        result = collection.update_one(
            {"_id": ObjectId(purchaseitem_id)},
            {"$set": {
                'status': 'active',
                'lastUpdatedDate': current_datetime
            }}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="PurchaseItem not found")
        
        return {"message": "PurchaseItem activated successfully"}
    except Exception as e:
        logging.error(f"Error activating purchase item: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.patch("/{purchaseitem_id}")
async def patch_purchaseitem(
    request: Request,
    purchaseitem_id: str, 
    purchaseitem_patch: PurchaseItemPost,
    user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)

    try:
        if not ObjectId.is_valid(purchaseitem_id):
            raise HTTPException(status_code=400, detail="Invalid purchaseitem ID format")
             
        existing_purchaseitem = collection.find_one({"_id": ObjectId(purchaseitem_id)})
        if not existing_purchaseitem:
            raise HTTPException(status_code=404, detail="PurchaseItem not found")

        updated_fields = purchaseitem_patch.dict(exclude_unset=True)
        if not updated_fields:
            raise HTTPException(status_code=400, detail="No fields to update provided")
        
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']
        
        result = collection.update_one(
            {"_id": ObjectId(purchaseitem_id)},
            {"$set": updated_fields}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update PurchaseItem")

        updated_purchaseitem = collection.find_one({"_id": ObjectId(purchaseitem_id)})
        return PurchaseItem(**updated_purchaseitem)
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error occurred while patching PurchaseItem: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/import_csv")
async def import_purchase_items_from_csv(
    request: Request,
    file: UploadFile = File(...), 
    mode: str = Form("merge"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "read"))
):
    tenant_id = request.state.tenant_id
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

        # Initialize collections and counter
        initialize_counter_if_needed(tenant_id)
        main_collection = get_purchaseitem_collection(tenant_id)
        revert_collection = get_revert_collection(tenant_id)
        current_datetime = get_current_date_and_time()['datetime']

        # Get all master data collections for validation
        itemgroup_collection = get_itemgroup_collection(tenant_id)
        purchasecategory_collection = get_purchasecategory_collection(tenant_id)
        purchasesubcategory_collection = get_purchasesubcategory_collection(tenant_id)
        purchasetax_collection = get_purchasetax_collection(tenant_id)
        purchaseuom_collection = get_purchaseuom_collection(tenant_id)
        itemtype_collection = get_itemtype_collection(tenant_id)
        storagelocation_collection = get_storagelocation_collection(tenant_id)

        # Fetch all master data for validation
        itemgroups = {item["itemgroupName"].lower(): item for item in await itemgroup_collection.find({"status": "active"}).to_list(None)}
        categories = {item["purchasecategoryName"].lower(): item for item in await purchasecategory_collection.find({"status": "active"}).to_list(None)}
        subcategories = {item["purchasesubcategoryName"].lower(): item for item in await purchasesubcategory_collection.find({"status": "active"}).to_list(None)}
        taxes = {str(item["purchasetaxPercentage"]): item for item in await purchasetax_collection.find({"status": "active"}).to_list(None)}
        uoms = {item["uom"].lower(): item for item in await purchaseuom_collection.find({"status": "active"}).to_list(None)}
        
        # Item types - store by name for lookup, but use randomId for ID field
        itemtypes_by_name = {}
        itemtypes_by_randomid = {}
        async for item in itemtype_collection.find({"status": "active"}):
            itemtypes_by_name[item["itemtypeName"].lower()] = item
            itemtypes_by_randomid[item["randomId"]] = item
        
        storagelocations = {item["locationName"].lower(): item for item in await storagelocation_collection.find({"status": "active"}).to_list(None)}

        # Synchronize counter with max randomId
        max_id = find_max_random_id(tenant_id)
        current_counter = get_current_counter_value(tenant_id)
        if max_id >= current_counter:
            set_counter_value(tenant_id, max_id + 1)
            current_counter = max_id + 1
            logging.info(f"Counter synchronized from {current_counter} to {max_id + 1}")

        # Handle rollback mode
        if mode.lower() == "rollback":
            return await handle_rollback(main_collection, revert_collection, tenant_id)

        # Read and process CSV file
        contents = await file.read()
        decoded = contents.decode('utf-8', errors='replace')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        # Map CSV headers
        headers = [REVERSE_HEADER_MAPPING.get(header.strip(), header.strip()) for header in csv_reader.fieldnames or []]
        csv_reader.fieldnames = headers

        # Define required fields
        required_fields = ['itemName', 'itemgroupName', 'purchasePrice', 'uom', 'purchasetaxName']

        # Check for missing required headers
        missing_headers = [HEADER_MAPPING.get(field, field) for field in required_fields if field not in headers]
        if missing_headers:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Missing required columns in CSV file",
                    "missing": missing_headers,
                    "required": [HEADER_MAPPING.get(field, field) for field in required_fields],
                    "successful": [],
                    "updated": [],
                    "failed": [{"row": 0, "data": {}, "error": "Missing required columns", "missingFields": missing_headers}],
                    "error_count": 1
                }
            )

        inserted_count = 0
        updated_count = 0
        successful = []
        failed = []
        updated = []
        batch = []
        seen_item_names = set()
        seen_item_codes = set()
        seen_random_ids = set()

        if mode.lower() == "replace":
            if main_collection.count_documents({}) > 0:
                revert_collection.delete_many({})
                main_collection.aggregate([{"$match": {}}, {"$out": "revertpurchaseitems"}])
            main_collection.delete_many({})
            reset_counter(tenant_id, 1)
            current_counter = 1

        for idx, row in enumerate(csv_reader, 1):
            try:
                row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}

                # Check for missing required fields
                missing_fields = [field for field in required_fields if not row.get(field)]
                if missing_fields:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Missing required fields: {', '.join([HEADER_MAPPING.get(field, field) for field in missing_fields])}",
                        "missingFields": missing_fields
                    })
                    continue

                # Validate master data references
                validation_errors = []
                
                # Validate item group
                item_group = row.get("itemgroupName", "").strip().lower()
                if item_group and item_group not in itemgroups:
                    validation_errors.append(f"Item Group '{row.get('itemgroupName')}' not found in master data")
                elif item_group:
                    row["itemgroupName"] = itemgroups[item_group]["itemgroupName"]
                
                # Validate category
                category = row.get("purchasecategoryName", "").strip().lower()
                if category and category not in categories:
                    validation_errors.append(f"Category '{row.get('purchasecategoryName')}' not found in master data")
                elif category:
                    row["purchasecategoryName"] = categories[category]["purchasecategoryName"]
                
                # Validate subcategory
                subcategory = row.get("purchasesubcategoryName", "").strip().lower()
                if subcategory and subcategory not in subcategories:
                    validation_errors.append(f"Subcategory '{row.get('purchasesubcategoryName')}' not found in master data")
                elif subcategory:
                    row["purchasesubcategoryName"] = subcategories[subcategory]["purchasesubcategoryName"]
                
                # Validate tax
                tax = row.get("purchasetaxPercentage", "").strip()
                if tax and tax not in taxes:
                    validation_errors.append(f"Tax Rate '{row.get('purchasetaxPercentage')}' not found in master data")
                elif tax:
                    row["purchasetaxName"] = str(taxes[tax]["purchasetaxPercentage"])
                
                # Validate UOM
                uom = row.get("uom", "").strip().lower()
                if uom and uom not in uoms:
                    validation_errors.append(f"UOM '{row.get('uom')}' not found in master data")
                elif uom:
                    row["uom"] = uoms[uom]["uom"]
                
                # Validate item type - store randomId in itemTypeId and name in itemType
                item_type_name = row.get("itemType", "").strip()
                if item_type_name:
                    item_type_name_lower = item_type_name.lower()
                    if item_type_name_lower not in itemtypes_by_name:
                        validation_errors.append(f"Item Type '{item_type_name}' not found in master data")
                    else:
                        item_type_obj = itemtypes_by_name[item_type_name_lower]
                        row["itemTypeId"] = item_type_obj["randomId"]  # Store the randomId (e.g., "IT001")
                        row["itemType"] = item_type_obj["itemtypeName"]  # Store the name
                else:
                    row["itemTypeId"] = ""
                    row["itemType"] = ""
                
                # Validate storage location
                location = row.get("locationName", "").strip().lower()
                if location and location not in storagelocations:
                    validation_errors.append(f"Location '{row.get('locationName')}' not found in master data")
                elif location:
                    row["locationName"] = storagelocations[location]["locationName"]
                
                if validation_errors:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": "; ".join(validation_errors),
                        "missingFields": []
                    })
                    continue

                item_name = row.get("itemName", "").strip()
                item_code = row.get("itemCode", "").strip()
                random_id = row.get("randomId", "").strip()

                # Check for duplicate itemName
                item_name_lower = item_name.lower()
                if item_name_lower in seen_item_names:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Duplicate Item Name: '{item_name}' already exists",
                        "missingFields": []
                    })
                    continue
                if mode.lower() == "merge":
                    if main_collection.find_one({"itemName": {"$regex": f"^{item_name}$", "$options": "i"}}):
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Duplicate Item Name: '{item_name}' already exists",
                            "missingFields": []
                        })
                        continue

                # Generate or validate randomId independently
                if random_id:
                    if not (random_id.startswith("PI") and random_id[2:].isdigit()):
                        random_id = ""
                    else:
                        if random_id in seen_random_ids:
                            failed.append({
                                "row": idx,
                                "data": row,
                                "error": f"Duplicate Item Id: '{random_id}' already exists",
                                "missingFields": []
                            })
                            continue
                        if mode.lower() == "merge":
                            if main_collection.find_one({"randomId": random_id}):
                                failed.append({
                                    "row": idx,
                                    "data": row,
                                    "error": f"Duplicate Item Id: '{random_id}' already exists",
                                    "missingFields": []
                                })
                                continue
                if not random_id:
                    random_id = f"PI{current_counter:03d}"

                # Check for duplicate itemCode if provided
                if item_code:
                    item_code_lower = item_code.lower()
                    if item_code_lower in seen_item_codes:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Duplicate Item Code: '{item_code}' already exists",
                            "missingFields": []
                        })
                        continue
                    if mode.lower() == "merge":
                        if main_collection.find_one({"itemCode": {"$regex": f"^{item_code}$", "$options": "i"}}):
                            failed.append({
                                "row": idx,
                                "data": row,
                                "error": f"Duplicate Item Code: '{item_code}' already exists",
                                "missingFields": []
                            })
                            continue
                else:
                    item_code = ""

                # Validate row
                validator = CSVImportValidator()
                validation_errors = validator.validate_row(row)
                if validation_errors:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": "; ".join([f"{field}: {msg}" for field, msg in validation_errors.items()]),
                        "missingFields": list(validation_errors.keys())
                    })
                    continue

                # Process row
                item_data = process_row(row, current_datetime, random_id)
                if not item_data:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": "Failed to process row data",
                        "missingFields": []
                    })
                    continue

                # Update item_data with itemCode and itemType fields
                item_data["itemCode"] = item_code
                item_data["itemTypeId"] = row.get("itemTypeId", "")  # This will be the randomId like "IT001"
                item_data["itemType"] = row.get("itemType", "")      # This will be the display name

                # Prepare for bulk insert
                item_object_id = ObjectId()
                item_data.update({
                    "_id": item_object_id,
                    "purchaseitemId": str(item_object_id)
                })
                batch.append(item_data)
                successful.append({
                    "row": idx,
                    "data": row
                })
                seen_item_names.add(item_name_lower)
                if item_code:
                    seen_item_codes.add(item_code_lower)
                seen_random_ids.add(random_id)
                current_counter += 1

                if len(batch) >= 100:
                    main_collection.insert_many(batch)
                    inserted_count += len(batch)
                    set_counter_value(tenant_id, current_counter)
                    batch = []

            except ValueError as e:
                failed.append({
                    "row": idx,
                    "data": row,
                    "error": f"Invalid data format: {str(e)}",
                    "missingFields": []
                })
            except Exception as e:
                failed.append({
                    "row": idx,
                    "data": row,
                    "error": f"Unexpected error: {str(e)}",
                    "missingFields": []
                })

        if batch:
            main_collection.insert_many(batch)
            inserted_count += len(batch)
            set_counter_value(tenant_id, current_counter)

        response = {
            "message": "CSV import processed successfully" if not failed else "CSV import completed with errors",
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "successful": successful,
            "updated": updated,
            "failed": failed,
            "mode": mode,
            "error_count": len(failed)
        }

        return response

    except HTTPException as e:
        raise
    except Exception as e:
        logging.error(f"Error during CSV import: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

def parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%d/%m/%Y').replace(tzinfo=pytz.UTC)
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=pytz.UTC)
        except ValueError:
            return None

async def handle_rollback(main_collection, revert_collection, tenant_id):
    revert_data = list(revert_collection.find({}))
    if not revert_data:
        raise HTTPException(status_code=400, detail="No backup data to revert")

    max_counter = 0
    documents_to_restore = []

    for doc in revert_data:
        doc.pop('_id', None)
        if 'randomId' in doc and doc['randomId'].startswith("PI"):
            try:
                current_id = int(doc['randomId'][2:])
                max_counter = max(max_counter, current_id)
            except ValueError:
                pass
        documents_to_restore.append(doc)

    main_collection.delete_many({})
    if documents_to_restore:
        main_collection.insert_many(documents_to_restore)
        set_counter_value(tenant_id, max_counter + 1 if max_counter > 0 else 1)

    revert_collection.delete_many({})
    return {
        "message": f"Rollback {len(documents_to_restore)} items successfully",
        "restored_count": len(documents_to_restore),
        "mode": "rollback"
    }

@router.get("/purchaseitemexport/export_csv")
async def export_all_purchase_items_to_csv(
    request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseitem", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)
    try:
        purchaseitems = list(collection.find())
        if not purchaseitems:
            raise HTTPException(status_code=404, detail="No purchase items found")

        csv_stream = io.StringIO()
        fieldnames = list(HEADER_MAPPING.keys())
        if "purchaseitemId" in fieldnames:
            fieldnames.remove("purchaseitemId")

        csv_writer = csv.DictWriter(csv_stream, fieldnames=[HEADER_MAPPING[field] for field in fieldnames])
        csv_writer.writeheader()

        for item in purchaseitems:
            row = {}
            for field in fieldnames:
                if field == "vendorTag":
                    vendor_tags = item.get(field, [])
                    if not isinstance(vendor_tags, list):
                        if vendor_tags is None:
                            vendor_tags = []
                        elif isinstance(vendor_tags, str):
                            vendor_tags = vendor_tags.split(",")
                        else:
                            vendor_tags = [str(vendor_tags)]
                    row[HEADER_MAPPING[field]] = ",".join(vendor_tags)
                elif field == "itemType":
                    # Export the display name, not the ID
                    row[HEADER_MAPPING[field]] = item.get("itemType", "")
                elif field in ("createdDate", "lastUpdatedDate"):
                    date_value = item.get(field)
                    if isinstance(date_value, datetime):
                        row[HEADER_MAPPING[field]] = date_value.strftime('%d/%m/%Y')
                    else:
                        row[HEADER_MAPPING[field]] = ""
                else:
                    row[HEADER_MAPPING[field]] = item.get(field, "")
            csv_writer.writerow(row)

        csv_stream.seek(0)
        response = StreamingResponse(
            iter([csv_stream.getvalue()]),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = "attachment; filename=purchase_items.csv"
        return response

    except Exception as e:
        logging.error(f"Error occurred during CSV export: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")