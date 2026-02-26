from datetime import datetime, timedelta
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, File, UploadFile,Depends,Request
from bson import ObjectId
from fastapi.responses import StreamingResponse
import pytz
import csv
import io
from pydantic import BaseModel
from pymongo import InsertOne, UpdateOne
from ItemGroup.models import ItemGroup, ItemGroupPost
from utils.database import get_itemgroup_collection
from dependencies.auth import validate_token
# ✅ IMPORT PERMISSION MIDDLEWARE
from middlewares.permission_middleware import check_permission

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Header mapping for user-friendly CSV columns
header_mapping = {
    'Item Group ID': 'randomId',
    'Item Group': 'itemgroupName',
    'Status': 'status',
    'Created Date': 'createdDate',
    'Updated Date': 'lastUpdatedDate'
}

def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    adjusted_time = localized_now + timedelta(hours=5, minutes=30)
    return adjusted_time.astimezone(pytz.UTC)

async def set_counter_value(tenant_id:str,value: int, counter_id: str = "itemgroupId"):
    """Set the counter value in the database."""
    counter_collection = get_itemgroup_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": counter_id},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

async def get_current_counter_value(tenant_id:str,counter_id: str = "itemgroupId"):
    """Get the current counter value from the database."""
    counter_collection = get_itemgroup_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one({"_id": counter_id})
    return counter["sequence_value"] if counter else 0

async def initialize_counter_if_needed(tenant_id:str,counter_id: str = "itemgroupId"):
    """Initialize counter to the highest existing ID number (IGxxx)."""
    collection = get_itemgroup_collection(tenant_id)
    counter_collection = collection.database["counters"]

    highest_item = await collection.find_one(
        {"randomId": {"$regex": "^IG\\d+$"}},
        sort=[("randomId", -1)]
    )

    if highest_item:
        try:
            last_number = int(highest_item["randomId"][2:])
        except (ValueError, TypeError):
            last_number = 0
            logger.warning(f"Malformed randomId found: {highest_item['randomId']}")
        await counter_collection.update_one(
            {"_id": counter_id},
            {"$set": {"sequence_value": last_number}},
            upsert=True
        )
    else:
        await counter_collection.update_one(
            {"_id": counter_id},
            {"$set": {"sequence_value": 0}},
            upsert=True
        )

async def generate_sequential_id(tenant_id:str,used_ids: set = None):
    """Generate an IGxxx ID, filling gaps in the sequence, considering used_ids."""
    collection = get_itemgroup_collection(tenant_id)
    counter_collection = collection.database["counters"]

    await initialize_counter_if_needed(tenant_id)
    counter = await counter_collection.find_one({"_id": "itemgroupId"})
    current_counter = counter["sequence_value"] if counter else 0

    # Find all existing IGxxx IDs in the database
    existing_ids = await collection.find(
        {"randomId": {"$regex": "^IG\\d+$"}},
        {"randomId": 1}
    ).to_list(None)
    id_numbers = set()
    for item in existing_ids:
        try:
            if item["randomId"].startswith("IG"):
                num = int(item["randomId"][2:])
                id_numbers.add(num)
        except (ValueError, TypeError):
            continue

    # Include used_ids from CSV if provided
    if used_ids:
        for rid in used_ids:
            try:
                if rid.startswith("IG") and rid[2:].isdigit():
                    num = int(rid[2:])
                    id_numbers.add(num)
            except (ValueError, TypeError):
                continue

    # Find the first available gap or next number
    next_number = 1
    if id_numbers:
        sorted_ids = sorted(id_numbers)
        for i in range(len(sorted_ids)):
            if sorted_ids[i] > i + 1:
                next_number = i + 1
                break
        else:
            next_number = sorted_ids[-1] + 1

    # Ensure we don't go below current counter
    next_number = max(next_number, current_counter + 1)

    # Update the counter atomically
    await counter_collection.update_one(
        {"_id": "itemgroupId"},
        {"$set": {"sequence_value": next_number}},
        upsert=True
    )

    return f"IG{next_number:03d}"

@router.post("/reset-counter")
async def reset_sequence(request:Request):
    """Reset the counter to 0. Next ID will be IG001."""
    tenant_id = request.state.tenant_id
    await set_counter_value(tenant_id,0)
    return {"message": "Counter reset successfully. Next ID will be IG001"}

@router.get("/export-csv")
async def export_all_itemgroups_to_csv(request:Request):
    """Export active item groups to a CSV file."""
    tenant_id = request.state.tenant_id
    try:
        logger.info("Received request for /itemgroups/export-csv")
        collection = get_itemgroup_collection(tenant_id)
        records = await collection.find({"status": "active"}, {'_id': 0}).to_list(None)
        
        if not records:
            logger.warning("No active item groups found for export")
            raise HTTPException(status_code=404, detail="No active item groups found to export")

        csv_stream = io.StringIO()
        fieldnames = list(header_mapping.keys())
        writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        writer.writeheader()

        ist = pytz.timezone('Asia/Kolkata')

        for record in records:
            created_date = record.get('createdDate')
            created_str = ""
            if created_date and isinstance(created_date, datetime):
                if created_date.tzinfo is None:
                    created_date = pytz.UTC.localize(created_date)
                created_date_ist = created_date.astimezone(ist)
                created_str = created_date_ist.strftime('%d-%m-%Y')

            last_updated_date = record.get('lastUpdatedDate')
            updated_str = ""
            if last_updated_date and isinstance(last_updated_date, datetime):
                if last_updated_date.tzinfo is None:
                    last_updated_date = pytz.UTC.localize(last_updated_date)
                last_updated_date_ist = last_updated_date.astimezone(ist)
                updated_str = last_updated_date_ist.strftime('%d-%m-%Y')

            writer.writerow({
                'Item Group ID': record.get('randomId', ''),
                'Item Group': record.get('itemgroupName', ''),
                'Status': record.get('status', ''),
                'Created Date': created_str,
                'Updated Date': updated_str
            })

        csv_stream.seek(0)
        filename = f"item_groups_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        logger.info(f"Successfully generated CSV file: {filename}")
        return StreamingResponse(
            csv_stream,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException as he:
        logger.error(f"HTTPException in export-csv: {he.detail}", exc_info=True)
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in export-csv: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting item groups: {str(e)}")

@router.post("/import-csv")
async def import_csv_data(request:Request,file: UploadFile = File(...)):
    tenant_id = request.state.tenant_id
    """Import item groups from a CSV file, preserving valid randomIds and handling duplicates."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    try:
        collection = get_itemgroup_collection(tenant_id)
        current_datetime = get_localized_datetime()

        content = await file.read()
        decoded = content.decode('utf-8-sig', errors='replace')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        headers = [header_mapping.get(header.strip(), header.strip()) for header in csv_reader.fieldnames or []]
        csv_reader.fieldnames = headers

        required_fields = ['itemgroupName']
        missing_headers = [header for header in required_fields if header not in headers]
        if missing_headers:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Missing required headers in CSV file",
                    "missing": [header_mapping.get(field, field) for field in missing_headers],
                    "required": [header_mapping.get(field, field) for field in required_fields]
                }
            )

        rows = []
        seen_names = {}
        seen_ids = {}
        for idx, row in enumerate(csv_reader, 1):
            cleaned_row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}
            rows.append((idx, cleaned_row))

            name = cleaned_row.get('itemgroupName', '').lower()
            if name:
                if name in seen_names:
                    seen_names[name].append(idx)
                else:
                    seen_names[name] = [idx]

            random_id = cleaned_row.get('randomId', '').strip()
            if random_id:
                if random_id in seen_ids:
                    seen_ids[random_id].append(idx)
                else:
                    seen_ids[random_id] = [idx]

        # Get existing groups by randomId and itemgroupName
        existing_groups_by_name = {g['itemgroupName'].lower(): g for g in await collection.find({}, {'itemgroupName': 1, '_id': 1, 'randomId': 1, 'status': 1}).to_list(None)}
        existing_groups_by_id = {g['randomId']: g for g in await collection.find({"randomId": {"$regex": "^IG\\d+$"}}, {'itemgroupName': 1, '_id': 1, 'randomId': 1, 'status': 1}).to_list(None)}
        used_ids = set(await collection.distinct("randomId", {"randomId": {"$regex": "^IG\\d+$"}}))

        await initialize_counter_if_needed(tenant_id)
        max_id_number = await get_current_counter_value(tenant_id)

        inserted_count = 0
        updated_count = 0
        successful = []
        updated = []
        failed = []
        batch = []

        for idx, row in rows:
            try:
                # Validate required fields
                missing_fields = [field for field in required_fields if not row.get(field)]
                if missing_fields:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": "Missing required fields",
                        "missingFields": [header_mapping.get(field, field) for field in missing_fields]
                    })
                    continue

                itemgroup_name = row.get('itemgroupName')
                # Check for duplicate itemgroupName in CSV
                if itemgroup_name.lower() in seen_names and len(seen_names[itemgroup_name.lower()]) > 1:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Duplicate Item Group in CSV: '{itemgroup_name}'",
                        "missingFields": []
                    })
                    continue

                # Validate status
                status = row.get('status', 'active').lower()
                if status not in ['active', 'inactive']:
                    status = 'active'

                # Parse dates
                created_date = current_datetime
                if row.get('createdDate'):
                    try:
                        created_date_ist = datetime.strptime(row['createdDate'], '%d-%m-%Y')
                        created_date_ist = pytz.timezone('Asia/Kolkata').localize(created_date_ist)
                        created_date = created_date_ist.astimezone(pytz.UTC)
                    except ValueError:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": "Invalid Created Date format: must be DD-MM-YYYY",
                            "missingFields": []
                        })
                        continue

                last_updated_date = current_datetime
                if row.get('lastUpdatedDate'):
                    try:
                        last_updated_date_ist = datetime.strptime(row['lastUpdatedDate'], '%d-%m-%Y')
                        last_updated_date_ist = pytz.timezone('Asia/Kolkata').localize(last_updated_date_ist)
                        last_updated_date = last_updated_date_ist.astimezone(pytz.UTC)
                    except ValueError:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": "Invalid Updated Date format: must be DD-MM-YYYY",
                            "missingFields": []
                        })
                        continue

                provided_id = row.get('randomId', '').strip()
                assigned_id = None

                # Handle randomId
                if provided_id:
                    if not (provided_id.startswith('IG') and provided_id[2:].isdigit()):
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Invalid randomId format: '{provided_id}'. Must be 'IG' followed by digits.",
                            "missingFields": []
                        })
                        continue
                    # Check for duplicate randomId in CSV
                    if provided_id in seen_ids and seen_ids[provided_id][0] != idx:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Duplicate randomId in CSV: '{provided_id}'. First used in row {seen_ids[provided_id][0]}.",
                            "missingFields": []
                        })
                        continue
                    # Check if randomId exists in the database
                    if provided_id in existing_groups_by_id:
                        existing_group = existing_groups_by_id[provided_id]
                        # Update existing record
                        update_data = {
                            'itemgroupName': itemgroup_name,
                            'status': status,
                            'lastUpdatedDate': last_updated_date
                        }
                        if row.get('createdDate'):
                            update_data['createdDate'] = created_date
                        batch.append(UpdateOne(
                            {'_id': existing_group['_id']},
                            {'$set': update_data}
                        ))
                        updated.append({
                            "row": idx,
                            "data": row,
                            "message": f"Item Group updated for randomId: '{provided_id}'"
                        })
                        updated_count += 1
                        max_id_number = max(max_id_number, int(provided_id[2:]))
                        # Update existing_groups_by_name to prevent duplicate name errors
                        if existing_group['itemgroupName'].lower() != itemgroup_name.lower():
                            del existing_groups_by_name[existing_group['itemgroupName'].lower()]
                            existing_groups_by_name[itemgroup_name.lower()] = existing_group
                        continue
                    # Valid, unused randomId from CSV
                    assigned_id = provided_id
                    used_ids.add(assigned_id)
                    max_id_number = max(max_id_number, int(assigned_id[2:]))
                else:
                    # Generate sequential ID for rows without a valid randomId
                    assigned_id = await generate_sequential_id(tenant_id,used_ids)
                    used_ids.add(assigned_id)
                    max_id_number = max(max_id_number, int(assigned_id[2:]))

                # Check for duplicate itemgroupName in the database
                if itemgroup_name.lower() in existing_groups_by_name:
                    existing_group = existing_groups_by_name[itemgroup_name.lower()]
                    if existing_group['randomId'] != assigned_id:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Item Group '{itemgroup_name}' already exists with randomId: '{existing_group['randomId']}'",
                            "missingFields": []
                        })
                        continue

                # Create new record
                group_data = {
                    'itemgroupName': itemgroup_name,
                    'randomId': assigned_id,
                    'status': status,
                    'createdDate': created_date,
                    'lastUpdatedDate': last_updated_date
                }

                batch.append(InsertOne(group_data))
                successful.append({
                    "row": idx,
                    "data": row,
                    "assignedId": assigned_id
                })
                existing_groups_by_name[itemgroup_name.lower()] = group_data
                existing_groups_by_id[assigned_id] = group_data
                inserted_count += 1

                if len(batch) >= 500:
                    await collection.bulk_write(batch, ordered=False)
                    batch = []

            except Exception as e:
                failed.append({
                    "row": idx,
                    "data": row,
                    "error": f"Unexpected error: {str(e)}",
                    "missingFields": []
                })
                logger.error(f"Row {idx} error: {str(e)}")

        if batch:
            await collection.bulk_write(batch, ordered=False)

        await set_counter_value(tenant_id,max_id_number)

        response = {
            "message": "CSV import processed successfully" if not failed else "CSV import completed with errors",
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "successful": successful,
            "updated": updated,
            "failed": failed,
            "errorCount": len(failed),
            "max_id_number": max_id_number
        }
        logger.info(f"Import response: {response}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/", response_model=str)
async def create_itemgroup(request:Request,itemgroup: ItemGroupPost,
   user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemgroup", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_itemgroup_collection(tenant_id)
    """Create a new item group with a sequential ID."""
    current_datetime = get_localized_datetime()

    await initialize_counter_if_needed(tenant_id)
    sequential_id = await generate_sequential_id(tenant_id)

    new_itemgroup_data = itemgroup.dict()
    new_itemgroup_data.update({
        'randomId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime,
        'lastUpdatedDate': current_datetime
    })

    result = await collection.insert_one(new_itemgroup_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[ItemGroup])
async def get_all_itemgroup(request:Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemgroup", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_itemgroup_collection(tenant_id)
    """Get all item groups."""
    itemgroups = await collection.find().to_list(None)
    formatted_itemgroup = [
        {**item, "itemgroupId": str(item["_id"])} for item in itemgroups
    ]
    return [ItemGroup(**item) for item in formatted_itemgroup]

@router.get("/{itemgroup_id}", response_model=ItemGroup)
async def get_itemgroup_by_id(request:Request,itemgroup_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemgroup", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_itemgroup_collection(tenant_id)
    """Get a specific item group by ID."""
    try:
        logger.info(f"Received request for /itemgroups/{itemgroup_id}")
        itemgroup = await collection.find_one({"_id": ObjectId(itemgroup_id)})
        if itemgroup:
            itemgroup["itemgroupId"] = str(itemgroup["_id"])
            return ItemGroup(**itemgroup)
        raise HTTPException(status_code=404, detail=f"Itemgroup not found: {itemgroup_id}")
    except Exception as e:
        logger.error(f"Invalid itemgroupId format: {itemgroup_id}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid itemgroupId format: {itemgroup_id}, must be a 24-character hexadecimal string")

@router.put("/{itemgroup_id}")
async def update_itemgroup(request:Request,itemgroup_id: str, itemgroup: ItemGroupPost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemgroup", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_itemgroup_collection(tenant_id)
    """Replace an existing item group."""
    try:
        current_datetime = get_localized_datetime()
        updated_itemgroup = itemgroup.dict(exclude_unset=True)
        updated_itemgroup.update({
            'lastUpdatedDate': current_datetime
        })

        result = await collection.update_one(
            {"_id": ObjectId(itemgroup_id)},
            {"$set": updated_itemgroup}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail=f"Itemgroup not found: {itemgroup_id}")
        return {"message": "Itemgroup updated successfully"}
    except Exception as e:
        logger.error(f"Invalid itemgroupId format: {itemgroup_id}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid itemgroupId format: {itemgroup_id}, must be a 24-character hexadecimal string")

@router.patch("/{itemgroup_id}", response_model=ItemGroup)
async def patch_itemgroup(request:Request,itemgroup_id: str, itemgroup_patch: ItemGroupPost,
   user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "itemgroup", "edit")) ):
    tenant_id = request.state.tenant_id
  
    """Update specific fields of an existing item group."""
    try:
        current_datetime = get_localized_datetime()
        collection = get_itemgroup_collection(tenant_id)

        # Validate ObjectId
        try:
            oid = ObjectId(itemgroup_id)
        except Exception:
            logger.error(f"Invalid itemgroupId format: {itemgroup_id}")
            raise HTTPException(status_code=400, detail="Invalid itemgroupId format: must be a 24-character hexadecimal string")

        # Check if item group exists
        existing_itemgroup = await collection.find_one({"_id": oid})
        if not existing_itemgroup:
            logger.info(f"Itemgroup not found: {itemgroup_id}")
            raise HTTPException(status_code=404, detail="Itemgroup not found")

        # Prepare update fields
        updated_fields = {
            key: value
            for key, value in itemgroup_patch.dict(exclude_unset=True).items()
            if value is not None
        }
        if not updated_fields:
            logger.info(f"No fields to update for itemgroup: {itemgroup_id}")
            return ItemGroup(**{**existing_itemgroup, "itemgroupId": str(existing_itemgroup["_id"])})

        updated_fields.update({"lastUpdatedDate": current_datetime})

        # Perform update
        result = await collection.update_one({"_id": oid}, {"$set": updated_fields})
        if result.modified_count == 0:
            logger.warning(f"No changes applied to itemgroup: {itemgroup_id}")
            # Still return the unchanged itemgroup
            return ItemGroup(**{**existing_itemgroup, "itemgroupId": str(existing_itemgroup["_id"])})

        # Fetch updated document
        updated_itemgroup = await collection.find_one({"_id": oid})
        if not updated_itemgroup:
            logger.error(f"Failed to retrieve updated itemgroup: {itemgroup_id}")
            raise HTTPException(status_code=500, detail="Failed to retrieve updated itemgroup")

        # Convert ObjectId to string and return as ItemGroup model
        updated_itemgroup["itemgroupId"] = str(updated_itemgroup["_id"])
        logger.info(f"Itemgroup updated successfully: {itemgroup_id}")
        return ItemGroup(**updated_itemgroup)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating itemgroup {itemgroup_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    
@router.patch("/{itemgroup_id}/status")
async def update_itemgroup_status(
    request: Request,
    itemgroup_id: str,
    status_data: dict,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","itemgroup","delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_itemgroup_collection(tenant_id)

    oid = ObjectId(itemgroup_id)

    result = await collection.update_one(
        {"_id": oid},
        {"$set": {"status": status_data.get("status")}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Itemgroup not found")

    return {"message": "Status updated"}
