# routes.py
from datetime import datetime
from fastapi import APIRouter, HTTPException,Depends,Request
from typing import List
from bson import ObjectId
import pytz
from .models import Personal, PersonalPost
from utils.database import get_personaldetails_collection
from middlewares.permission_middleware import check_permission
router = APIRouter()

# Helper functions for counter and randomId generation for personalId
async def get_next_counter_value(tenant_id: str):
    counter_collection = get_personaldetails_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one_and_update(
        {"_id": "personalId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

async def reset_counter(tenant_id:str):
    counter_collection = get_personaldetails_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "personalId"},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )

async def generate_random_id(tenant_id:str):
    counter_value = await get_next_counter_value(tenant_id)
    return f"PD{counter_value:03d}"  # Generate ID in the format PD001, PD002, etc.

# Function to get the current date and time with timezone as a datetime object
def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    try:
        specified_timezone = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")
    
    now = datetime.now(specified_timezone)
    return {"datetime": now}  # Return dict with timezone-aware datetime

# Create new personal details
@router.post("/", response_model=str)
async def create_personal(request: Request,personal: PersonalPost):
    tenant_id = request.state.tenant_id
    collection = get_personaldetails_collection(tenant_id)
    # Check if the collection is empty and reset the counter if it is
    if await collection.count_documents({}) == 0:
        await reset_counter(tenant_id)

    # Generate randomId for personal ID
    random_id = await generate_random_id(tenant_id)

    # Prepare data to be inserted
    new_personal_data = personal.dict(exclude_unset=True)
    new_personal_data['randomId'] = random_id
    new_personal_data['createdDate'] = get_current_date_and_time()['datetime']
    new_personal_data['lastUpdatedDate'] = get_current_date_and_time()['datetime']  # Standardized field name
    new_personal_data['status'] = new_personal_data.get('status', 'active')  # Default to 'active'

    # Insert into MongoDB
    result = await collection.insert_one(new_personal_data)
    return str(result.inserted_id)  # Return the MongoDB-generated ObjectId as a string

# Get all personal details
@router.get("/", response_model=List[Personal])
async def get_all_personal(request: Request):
    tenant_id = request.state.tenant_id
    collection = get_personaldetails_collection(tenant_id)
    # Use async iteration to fetch all documents
    personals = [personal async for personal in collection.find()]
    
    formatted_personal = []
    for personal in personals:
        personal_copy = personal.copy()
        personal_copy["personalId"] = str(personal["_id"])  # Convert ObjectId to string
        personal_copy.pop("_id", None)  # Remove raw _id
        formatted_personal.append(Personal(**personal_copy))  # Convert to Personal model
    return formatted_personal

# Get personal detail by ID
@router.get("/{personal_id}", response_model=Personal)
async def get_personal_by_id(personal_id: str,request: Request,):
    tenant_id = request.state.tenant_id
    collection = get_personaldetails_collection(tenant_id)
    try:
        personal = await collection.find_one({"_id": ObjectId(personal_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid personal_id format")
    
    if personal:
        personal_copy = personal.copy()
        personal_copy["personalId"] = str(personal["_id"])  # Convert ObjectId to string
        personal_copy.pop("_id", None)  # Remove raw _id
        return Personal(**personal_copy)  # Return Personal model object
    else:
        raise HTTPException(status_code=404, detail="Personal not found")

# Update personal details (PUT)
@router.put("/{personal_id}")
async def update_personal( request: Request,personal_id: str, personal: PersonalPost):
    tenant_id = request.state.tenant_id
    collection = get_personaldetails_collection(tenant_id)
    try:
        ObjectId(personal_id)  # Validate ID format
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid personal_id format")
    
    updated_personal = personal.dict(exclude_unset=True)  # Only update fields that are set
    updated_personal['lastUpdatedDate'] = get_current_date_and_time()['datetime']  # Update timestamp
    
    result = await collection.update_one(
        {"_id": ObjectId(personal_id)}, 
        {"$set": updated_personal}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Personal not found")
    return {"message": "Personal updated successfully"}

# Patch personal details
@router.patch("/{personal_id}")
async def patch_personal(request: Request,personal_id: str, personal_patch: PersonalPost):
    tenant_id = request.state.tenant_id
    collection = get_personaldetails_collection(tenant_id)
    try:
        ObjectId(personal_id)  # Validate ID format
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid personal_id format")
    
    existing_personal = await collection.find_one({"_id": ObjectId(personal_id)})
    if not existing_personal:
        raise HTTPException(status_code=404, detail="Personal not found")

    updated_fields = {
        key: value for key, value in personal_patch.dict(exclude_unset=True).items() 
        if value is not None
    }
    if updated_fields:
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']  # Update timestamp
        result = await collection.update_one(
            {"_id": ObjectId(personal_id)}, 
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update personal")

    # Fetch updated document
    updated_personal = await collection.find_one({"_id": ObjectId(personal_id)})
    updated_personal_copy = updated_personal.copy()
    updated_personal_copy["personalId"] = str(updated_personal["_id"])
    updated_personal_copy.pop("_id", None)
    return Personal(**updated_personal_copy)

# Delete personal details by ID
@router.delete("/{personal_id}")
async def delete_personal( request: Request,personal_id: str):
    tenant_id = request.state.tenant_id
    collection = get_personaldetails_collection(tenant_id)
    try:
        ObjectId(personal_id)  # Validate ID format
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid personal_id format")
    
    result = await collection.delete_one({"_id": ObjectId(personal_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Personal not found")

    return {"message": "Personal deleted successfully"}