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
from FreightMaster.models import Freight, FreightPost
from utils.database import get_freight_collection
from dependencies.auth import validate_token
# ADD PERMISSION IMPORTS
from middlewares.permission_middleware import check_permission

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Header mapping for user-friendly CSV columns
header_mapping = {
    'Freight ID': 'randomId',
    'Freight': 'freightName',
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

async def set_counter_value(tenant_id:str,value: int, counter_id: str = "freightId"):
    """Set the counter value in the database."""
    counter_collection = get_freight_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": counter_id},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

async def get_current_counter_value(tenant_id:str,counter_id: str = "freightId"):
    """Get the current counter value from the database."""
    counter_collection = get_freight_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one({"_id": counter_id})
    return counter["sequence_value"] if counter else 0

async def initialize_counter_if_needed(tenant_id:str,counter_id: str = "freightId"):
    """Initialize counter to the highest existing ID number (FRxxx)."""
    collection = get_freight_collection(tenant_id)
    counter_collection = collection.database["counters"]

    highest_item = await collection.find_one(
        {"randomId": {"$regex": "^FR\\d+$"}},
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
    """Generate an FRxxx ID, filling gaps in the sequence, considering used_ids."""
    collection = get_freight_collection(tenant_id)
    counter_collection = collection.database["counters"]

    await initialize_counter_if_needed(tenant_id)
    counter = await counter_collection.find_one({"_id": "freightId"})
    current_counter = counter["sequence_value"] if counter else 0

    # Find all existing FRxxx IDs in the database
    existing_ids = await collection.find(
        {"randomId": {"$regex": "^FR\\d+$"}},
        {"randomId": 1}
    ).to_list(None)
    id_numbers = set()
    for item in existing_ids:
        try:
            if item["randomId"].startswith("FR"):
                num = int(item["randomId"][2:])
                id_numbers.add(num)
        except (ValueError, TypeError):
            continue

    # Include used_ids from CSV if provided
    if used_ids:
        for rid in used_ids:
            try:
                if rid.startswith("FR") and rid[2:].isdigit():
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
        {"_id": "freightId"},
        {"$set": {"sequence_value": next_number}},
        upsert=True
    )

    return f"FR{next_number:03d}"

@router.post("/reset-counter")
async def reset_sequence(request:Request):
    """Reset the counter to 0. Next ID will be FR001."""
    tenant_id = request.state.tenant_id
    collection = get_freight_collection(tenant_id)
    await set_counter_value(tenant_id,0)
    return {"message": "Counter reset successfully. Next ID will be FR001"}

@router.get("/export-csv")
async def export_all_freights_to_csv(request:Request):
    tenant_id = request.state.tenant_id
 
    """Export active freights to a CSV file."""
    try:
        logger.info("Received request for /freights/export-csv")
        collection = get_freight_collection(tenant_id)
        records = await collection.find({"status": "active"}, {'_id': 0}).to_list(None)
        
        if not records:
            logger.warning("No active freights found for export")
            raise HTTPException(status_code=404, detail="No active freights found to export")

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
                'Freight ID': record.get('randomId', ''),
                'Freight': record.get('freightName', ''),
                'Status': record.get('status', ''),
                'Created Date': created_str,
                'Updated Date': updated_str
            })

        csv_stream.seek(0)
        filename = f"freights_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
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
        raise HTTPException(status_code=500, detail=f"Error exporting freights: {str(e)}")
@router.post("/import-csv")
async def import_csv_data(request:Request,file: UploadFile = File(...)):
    tenant_id = request.state.tenant_id
  
    """Import freights from a CSV file, preserving valid randomIds and handling duplicates."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    try:
        collection = get_freight_collection(tenant_id)
        current_datetime = get_localized_datetime()

        content = await file.read()
        decoded = content.decode('utf-8-sig', errors='replace')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        headers = [header_mapping.get(header.strip(), header.strip()) for header in csv_reader.fieldnames or []]
        csv_reader.fieldnames = headers

        required_fields = ['freightName']
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

            name = cleaned_row.get('freightName', '').lower()
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

        # Get existing freights by randomId and freightName
        existing_freights_by_name = {g['freightName'].lower(): g for g in await collection.find({}, {'freightName': 1, '_id': 1, 'randomId': 1, 'status': 1}).to_list(None)}
        existing_freights_by_id = {g['randomId']: g for g in await collection.find({"randomId": {"$regex": "^FR\\d+$"}}, {'freightName': 1, '_id': 1, 'randomId': 1, 'status': 1}).to_list(None)}

        # Build db_id_numbers for gap-filling optimization
        db_id_numbers = set()
        for rid in existing_freights_by_id:
            try:
                db_id_numbers.add(int(rid[2:]))
            except ValueError:
                logger.warning(f"Malformed existing randomId: {rid}")
                continue

        await initialize_counter_if_needed(tenant_id)
        current_counter = await get_current_counter_value(tenant_id)
        current_min_next = current_counter + 1 if current_counter is not None else 1
        used_id_numbers = db_id_numbers.copy()  # Will add new numbers here for gap-filling

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

                freight_name = row.get('freightName')
                # Check for duplicate freightName in CSV
                if freight_name.lower() in seen_names and len(seen_names[freight_name.lower()]) > 1:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": f"Duplicate Freight in CSV: '{freight_name}'",
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
                assigned_num = None

                # Handle randomId
                if provided_id:
                    if not (provided_id.startswith('FR') and provided_id[2:].isdigit()):
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Invalid randomId format: '{provided_id}'. Must be 'FR' followed by digits.",
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
                    if provided_id in existing_freights_by_id:
                        existing_freight = existing_freights_by_id[provided_id]
                        # Update existing record
                        update_data = {
                            'freightName': freight_name,
                            'status': status,
                            'lastUpdatedDate': last_updated_date
                        }
                        if row.get('createdDate'):
                            update_data['createdDate'] = created_date
                        batch.append(UpdateOne(
                            {'_id': existing_freight['_id']},
                            {'$set': update_data}
                        ))
                        updated.append({
                            "row": idx,
                            "data": row,
                            "message": f"Freight updated for randomId: '{provided_id}'"
                        })
                        updated_count += 1
                        # Update existing_freights_by_name to prevent duplicate name errors
                        if existing_freight['freightName'].lower() != freight_name.lower():
                            if existing_freight['freightName'].lower() in existing_freights_by_name:
                                del existing_freights_by_name[existing_freight['freightName'].lower()]
                            existing_freights_by_name[freight_name.lower()] = existing_freight
                        continue
                    # Valid, unused randomId from CSV
                    assigned_id = provided_id
                    try:
                        assigned_num = int(assigned_id[2:])
                    except ValueError:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Invalid randomId number: '{assigned_id}'.",
                            "missingFields": []
                        })
                        continue
                else:
                    # Generate sequential ID locally for rows without a valid randomId (optimized, no DB calls per row)
                    sorted_ids = sorted(used_id_numbers)
                    gap_next = 1
                    if sorted_ids:
                        for i in range(len(sorted_ids)):
                            if sorted_ids[i] > i + 1:
                                gap_next = i + 1
                                break
                        else:
                            gap_next = sorted_ids[-1] + 1
                    assigned_num = max(gap_next, current_min_next)
                    assigned_id = f"FR{assigned_num:03d}"

                # Check for duplicate freightName in the database
                if freight_name.lower() in existing_freights_by_name:
                    existing_freight = existing_freights_by_name[freight_name.lower()]
                    if existing_freight['randomId'] != assigned_id:
                        failed.append({
                            "row": idx,
                            "data": row,
                            "error": f"Freight '{freight_name}' already exists with randomId: '{existing_freight['randomId']}'",
                            "missingFields": []
                        })
                        continue

                # Now safe to reserve ID (add to used_id_numbers) only if inserting new
                used_id_numbers.add(assigned_num)
                if not provided_id:
                    # Only update min_next for generated IDs (matches original generate_sequential_id behavior)
                    current_min_next = assigned_num + 1

                # Create new record
                freight_data = {
                    'freightName': freight_name,
                    'randomId': assigned_id,
                    'status': status,
                    'createdDate': created_date,
                    'lastUpdatedDate': last_updated_date
                }

                batch.append(InsertOne(freight_data))
                successful.append({
                    "row": idx,
                    "data": row,
                    "assignedId": assigned_id
                })
                existing_freights_by_name[freight_name.lower()] = freight_data
                existing_freights_by_id[assigned_id] = freight_data
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

        # Set counter to the highest used ID number
        max_id_number = max(used_id_numbers) if used_id_numbers else 0
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
async def create_freight(request:Request,freight: FreightPost,user = Depends(validate_token), 
                         
    permissions: dict = Depends(check_permission("yenerp", "freight", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_freight_collection(tenant_id)
    """Create a new freight with a sequential ID."""
    current_datetime = get_localized_datetime()

    await initialize_counter_if_needed(tenant_id)
    sequential_id = await generate_sequential_id(tenant_id)

    new_freight_data = freight.dict()
    new_freight_data.update({
        'randomId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime,
        'lastUpdatedDate': current_datetime
    })

    result = await collection.insert_one(new_freight_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[Freight])
async def get_all_freight(request:Request,user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "freight", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_freight_collection(tenant_id)
    """Get all freights."""
    freights = await collection.find().to_list(None)
    formatted_freight = [
        {**freight, "freightId": str(freight["_id"])} for freight in freights
    ]
    return [Freight(**freight) for freight in formatted_freight]

@router.get("/{freight_id}", response_model=Freight)
async def get_freight_by_id(request:Request,freight_id: str,user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "freight", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_freight_collection(tenant_id)
    """Get a specific freight by ID."""
    try:
        logger.info(f"Received request for /freights/{freight_id}")
        freight = await collection.find_one({"_id": ObjectId(freight_id)})
        if freight:
            freight["freightId"] = str(freight["_id"])
            return Freight(**freight)
        raise HTTPException(status_code=404, detail=f"Freight not found: {freight_id}")
    except Exception as e:
        logger.error(f"Invalid freightId format: {freight_id}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid freightId format: {freight_id}, must be a 24-character hexadecimal string")

@router.put("/{freight_id}")
async def update_freight(request:Request,freight_id: str, freight: FreightPost,user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "freight", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_freight_collection(tenant_id)
    """Replace an existing freight."""
    try:
        current_datetime = get_localized_datetime()
        updated_freight = freight.dict(exclude_unset=True)
        updated_freight.update({
            'lastUpdatedDate': current_datetime
        })

        result = await collection.update_one(
            {"_id": ObjectId(freight_id)},
            {"$set": updated_freight}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail=f"Freight not found: {freight_id}")
        return {"message": "Freight updated successfully"}
    except Exception as e:
        logger.error(f"Invalid freightId format: {freight_id}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid freightId format: {freight_id}, must be a 24-character hexadecimal string")

@router.patch("/{freight_id}", response_model=Freight)
async def patch_freight(request:Request,freight_id: str, freight_patch: FreightPost,user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "freight", "edit"))):
    tenant_id = request.state.tenant_id
 
    """Update specific fields of an existing freight."""
    try:
        current_datetime = get_localized_datetime()
        collection = get_freight_collection(tenant_id)

        # Validate ObjectId
        try:
            oid = ObjectId(freight_id)
        except Exception:
            logger.error(f"Invalid freightId format: {freight_id}")
            raise HTTPException(status_code=400, detail="Invalid freightId format: must be a 24-character hexadecimal string")

        # Check if freight exists
        existing_freight = await collection.find_one({"_id": oid})
        if not existing_freight:
            logger.info(f"Freight not found: {freight_id}")
            raise HTTPException(status_code=404, detail="Freight not found")

        # Prepare update fields
        updated_fields = {
            key: value
            for key, value in freight_patch.dict(exclude_unset=True).items()
            if value is not None
        }
        if not updated_fields:
            logger.info(f"No fields to update for freight: {freight_id}")
            return Freight(**{**existing_freight, "freightId": str(existing_freight["_id"])})

        updated_fields.update({"lastUpdatedDate": current_datetime})

        # Perform update
        result = await collection.update_one({"_id": oid}, {"$set": updated_fields})
        if result.modified_count == 0:
            logger.warning(f"No changes applied to freight: {freight_id}")
            # Still return the unchanged freight
            return Freight(**{**existing_freight, "freightId": str(existing_freight["_id"])})

        # Fetch updated document
        updated_freight = await collection.find_one({"_id": oid})
        if not updated_freight:
            logger.error(f"Failed to retrieve updated freight: {freight_id}")
            raise HTTPException(status_code=500, detail="Failed to retrieve updated freight")

        # Convert ObjectId to string and return as Freight model
        updated_freight["freightId"] = str(updated_freight["_id"])
        logger.info(f"Freight updated successfully: {freight_id}")
        return Freight(**updated_freight)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating freight {freight_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    
@router.patch("/{freight_id}/deactivate", response_model=Freight)
async def deactivate_freight(request:Request,
    freight_id: str,user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "freight", "delete"))
):
    tenant_id = request.state.tenant_id
   
    """Deactivate a freight (soft delete)."""
    try:
        current_datetime = get_localized_datetime()
        collection = get_freight_collection(tenant_id)

        # Validate ObjectId
        try:
            oid = ObjectId(freight_id)
        except Exception:
            logger.error(f"Invalid freightId format: {freight_id}")
            raise HTTPException(status_code=400, detail="Invalid freightId format")

        # Check if freight exists
        existing_freight = await collection.find_one({"_id": oid})
        if not existing_freight:
            raise HTTPException(status_code=404, detail="Freight not found")

        # Update status to inactive
        result = await collection.update_one(
            {"_id": oid}, 
            {"$set": {
                'status': 'inactive',
                'lastUpdatedDate': current_datetime
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Freight not found")

        # Fetch updated document
        updated_freight = await collection.find_one({"_id": oid})
        updated_freight["freightId"] = str(updated_freight["_id"])
        
        logger.info(f"Freight deactivated successfully: {freight_id}")
        return Freight(**updated_freight)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating freight {freight_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.patch("/{freight_id}/activate", response_model=Freight)
async def activate_freight(request:Request,
    freight_id: str,user = Depends(validate_token), 
    permissions: dict = Depends(check_permission("yenerp", "freight", "delete"))
):
    tenant_id = request.state.tenant_id
 
    """Activate a freight."""
    try:
        current_datetime = get_localized_datetime()
        collection = get_freight_collection(tenant_id)

        # Validate ObjectId
        try:
            oid = ObjectId(freight_id)
        except Exception:
            logger.error(f"Invalid freightId format: {freight_id}")
            raise HTTPException(status_code=400, detail="Invalid freightId format")

        # Check if freight exists
        existing_freight = await collection.find_one({"_id": oid})
        if not existing_freight:
            raise HTTPException(status_code=404, detail="Freight not found")

        # Update status to active
        result = await collection.update_one(
            {"_id": oid}, 
            {"$set": {
                'status': 'active',
                'lastUpdatedDate': current_datetime
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Freight not found")

        # Fetch updated document
        updated_freight = await collection.find_one({"_id": oid})
        updated_freight["freightId"] = str(updated_freight["_id"])
        
        logger.info(f"Freight activated successfully: {freight_id}")
        return Freight(**updated_freight)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating freight {freight_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")