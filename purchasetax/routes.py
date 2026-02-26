import csv
from datetime import datetime, timedelta
import io
import logging
from typing import List
from fastapi import Request
from fastapi import APIRouter, File, HTTPException, UploadFile,Depends
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pymongo import InsertOne, UpdateOne
import pytz
from .models import PurchaseTax, PurchaseTaxPost
from utils.database import get_purchasetax_collection
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
    
    collection = get_purchasetax_collection(tenant_id)
    existing_records = await collection.find(
        {"randomId": {"$regex": "^PT\\d+$"}},
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
    existing_numbers = await get_all_existing_numbers(tenant_id)
    if not existing_numbers:
        return 1
    if existing_numbers[0] > 1:
        return 1
    for i in range(1, len(existing_numbers)):
        if existing_numbers[i] != existing_numbers[i-1] + 1:
            return existing_numbers[i-1] + 1
    return existing_numbers[-1] + 1

async def update_counter(tenant_id: str,value: int):
    counter_collection = get_purchasetax_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "purchasetaxId"},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

async def initialize_counter_if_needed(tenant_id: str):
    next_number = await find_next_available_number(tenant_id)
    await update_counter(tenant_id,next_number)

async def generate_sequential_id(tenant_id: str):
    next_number = await find_next_available_number(tenant_id)
    await update_counter(tenant_id,next_number + 1)
    return f"PT{next_number:03d}"

@router.post("/reset-sequence")
async def reset_sequence(request: Request):
    tenant_id = request.state.tenant_id
    await initialize_counter_if_needed(tenant_id)
    return {"message": "Sequence reset to fill all gaps"}

@router.post("/", response_model=str)
async def create_purchasetax(purchasetax: PurchaseTaxPost,request: Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)
    current_datetime = get_localized_datetime()
    await initialize_counter_if_needed(tenant_id)
    sequential_id = await generate_sequential_id(tenant_id)
    new_purchasetax_data = purchasetax.dict()
    new_purchasetax_data.update({
        'randomId': sequential_id,
        'status': 'active',
        'createdDate': current_datetime,
        'lastUpdatedDate': current_datetime
    })
    result = await collection.insert_one(new_purchasetax_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[PurchaseTax])
async def get_all_purchasetax(request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)
    purchasetaxs = await collection.find().to_list(None)
    formatted_purchasetax = []
    for purchasetax in purchasetaxs:
        purchasetax["purchasetaxId"] = str(purchasetax["_id"])
        formatted_purchasetax.append(PurchaseTax(**purchasetax))
    return formatted_purchasetax

@router.get("/{purchasetax_id}", response_model=PurchaseTax)
async def get_purchasetax_by_id(request: Request,purchasetax_id: str, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)
    purchasetax = await collection.find_one({"_id": ObjectId(purchasetax_id)})
    if purchasetax:
        purchasetax["purchasetaxId"] = str(purchasetax["_id"])
        return PurchaseTax(**purchasetax)
    raise HTTPException(status_code=404, detail="PurchaseTax not found")

@router.put("/{purchasetax_id}")
async def update_PurchaseTax(purchasetax_id: str,request: Request, purchasetax: PurchaseTaxPost,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "edit"))):
    current_datetime = get_localized_datetime()
    updated_purchasetax = purchasetax.dict(exclude_unset=True)
    updated_purchasetax.update({
        'lastUpdatedDate': current_datetime,
        'lastUpdatedTime': current_datetime
    })
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)

    result = await collection.update_one(
        {"_id": ObjectId(purchasetax_id)},
        {"$set": updated_purchasetax}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseTax not found")
    return {"message": "PurchaseTax updated successfully"}

@router.patch("/{purchasetax_id}")
async def patch_purchasetax(purchasetax_id: str,request: Request, purchasetax_patch: PurchaseTaxPost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)

    current_datetime = get_localized_datetime()
    existing_purchasetax = await collection.find_one({"_id": ObjectId(purchasetax_id)})
    if not existing_purchasetax:
        raise HTTPException(status_code=404, detail="PurchaseTax not found")
    updated_fields = {key: value for key, value in purchasetax_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields.update({
            'lastUpdatedDate': current_datetime,
            'lastUpdatedTime': current_datetime
        })
        result = await collection.update_one(
            {"_id": ObjectId(purchasetax_id)},
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update PurchaseTax")
        return {"message": "PurchaseTax updated successfully"}

@router.post("/import-csv")
async def import_csv_data(request: Request,file: UploadFile = File(...),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "add"))):
    tenant_id = request.state.tenant_id
    try:
        collection = get_purchasetax_collection(tenant_id)
        counter_collection = collection.database["counters"]
        current_datetime = get_localized_datetime()
        content = await file.read()
        try:
            decoded = content.decode("utf-8-sig").splitlines()
            csv_reader = csv.DictReader(decoded)
            csv_data = list(csv_reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")
        required_fields = ['ID', 'Tax Name', 'Percentage', 'Created Date', 'Updated Date', 'Status']
        if not all(field in csv_reader.fieldnames for field in ['Tax Name', 'Percentage']):
            raise HTTPException(
                status_code=400,
                detail="CSV file must contain 'Tax Name' and 'Percentage' columns"
            )
        next_number = await find_next_available_number(tenant_id)
        operations = []
        new_count = 0
        update_count = 0
        skipped_count = 0
        error_rows = []
        processed_names = set()
        successful = []
        updated = []
        for idx, row in enumerate(csv_data, 1):
            try:
                tax_name = row.get('Tax Name', '').strip()
                percentage = row.get('Percentage', '').strip()
                status = row.get('Status', 'active').strip() or 'active'
                random_id = row.get('ID', '').strip()
                if not tax_name:
                    raise ValueError("Tax Name is required and cannot be empty")
                try:
                    percentage_val = float(percentage)
                    if percentage_val < 0 or percentage_val > 100:
                        raise ValueError("Percentage must be between 0 and 100")
                except ValueError:
                    raise ValueError("Percentage must be a valid number")
                if status.lower() not in ['active', 'inactive']:
                    raise ValueError("Status must be 'active' or 'inactive'")
                if tax_name in processed_names:
                    skipped_count += 1
                    continue
                processed_names.add(tax_name)
                existing_tax = await collection.find_one({'purchasetaxName': tax_name})
                if existing_tax:
                    updates = {}
                    if existing_tax['purchasetaxPercentage'] != percentage_val:
                        updates['purchasetaxPercentage'] = percentage_val
                    if existing_tax['status'] != status:
                        updates['status'] = status
                    if updates:
                        updates['lastUpdatedDate'] = current_datetime
                        operations.append(UpdateOne(
                            {'_id': existing_tax['_id']},
                            {'$set': updates}
                        ))
                        update_count += 1
                        updated.append({
                            "row": idx,
                            "data": {
                                "randomId": existing_tax['randomId'],
                                "purchasetaxName": tax_name,
                                "purchasetaxPercentage": percentage_val,
                                "status": status,
                                "createdDate": existing_tax['createdDate'].strftime('%Y-%m-%d') if isinstance(existing_tax['createdDate'], datetime) else existing_tax['createdDate'],
                                "lastUpdatedDate": current_datetime.strftime('%Y-%m-%d')
                            },
                            "message": f"Purchase Tax updated for randomId: {existing_tax['randomId']}"
                        })
                    else:
                        skipped_count += 1
                else:
                    sequential_id = random_id if random_id else f"PT{next_number:03d}"
                    if not random_id:
                        next_number += 1
                    operations.append(InsertOne({
                        'purchasetaxName': tax_name,
                        'purchasetaxPercentage': percentage_val,
                        'status': status,
                        'randomId': sequential_id,
                        'createdDate': current_datetime,
                        'lastUpdatedDate': current_datetime
                    }))
                    new_count += 1
                    successful.append({
                        "row": idx,
                        "data": {
                            "randomId": sequential_id,
                            "purchasetaxName": tax_name,
                            "purchasetaxPercentage": percentage_val,
                            "status": status,
                            "createdDate": current_datetime.strftime('%Y-%m-%d'),
                            "lastUpdatedDate": current_datetime.strftime('%Y-%m-%d')
                        },
                        "assignedId": sequential_id
                    })
            except ValueError as e:
                error_rows.append({
                    "row": idx,
                    "data": row,
                    "error": str(e)
                })
                skipped_count += 1
                continue
        if operations:
            await counter_collection.update_one(
                {"_id": "purchasetaxId"},
                {"$set": {"sequence_value": next_number}},
                upsert=True
            )
            result = await collection.bulk_write(operations)
            response = {
                "message": f"CSV import processed successfully",
                "inserted_count": new_count,
                "updated_count": update_count,
                "successful": successful,
                "updated": updated,
                "failed": error_rows,
                "errorCount": len(error_rows),
                "max_id_number": next_number - 1 if new_count > 0 else (await find_next_available_number(tenant_id) - 1)
            }
            return response
        raise HTTPException(status_code=400, detail="No valid records to import")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Import error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.get("/export-tax/export-csv")
async def export_all_purchase_taxes_to_csv(request: Request,user = Depends(validate_token),

    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "read"))):
    tenant_id = request.state.tenant_id
    try:
        collection = get_purchasetax_collection(tenant_id)
        records = await collection.find(
            {"status": "active"},
            {'_id': 0, 'randomId': 1, 'purchasetaxName': 1, 'purchasetaxPercentage': 1, 
             'createdDate': 1, 'lastUpdatedDate': 1, 'status': 1}
        ).to_list(None)
        if not records:
            raise HTTPException(status_code=404, detail="No active purchase taxes found to export")
        csv_stream = io.StringIO()
        fieldnames = ['ID', 'Tax Name', 'Percentage', 'Created Date', 'Updated Date', 'Status']
        writer = csv.DictWriter(csv_stream, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            csv_row = {
                'ID': record['randomId'],
                'Tax Name': record['purchasetaxName'],
                'Percentage': record['purchasetaxPercentage'],
                'Created Date': record['createdDate'].strftime('%Y-%m-%d') if isinstance(record['createdDate'], datetime) else record['createdDate'],
                'Updated Date': record['lastUpdatedDate'].strftime('%Y-%m-%d') if isinstance(record['lastUpdatedDate'], datetime) else record['lastUpdatedDate'],
                'Status': record['status']
            }
            writer.writerow(csv_row)
        csv_stream.seek(0)
        return StreamingResponse(
            csv_stream,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=active_purchasetaxes_export.csv"}
        )
    except Exception as e:
        logging.error(f"Error exporting taxes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting taxes: {str(e)}")
    

@router.patch("/{purchasetax_id}/deactivate")
async def deactivate_purchasetax(purchasetax_id: str,request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "delete"))): 
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)

    current_datetime = get_localized_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(purchasetax_id)}, 
        {"$set": {
            'status': 'deactivated',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseTax not found")
    return {"message": "PurchaseTax deactivated successfully"}

@router.patch("/{purchasetax_id}/activate")
async def activate_purchasetax(purchasetax_id: str,request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasetax", "delete"))):  # ✅ "delete" permission
    tenant_id = request.state.tenant_id
    collection = get_purchasetax_collection(tenant_id)
    current_datetime = get_localized_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(purchasetax_id)}, 
        {"$set": {
            'status': 'active',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseTax not found")
    return {"message": "PurchaseTax activated successfully"}