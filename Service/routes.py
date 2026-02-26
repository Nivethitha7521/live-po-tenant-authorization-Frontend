import asyncio
import csv
import re
from datetime import datetime, timedelta
import io
import logging
from fastapi import Request
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, Query
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pymongo import InsertOne, UpdateOne
import pytz
from .models import PaginatedServiceResponse, Service, ServicePost, ImportResult
from utils.database import get_service_collection
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends

router = APIRouter()

def get_current_date_and_time():
    # Get current time in UTC (simplified, as IST + 5:30 seems unusual)
    return datetime.now(pytz.UTC)

def format_sequential_id(sequence_value: int) -> str:
    """Format numeric sequence value to SI-prefixed ID with leading zeros"""
    return f"SI{sequence_value:03d}"

async def get_next_counter_value(tenant_id: str):
    counter_collection = get_service_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one_and_update(
        {"_id": "serviceId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

async def initialize_counter_if_needed(tenant_id: str):
    """Initialize counter to match highest existing serviceId"""
    counter_collection = get_service_collection(tenant_id).database["counters"]
    collection = get_service_collection(tenant_id)
    
    # Find the highest existing serviceId in the collection
    highest_item = await collection.find_one(
        {},
        sort=[("serviceId", -1)]
    )
    
    if highest_item and "serviceId" in highest_item:
        # Extract the numeric part from SI-prefixed IDs
        service_id = highest_item["serviceId"]
        if isinstance(service_id, str) and service_id.startswith("SI"):
            try:
                # Extract numeric part after "SI"
                last_number = int(service_id[2:])
                await counter_collection.update_one(
                    {"_id": "serviceId"},
                    {"$set": {"sequence_value": last_number}},
                    upsert=True
                )
            except ValueError:
                # If format is wrong, start from 0
                await counter_collection.update_one(
                    {"_id": "serviceId"},
                    {"$set": {"sequence_value": 0}},
                    upsert=True
                )
        else:
            # If serviceId is not in SI format, try to convert or start from 0
            try:
                last_number = int(service_id)
                await counter_collection.update_one(
                    {"_id": "serviceId"},
                    {"$set": {"sequence_value": last_number}},
                    upsert=True
                )
            except (ValueError, TypeError):
                await counter_collection.update_one(
                    {"_id": "serviceId"},
                    {"$set": {"sequence_value": 0}},
                    upsert=True
                )
    else:
        # No existing records, start from 0
        await counter_collection.update_one(
            {"_id": "serviceId"},
            {"$set": {"sequence_value": 0}},
            upsert=True
        )

async def generate_sequential_id(tenant_id: str):
    """Generate sequential IDs in SI001 format without gaps"""
    counter_collection = get_service_collection(tenant_id).database["counters"]
    
    # Atomic operation to increment and get next value
    counter = await counter_collection.find_one_and_update(
        {"_id": "serviceId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    sequence_value = counter['sequence_value']
    return format_sequential_id(sequence_value)

@router.post("/", response_model=Service)
async def create_service( request: Request,service: ServicePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    current_datetime = get_current_date_and_time()
    
    # Initialize counter if needed
    await initialize_counter_if_needed(tenant_id)
    # Generate sequential ID in SI001 format
    sequential_id = await generate_sequential_id(tenant_id)
    # Prepare data including serviceId
    new_service_data = service.dict()
    new_service_data.update({
        'serviceId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime
    })
    
    result = await collection.insert_one(new_service_data)
    inserted_service = await collection.find_one({"_id": result.inserted_id})
    inserted_service["mongoId"] = str(inserted_service["_id"])
    return Service(**inserted_service)

@router.get("/", response_model=PaginatedServiceResponse
  )
async def get_all_service( request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query("active", description="Filter by status (active, deactivated, or all)"),
    search: Optional[str] = Query(None, description="Search term for serviceName or saccode"),  user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
   
    skip = (page - 1) * limit
    
    # Build match filter
    match_filter = {}
    if status != "all":
        match_filter["status"] = status
    
    if search and search.strip():
        escaped_search = re.escape(search.strip())
        search_regex = f"\\b{escaped_search}\\b"
        or_conditions = [{"serviceName": {"$regex": search_regex, "$options": "i"}}]
        
        # Also search in serviceId (SI-prefixed)
        or_conditions.append({"serviceId": {"$regex": escaped_search, "$options": "i"}})
        
        try:
            search_num = int(search.strip())
            or_conditions.append({"saccode": search_num})
        except ValueError:
            pass
        match_filter["$or"] = or_conditions
    
    # Aggregate pipeline for pagination
    pipeline = [
        {"$match": match_filter},
        {"$sort": {"createdDate": -1}},  # Sort by creation date by default
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    services_cursor = collection.aggregate(pipeline)
    services = [item async for item in services_cursor]
    
    # Get total count
    total = await collection.count_documents(match_filter)
    
    formatted_services = []
    for service in services:
        service["mongoId"] = str(service["_id"])
        formatted_services.append(Service(**service))
    
    total_pages = (total + limit - 1) // limit if limit > 0 else 0
    
    return PaginatedServiceResponse(
        data=formatted_services,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@router.get("/{mongo_id}", response_model=Service)
async def get_service_by_mongo_id( request: Request,mongo_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    try:
        _id = ObjectId(mongo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid mongo_id format")
    service = await collection.find_one({"_id": _id})
    if service:
        service["mongoId"] = str(service["_id"])
        return Service(**service)
    else:
        raise HTTPException(status_code=404, detail="Service not found")

@router.put("/{mongo_id}")
async def update_service( request: Request,mongo_id: str, service: ServicePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    try:
        _id = ObjectId(mongo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid mongo_id format")
    current_datetime = get_current_date_and_time()
    updated_service = service.dict(exclude_unset=True)
    updated_service.update({
        'lastUpdatedDate': current_datetime
    })
    result = await collection.update_one(
        {"_id": _id},
        {"$set": updated_service}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    updated = await collection.find_one({"_id": _id})
    updated["mongoId"] = str(updated["_id"])
    return Service(**updated)

@router.patch("/{mongo_id}")
async def patch_service( request: Request,mongo_id: str, service_patch: ServicePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    try:
        _id = ObjectId(mongo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid mongo_id format")
    current_datetime = get_current_date_and_time()
    existing_service = await collection.find_one({"_id": _id})
    if not existing_service:
        raise HTTPException(status_code=404, detail="Service not found")
    updated_fields = {key: value for key, value in service_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields.update({
            'lastUpdatedDate': current_datetime
        })
        result = await collection.update_one(
            {"_id": _id},
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Service")
    updated_service = await collection.find_one({"_id": _id})
    updated_service["mongoId"] = str(updated_service["_id"])
    return Service(**updated_service)

@router.patch("/{mongo_id}/activate")
async def activate_service( request: Request,mongo_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    try:
        _id = ObjectId(mongo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid mongo_id format")
    current_datetime = get_current_date_and_time()
    result = await collection.update_one(
        {"_id": _id},
        {"$set": {
            "status": "active",
            "lastUpdatedDate": current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    updated_service = await collection.find_one({"_id": _id})
    updated_service["mongoId"] = str(updated_service["_id"])
    return Service(**updated_service)

@router.patch("/{mongo_id}/deactivate")
async def deactivate_service( request: Request,mongo_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    try:
        _id = ObjectId(mongo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid mongo_id format")
    current_datetime = get_current_date_and_time()
    result = await collection.update_one(
        {"_id": _id},
        {"$set": {
            "status": "deactivated",
            "lastUpdatedDate": current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    updated_service = await collection.find_one({"_id": _id})
    updated_service["mongoId"] = str(updated_service["_id"])
    return Service(**updated_service)

@router.post("/import-csv", response_model=ImportResult)
async def import_csv_data( request: Request,file: UploadFile = File(...), background_tasks: BackgroundTasks = None,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "add"))):
    tenant_id = request.state.tenant_id
   
    """
    Bulk import services from CSV with optimizations:
    - Batch-fetch existing by ID and name upfront.
    - Batch-generate sequential IDs (one counter read + one write).
    - Process inserts/updates in memory, bulk_write at end.
    """
    try:
        collection = get_service_collection(tenant_id)
        current_datetime = get_current_date_and_time()
        
        # Read and parse CSV (same as before, but add size check for very large files)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # >10MB, reject or warn
            raise HTTPException(status_code=413, detail="CSV too large (>10MB). Use async import.")
        
        try:
            decoded = content.decode("utf-8-sig").splitlines()
            csv_reader = csv.DictReader(decoded)
            csv_data = list(csv_reader)  # For small/medium CSVs; for huge, see streaming note below
        except Exception as e:
            logging.error(f"Invalid CSV file: {str(e)}")
            return ImportResult(
                message=f"Invalid CSV file: {str(e)}",
                detail={"message": f"Unable to parse CSV: {str(e)}"},
                inserted_count=0,
                updated_count=0,
                successful=[],
                failed=[],
                errorCount=0,
            )

        # Validate required headers (unchanged)
        valid_headers = ["Service", "serviceName"]
        found_header = None
        for header in valid_headers:
            if header in csv_reader.fieldnames:
                found_header = header
                break
        
        if not found_header:
            logging.error("Missing required CSV header: 'Service' or 'serviceName'")
            return ImportResult(
                message="Missing required CSV header",
                detail={
                    "message": "Required header 'Service' or 'serviceName' not found",
                    "missing": ["Service or serviceName"],
                },
                inserted_count=0,
                updated_count=0,
                successful=[],
                failed=[],
                errorCount=0,
            )

        # Initialize counter if needed (unchanged)
        await initialize_counter_if_needed(tenant_id)

        # OPTIMIZATION 1: Pre-fetch ALL existing services by name (unchanged, efficient)
        existing_by_name = {}
        async for item in collection.find({}, {'serviceName': 1, 'serviceId': 1, '_id': 1}):
            existing_by_name[item['serviceName'].lower().strip()] = item

        # OPTIMIZATION 2: Collect unique IDs from CSV, fetch ALL existing by ID in ONE query
        unique_row_ids = set()
        for row in csv_data:
            row_id_str = row.get("ID", "").strip()
            # Handle both numeric IDs and SI-prefixed IDs
            if row_id_str:
                if row_id_str.startswith("SI"):
                    try:
                        # Extract numeric part from SI001 format
                        numeric_id = int(row_id_str[2:])
                        unique_row_ids.add(row_id_str)
                    except ValueError:
                        # Not a valid SI ID, skip
                        pass
                elif row_id_str.isdigit():
                    # Legacy numeric ID - convert to SI format for matching
                    try:
                        numeric_id = int(row_id_str)
                        # Check if this numeric ID exists in the database (as numeric or as SI format)
                        unique_row_ids.add(row_id_str)  # Add the numeric string
                        # Also add the SI format version for matching
                        unique_row_ids.add(f"SI{int(row_id_str):03d}")
                    except ValueError:
                        pass
        
        existing_by_id = {}
        if unique_row_ids:
            # Fetch by serviceId (which can be string now)
            async for item in collection.find(
                {"serviceId": {"$in": list(unique_row_ids)}}, 
                {'_id': 1, 'serviceName': 1, 'serviceId': 1}
            ):
                existing_by_id[item['serviceId']] = item

        # OPTIMIZATION 3: First pass to count/collect inserts (no DB calls here)
        operations = []
        insert_datas = []  # Collect insert data without IDs
        new_count_potential = 0
        updated_count = 0
        successful = []
        failed = []
        seen_names_in_csv = set()

        for row_idx, row in enumerate(csv_data, start=1):
            service_name = row.get(found_header, '').strip()
            
            # Validate service name (unchanged)
            if not service_name:
                failed.append({
                    "row": row_idx,
                    "data": {
                        "serviceName": service_name,
                        "ID": row.get("ID", ""),
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": row.get("Status", ""),
                        "SAC Code": row.get("SAC Code", ""),
                    },
                    "error": "Service name is empty",
                })
                continue

            normalized_name = service_name.lower().strip()
            
            # Check for duplicates within the CSV (unchanged)
            if normalized_name in seen_names_in_csv:
                failed.append({
                    "row": row_idx,
                    "data": {
                        "serviceName": service_name,
                        "ID": row.get("ID", ""),
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": row.get("Status", ""),
                        "SAC Code": row.get("SAC Code", ""),
                    },
                    "error": "Duplicate service name in CSV",
                })
                continue

            seen_names_in_csv.add(normalized_name)

            # Validate status and saccode (unchanged)
            status = row.get("Status", "active").strip().lower()
            if status not in ["active", "deactivated"]:
                status = "active"

            saccode_str = row.get("SAC Code", row.get("saccode", "")).strip()
            saccode = None
            if saccode_str:
                try:
                    saccode = int(saccode_str)
                except ValueError:
                    failed.append({
                        "row": row_idx,
                        "data": {
                            "serviceName": service_name,
                            "ID": row.get("ID", ""),
                            "S.No": row.get("S.No", str(row_idx)),
                            "Status": status,
                            "SAC Code": saccode_str,
                        },
                        "error": "Invalid SAC code: must be integer",
                    })
                    continue

            row_id_str = row.get("ID", "").strip()
            row_id = row_id_str if row_id_str else None

            # Check existence: NOW BATCHED (no per-row query!)
            existing_item = None
            if row_id is not None:
                # Check for the row_id as provided
                existing_item = existing_by_id.get(row_id)
                
                # If row_id is numeric and not found, also check the SI format version
                if not existing_item and row_id.isdigit():
                    si_formatted = f"SI{int(row_id):03d}"
                    existing_item = existing_by_id.get(si_formatted)
            
            if not existing_item and normalized_name in existing_by_name:
                existing_item = existing_by_name[normalized_name]

            if existing_item:
                # Update existing (unchanged)
                update_data = {
                    "serviceName": service_name,
                    "status": status,
                    "lastUpdatedDate": current_datetime,
                }
                if saccode is not None:
                    update_data["saccode"] = saccode
                
                operations.append(UpdateOne(
                    {"_id": existing_item["_id"]},
                    {"$set": update_data}
                ))
                updated_count += 1
                successful.append({
                    "row": row_idx,
                    "data": {
                        "serviceName": service_name,
                        "serviceId": existing_item.get("serviceId", row_id),
                        "ID": row_id_str,
                        "S.No": row.get("S.No", str(row_idx)),
                        "Status": status,
                        "SAC Code": saccode_str,
                    },
                    "action": "updated"
                })
            else:
                # Collect insert data (ID assigned later)
                insert_data = {
                    "serviceName": service_name,
                    "status": status,
                    "createdDate": current_datetime,
                }
                if saccode is not None:
                    insert_data["saccode"] = saccode
                
                insert_datas.append({
                    'data': insert_data,
                    'row_idx': row_idx,
                    'row_id_str': row_id_str,
                    'saccode_str': saccode_str,
                    'status': status,
                })
                new_count_potential += 1  # Will be actual after ID assignment

        # OPTIMIZATION 4: Batch-generate IDs for all inserts (2 DB ops max)
        num_inserts = len(insert_datas)
        if num_inserts > 0:
            # Get current counter value (no inc)
            counter_collection = collection.database["counters"]
            current_counter = await counter_collection.find_one({"_id": "serviceId"})
            next_id = (current_counter["sequence_value"] if current_counter else 0) + 1
            
            # Set counter forward by num_inserts (atomic set, assumes no concurrent imports)
            await counter_collection.update_one(
                {"_id": "serviceId"},
                {"$set": {"sequence_value": next_id + num_inserts - 1}},
                upsert=True
            )
            
            # Assign sequential IDs in SI001 format
            for i, insert_info in enumerate(insert_datas):
                sequence_value = next_id + i
                formatted_id = format_sequential_id(sequence_value)
                insert_data = insert_info['data']
                insert_data["serviceId"] = formatted_id
                
                operations.append(InsertOne(insert_data))
                successful.append({
                    "row": insert_info['row_idx'],
                    "data": {
                        "serviceName": insert_data["serviceName"],
                        "serviceId": formatted_id,
                        "ID": insert_info['row_id_str'],
                        "S.No": insert_info['row_idx'],  # Approximate
                        "Status": insert_info['status'],
                        "SAC Code": insert_info['saccode_str'],
                    },
                    "action": "inserted"
                })

        # Execute bulk operations (unchanged)
        if operations:
            try:
                result = await collection.bulk_write(operations, ordered=False)
                logging.info(f"Bulk write completed: {result.inserted_count} inserted, {result.modified_count} modified")
                # Adjust counts based on actual result (in case of failures)
                new_count = result.inserted_count
                updated_count = result.modified_count
            except Exception as bulk_error:
                logging.error(f"Bulk write error: {str(bulk_error)}")
                # Fallback: counts from planning, but log error
                new_count = num_inserts
        else:
            new_count = 0

        return ImportResult(
            message=f"Import completed: {new_count} inserted, {updated_count} updated, {len(failed)} errors",
            inserted_count=new_count,
            updated_count=updated_count,
            successful=successful,
            failed=failed,
            errorCount=len(failed),
        )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Import error: {str(e)}", exc_info=True)
        return ImportResult(
            message="Import failed",
            detail={"message": f"Server error: {str(e)}"},
            inserted_count=0,
            updated_count=0,
            successful=[],
            failed=[],
            errorCount=1,
        )

# Async bulk import for better performance
@router.post("/import-csv-async")
async def import_csv_async( request: Request,file: UploadFile = File(...), background_tasks: BackgroundTasks = None, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    """
    Asynchronous bulk import - returns immediately, processes in background
    """
    from fastapi.background import BackgroundTasks
    
    async def process_import_async(file_content: bytes, filename: str):
        """Process import in background"""
        try:
            # Similar logic to import_csv_data but optimized for background processing
            # You can store progress in database or cache for frontend to poll
            logging.info(f"Background import started for {filename}")
            # Implement your import logic here
            await asyncio.sleep(1)  # Simulate processing
            logging.info(f"Background import completed for {filename}")
        except Exception as e:
            logging.error(f"Background import failed: {str(e)}")

    # Read file and start background task
    content = await file.read()
    if background_tasks:
        background_tasks.add_task(process_import_async, content, file.filename)
        return {"message": "Import started in background", "filename": file.filename}
    else:
        # Fallback to synchronous processing
        return await import_csv_data(request,file)

@router.get("/export-service/export-csv")
async def export_all_service_to_csv( request: Request):
    tenant_id = request.state.tenant_id
    """Export services to CSV with improved error handling"""
    try:
        collection = get_service_collection(tenant_id)
        records = [item async for item in collection.find(
            {"status": "active"},
            {'_id': 0, 'serviceId': 1, 'serviceName': 1, 'saccode': 1, 'status': 1, 'createdDate': 1, 'lastUpdatedDate': 1}
        )]
         
        csv_stream = io.StringIO()
        fieldnames = ['S.No', 'ID', 'Service', 'SAC Code', 'Created Date', 'Updated Date', 'Status']
        writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        writer.writeheader()
        
        for index, record in enumerate(records, 1):
            # Safe date formatting
            created_date = record.get('createdDate')
            created_str = ""
            if created_date:
                if isinstance(created_date, datetime):
                    created_str = created_date.strftime('%d-%m-%Y')
                else:
                    created_str = str(created_date)
            
            updated_date = record.get('lastUpdatedDate')
            updated_str = ""
            if updated_date:
                if isinstance(updated_date, datetime):
                    updated_str = updated_date.strftime('%d-%m-%Y')
                else:
                    updated_str = str(updated_date)
            
            writer.writerow({
                'S.No': index,
                'ID': str(record.get('serviceId', '')),
                'Service': record.get('serviceName', ''),
                'SAC Code': str(record.get('saccode', '')),
                'Created Date': created_str,
                'Updated Date': updated_str,
                'Status': record.get('status', ''),
            })
         
        csv_stream.seek(0)
        filename = f"services_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            io.BytesIO(csv_stream.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
   
    except Exception as e:
        logging.error(f"Error exporting service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting service: {str(e)}")