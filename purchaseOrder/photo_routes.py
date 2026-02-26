import ftplib
import io
import logging
import os
from typing import List
from fastapi import APIRouter, File, HTTPException, Response, UploadFile,Depends,Request
from PIL import Image
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token

from utils.database import get_image_collection

router = APIRouter()

# FTP Configuration
FTP_HOST = "194.233.78.90"
FTP_USER = "yenerp.com_thys677l7kc"
FTP_PASSWORD = "PUTndhivxi6x94^%"
FTP_UPLOAD_DIR = "/httpdocs/share/upload/purchaseorder/receipts"
BASE_URL = "https://yenerp.com/share/upload"


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
        return f"{BASE_URL}/purchaseorder/receipts/{remote_filename}"
    
    except Exception as e:
        logging.error(f"FTP Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FTP upload failed: {str(e)}")

@router.post("/upload/{photo_id}")
async def upload_photos(request:Request,
    photo_id: str,
    files: List[UploadFile] = File(...),user = Depends(validate_token),
     permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "add"))
):
    tenant_id = request.state.tenant_id
    
    # ✅ GET TENANT-SPECIFIC COLLECTION
    collection = get_image_collection(tenant_id)
    try:
        # Ensure the document exists, if not create it
        photo_document = collection.find_one({"_id": photo_id})
        if not photo_document:
            # If no document exists, create one
            collection.insert_one({
                "_id": photo_id,
                "photos": []
            })
            photos_info = []
        else:
            photos_info = photo_document.get("photos", [])

        # Check if maximum photo limit is reached (optional)
        max_photos = 3
        if len(photos_info) >= max_photos:
            raise HTTPException(status_code=400, detail=f"Maximum of {max_photos} photos allowed.")

        # Assign index based on the current number of photos
        current_index = len(photos_info) + 1

        uploaded_photos = []

        # Process each uploaded file
        for idx, file in enumerate(files):
            content = await file.read()

            # Compress the image
            compressed_content = compress_image(content)

            # Define the filename for the FTP server
            filename = f"{photo_id}_{current_index + idx}.webp"

            # Upload the compressed file to the FTP server
            ftp_path = await upload_to_ftp(compressed_content, filename,tenant_id)

            # Add the FTP path to the MongoDB document with index
            collection.update_one(
                {"_id": photo_id},
                {"$push": {"photos": {
                    "index": current_index + idx,
                    "ftp_path": ftp_path
                }}}
            )

            # Track uploaded photos
            uploaded_photos.append({
                "index": current_index + idx,
                "ftp_path": ftp_path
            })

            # Enforce photo upload limit if necessary
            if len(photos_info) + len(uploaded_photos) >= max_photos:
                break

        return {"message": f"{len(uploaded_photos)} photo(s) uploaded successfully", "uploaded_photos": uploaded_photos}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading photos: {str(e)}")
    
@router.get("/view/{photo_id}/{index}")
async def get_photo_by_index(request:Request,
    photo_id: str,
    index: int,
    response: Response,user = Depends(validate_token),
     permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    tenant_id = request.state.tenant_id
    
    # ✅ GET TENANT COLLECTION
    collection = get_image_collection(tenant_id)
    try:
        # Try to find by _id first
        photo_document = collection.find_one({"_id": photo_id})
        
        # If not found by _id, try other common fields
        if not photo_document:
            photo_document = collection.find_one({"purchase_id": photo_id})
        
        if not photo_document:
            photo_document = collection.find_one({"ticket_id": photo_id})
        
        if not photo_document:
            raise HTTPException(status_code=404, detail="Photos not found for the provided ID")
        
        photos = photo_document.get("photos", [])
        if index < 1 or index > len(photos):
            raise HTTPException(status_code=404, detail=f"No photo found for index {index}")
        
        photo_info = photos[index - 1]
        ftp_path = photo_info.get("ftp_path")
        
        if not ftp_path:
            raise HTTPException(status_code=404, detail="FTP path not found for the selected photo")
        
        return {"imageUrl": ftp_path}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching photo: {str(e)}")

@router.get("/view-all/{purchase_id}")
async def get_all_ticket_images(request:Request,
    purchase_id: str,
    response: Response,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
    tenant_id = request.state.tenant_id
    
    # ✅ GET TENANT COLLECTION
    collection = get_image_collection(tenant_id)
    # Add headers to prevent caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    try:
        # Try multiple ways to find the document
        ticket_document = collection.find_one({"_id": purchase_id})
        
        if not ticket_document:
            ticket_document = collection.find_one({"purchase_id": purchase_id})
        
        if not ticket_document:
            raise HTTPException(status_code=404, detail="Purchase not found")
        
        # Extract all photos
        photos = ticket_document.get("photos", [])
        if not photos:
            raise HTTPException(status_code=404, detail="No images found for this purchase")
        
        # Return all image URLs
        image_urls = [photo.get("ftp_path") for photo in photos if photo.get("ftp_path")]
        return {"imageUrls": image_urls}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching images: {str(e)}")

# Debug endpoint to check what's in your collection
@router.get("/debug/{photo_id}")
async def debug_photo_document(request:Request,photo_id: str):
    """Debug endpoint to see the actual document structure"""
    tenant_id = request.state.tenant_id
    
    # ✅ GET TENANT COLLECTION
    collection = get_image_collection(tenant_id)
    try:
        # Check all possible ways to find the document
        by_id = collection.find_one({"_id": photo_id})
        by_purchase_id = collection.find_one({"purchase_id": photo_id})
        
        # Get a sample document to see structure
        sample_doc = collection.find_one()
        
        return {
            "searched_id": photo_id,
            "found_by_id": by_id is not None,
            "found_by_purchase_id": by_purchase_id is not None,
            "sample_document_structure": {
                "fields": list(sample_doc.keys()) if sample_doc else [],
                "_id": sample_doc.get("_id") if sample_doc else None,
                "purchase_id": sample_doc.get("purchase_id") if sample_doc else None
            }
        }
    except Exception as e:
        return {"error": str(e)}
@router.patch("/edit/{photo_id}/{index}")
async def edit_photo_by_index(request:Request,
    photo_id: str,
    index: int,
    file: UploadFile = File(...),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "edit"))
):
    tenant_id = request.state.tenant_id
    
    # ✅ GET TENANT COLLECTION
    collection = get_image_collection(tenant_id)
    try:
        # Retrieve document from MongoDB
        photo_document = collection.find_one({"_id": photo_id})
        if not photo_document:
            raise HTTPException(status_code=404, detail="Photos not found for the provided ID")

        # Find the photo by index
        photo_info = next((photo for photo in photo_document.get("photos", []) if photo["index"] == index), None)
        if not photo_info:
            raise HTTPException(status_code=404, detail=f"No photo found for index {index}")

        ftp_path = photo_info.get("ftp_path")
        if not ftp_path:
            raise HTTPException(status_code=404, detail="FTP path not found in the document")

        # Extract the filename from the FTP path
        filename = ftp_path.split("/")[-1]

        # Connect to the FTP server
        ftp = ftplib.FTP()
        ftp.set_pasv(True)
        ftp.connect(FTP_HOST, 21, timeout=10)
        ftp.login(FTP_USER, FTP_PASSWORD)
        ftp.cwd(FTP_UPLOAD_DIR)

        # Check if the file exists on the FTP server
        files_list = ftp.nlst()
        if filename in files_list:
            # If the file exists, delete it before uploading the new one
            ftp.delete(filename)

        # Overwrite the file with the new content
        content = await file.read()
        ftp.storbinary(f"STOR {filename}", io.BytesIO(content))
        ftp.quit()

        return {"message": f"Photo at index {index} updated successfully"}

    except ftplib.all_errors as e:
        raise HTTPException(status_code=500, detail=f"FTP error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating photo: {str(e)}")

