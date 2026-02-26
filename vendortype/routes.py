from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException,Depends
from bson import ObjectId
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from utils.database import get_counter_collection, get_vendortype_collection
from .models import VendorType, VendorTypePost
import pytz
from fastapi import Request
router = APIRouter()

# Counter functions
async def get_next_counter_value(tenant_id:str):
    counter_collection = get_counter_collection(tenant_id)
    counter = counter_collection.find_one_and_update(
        {"_id": "vendortypeId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

async def reset_counter(tenant_id:str):
    counter_collection = get_counter_collection(tenant_id)
    counter_collection.update_one(
        {"_id": "vendortypeId"},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )

async def generate_random_id(tenant_id:str):
    counter_value = await get_next_counter_value(tenant_id)
    return f"VT{counter_value:03d}"

# Function to get current datetime with timezone
def get_current_datetime():
    return datetime.now(pytz.timezone("Asia/Kolkata"))

# CREATE - Create new vendor type
@router.post("/", response_model=VendorType)
async def create_vendortype(request: Request, vendortype: VendorTypePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "add"))):

    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

    if await collection.count_documents({}) == 0:
        await reset_counter(tenant_id)

    random_id = await generate_random_id(tenant_id)
    current_time = get_current_datetime()

    new_vendortype_data = vendortype.dict()
    new_vendortype_data.update({
        "randomId": random_id,
        "createdDate": current_time,
        "lastUpdatedDate": current_time,
        "status": "active"
    })

    result = await collection.insert_one(new_vendortype_data)

    new_vendortype_data["vendortypeId"] = str(result.inserted_id)

    return VendorType(**new_vendortype_data)

# READ - Get all vendor types
@router.get("/", response_model=List[VendorType])
async def get_all_vendortype(request:Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)
    vendortypes = await collection.find().to_list(length=None)
    
    formatted_vendortype = []
    for vendortype in vendortypes:
        vendortype["vendortypeId"] = str(vendortype["_id"])
        formatted_vendortype.append(VendorType(**vendortype))
    return formatted_vendortype

# READ - Get vendor type by ID
@router.get("/{vendortype_id}", response_model=VendorType)
async def get_vendortype_by_id(request:Request,vendortype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

    
    
    if not ObjectId.is_valid(vendortype_id):
        raise HTTPException(status_code=400, detail="Invalid vendor type ID format")
    
    vendortype = await collection.find_one({"_id": ObjectId(vendortype_id)})
    if vendortype:
        vendortype["vendortypeId"] = str(vendortype["_id"])
        return VendorType(**vendortype)
    else:
        raise HTTPException(status_code=404, detail="VendorType not found")

# READ - Get vendor type by randomId
@router.get("/by-random/{random_id}", response_model=VendorType)
async def get_vendortype_by_random_id(request:Request,random_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

   
    vendortype = await collection.find_one({"randomId": random_id})
    
    if vendortype:
        vendortype["vendortypeId"] = str(vendortype["_id"])
        return VendorType(**vendortype)
    else:
        raise HTTPException(status_code=404, detail="VendorType not found")

# UPDATE - Full update (PUT)
@router.put("/{vendortype_id}")
async def update_vendortype(request:Request,vendortype_id: str, vendortype: VendorTypePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

   
    
    if not ObjectId.is_valid(vendortype_id):
        raise HTTPException(status_code=400, detail="Invalid vendor type ID format")
    
    # Get current datetime for lastUpdatedDate
    current_time = get_current_datetime()
    
    # Prepare update data
    updated_vendortype = vendortype.dict(exclude_unset=True)
    updated_vendortype['lastUpdatedDate'] = current_time
    
    # Perform update
    result = await collection.update_one(
        {"_id": ObjectId(vendortype_id)},
        {"$set": updated_vendortype}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="VendorType not found")
    
    return {"message": "VendorType updated successfully"}

# UPDATE - Partial update (PATCH)
@router.patch("/{vendortype_id}")
async def patch_vendortype(request:Request,vendortype_id: str, vendortype_patch: VendorTypePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

   
    
    if not ObjectId.is_valid(vendortype_id):
        raise HTTPException(status_code=400, detail="Invalid vendor type ID format")
    
    # Check if vendor type exists
    existing_vendortype = await collection.find_one({"_id": ObjectId(vendortype_id)})
    if not existing_vendortype:
        raise HTTPException(status_code=404, detail="VendorType not found")

    # Get current datetime for lastUpdatedDate
    current_time = get_current_datetime()
    
    # Prepare update fields (exclude unset fields and None values)
    updated_fields = {key: value for key, value in vendortype_patch.dict(exclude_unset=True).items() if value is not None}
    updated_fields['lastUpdatedDate'] = current_time
    
    # Perform update if there are fields to update
    if updated_fields:
        result = await collection.update_one(
            {"_id": ObjectId(vendortype_id)},
            {"$set": updated_fields}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update VendorType")

    # Return updated vendor type
    updated_vendortype = await collection.find_one({"_id": ObjectId(vendortype_id)})
    updated_vendortype["vendortypeId"] = str(updated_vendortype["_id"])
    return VendorType(**updated_vendortype)
@router.patch("/{vendortype_id}/deactivate")
async def deactivate_vendortype(request:Request,
    vendortype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

    """Deactivate a vendor type (soft delete)"""
  
    
    if not ObjectId.is_valid(vendortype_id):
        raise HTTPException(status_code=400, detail="Invalid vendor type ID format")
    
    current_time = get_current_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(vendortype_id)},
        {"$set": {
            'status': 'deactivated',
            'lastUpdatedDate': current_time
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="VendorType not found")
    
    updated_vendortype = await collection.find_one({"_id": ObjectId(vendortype_id)})
    if updated_vendortype:
        updated_vendortype["vendortypeId"] = str(updated_vendortype["_id"])
        del updated_vendortype["_id"]
        return VendorType(**updated_vendortype)
    
    raise HTTPException(status_code=404, detail="VendorType not found after update")

# ✅ ACTIVATE - Separate endpoint for activation (with delete permission)
@router.patch("/{vendortype_id}/activate")
async def activate_vendortype(request:Request,
    vendortype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

    """Activate a vendor type"""
    
    
    if not ObjectId.is_valid(vendortype_id):
        raise HTTPException(status_code=400, detail="Invalid vendor type ID format")
    
    current_time = get_current_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(vendortype_id)},
        {"$set": {
            'status': 'active',
            'lastUpdatedDate': current_time
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="VendorType not found")
    
    updated_vendortype = await collection.find_one({"_id": ObjectId(vendortype_id)})
    if updated_vendortype:
        updated_vendortype["vendortypeId"] = str(updated_vendortype["_id"])
        del updated_vendortype["_id"]
        return VendorType(**updated_vendortype)
    
    raise HTTPException(status_code=404, detail="VendorType not found after update")

# DELETE - Delete vendor type
@router.delete("/{vendortype_id}")
async def delete_vendortype(request:Request,vendortype_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "vendortype", "delete"))):
    tenant_id = request.state.tenant_id
    collection = get_vendortype_collection(tenant_id)

    
    
    if not ObjectId.is_valid(vendortype_id):
        raise HTTPException(status_code=400, detail="Invalid vendor type ID format")
    
    result = await collection.delete_one({"_id": ObjectId(vendortype_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="VendorType not found")
    
    return {"message": "VendorType deleted successfully"}

# Utility endpoint to get current time (for testing)
@router.get("/utils/current-time")
async def get_current_time(request:Request):
    return {"current_time": get_current_datetime()}