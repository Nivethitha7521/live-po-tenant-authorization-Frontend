# routes/tenant_image_upload.py
import ftplib
import io
import logging
import os
import secrets
import string
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from PIL import Image
from bson import ObjectId, errors
import pytz

from utils.database import get_tenant_image_collection

router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

# FTP Configuration
FTP_HOST = "194.233.78.90"
FTP_USER = "yenerp.com_thys677l7kc"
FTP_PASSWORD = "PUTndhivxi6x94^%"
FTP_UPLOAD_DIR = "/httpdocs/share/upload/purchaseorder/receipts"
BASE_URL = "https://yenerp.com/share/upload/purchaseorder/receipts"

def generate_random_string(length: int = 8) -> str:
    """Generate random string for filenames"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def compress_image_to_webp(image_bytes: bytes, quality: int = 85) -> bytes:
    """Compress image to WebP format"""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'RGBA':
                background.paste(image, mask=image.split()[-1])
            else:
                background.paste(image)
            image = background
        else:
            image = image.convert("RGB")
        
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Image compression failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {str(e)}"
        )

async def upload_to_ftp(file_bytes: bytes, remote_filename: str) -> str:
    """Upload file to FTP server"""
    try:
        ftp = ftplib.FTP()
        ftp.set_pasv(True)
        ftp.connect(FTP_HOST, 21, timeout=30)
        ftp.login(FTP_USER, FTP_PASSWORD)
        
        # Ensure directory exists
        folders = FTP_UPLOAD_DIR.strip("/").split("/")
        current_path = ""
        for folder in folders:
            current_path += f"/{folder}" if current_path else folder
            try:
                ftp.cwd(current_path)
            except ftplib.error_perm:
                try:
                    ftp.mkd(current_path)
                    ftp.cwd(current_path)
                except Exception as mkdir_error:
                    logger.error(f"Failed to create directory {current_path}: {str(mkdir_error)}")
        
        # Upload file
        with io.BytesIO(file_bytes) as file_stream:
            ftp.storbinary(f"STOR {remote_filename}", file_stream)
        
        ftp.quit()
        
        return f"{BASE_URL}/{remote_filename}"
    
    except Exception as e:
        logger.error(f"FTP Upload Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"FTP upload failed: {str(e)}"
        )

def get_current_datetime() -> datetime:
    """Get current datetime in Asia/Kolkata timezone"""
    tz = pytz.timezone("Asia/Kolkata")
    return datetime.now(tz)

@router.post("/{tenant_id}/upload/{photo_id}")
async def upload_photos_with_tenant(
    tenant_id: str,
    photo_id: str,
    files: List[UploadFile] = File(...),
    max_photos: int = Query(10, ge=1, le=50, description="Maximum photos allowed")
):
    """
    Upload photos for a specific tenant
    """
    try:
        # Validate tenant ID
        try:
            ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Get tenant-specific image collection
        image_collection = get_tenant_image_collection(tenant_id)
        
        # Find or create document
        photo_document = image_collection.find_one({"_id": photo_id})
        if not photo_document:
            photo_document = {
                "_id": photo_id,
                "tenantId": tenant_id,
                "photos": [],
                "createdDate": get_current_datetime(),
                "lastUpdatedDate": get_current_datetime()
            }
            image_collection.insert_one(photo_document)
            current_index = 1
        else:
            current_index = len(photo_document.get("photos", [])) + 1
        
        # Check photo limit
        if current_index + len(files) - 1 > max_photos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot upload more than {max_photos} photos total"
            )
        
        # Validate files
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
        uploaded_photos = []
        
        for idx, file in enumerate(files):
            # Validate file type
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{file.filename}' has unsupported type '{file.content_type}'. Allowed types: {', '.join(allowed_types)}"
                )
            
            # Validate file size (max 10MB)
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{file.filename}' exceeds 10MB size limit"
                )
            
            # Compress image
            compressed_content = compress_image_to_webp(content)
            
            # Generate filename
            random_str = generate_random_string(6)
            filename = f"tenant_{tenant_id}_{photo_id}_{current_index + idx}_{random_str}.webp"
            
            # Upload to FTP
            ftp_path = await upload_to_ftp(compressed_content, filename)
            
            # Update document
            image_collection.update_one(
                {"_id": photo_id},
                {
                    "$push": {
                        "photos": {
                            "index": current_index + idx,
                            "ftp_path": ftp_path,
                            "filename": filename,
                            "original_filename": file.filename,
                            "content_type": file.content_type,
                            "uploadedAt": get_current_datetime(),
                            "size_bytes": len(compressed_content)
                        }
                    },
                    "$set": {
                        "lastUpdatedDate": get_current_datetime()
                    }
                }
            )
            
            uploaded_photos.append({
                "index": current_index + idx,
                "ftp_path": ftp_path,
                "filename": filename,
                "original_filename": file.filename,
                "size_kb": len(compressed_content) // 1024
            })
        
        return {
            "message": f"{len(uploaded_photos)} photo(s) uploaded successfully",
            "tenantId": tenant_id,
            "photoId": photo_id,
            "uploadedPhotos": uploaded_photos,
            "totalPhotos": current_index + len(uploaded_photos) - 1,
            "maxPhotos": max_photos
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading photos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading photos: {str(e)}"
        )

@router.get("/{tenant_id}/view/{photo_id}/{index}")
async def get_photo_by_index_with_tenant(
    tenant_id: str,
    photo_id: str,
    index: int
):
    """
    Get photo by index for specific tenant
    """
    try:
        # Validate tenant ID
        try:
            ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Get tenant-specific image collection
        image_collection = get_tenant_image_collection(tenant_id)
        
        # Find document
        photo_document = image_collection.find_one({"_id": photo_id})
        if not photo_document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo document not found"
            )
        
        # Find photo by index
        photos = photo_document.get("photos", [])
        photo_info = next(
            (p for p in photos if p.get("index") == index),
            None
        )
        
        if not photo_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Photo with index {index} not found"
            )
        
        return {
            "imageUrl": photo_info.get("ftp_path"),
            "index": photo_info.get("index"),
            "filename": photo_info.get("original_filename"),
            "uploadedAt": photo_info.get("uploadedAt"),
            "size_kb": photo_info.get("size_bytes", 0) // 1024
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching photo: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching photo: {str(e)}"
        )

@router.get("/{tenant_id}/view-all/{photo_id}")
async def get_all_photos_with_tenant(
    tenant_id: str,
    photo_id: str
):
    """
    Get all photos for a document in specific tenant
    """
    try:
        # Validate tenant ID
        try:
            ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Get tenant-specific image collection
        image_collection = get_tenant_image_collection(tenant_id)
        
        # Find document
        photo_document = image_collection.find_one({"_id": photo_id})
        if not photo_document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo document not found"
            )
        
        # Extract all photos
        photos = photo_document.get("photos", [])
        photo_details = []
        
        for photo in photos:
            photo_details.append({
                "index": photo.get("index"),
                "imageUrl": photo.get("ftp_path"),
                "filename": photo.get("original_filename"),
                "uploadedAt": photo.get("uploadedAt"),
                "size_kb": photo.get("size_bytes", 0) // 1024,
                "content_type": photo.get("content_type")
            })
        
        return {
            "tenantId": tenant_id,
            "photoId": photo_id,
            "photos": photo_details,
            "totalPhotos": len(photo_details),
            "createdDate": photo_document.get("createdDate"),
            "lastUpdatedDate": photo_document.get("lastUpdatedDate")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching photos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching photos: {str(e)}"
        )

@router.delete("/{tenant_id}/delete/{photo_id}/{index}")
async def delete_photo_by_index(
    tenant_id: str,
    photo_id: str,
    index: int
):
    """
    Delete a specific photo by index
    """
    try:
        # Validate tenant ID
        try:
            ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Get tenant-specific image collection
        image_collection = get_tenant_image_collection(tenant_id)
        
        # Find document
        photo_document = image_collection.find_one({"_id": photo_id})
        if not photo_document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo document not found"
            )
        
        # Find photo to delete
        photos = photo_document.get("photos", [])
        photo_to_delete = next(
            (p for p in photos if p.get("index") == index),
            None
        )
        
        if not photo_to_delete:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Photo with index {index} not found"
            )
        
        # Remove photo from array
        image_collection.update_one(
            {"_id": photo_id},
            {
                "$pull": {"photos": {"index": index}},
                "$set": {"lastUpdatedDate": get_current_datetime()}
            }
        )
        
        # TODO: Optionally delete file from FTP server
        
        return {
            "message": f"Photo with index {index} deleted successfully",
            "deletedPhoto": {
                "index": index,
                "filename": photo_to_delete.get("original_filename")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting photo: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting photo: {str(e)}"
        )

@router.get("/{tenant_id}/stats/{photo_id}")
async def get_photo_stats(
    tenant_id: str,
    photo_id: str
):
    """
    Get statistics for a photo document
    """
    try:
        # Validate tenant ID
        try:
            ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Get tenant-specific image collection
        image_collection = get_tenant_image_collection(tenant_id)
        
        # Find document
        photo_document = image_collection.find_one({"_id": photo_id})
        if not photo_document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo document not found"
            )
        
        photos = photo_document.get("photos", [])
        total_size_bytes = sum(p.get("size_bytes", 0) for p in photos)
        
        return {
            "tenantId": tenant_id,
            "photoId": photo_id,
            "totalPhotos": len(photos),
            "totalSizeMB": round(total_size_bytes / (1024 * 1024), 2),
            "createdDate": photo_document.get("createdDate"),
            "lastUpdatedDate": photo_document.get("lastUpdatedDate"),
            "photoIndexes": [p.get("index") for p in photos]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting photo stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting photo stats: {str(e)}"
        )