from datetime import datetime
import ftplib
import io
import logging
import os
from typing import List, Optional
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from bson import ObjectId
from fastapi.responses import StreamingResponse
import pytz
from .models import Business, BusinessPost # Import Business and BusinessPost models
from utils.database import get_businessdetails_collection,get_image_collection  # Make sure this utility function is implementedfrom PIL import Image
from PIL import Image
router = APIRouter()

# FTP Configuration
FTP_HOST = "194.233.78.90"
FTP_USER = "yenerp.com_thys677l7kc"
FTP_PASSWORD = "PUTndhivxi6x94^%"
FTP_UPLOAD_DIR = "/httpdocs/share/upload/business/image"
BASE_URL = "https://yenerp.com/share/upload"

# Helper functions for counter and randomId generation for businessId
def get_next_counter_value(tenant_id:str):
    counter_collection = get_businessdetails_collection(tenant_id).database["counters"]
    counter = counter_collection.find_one_and_update(
        {"_id": "businessId"},
        {"$inc": {"sequence_value": 1}},  # Increment counter
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

def reset_counter(tenant_id:str):
    counter_collection = get_businessdetails_collection(tenant_id).database["counters"]
    counter_collection.update_one(
        {"_id": "businessId"},
        {"$set": {"sequence_value": 0}},  # Reset the counter
        upsert=True
    )

def generate_random_id(tenant_id:str):
    counter_value = get_next_counter_value(tenant_id)
    return f"BD{counter_value:03d}"  # Business ID formatted like BD001, BD002, etc.

# Local temp folder for processing
LOCAL_UPLOAD_FOLDER = "./temp_uploads"
os.makedirs(LOCAL_UPLOAD_FOLDER, exist_ok=True)

def compress_image(image_bytes: bytes, max_size: int = 800) -> bytes:
    """Compresses an image and converts it to WebP format without resizing."""
    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("RGB")  # Ensure compatibility with WebP format

    # Save as WebP with compression
    compressed_io = io.BytesIO()
    image.save(compressed_io, format="WebP", quality=70)  # WebP for better compression
    return compressed_io.getvalue()


async def upload_to_ftp(file_bytes: bytes, remote_filename: str) -> str:
    """Uploads a file to the FTP server."""
    try:
        ftp = ftplib.FTP()
        ftp.set_pasv(True)
        ftp.connect(FTP_HOST, 21, timeout=200)
        ftp.login(FTP_USER, FTP_PASSWORD)

        # Ensure directory exists
        folders = FTP_UPLOAD_DIR.strip("/").split("/")
        for folder in folders:
            try:
                ftp.cwd(folder)
            except ftplib.error_perm:
                ftp.mkd(folder)
                ftp.cwd(folder)

        # Upload file using binary mode
        with io.BytesIO(file_bytes) as f:
            ftp.storbinary(f"STOR {remote_filename}", f)

        ftp.quit()
        return f"{BASE_URL}/ticketing/receipts/{remote_filename}"
    
    except Exception as e:
        logging.error(f"FTP Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FTP upload failed: {str(e)}")

# Function to get the current date and time with timezone as a datetime object
def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> datetime:
    try:
        # Set the specified timezone
        specified_timezone = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")
    
    # Get the current time in the specified timezone and make it timezone-aware
    now = datetime.now(specified_timezone)
    
    return {
        "datetime": now  # Return the ISO 8601 formatted datetime string
    }

# Create business details
@router.post("/", response_model=Business)
async def create_business(request:Request,business: BusinessPost):
    tenant_id = request.state.tenant_id
    collection = get_businessdetails_collection(tenant_id)
    # Check if the collection is empty and reset the counter if it is
    if collection.count_documents({}) == 0:
        reset_counter(tenant_id)
    
    # Generate randomId (e.g., BD001, BD002)
    random_id = generate_random_id(tenant_id)

    current_date_and_time = get_current_date_and_time()

    # Prepare the business data, including the randomId
    new_business_data = business.dict()
    new_business_data['randomId'] = random_id
    new_business_data['status']= 'active'
    new_business_data['createdDate'] = current_date_and_time['datetime']  # Add created date

    # Insert the new business into MongoDB
    result = collection.insert_one(new_business_data)

    # Fetch the created business document from the database
    created_business = collection.find_one({"_id": result.inserted_id})
    created_business["businessId"] = str(created_business["_id"])  # Convert ObjectId to string
    
    return Business(**created_business)

# Get all businesses
@router.get("/", response_model=List[Business])
async def get_all_businesses(request:Request):
    tenant_id = request.state.tenant_id
    collection = get_businessdetails_collection(tenant_id)
    businesses = list(collection.find())
    formatted_businesses = []
    for business in businesses:
        business["businessId"] = str(business["_id"])  # Convert ObjectId to string
        formatted_businesses.append(Business(**business))  # Create Business model objects
    return formatted_businesses

# Get business by ID
@router.get("/{business_id}", response_model=Business)
async def get_business_by_id(request:Request,business_id: str):
    tenant_id = request.state.tenant_id
    collection = get_businessdetails_collection(tenant_id)
    business = collection.find_one({"_id": ObjectId(business_id)})
    if business:
        business["businessId"] = str(business["_id"])  # Convert ObjectId to string
        return Business(**business)  # Return Business model object
    else:
        raise HTTPException(status_code=404, detail="Business not found")

# Update business details (PUT)
@router.put("/{business_id}")
async def update_business(request:Request,business_id: str, business: BusinessPost):
    tenant_id = request.state.tenant_id
    collection = get_businessdetails_collection(tenant_id)
    updated_business = business.dict(exclude_unset=True)  # Exclude unset fields
    result = collection.update_one({"_id": ObjectId(business_id)}, {"$set": updated_business})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"message": "Business updated successfully"}
@router.patch("/{business_id}")
async def patch_businessdetails(request:Request,business_id: str, business_patch: BusinessPost):
    tenant_id = request.state.tenant_id
    collection = get_businessdetails_collection(tenant_id)
    existing_businessdetails = collection.find_one({"_id": ObjectId(business_id)})
    if not existing_businessdetails:
        raise HTTPException(status_code=404, detail="Businessdetails not found")

    updated_fields = {key: value for key, value in business_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']
        # Preserve existing imageUrl if not being updated
        if 'imageUrl' not in updated_fields and 'imageUrl' in existing_businessdetails:
            updated_fields['imageUrl'] = existing_businessdetails['imageUrl']
            
        result = collection.update_one({"_id": ObjectId(business_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Businessdetails")

    updated_business = collection.find_one({"_id": ObjectId(business_id)})
    updated_business["_id"] = str(updated_business["_id"])
    return updated_business

@router.post("/upload")
async def upload_photo(request:Request,file: UploadFile = File(...), custom_id: Optional[str] = None):
    tenant_id = request.state.tenant_id
    collection = get_image_collection(tenant_id)
    try:
        # Read the contents of the uploaded file
        contents = await file.read()

        # Check if custom_id is provided, otherwise generate a new ObjectId
        if custom_id:
            custom_object_id = custom_id
        else:
            custom_object_id = str(ObjectId())

        # Insert the file contents into MongoDB with the custom ID
        result = collection.insert_one({
            "_id": custom_object_id,
            "filename": file.filename,
            "content": contents
        })

        # Construct the FULL BACKEND URL (not relative path)
        image_url = f"http://127.0.0.1:8000/{tenant_id}/purchasetestapi/pobusiness/view/{custom_object_id}"

        return {"filename": file.filename, "id": custom_object_id, "imageUrl": image_url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/view/{busines_id}")
async def get_photo(request:Request,busines_id: str):
    tenant_id = request.state.tenant_id
    collection = get_image_collection(tenant_id)
    try:
        # Retrieve document from MongoDB
        photo_document = collection.find_one({"_id": busines_id})

        if photo_document:
            # Retrieve content
            content = photo_document["content"]

            # Return StreamingResponse with the correct media type (image/jpeg or image/png, depending on your image)
            return StreamingResponse(io.BytesIO(content), media_type="image/jpeg")  # Adjust media_type as per your image format

        else:
            raise HTTPException(status_code=404, detail="Photo not found")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
