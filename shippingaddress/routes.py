from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException
from bson import ObjectId
import pytz
from .models import ShippingAddress, ShippingAddressPost  # Import ShippingAddress and ShippingAddressPost models
from utils.database import get_shippingaddress_collection  # Utility function to get shipping address collection
from fastapi import Request

router = APIRouter()

# Helper functions for counter and randomId generation for shippingId
async def get_next_shipping_counter_value(tenant_id: str):
    counter_collection = get_shippingaddress_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one_and_update(
        {"_id": "shippingId"},
        {"$inc": {"sequence_value": 1}},  # Increment counter
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

async def reset_shipping_counter(tenant_id: str):
    counter_collection = get_shippingaddress_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": "shippingId"},
        {"$set": {"sequence_value": 0}},  # Reset the counter
        upsert=True
    )

async def generate_shipping_random_id(tenant_id:str):
    counter_value = await get_next_shipping_counter_value(tenant_id)
    return f"SA{counter_value:03d}"  # Shipping ID formatted like SA001, SA002, etc.

# Function to get the current date and time with timezone as a datetime object
def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    try:
        # Set the specified timezone
        specified_timezone = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")
    
    # Get the current time in the specified timezone and make it timezone-aware
    now = datetime.now(specified_timezone)
    
    return {
        "datetime": now  # Return the datetime object
    }

# Create shipping address details
@router.post("/", response_model=ShippingAddress)
async def create_shipping_address(request: Request,shipping_address: ShippingAddressPost):
    tenant_id = request.state.tenant_id
    collection = get_shippingaddress_collection(tenant_id)
    # Check if the collection is empty and reset the counter if it is
   
    if await collection.count_documents({}) == 0:
        await reset_shipping_counter(tenant_id)

    # Generate randomId (e.g., SA001, SA002)
    random_id = await generate_shipping_random_id(tenant_id)

    current_date_and_time = get_current_date_and_time()

    # Prepare the shipping address data, including the randomId
    new_shipping_data = shipping_address.dict()
    new_shipping_data['randomId'] = random_id
    new_shipping_data['status'] = 'active'
    new_shipping_data['createdDate'] = current_date_and_time['datetime']  # Add created date

    # Insert the new shipping address into MongoDB
    result = await collection.insert_one(new_shipping_data)

    # Fetch the created shipping address document from the database
    created_shipping = await collection.find_one({"_id": result.inserted_id})
    created_shipping["shippingId"] = str(created_shipping["_id"])  # Convert ObjectId to string
    
    return ShippingAddress(**created_shipping)

# Get all shipping addresses
@router.get("/", response_model=List[ShippingAddress])
async def get_all_shipping_addresses(request: Request):
    tenant_id = request.state.tenant_id
    collection = get_shippingaddress_collection(tenant_id)
    shipping_addresses = [shipping async for shipping in collection.find()]
    formatted_shipping_addresses = []
    for shipping in shipping_addresses:
        shipping["shippingId"] = str(shipping["_id"])  # Convert ObjectId to string
        formatted_shipping_addresses.append(ShippingAddress(**shipping))  # Create ShippingAddress model objects
    return formatted_shipping_addresses

# Get shipping address by ID
@router.get("/{shipping_id}", response_model=ShippingAddress)
async def get_shipping_by_id(request: Request,shipping_id: str):
    tenant_id = request.state.tenant_id
    collection = get_shippingaddress_collection(tenant_id)
    shipping = await collection.find_one({"_id": ObjectId(shipping_id)})
    if shipping:
        shipping["shippingId"] = str(shipping["_id"])  # Convert ObjectId to string
        return ShippingAddress(**shipping)  # Return ShippingAddress model object
    else:
        raise HTTPException(status_code=404, detail="Shipping address not found")

# Update shipping address details (PUT)
@router.put("/{shipping_id}")
async def update_shipping_address(request: Request,shipping_id: str, shipping_address: ShippingAddressPost):
    tenant_id = request.state.tenant_id
    collection = get_shippingaddress_collection(tenant_id)
    updated_shipping = shipping_address.dict(exclude_unset=True)  # Exclude unset fields
    result = await collection.update_one({"_id": ObjectId(shipping_id)}, {"$set": updated_shipping})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Shipping address not found")
    return {"message": "Shipping address updated successfully"}

# Patch shipping address details (PATCH)
@router.patch("/{shipping_id}")
async def patch_shipping_address(request: Request,shipping_id: str, shipping_patch: ShippingAddressPost):
    tenant_id = request.state.tenant_id
    collection = get_shippingaddress_collection(tenant_id)
    existing_shipping = await collection.find_one({"_id": ObjectId(shipping_id)})
    if not existing_shipping:
        raise HTTPException(status_code=404, detail="Shipping address not found")

    updated_fields = {key: value for key, value in shipping_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']
        result = await collection.update_one({"_id": ObjectId(shipping_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update shipping address")

    updated_shipping = await collection.find_one({"_id": ObjectId(shipping_id)})
    updated_shipping["_id"] = str(updated_shipping["_id"])
    return updated_shipping