import csv
from datetime import datetime, timedelta
import io
import logging
from typing import List
from fastapi import APIRouter, File, HTTPException, UploadFile,Depends
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pymongo import InsertOne, UpdateOne
import pytz
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Request

from .models import PurchaseSubcategory, PurchaseSubcategoryPost
from utils.database import get_purchasecategory_collection, get_purchasesubcategory_collection

# User-friendly header mapping for subcategory import and export
subcategory_header_mapping = {
    'Subcategory ID': 'randomId',
    'Subcategory': 'purchasesubcategoryName',
    'Status': 'status',
    'Created Date': 'createdDate',
    'Updated Date': 'lastUpdatedDate'
}

router = APIRouter()

def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    adjusted_time = localized_now + timedelta(hours=5, minutes=30)
    return adjusted_time.astimezone(pytz.UTC)
async def set_counter_value(tenant_id: str,value: int, counter_id: str = "purchasesubcategoryId"):
    """Set the counter value in the database."""
    counter_collection = get_purchasesubcategory_collection(tenant_id).database["counters"]
    await counter_collection.update_one(  # Await async operation
        {"_id": counter_id},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

async def get_current_counter_value(tenant_id: str,counter_id: str = "purchasesubcategoryId"):
    """Get the current counter value from the database."""
    counter_collection = get_purchasesubcategory_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one({"_id": counter_id})  # Await async operation
    return counter["sequence_value"] if counter else 0

async def initialize_counter_if_needed(tenant_id: str,counter_id: str = "purchasesubcategoryId"):  # Updated counter_id default
    """Initialize counter to the highest existing ID number (PCxxx or PSxxx)."""
    if counter_id == "purchasecategoryId":
        collection = get_purchasecategory_collection(tenant_id)
        id_prefix = "PC"
    elif counter_id == "purchasesubcategoryId":
        collection = get_purchasesubcategory_collection(tenant_id)
        id_prefix = "PS"
    else:
        raise ValueError(f"Invalid counter_id: {counter_id}")

    counter_collection = collection.database["counters"]
    
    highest_item = await collection.find_one(  # Await async operation
        {"randomId": {"$regex": f"^{id_prefix}\\d+$"}},
        sort=[("randomId", -1)]
    )
    
    if highest_item:
        try:
            last_number = int(highest_item["randomId"][2:])
        except (ValueError, TypeError):
            last_number = 0
            logging.warning(f"Malformed randomId found: {highest_item['randomId']}")
        await counter_collection.update_one(  # Await async operation
            {"_id": counter_id},
            {"$set": {"sequence_value": last_number}},
            upsert=True
        )
    else:
        await counter_collection.update_one(  # Await async operation
            {"_id": counter_id},
            {"$set": {"sequence_value": 0}},
            upsert=True
        )

async def generate_sequential_subcategoryid(tenant_id: str,):
    """Generate a PSxxx ID, filling gaps in the sequence."""
    collection = get_purchasesubcategory_collection(tenant_id)
    counter_collection = collection.database["counters"]
    
    counter = await counter_collection.find_one({"_id": "purchasesubcategoryId"})  # Await async operation
    current_counter = counter["sequence_value"] if counter else 0
    
    existing_ids = await collection.find({"randomId": {"$regex": "^PS\\d+$"}}, {"randomId": 1}).to_list(None)  # Await async operation
    id_numbers = [int(item["randomId"][2:]) for item in existing_ids if item["randomId"].startswith("PS")]
    
    next_number = 1
    if id_numbers:
        expected = 1
        for num in sorted(id_numbers):
            if num > expected:
                next_number = expected
                break
            expected = num + 1
        else:
            next_number = expected
    
    next_number = max(next_number, current_counter + 1)
    
    await counter_collection.update_one(  # Await async operation
        {"_id": "purchasesubcategoryId"},
        {"$set": {"sequence_value": next_number}},
        upsert=True
    )
    
    return f"PS{next_number:03d}"

@router.post("/reset-counter")
async def reset_sequence(request: Request):
    """Reset the counter to 0. Next ID will be PS001."""
    tenant_id = request.state.tenant_id
    await set_counter_value(tenant_id,0)  # Await async operation
    return {"message": "Counter reset successfully. Next ID will be PS001"}

@router.post("/", response_model=str)
async def create_purchasesubcategory( request: Request,purchasesubcategory: PurchaseSubcategoryPost, user = Depends(validate_token),                 
     permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "add"))):
    tenant_id = request.state.tenant_id

    """Create a new purchase subcategory with a sequential ID."""
    current_datetime = get_localized_datetime()
    
    await initialize_counter_if_needed(tenant_id)  # Await async operation
    sequential_id = await generate_sequential_subcategoryid(tenant_id)  # Await async operation

    new_purchasesubcategory_data = purchasesubcategory.dict()
    new_purchasesubcategory_data.update({
        'randomId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime,
        'createdTime': current_datetime,
        'lastUpdatedDate': current_datetime,
        'lastUpdatedTime': current_datetime
    })

    result = await get_purchasesubcategory_collection(tenant_id).insert_one(new_purchasesubcategory_data)  # Await async operation
    return str(result.inserted_id)

@router.get("/", response_model=List[PurchaseSubcategory])
async def get_all_purchasesubcategory(  request: Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "read"))):
    """Get all purchase subcategories."""
    tenant_id = request.state.tenant_id
    collection = get_purchasesubcategory_collection(tenant_id)
    purchasesubcategories = await collection.find().to_list(None)  # Await async operation
    formatted_purchasesubcategory = [
        {**sub, "purchasesubcategoryId": str(sub["_id"])} for sub in purchasesubcategories
    ]
    return [PurchaseSubcategory(**sub) for sub in formatted_purchasesubcategory]

@router.get("/{purchasesubcategory_id}", response_model=PurchaseSubcategory)
async def get_purchasesubcategory_by_id( request: Request,purchasesubcategory_id: str, user = Depends(validate_token),                 
     permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "read"))):
    """Get a specific purchase subcategory by ID."""
    try:
        tenant_id = request.state.tenant_id
        collection = get_purchasesubcategory_collection(tenant_id)
        subcategory = await collection.find_one({"_id": ObjectId(purchasesubcategory_id)})  # Await async operation
        if subcategory:
            subcategory["purchasesubcategoryId"] = str(subcategory["_id"])
            return PurchaseSubcategory(**subcategory)
        raise HTTPException(status_code=404, detail="PurchaseSubcategory not found")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid purchasesubcategoryId format")

@router.put("/{purchasesubcategory_id}")
async def update_purchasesubcategory( request: Request,purchasesubcategory_id: str, purchasesubcategory: PurchaseSubcategoryPost,user = Depends(validate_token),                
    permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "edit"))):
    tenant_id = request.state.tenant_id

    """Replace an existing purchase subcategory."""
    current_datetime = get_localized_datetime()
    
    updated_purchasesubcategory = purchasesubcategory.dict(exclude_unset=True)
    updated_purchasesubcategory.update({
        'lastUpdatedDate': current_datetime,
        'lastUpdatedTime': current_datetime
    })
    
    result = await get_purchasesubcategory_collection(tenant_id).update_one(  # Await async operation
        {"_id": ObjectId(purchasesubcategory_id)}, 
        {"$set": updated_purchasesubcategory}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseSubcategory not found")
    return {"message": "PurchaseSubcategory updated successfully"}

@router.patch("/{purchasesubcategory_id}")
async def patch_purchasesubcategory( request: Request,purchasesubcategory_id: str, purchasesubcategory_patch: PurchaseSubcategoryPost, user = Depends(validate_token),                   
     permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "edit"))):
    tenant_id = request.state.tenant_id

    """Update specific fields of an existing purchase subcategory."""
    current_datetime = get_localized_datetime()
    collection = get_purchasesubcategory_collection(tenant_id)
    existing_subcategory = await collection.find_one({"_id": ObjectId(purchasesubcategory_id)})  # Await async operation
    if not existing_subcategory:
        raise HTTPException(status_code=404, detail="PurchaseSubcategory not found")

    updated_fields = {key: value for key, value in purchasesubcategory_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields.update({
            'lastUpdatedDate': current_datetime,
            'lastUpdatedTime': current_datetime
        })
        
        result = await get_purchasesubcategory_collection(tenant_id).update_one(  # Await async operation
            {"_id": ObjectId(purchasesubcategory_id)},
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update PurchaseSubcategory")
    
    return {"message": "PurchaseSubcategory updated successfully"}

@router.post("/import-csv")
async def import_purchasesubcategory_csv( request: Request,file: UploadFile = File(...), user = Depends(validate_token),                
     permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "add"))):
    tenant_id = request.state.tenant_id

    """Import purchase subcategories from a CSV file, ensuring sequential subcategory IDs."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    try:
        collection = get_purchasesubcategory_collection(tenant_id)
        current_datetime = get_localized_datetime()

        # Read CSV file
        content = await file.read()
        decoded = content.decode('utf-8-sig', errors='replace')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        # Map headers
        headers = [subcategory_header_mapping.get(header.strip(), header.strip()) for header in csv_reader.fieldnames or []]
        csv_reader.fieldnames = headers

        # Required fields validation
        required_fields = ['purchasesubcategoryName']
        missing_headers = [subcategory_header_mapping.get(field, field) for field in required_fields if field not in headers]
        if missing_headers:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Missing required headers in CSV file",
                    "missing": missing_headers,
                    "required": [subcategory_header_mapping.get(field, field) for field in required_fields]
                }
            )

        # Pre-fetch existing subcategories
        existing_subcategories = {sub['purchasesubcategoryName'].lower(): sub for sub in await collection.find({}, {'purchasesubcategoryName': 1, '_id': 1, 'randomId': 1}).to_list(None)}  # Await async operation

        # Initialize counters
        await initialize_counter_if_needed(tenant_id)  # Await async operation

        inserted_count = 0
        updated_count = 0
        successful = []
        updated = []
        failed = []
        batch = []
        used_ids = set(await collection.distinct("randomId", {"randomId": {"$regex": "^PS\\d+$"}}))  # Await async operation
        max_id_number = await get_current_counter_value(tenant_id)  # Await async operation

        for idx, row in enumerate(csv_reader, 1):
            try:
                row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}

                # Check for missing required fields
                missing_fields = [field for field in required_fields if not row.get(field)]
                if missing_fields:
                    failed.append({
                        "row": idx,
                        "data": row,
                        "error": "Missing required fields",
                        "missingFields": [subcategory_header_mapping.get(field, field) for field in missing_fields]
                    })
                    continue

                subcategory_name = row.get('purchasesubcategoryName')
                if subcategory_name.lower() in existing_subcategories:
                    status = row.get('status', 'active').lower()
                    if status not in ['active', 'inactive']:
                        status = 'active'
                    update_data = {
                        'status': status,
                        'lastUpdatedDate': current_datetime,
                        'lastUpdatedTime': current_datetime
                    }
                    batch.append(UpdateOne(
                        {'_id': existing_subcategories[subcategory_name.lower()]['_id']},
                        {'$set': update_data}
                    ))
                    updated.append({
                        "row": idx,
                        "data": row,
                        "error": "Duplicate subcategory updated"
                    })
                    updated_count += 1
                    continue

                # Process dates
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

                # Generate sequential subcategory ID
                provided_id = row.get('randomId', '')
                if provided_id.startswith('PS') and provided_id[2:].isdigit() and provided_id not in used_ids:
                    id_number = int(provided_id[2:])
                    used_ids.add(provided_id)
                    max_id_number = max(max_id_number, id_number)
                else:
                    provided_id = await generate_sequential_subcategoryid(tenant_id)  # Await async operation
                    used_ids.add(provided_id)
                    max_id_number = max(max_id_number, int(provided_id[2:]))

                subcategory_data = {
                    'purchasesubcategoryName': subcategory_name,
                    'randomId': provided_id,
                    'status': row.get('status', 'active').lower() if row.get('status', '').lower() in ['active', 'inactive'] else 'active',
                    'createdDate': created_date,
                    'createdTime': created_date,
                    'lastUpdatedDate': last_updated_date,
                    'lastUpdatedTime': last_updated_date
                }

                batch.append(InsertOne(subcategory_data))
                successful.append({
                    "row": idx,
                    "data": row
                })
                existing_subcategories[subcategory_name.lower()] = subcategory_data
                inserted_count += 1

                if len(batch) >= 500:
                    await collection.bulk_write(batch, ordered=False)  # Await async operation
                    batch = []

            except Exception as e:
                failed.append({
                    "row": idx,
                    "data": row,
                    "error": f"Unexpected error: {str(e)}",
                    "missingFields": []
                })

        # Insert remaining batch
        if batch:
            await collection.bulk_write(batch, ordered=False)  # Await async operation

        # Update subcategory counter
        await set_counter_value(tenant_id,max_id_number)  # Await async operation

        response = {
            "message": "CSV import processed successfully" if not failed else "CSV import completed with errors",
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "successful": successful,
            "updated": updated,
            "failed": failed,
            "errorCount": len(failed)
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Import error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.get("/exportsubcategory/export-csv")
async def export_purchasesubcategory_csv( request: Request, user = Depends(validate_token),                  
     permissions: dict = Depends(check_permission("yenerp", "purchasesubcategory", "read"))):
    tenant_id = request.state.tenant_id

    """Export active purchase subcategories to a CSV file."""
    try:
        collection = get_purchasesubcategory_collection(tenant_id)
        subcategories = await collection.find(  # Await async operation
            {"status": "active"},
            {
                '_id': 0,
                'randomId': 1,
                'purchasesubcategoryName': 1,
                'status': 1,
                'createdDate': 1,
                'lastUpdatedDate': 1
            }
        ).to_list(None)

        if not subcategories:
            raise HTTPException(status_code=404, detail="No active purchase subcategories found")

        csv_stream = io.StringIO()
        fieldnames = list(subcategory_header_mapping.keys())  # Use user-friendly header names
        writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        writer.writeheader()

        ist = pytz.timezone('Asia/Kolkata')

        for subcategory in subcategories:
            created_date = subcategory.get('createdDate')
            created_str = ""
            if created_date:
                if created_date.tzinfo is None:
                    created_date = pytz.UTC.localize(created_date)
                created_date_ist = created_date.astimezone(ist)
                created_str = created_date_ist.strftime('%d-%m-%Y')

            last_updated_date = subcategory.get('lastUpdatedDate')
            updated_str = ""
            if last_updated_date:
                if last_updated_date.tzinfo is None:
                    last_updated_date = pytz.UTC.localize(last_updated_date)
                last_updated_date_ist = last_updated_date.astimezone(ist)
                updated_str = last_updated_date_ist.strftime('%d-%m-%Y')

            writer.writerow({
                'Subcategory ID': subcategory.get('randomId', ''),
                'Subcategory': subcategory.get('purchasesubcategoryName', ''),
                'Status': subcategory.get('status', ''),
                'Created Date': created_str,
                'Updated Date': updated_str
            })

        csv_stream.seek(0)
        filename = f"purchasesubcategories_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        return StreamingResponse(
            csv_stream,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error exporting subcategories: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting subcategories: {str(e)}")
    


@router.patch("/{purchasesubcategory_id}/deactivate")
async def deactivate_purchasesubcategory(
    request: Request,
    purchasesubcategory_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","purchasesubcategory","delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchasesubcategory_collection(tenant_id)

    await collection.update_one(
        {"_id": ObjectId(purchasesubcategory_id)},
        {"$set": {"status": "deactivated", "lastUpdatedDate": get_localized_datetime()}}
    )

    return {"message": "Subcategory deactivated"}
@router.patch("/{purchasesubcategory_id}/activate")
async def activate_purchasesubcategory(
    request: Request,
    purchasesubcategory_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","purchasesubcategory","delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchasesubcategory_collection(tenant_id)

    await collection.update_one(
        {"_id": ObjectId(purchasesubcategory_id)},
        {"$set": {"status": "active", "lastUpdatedDate": get_localized_datetime()}}
    )

    return {"message": "Subcategory activated"}
