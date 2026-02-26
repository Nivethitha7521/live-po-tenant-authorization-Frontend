import csv
from datetime import datetime, timedelta
import io
from fastapi import Request

import logging
from typing import List
from fastapi import APIRouter, File, HTTPException, UploadFile,Depends,Request
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pymongo import InsertOne, UpdateOne
import pytz
from .models import ItemType, ItemTypePost
from utils.database import get_itemtype_collection
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
router = APIRouter()
item_group_counter = 0

def get_current_date_and_time():
    # Get current time in UTC (simplified, as IST + 5:30 seems unusual)
    return datetime.now(pytz.UTC)

async def get_next_counter_value(tenant_id:str):
    counter_collection = get_itemtype_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one_and_update(
        {"_id": "itemtypeId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

async def reset_counter(tenant_id:str):
    counter_collection = get_itemtype_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "itemtypeId"},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )

async def initialize_counter_if_needed(tenant_id:str):
    """Initialize counter to match highest existing ITxxx ID"""
    counter_collection = get_itemtype_collection(tenant_id).database["counters"]
    collection = get_itemtype_collection(tenant_id)
    
    # Find the highest existing ITxxx ID in the collection
    highest_item = await collection.find_one(
        {"randomId": {"$regex": "^IT\\d+$"}},
        sort=[("randomId", -1)]
    )
    
    if highest_item:
        # Extract the numeric part and set counter
        last_number = int(highest_item["randomId"][2:])
        await counter_collection.update_one(
            {"_id": "itemtypeId"},
            {"$set": {"sequence_value": last_number}},
            upsert=True
        )
    else:
        # No existing records, start from 0
        await counter_collection.update_one(
            {"_id": "itemtypeId"},
            {"$set": {"sequence_value": 0}},
            upsert=True
        )

async def generate_sequential_id(tenant_id:str):
    """Generate sequential ITxxx IDs without gaps"""
    counter_collection = get_itemtype_collection(tenant_id).database["counters"]
    
    # Atomic operation to increment and get next value
    counter = await counter_collection.find_one_and_update(
        {"_id": "itemtypeId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return f"IT{counter['sequence_value']:03d}"

async def generate_random_id(tenant_id:str):
    counter_value = await get_next_counter_value(tenant_id)
    return f"IT{counter_value:03d}"

async def set_counter_value(tenant_id:str,value: int):
    counter_collection = get_itemtype_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "itemtypeId"},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

@router.post("/", response_model=str)
async def create_itemtype(itemtype: ItemTypePost,request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    current_datetime = get_current_date_and_time()
    
    # Initialize counter if needed
    await initialize_counter_if_needed(tenant_id)

    # Generate sequential ID
    sequential_id = await generate_sequential_id(tenant_id)

    # Prepare data including randomId
    new_itemtype_data = itemtype.dict()
    new_itemtype_data.update({
        'randomId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime
    })
    
    result = await collection.insert_one(new_itemtype_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[ItemType])
async def get_all_itemtype(request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "itemtype", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    itemtypes = [item async for item in collection.find()]
    formatted_itemtype = []
    for itemtype in itemtypes:
        itemtype["itemtypeId"] = str(itemtype["_id"])
        formatted_itemtype.append(ItemType(**itemtype))
    return formatted_itemtype

@router.get("/{itemtype_id}", response_model=ItemType)
async def get_itemtype_by_id(request: Request,itemtype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    itemtype = await collection.find_one({"_id": ObjectId(itemtype_id)})
    if itemtype:
        itemtype["itemtypeId"] = str(itemtype["_id"])
        return ItemType(**itemtype)
    else:
        raise HTTPException(status_code=404, detail="Itemtype not found")

@router.put("/{itemtype_id}")
async def update_itemtype(request: Request,itemtype_id: str, itemtype: ItemTypePost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    current_datetime = get_current_date_and_time()
    updated_itemtype = itemtype.dict(exclude_unset=True)
    updated_itemtype.update({
        'lastUpdatedDate': current_datetime
    })
    result = await collection.update_one(
        {"_id": ObjectId(itemtype_id)}, 
        {"$set": updated_itemtype}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Itemtype not found")
    return {"message": "Itemtype updated successfully"}

@router.patch("/{itemtype_id}")
async def patch_itemtype(request: Request,itemtype_id: str, itemtype_patch: ItemTypePost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    current_datetime = get_current_date_and_time()
    existing_itemtype = await collection.find_one({"_id": ObjectId(itemtype_id)})
    if not existing_itemtype:
        raise HTTPException(status_code=404, detail="Itemtype not found")

    updated_fields = {key: value for key, value in itemtype_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields.update({
            'lastUpdatedDate': current_datetime
        })
        result = await collection.update_one(
            {"_id": ObjectId(itemtype_id)}, 
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Itemtype")

    updated_itemtype = await collection.find_one({"_id": ObjectId(itemtype_id)})
    updated_itemtype["_id"] = str(updated_itemtype["_id"])
    return updated_itemtype

@router.post("/import-csv")
async def import_csv_data(request: Request,file: UploadFile = File(...),
                          user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "add"))):
    tenant_id = request.state.tenant_id
  
    try:
        collection = get_itemtype_collection(tenant_id)
        current_datetime = get_current_date_and_time()

        content = await file.read()
        try:
            decoded = content.decode("utf-8-sig").splitlines()
            csv_reader = csv.DictReader(decoded)
            csv_data = list(csv_reader)
        except Exception as e:
            logging.error(f"Invalid CSV file: {str(e)}")
            return {
                "message": f"Invalid CSV file: {str(e)}",
                "detail": {"message": f"Unable to parse CSV: {str(e)}"},
                "inserted_count": 0,
                "updated_count": 0,
                "successful": [],
                "failed": [],
                "errorCount": 0,
            }

        # Validate required headers: accept 'Item Type' or 'itemtypeName'
        valid_headers = ["Item Type", "itemtypeName"]
        found_header = None
        for header in valid_headers:
            if header in csv_reader.fieldnames:
                found_header = header
                break

        if not found_header:
            logging.error("Missing required CSV header: 'Item Type' or 'itemtypeName'")
            return {
                "message": "Missing required CSV header",
                "detail": {
                    "message": "Required header 'Item Type' or 'itemtypeName' not found",
                    "missing": ["Item Type or itemtypeName"],
                },
                "inserted_count": 0,
                "updated_count": 0,
                "successful": [],
                "failed": [],
                "errorCount": 0,
            }

        await initialize_counter_if_needed(tenant_id)
        operations = []
        new_count = 0
        updated_count = 0
        successful = []
        failed = []
        seen_names = set()
        existing_names = {item['itemtypeName'].lower().strip() async for item in collection.find({}, {'itemtypeName': 1})}

        for row_idx, row in enumerate(csv_data, start=1):  # Start at 1 for user-facing row numbers
            item_name = row.get(found_header, '').strip()
            if not item_name:
                failed.append({
                    "row": row_idx,
                    "data": {
                        "itemtypeName": item_name,
                        "ID": row.get("ID", ""),
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": row.get("Status", ""),
                        "Created Date": row.get("Created Date", ""),
                        "Updated Date": row.get("Updated Date", ""),
                    },
                    "error": "Item type name is empty",
                })
                logging.info(f"Row {row_idx}: Failed - Empty item type name")
                continue

            normalized_name = item_name.lower().strip()
            row_id = row.get("ID", "").strip()
            existing_item = None
            # Only check for existing item if row_id is a valid ITxxx format
            if row_id and row_id.startswith("IT") and row_id[2:].isdigit():
                existing_item = await collection.find_one({"randomId": row_id})
                logging.info(f"Row {row_idx}: Checked for existing item with ID {row_id}, found: {bool(existing_item)}")
            else:
                logging.info(f"Row {row_idx}: Invalid or missing ID '{row_id}', treating as new item")

            if normalized_name in seen_names or (normalized_name in existing_names and not existing_item):
                failed.append({
                    "row": row_idx,
                    "data": {
                        "itemtypeName": item_name,
                        "ID": row_id,
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": row.get("Status", ""),
                        "Created Date": row.get("Created Date", ""),
                        "Updated Date": row.get("Updated Date", ""),
                    },
                    "error": "Duplicate item type name",
                })
                logging.info(f"Row {row_idx}: Failed - Duplicate item type name '{item_name}'")
                continue

            # Validate status
            status = row.get("Status", "active").lower()
            if status not in ["active", "inactive"]:
                failed.append({
                    "row": row_idx,
                    "data": {
                        "itemtypeName": item_name,
                        "ID": row_id,
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": status,
                        "Created Date": row.get("Created Date", ""),
                        "Updated Date": row.get("Updated Date", ""),
                    },
                    "error": "Invalid status value (must be 'active' or 'inactive')",
                })
                logging.info(f"Row {row_idx}: Failed - Invalid status '{status}'")
                continue

            if existing_item:
                # Update existing item
                operations.append(UpdateOne(
                    {"randomId": row_id},
                    {"$set": {
                        "itemtypeName": item_name,
                        "status": status,
                        "lastUpdatedDate": current_datetime,
                    }}
                ))
                updated_count += 1
                successful.append({
                    "row": row_idx,
                    "data": {
                        "itemtypeName": item_name,
                        "randomId": row_id,
                        "ID": row_id,
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": status,
                        "Created Date": row.get("Created Date", ""),
                        "Updated Date": current_datetime.isoformat(),
                    },
                    "action": "updated"
                })
                logging.info(f"Row {row_idx}: Updated item with randomId {row_id}")
            else:
                # Insert new item
                sequential_id = await generate_sequential_id(tenant_id)
                operations.append(InsertOne({
                    "itemtypeName": item_name,
                    "status": status,
                    "randomId": sequential_id,
                    "itemtypeId": sequential_id,
                    "createdDate": current_datetime,
                }))
                new_count += 1
                successful.append({
                    "row": row_idx,
                    "data": {
                        "itemtypeName": item_name,
                        "randomId": sequential_id,
                        "ID": row_id,
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": status,
                        "Created Date": row.get("Created Date", ""),
                        "Updated Date": "",
                    },
                    "action": "inserted"
                })
                logging.info(f"Row {row_idx}: Inserted item with randomId {sequential_id}")
            seen_names.add(normalized_name)
            existing_names.add(normalized_name)

        if operations:
            result = await collection.bulk_write(operations)
            logging.info(f"Bulk write completed: {result.inserted_count} inserted, {result.modified_count} modified")

        return {
            "message": f"Import completed: {new_count} inserted, {updated_count} updated, {len(failed)} errors",
            "inserted_count": new_count,
            "updated_count": updated_count,
            "successful": successful,
            "failed": [],
            "errorCount": len(failed),
        }

    except Exception as e:
        logging.error(f"Import error: {str(e)}", exc_info=True)
        return {
            "message": "Import failed",
            "detail": {"message": f"Server error: {str(e)}"},
            "inserted_count": 0,
            "updated_count": 0,
            "successful": [],
            "failed": [],
            "errorCount": 1,
        }

@router.get("/export-itemtype/export-csv")
async def export_all_item_type_to_csv(request: Request, user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "itemtype", "read"))):
    tenant_id = request.state.tenant_id
   
    try:
        collection = get_itemtype_collection(tenant_id)
        records = [item async for item in collection.find(
            {"status": "active"}, 
            {'_id': 0, 'randomId': 1, 'itemtypeName': 1, 'status': 1, 'createdDate': 1, 'lastUpdatedDate': 1}
        )]
        
        if not records:
            raise HTTPException(status_code=404, detail="No active item type found to export")

        csv_stream = io.StringIO()
        fieldnames = ['S.No', 'ID', 'Item Type', 'Created Date', 'Updated Date', 'Status']
        writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        writer.writeheader()

        for index, record in enumerate(records, 1):
            writer.writerow({
                'S.No': index,
                'ID': record.get('randomId', ''),
                'Item Type': record.get('itemtypeName', ''),
                'Created Date': record.get('createdDate', '').strftime('%d-%m-%Y') if record.get('createdDate') else '',
                'Updated Date': record.get('lastUpdatedDate', '').strftime('%d-%m-%Y') if record.get('lastUpdatedDate') else '',
                'Status': record.get('status', ''),
            })
        
        csv_stream.seek(0)
        return StreamingResponse(
            csv_stream, 
            media_type="text/csv", 
            headers={"Content-Disposition": "attachment; filename=active_itemtype_export.csv"}
        )
    
    except Exception as e:
        logging.error(f"Error exporting itemtype: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting itemtype: {str(e)}")
    

@router.delete("/{itemtype_id}")
async def delete_itemtype(request: Request,
    itemtype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    """Soft delete an item type (change status to deactivated)."""
    current_datetime = get_current_date_and_time()
    
    result = await collection.update_one(
        {"_id": ObjectId(itemtype_id)},
        {"$set": {
            'status': 'deactivated',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Itemtype not found")
    return {"message": "Itemtype deactivated successfully"}

# ✅ ADD ACTIVATE ENDPOINT FOR HIDE FUNCTIONALITY
@router.patch("/{itemtype_id}/activate")
async def activate_itemtype(request: Request,
    itemtype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemtype", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_itemtype_collection(tenant_id)
    """Activate an item type (change status to active)."""
    current_datetime = get_current_date_and_time()
    
    result = await collection.update_one(
        {"_id": ObjectId(itemtype_id)},
        {"$set": {
            'status': 'active',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Itemtype not found")
    
    # Return the updated item type
    updated_itemtype = await collection.find_one({"_id": ObjectId(itemtype_id)})
    if updated_itemtype:
        updated_itemtype["itemtypeId"] = str(updated_itemtype["_id"])
        del updated_itemtype["_id"]
        return ItemType(**updated_itemtype)
    
    raise HTTPException(status_code=404, detail="Itemtype not found after update")