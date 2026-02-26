from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, File,  HTTPException, UploadFile,Depends
from bson import ObjectId
from fastapi import Request

from fastapi.responses import StreamingResponse
from pymongo import InsertOne, UpdateOne
import pytz
import csv
import io
import logging
from .models import PurchaseUOM, PurchaseUOMPost
from utils.database import get_purchaseuom_collection
from dependencies.auth import validate_token


from middlewares.permission_middleware import check_permission
router = APIRouter()
def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    adjusted_time = localized_now + timedelta(hours=5, minutes=30)
    return adjusted_time.astimezone(pytz.UTC)
async def get_all_existing_numbers(tenant_id: str):
    """Get all existing UOxxx numbers from database."""
    collection = get_purchaseuom_collection(tenant_id)
    existing_records = await collection.find(
        {"randomId": {"$regex": "^UO\\d+$"}},
        {"randomId": 1}
    ).to_list(None)
    
    numbers = []
    for record in existing_records:
        try:
            num = int(record["randomId"][2:])
            numbers.append(num)
        except (ValueError, KeyError):
            continue
    return sorted(numbers)

async def find_next_available_number(tenant_id: str):
    """Find the next available number, filling gaps."""
    existing_numbers = await get_all_existing_numbers(tenant_id)
    
    # If no records exist, start with 1
    if not existing_numbers:
        return 1
    
    # Check for gap at beginning
    if existing_numbers[0] > 1:
        return 1
    
    # Check for gaps in the sequence
    for i in range(1, len(existing_numbers)):
        if existing_numbers[i] != existing_numbers[i-1] + 1:
            return existing_numbers[i-1] + 1
    
    # If no gaps, return next number after last
    return existing_numbers[-1] + 1

async def update_counter(tenant_id: str,value: int):
    """Update the counter with proper value."""
    counter_collection = get_purchaseuom_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "purchaseuomId"},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

async def initialize_counter_if_needed(tenant_id: str):
    """Initialize counter to the next available number."""
    next_number = await find_next_available_number(tenant_id)
    await update_counter(tenant_id,next_number)

async def generate_sequential_id(tenant_id: str):
    """Generate a UOxxx ID that fills gaps."""
    # Get next available number
    next_number = await find_next_available_number(tenant_id)
    
    # Update counter to this number + 1 (for next call)
    await update_counter(tenant_id,next_number + 1)
    
    return f"UO{next_number:03d}"

@router.post("/reset-sequence")
async def reset_sequence(request: Request):
    tenant_id = request.state.tenant_id
    await initialize_counter_if_needed(tenant_id)
    return {"message": "Sequence reset to fill all gaps"}


@router.post("/", response_model=str)
async def create_purchaseuom(purchaseuom: PurchaseUOMPost,request: Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "add"))):
    """Create a new purchase UOM with a sequential ID."""
    tenant_id = request.state.tenant_id
    current_datetime = get_localized_datetime()
    await initialize_counter_if_needed(tenant_id)

    # Generate sequential ID that fills gaps
    sequential_id = await generate_sequential_id(tenant_id)

    new_purchaseuom_data = purchaseuom.dict()
    new_purchaseuom_data.update({
        'randomId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime,
        'lastUpdatedDate': current_datetime
    })

    collection = get_purchaseuom_collection(tenant_id)
    result = await collection.insert_one(new_purchaseuom_data)    
    return str(result.inserted_id)

@router.get("/", response_model=List[PurchaseUOM])
async def get_all_purchaseuom(request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "read"))):
    """Get all purchase UOMs.""" 
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    purchaseuoms = await collection.find().to_list(None)
    formatted_purchaseuoms = [
        {**purchaseuom, "purchaseuomId": str(purchaseuom["_id"])} for purchaseuom in purchaseuoms
    ]
    return [PurchaseUOM(**purchaseuom) for purchaseuom in formatted_purchaseuoms]

@router.get("/{purchaseuom_id}", response_model=PurchaseUOM)
async def get_purchaseuom_by_id(purchaseuom_id: str,request: Request, user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    """Get a specific purchase UOM by ID."""
    purchaseuom = await collection.find_one({"_id": ObjectId(purchaseuom_id)})
    if purchaseuom:
        purchaseuom["purchaseuomId"] = str(purchaseuom["_id"])
        return PurchaseUOM(**purchaseuom)
    else:
        raise HTTPException(status_code=404, detail="PurchaseUOM not found")

@router.put("/{purchaseuom_id}")
async def update_purchaseuom(purchaseuom_id: str, purchaseuom: PurchaseUOMPost,request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    current_datetime = get_localized_datetime()
    
    updated_purchaseuom = purchaseuom.dict(exclude_unset=True)
    updated_purchaseuom['lastUpdatedDate'] = current_datetime
    
    result = await collection.update_one(
        {"_id": ObjectId(purchaseuom_id)}, 
        {"$set": updated_purchaseuom}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseUOM not found")
    return {"message": "PurchaseUOM updated successfully"}

@router.patch("/{purchaseuom_id}")
async def patch_purchaseuom(purchaseuom_id: str,request: Request, purchaseuom_patch: PurchaseUOMPost,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    """Update specific fields of an existing purchase UOM."""
    current_datetime = get_localized_datetime()
    
    existing_purchaseuom = await collection.find_one({"_id": ObjectId(purchaseuom_id)})
    if not existing_purchaseuom:
        raise HTTPException(status_code=404, detail="PurchaseUOM not found")

    updated_fields = {key: value for key, value in purchaseuom_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] = current_datetime
        
        result = await collection.update_one(
            {"_id": ObjectId(purchaseuom_id)},
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update PurchaseUOM")

    updated_purchaseuom = await collection.find_one({"_id": ObjectId(purchaseuom_id)})
    updated_purchaseuom["purchaseuomId"] = str(updated_purchaseuom["_id"])
    return PurchaseUOM(**updated_purchaseuom)

@router.post("/import-csv")
async def import_csv_data(request: Request,file: UploadFile = File(...), user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "add"))):
    """Import UOM data from CSV with sequential ID generation."""
    try:
        tenant_id = request.state.tenant_id
        collection = get_purchaseuom_collection(tenant_id)
        counter_collection = collection.database["counters"]
        current_datetime = get_localized_datetime()

        content = await file.read()
        try:
            decoded = content.decode("utf-8-sig").splitlines()
            csv_reader = csv.DictReader(decoded)
            csv_data = list(csv_reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

        # Check if required fields exist in CSV header
        if not all(field in csv_reader.fieldnames for field in ['uom', 'precisionValue']):
            raise HTTPException(
                status_code=400,
                detail="CSV file must contain both 'uom' and 'precisionValue' columns"
            )

        # Get existing numbers and find next available
        next_number = await find_next_available_number(tenant_id)
        
        operations = []
        new_count = 0
        update_count = 0
        skipped_count = 0
        error_rows = []
        processed_uoms = set()  # Track processed UOMs to avoid duplicates in CSV
        
        for idx, row in enumerate(csv_data, 1):
            try:
                uom = row.get('uom', '').strip()
                precision_value = row.get('precisionValue', '').strip()
                
                # Validate required fields
                if not uom:
                    raise ValueError("UOM name is required and cannot be empty")
                if not precision_value:
                    raise ValueError("Precision value is required and cannot be empty")
                
                # Check if precision value is valid
                try:
                    float(precision_value)
                except ValueError:
                    raise ValueError("Precision value must be a number")
                
                # Skip if we've already processed this UOM in this CSV
                if uom in processed_uoms:
                    skipped_count += 1
                    continue
                    
                processed_uoms.add(uom)
                
                existing_uom = await collection.find_one({'uom': uom})
                
                if existing_uom:
                    # Update existing UOM if precision is different
                    if existing_uom['precisionValue'] != precision_value:
                        operations.append(UpdateOne(
                            {'_id': existing_uom['_id']},
                            {'$set': {
                                'precisionValue': precision_value,
                                'lastUpdatedDate': current_datetime
                            }}
                        ))
                        update_count += 1
                    else:
                        skipped_count += 1
                else:
                    # Generate sequential ID and reserve it
                    sequential_id = f"UO{next_number:03d}"
                    next_number += 1
                    
                    operations.append(InsertOne({
                        'uom': uom,
                        'precisionValue': precision_value,
                        'status': 'active',
                        'randomId': sequential_id,
                        'createdDate': current_datetime,
                        'lastUpdatedDate': current_datetime
                    }))
                    new_count += 1
                    
            except ValueError as e:
                error_rows.append({
                    "row_number": idx,
                    "error": str(e)
                })
                skipped_count += 1
                continue
        
        if operations:
            # Update counter to the next available number
            await counter_collection.update_one(
                {"_id": "purchaseuomId"},
                {"$set": {"sequence_value": next_number}},
                upsert=True
            )
            
            # Execute all operations
            result = await collection.bulk_write(operations)
            
            response = {
                "message": f"Import completed: {new_count} new, {update_count} updated, {skipped_count} skipped",
                "new_count": new_count,
                "updated_count": update_count,
                "skipped_count": skipped_count
            }
            
            if error_rows:
                response["error_details"] = {
                    "total_errors": len(error_rows),
                    "sample_errors": error_rows[:5]  # Show first 5 errors to avoid huge responses
                }
            
            return response
        
        raise HTTPException(status_code=400, detail="No valid records to import")

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Import error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.get("/export-uom/export-csv")
async def export_all_purchase_uoms_to_csv(request: Request,user = Depends(validate_token),


    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    """Export all active purchase UOMs to a CSV file."""
    try:
        
        records = await collection.find(
            {"status": "active"}, 
            {'_id': 0, 'createdDate': 1, 'lastUpdatedDate': 1, 
             'uom': 1, 'precisionValue': 1, 'status': 1, 'randomId': 1}
        ).to_list(None)
        
        if not records:
            raise HTTPException(status_code=404, detail="No active UOMs found to export")

        csv_stream = io.StringIO()
        
        fieldnames = [
            "randomId",
            "uom", 
            "precisionValue",
            "status",
            "createdDate",
            "lastUpdatedDate",
        ]

        writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        writer.writeheader()

        for record in records:
            # Format date fields
            for field in ['createdDate', 'lastUpdatedDate']:
                if field in record and isinstance(record[field], datetime):
                    record[field] = record[field].strftime('%d-%m-%Y')
            
            writer.writerow(record)
        
        csv_stream.seek(0)
        
        return StreamingResponse(
            csv_stream, 
            media_type="text/csv", 
            headers={"Content-Disposition": "attachment; filename=active_uoms_export.csv"}
        )
    
    except Exception as e:
        logging.error(f"Error exporting UOMs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting UOMs: {str(e)}")
    

@router.patch("/{purchaseuom_id}/deactivate")
async def deactivate_purchaseuom(purchaseuom_id: str,request: Request,
   user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    """Deactivate a purchase UOM with delete permission."""
    current_datetime = get_localized_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(purchaseuom_id)}, 
        {"$set": {
            'status': 'deactivated',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseUOM not found")
    return {"message": "PurchaseUOM deactivated successfully"}

@router.patch("/{purchaseuom_id}/activate")
async def activate_purchaseuom(purchaseuom_id: str,request: Request,
    user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchaseuom", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseuom_collection(tenant_id)
    """Activate a purchase UOM with delete permission."""
    current_datetime = get_localized_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(purchaseuom_id)}, 
        {"$set": {
            'status': 'active',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseUOM not found")
    return {"message": "PurchaseUOM activated successfully"}