import csv
from datetime import datetime, timedelta
import io
import logging
from typing import List
from fastapi import APIRouter, File, HTTPException, UploadFile,Depends
from bson import ObjectId
from fastapi.responses import StreamingResponse
from fastapi import Request
from pymongo import InsertOne, UpdateOne
import pytz
from .models import StorageLocation, StorageLocationPost
from utils.database import get_storagelocation_collection
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Header mapping for user-friendly CSV columns
header_mapping = {
    'Location ID': 'randomId',
    'Location': 'locationName',
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
async def set_counter_value(tenant_id: str,value: int):
    counter_collection = get_storagelocation_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "storageLocationId"},
        {"$set": {"sequence_value": value}},
        upsert=True
    )
    logger.info(f"Counter set to {value}")

async def get_next_counter_value(tenant_id: str):
    counter_collection = get_storagelocation_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one_and_update(
        {"_id": "storageLocationId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    if counter is None or "sequence_value" not in counter:
        await counter_collection.update_one(
            {"_id": "storageLocationId"},
            {"$set": {"sequence_value": 1}},
            upsert=True
        )
        logger.info("Counter initialized to 1")
        return 1
    logger.info(f"Counter incremented to {counter['sequence_value']}")
    return counter["sequence_value"]

async def reset_counter(tenant_id: str):
    counter_collection = get_storagelocation_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "storageLocationId"},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )
    logger.info("Counter reset to 0")

async def initialize_counter_if_needed(tenant_id: str):
    counter_collection = get_storagelocation_collection(tenant_id).database["counters"]
    storage_collection = get_storagelocation_collection(tenant_id)
    logger.info("Initializing counter")
    
    # Check if storagelocation collection is empty
    if await storage_collection.count_documents({}) == 0:
        logger.info("Storage collection empty, resetting counter")
        await reset_counter(tenant_id)
        return
    
    # If storagelocation collection is not empty, set counter based on highest randomId
    counter = await counter_collection.find_one({"_id": "storageLocationId"})
    if not counter:
        highest_location = await storage_collection.find_one(
            {"randomId": {"$regex": "^ST\\d+$"}},
            sort=[("randomId", -1)]
        )
        if highest_location:
            last_number = int(highest_location["randomId"][2:])
            logger.info(f"Found highest randomId: ST{last_number}, setting counter")
            await set_counter_value(tenant_id,last_number)
        else:
            logger.info("No valid randomId found, resetting counter")
            await reset_counter(tenant_id)

async def generate_random_id(tenant_id: str):
    counter_value = await get_next_counter_value(tenant_id)
    if counter_value < 1:
        logger.warning("Counter value less than 1, setting to 1")
        counter_value = 1
        await set_counter_value(tenant_id,1)
    random_id = f"ST{counter_value:03d}"
    logger.info(f"Generated randomId: {random_id}")
    return random_id

@router.post("/", response_model=str)
async def create_storagelocation(request: Request,storagelocation: StorageLocationPost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    logger.info("Creating new storage location")
    current_datetime = get_localized_datetime()
    await initialize_counter_if_needed(tenant_id)
    random_id = await generate_random_id(tenant_id)
    
    new_storagelocation_data = storagelocation.dict()
    new_storagelocation_data.update({
        'randomId': random_id,
        'status': 'active',
        'createdDate': current_datetime,
        'lastUpdatedDate': current_datetime
    })

    try:
        result = await collection.insert_one(new_storagelocation_data)
        logger.info(f"Storage location created with ID: {result.inserted_id}")
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Failed to create storage location: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create storage location: {str(e)}")

@router.get("/", response_model=List[StorageLocation])
async def get_all_storagelocation( request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    logger.info("Fetching all storage locations")
    storagelocations = await collection.find().to_list(None)
    formatted_storagelocations = []
    for storagelocation in storagelocations:
        storagelocation["storageLocationId"] = str(storagelocation["_id"])
        formatted_storagelocations.append(StorageLocation(**storagelocation))
    logger.info(f"Retrieved {len(formatted_storagelocations)} storage locations")
    return formatted_storagelocations

@router.patch("/{storageLocation_id}/deactivate")
async def deactivate_storagelocation(request: Request,
    storageLocation_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    """Deactivate a storage location - requires DELETE permission"""
    logger.info(f"Deactivating storage location with ID: {storageLocation_id}")
    current_datetime = get_localized_datetime()
    
    try:
        # Check if storage location exists
        existing_storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        if not existing_storagelocation:
            logger.warning(f"Storage location not found: {storageLocation_id}")
            raise HTTPException(status_code=404, detail="StorageLocation not found")

        # Update status to deactivated
        result = await collection.update_one(
            {"_id": ObjectId(storageLocation_id)},
            {"$set": {
                'status': 'deactivated',
                'lastUpdatedDate': current_datetime
            }}
        )
        
        if result.modified_count == 0:
            logger.warning(f"No changes made to storage location: {storageLocation_id}")
            raise HTTPException(status_code=500, detail="Failed to deactivate StorageLocation")

        # Return the updated storage location
        updated_storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        updated_storagelocation["storageLocationId"] = str(updated_storagelocation["_id"])
        del updated_storagelocation["_id"]
        
        logger.info(f"Storage location deactivated successfully: {storageLocation_id}")
        return StorageLocation(**updated_storagelocation)
        
    except Exception as e:
        logger.error(f"Failed to deactivate storage location: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID format or error: {str(e)}")

@router.patch("/{storageLocation_id}/activate")
async def activate_storagelocation(request: Request,
    storageLocation_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    """Activate a storage location - requires DELETE permission"""
    logger.info(f"Activating storage location with ID: {storageLocation_id}")
    current_datetime = get_localized_datetime()
    
    try:
        # Check if storage location exists
        existing_storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        if not existing_storagelocation:
            logger.warning(f"Storage location not found: {storageLocation_id}")
            raise HTTPException(status_code=404, detail="StorageLocation not found")

        # Update status to active
        result = await collection.update_one(
            {"_id": ObjectId(storageLocation_id)},
            {"$set": {
                'status': 'active',
                'lastUpdatedDate': current_datetime
            }}
        )
        
        if result.modified_count == 0:
            logger.warning(f"No changes made to storage location: {storageLocation_id}")
            raise HTTPException(status_code=500, detail="Failed to activate StorageLocation")

        # Return the updated storage location
        updated_storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        updated_storagelocation["storageLocationId"] = str(updated_storagelocation["_id"])
        del updated_storagelocation["_id"]
        
        logger.info(f"Storage location activated successfully: {storageLocation_id}")
        return StorageLocation(**updated_storagelocation)
        
    except Exception as e:
        logger.error(f"Failed to activate storage location: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID format or error: {str(e)}")
@router.get("/{storageLocation_id}", response_model=StorageLocation)
async def get_storagelocation_by_id(request: Request,storageLocation_id: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    logger.info(f"Fetching storage location with ID: {storageLocation_id}")
    try:
        storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        if storagelocation:
            storagelocation["storageLocationId"] = str(storagelocation["_id"])
            logger.info(f"Storage location found: {storagelocation['locationName']}")
            return StorageLocation(**storagelocation)
        else:
            logger.warning(f"Storage location not found: {storageLocation_id}")
            raise HTTPException(status_code=404, detail="StorageLocation not found")
    except Exception as e:
        logger.error(f"Error fetching storage location: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID format: {str(e)}")

@router.put("/{storageLocation_id}")
async def update_storagelocation(request: Request,storageLocation_id: str, storagelocation: StorageLocationPost, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    logger.info(f"Updating storage location with ID: {storageLocation_id}")
    current_datetime = get_localized_datetime()
    updated_storagelocation = storagelocation.dict(exclude_unset=True)
    updated_storagelocation.update({
        'lastUpdatedDate': current_datetime
    })
    
    try:
        result = await collection.update_one(
            {"_id": ObjectId(storageLocation_id)},
            {"$set": updated_storagelocation}
        )
        if result.modified_count == 0:
            logger.warning(f"Storage location not found or no changes made: {storageLocation_id}")
            raise HTTPException(status_code=404, detail="StorageLocation not found")
        logger.info(f"Storage location updated successfully: {storageLocation_id}")
        return {"message": "StorageLocation updated successfully"}
    except Exception as e:
        logger.error(f"Failed to update storage location: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID format or error: {str(e)}")

@router.patch("/{storageLocation_id}")
async def patch_storagelocation(request: Request,storageLocation_id: str, storagelocation_patch: StorageLocationPost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    logger.info(f"Patching storage location with ID: {storageLocation_id}")
    current_datetime = get_localized_datetime()
    
    try:
        existing_storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        if not existing_storagelocation:
            logger.warning(f"Storage location not found: {storageLocation_id}")
            raise HTTPException(status_code=404, detail="StorageLocation not found")

        updated_fields = {key: value for key, value in storagelocation_patch.dict(exclude_unset=True).items() if value is not None}
        if updated_fields:
            updated_fields.update({
                'lastUpdatedDate': current_datetime
            })
            result = await collection.update_one(
                {"_id": ObjectId(storageLocation_id)},
                {"$set": updated_fields}
            )
            if result.modified_count == 0:
                logger.warning(f"No changes made to storage location: {storageLocation_id}")
                raise HTTPException(status_code=500, detail="Failed to update StorageLocation")

        updated_storagelocation = await collection.find_one({"_id": ObjectId(storageLocation_id)})
        updated_storagelocation["_id"] = str(updated_storagelocation["_id"])
        logger.info(f"Storage location patched successfully: {storageLocation_id}")
        return updated_storagelocation
    except Exception as e:
        logger.error(f"Failed to patch storage location: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID format or error: {str(e)}")

@router.post("/import-csv")
async def import_storage_location_csv(request: Request,file: UploadFile = File(...), user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    """Import storage locations from a CSV file, requiring only locationName and handling optional fields."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    logger.info("Importing storage locations from CSV")
    try:
      
        current_datetime = get_localized_datetime()

        # Read and decode CSV content
        content = await file.read()
        decoded = content.decode('utf-8-sig', errors='replace')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        # Map headers to database fields
        headers = [header_mapping.get(header.strip(), header.strip()) for header in csv_reader.fieldnames or []]
        csv_reader.fieldnames = headers

        # Define required field
        required_fields = ['locationName']
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

        # Collect rows and track duplicates
        rows = []
        seen_names = {}
        seen_ids = {}
        for idx, row in enumerate(csv_reader, 1):
            cleaned_row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}
            rows.append((idx, cleaned_row))

            name = cleaned_row.get('locationName', '').lower()
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

        # Get existing locations by locationName and randomId
        existing_locations_by_name = {
            loc['locationName'].lower(): loc 
            async for loc in collection.find({}, {'locationName': 1, '_id': 1, 'randomId': 1, 'status': 1})
        }
        existing_locations_by_id = {
            loc['randomId']: loc 
            async for loc in collection.find({"randomId": {"$regex": "^ST\\d+$"}}, {'locationName': 1, '_id': 1, 'randomId': 1, 'status': 1})
        }
        used_ids = set(await collection.distinct("randomId", {"randomId": {"$regex": "^ST\\d+$"}}))

        await initialize_counter_if_needed(tenant_id)
        max_id_number = 0  # Track highest ID used
        for loc in existing_locations_by_id.values():
            if loc['randomId'].startswith('ST') and loc['randomId'][2:].isdigit():
                max_id_number = max(max_id_number, int(loc['randomId'][2:]))

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
                        "data": {
                            "randomId": row.get('randomId', ''),
                            "locationName": row.get('locationName', ''),
                            "status": row.get('status', 'active'),
                            "createdDate": row.get('createdDate', ''),
                            "lastUpdatedDate": row.get('lastUpdatedDate', '')
                        },
                        "error": "Missing required fields",
                        "missingFields": [header_mapping.get(field, field) for field in missing_fields]
                    })
                    continue

                location_name = row.get('locationName')
                # Check for duplicate locationName in CSV
                if location_name.lower() in seen_names and len(seen_names[location_name.lower()]) > 1:
                    failed.append({
                        "row": idx,
                        "data": {
                            "randomId": row.get('randomId', ''),
                            "locationName": location_name,
                            "status": row.get('status', 'active'),
                            "createdDate": row.get('createdDate', ''),
                            "lastUpdatedDate": row.get('lastUpdatedDate', '')
                        },
                        "error": f"Duplicate Location in CSV: '{location_name}'",
                        "missingFields": []
                    })
                    continue

                # Validate status
                status = row.get('status', 'active').lower()
                if status not in ['active', 'deactivated']:
                    logger.warning(f"Row {idx}: Invalid status '{status}', defaulting to 'active'")
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
                            "data": {
                                "randomId": row.get('randomId', ''),
                                "locationName": location_name,
                                "status": status,
                                "createdDate": row.get('createdDate', ''),
                                "lastUpdatedDate": row.get('lastUpdatedDate', '')
                            },
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
                            "data": {
                                "randomId": row.get('randomId', ''),
                                "locationName": location_name,
                                "status": status,
                                "createdDate": row.get('createdDate', ''),
                                "lastUpdatedDate": row.get('lastUpdatedDate', '')
                            },
                            "error": "Invalid Updated Date format: must be DD-MM-YYYY",
                            "missingFields": []
                        })
                        continue

                provided_id = row.get('randomId', '').strip()
                assigned_id = None

                # Handle randomId
                if provided_id:
                    if not (provided_id.startswith('ST') and provided_id[2:].isdigit()):
                        failed.append({
                            "row": idx,
                            "data": {
                                "randomId": provided_id,
                                "locationName": location_name,
                                "status": status,
                                "createdDate": row.get('createdDate', ''),
                                "lastUpdatedDate": row.get('lastUpdatedDate', '')
                            },
                            "error": f"Invalid randomId format: '{provided_id}'. Must be 'ST' followed by digits.",
                            "missingFields": []
                        })
                        continue
                    # Check for duplicate randomId in CSV
                    if provided_id in seen_ids and seen_ids[provided_id][0] != idx:
                        failed.append({
                            "row": idx,
                            "data": {
                                "randomId": provided_id,
                                "locationName": location_name,
                                "status": status,
                                "createdDate": row.get('createdDate', ''),
                                "lastUpdatedDate": row.get('lastUpdatedDate', '')
                            },
                            "error": f"Duplicate randomId in CSV: '{provided_id}'. First used in row {seen_ids[provided_id][0]}.",
                            "missingFields": []
                        })
                        continue
                    # Check if randomId exists in the database
                    if provided_id in existing_locations_by_id:
                        existing_location = existing_locations_by_id[provided_id]
                        # Update existing record
                        update_data = {
                            'locationName': location_name,
                            'status': status,
                            'lastUpdatedDate': last_updated_date
                        }
                        if row.get('createdDate'):
                            update_data['createdDate'] = created_date
                        batch.append(UpdateOne(
                            {'_id': existing_location['_id']},
                            {'$set': update_data}
                        ))
                        updated.append({
                            "row": idx,
                            "data": {
                                "randomId": provided_id,
                                "locationName": location_name,
                                "status": status,
                                "createdDate": created_date.strftime('%d-%m-%Y'),
                                "lastUpdatedDate": last_updated_date.strftime('%d-%m-%Y')
                            },
                            "message": f"Location updated for randomId: '{provided_id}'"
                        })
                        updated_count += 1
                        max_id_number = max(max_id_number, int(provided_id[2:]))
                        # Update existing_locations_by_name to prevent duplicate name errors
                        if existing_location['locationName'].lower() != location_name.lower():
                            del existing_locations_by_name[existing_location['locationName'].lower()]
                            existing_locations_by_name[location_name.lower()] = existing_location
                        continue
                    # Valid, unused randomId from CSV
                    assigned_id = provided_id
                    used_ids.add(assigned_id)
                    max_id_number = max(max_id_number, int(assigned_id[2:]))
                else:
                    # Generate new randomId
                    assigned_id = await generate_random_id(tenant_id)
                    used_ids.add(assigned_id)
                    max_id_number = max(max_id_number, int(assigned_id[2:]))

                # Check for duplicate locationName in the database
                if location_name.lower() in existing_locations_by_name:
                    existing_location = existing_locations_by_name[location_name.lower()]
                    if existing_location['randomId'] != assigned_id:
                        failed.append({
                            "row": idx,
                            "data": {
                                "randomId": provided_id,
                                "locationName": location_name,
                                "status": status,
                                "createdDate": row.get('createdDate', ''),
                                "lastUpdatedDate": row.get('lastUpdatedDate', '')
                            },
                            "error": f"Location '{location_name}' already exists with randomId: '{existing_location['randomId']}'",
                            "missingFields": []
                        })
                        continue

                # Create new record
                location_data = {
                    'locationName': location_name,
                    'randomId': assigned_id,
                    'status': status,
                    'createdDate': created_date,
                    'lastUpdatedDate': last_updated_date
                }

                batch.append(InsertOne(location_data))
                successful.append({
                    "row": idx,
                    "data": {
                        "randomId": assigned_id,
                        "locationName": location_name,
                        "status": status,
                        "createdDate": created_date.strftime('%d-%m-%Y'),
                        "lastUpdatedDate": last_updated_date.strftime('%d-%m-%Y')
                    },
                    "assignedId": assigned_id
                })
                existing_locations_by_name[location_name.lower()] = location_data
                existing_locations_by_id[assigned_id] = location_data
                inserted_count += 1

                if len(batch) >= 500:
                    await collection.bulk_write(batch, ordered=False)
                    batch = []

            except Exception as e:
                logger.error(f"Row {idx}: Error processing row - {str(e)}")
                failed.append({
                    "row": idx,
                    "data": {
                        "randomId": row.get('randomId', ''),
                        "locationName": location_name,
                        "status": status,
                        "createdDate": row.get('createdDate', ''),
                        "lastUpdatedDate": row.get('lastUpdatedDate', '')
                    },
                    "error": f"Unexpected error: {str(e)}",
                    "missingFields": []
                })
                continue

        if batch:
            await collection.bulk_write(batch, ordered=False)

        # Set counter to the highest used ID
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
        logger.info(f"CSV import completed: {response['message']}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.get("/exportstoragelocation/export-csv")
async def export_storage_locations_to_csv(request: Request, user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "storagelocation", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_storagelocation_collection(tenant_id)

    logger.info("Exporting storage locations to CSV")
    try:
       
        records = await collection.find(
            {"status": "active"},
            {'_id': 0}
        ).to_list(None)
        
        if not records:
            logger.warning("No active storage locations found to export")
            raise HTTPException(status_code=404, detail="No active storage locations found to export")

        csv_stream = io.StringIO()
        user_friendly_fieldnames = list(header_mapping.keys())
        writer = csv.DictWriter(csv_stream, fieldnames=user_friendly_fieldnames)
        writer.writeheader()

        for record in records:
            transformed_record = {}
            for user_friendly_field, db_field in header_mapping.items():
                value = record.get(db_field, '')
                if db_field in ['createdDate', 'lastUpdatedDate'] and isinstance(value, datetime):
                    value = value.strftime('%d-%m-%Y')
                transformed_record[user_friendly_field] = value
            
            writer.writerow(transformed_record)
        
        csv_stream.seek(0)
        logger.info("Storage locations exported successfully")
        return StreamingResponse(
            csv_stream,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=storage_locations_export.csv"}
        )
    
    except Exception as e:
        logger.error(f"Error exporting storage locations: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting storage locations: {str(e)}")