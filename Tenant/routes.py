# routes/tenant.py - Updated version
import ftplib
import io
import logging
import os
import re
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status, BackgroundTasks
from PIL import Image
from bson import ObjectId, errors
import pytz

from Tenant.models import (
    Tenant, TenantCreate, TenantUpdate, 
    TenantStatus, TenantStats, TenantCollectionList
)
from utils.database import (
    get_tenant_collection, 
    get_sync_connection,
    get_counter_collection
)

router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

# FTP Configuration for Tenant Logos
FTP_HOST = "194.233.78.90"
FTP_USER = "yenerp.com_thys677l7kc"
FTP_PASSWORD = "PUTndhivxi6x94^%"
FTP_TENANT_DIR = "/httpdocs/share/upload/tenant/logos"
BASE_URL = "https://yenerp.com/share/upload/tenant/logos"

# Local temp folder
LOCAL_UPLOAD_FOLDER = "./temp_tenant_uploads"
os.makedirs(LOCAL_UPLOAD_FOLDER, exist_ok=True)

# ============================
# HELPER FUNCTIONS (FIXED TIMEZONE)
# ============================

def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    adjusted_time = localized_now + timedelta(hours=5, minutes=30)
    return adjusted_time.astimezone(pytz.UTC)

def get_current_datetime() -> datetime:
    """Get current datetime in correct timezone"""
    return get_localized_datetime()

def format_datetime_for_db(dt: datetime) -> datetime:
    """Ensure datetime is stored correctly in MongoDB"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=pytz.UTC)
    return dt.astimezone(pytz.UTC)

def get_next_tenant_counter() -> int:
    """Get next sequence value for tenant IDs"""
    counter_collection = get_counter_collection()
    
    result = counter_collection.find_one_and_update(
        {"_id": "tenant_counter"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return result["seq"]

def generate_tenant_random_id() -> str:
    """Generate tenant ID like TNT001"""
    seq = get_next_tenant_counter()
    return f"TNT{seq:03d}"

def generate_random_string(length: int = 12) -> str:
    """Generate random string for secure filenames"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def compress_image(image_bytes: bytes, quality: int = 85) -> bytes:
    """Compress image and convert to WebP"""
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

async def upload_logo_to_ftp(image_bytes: bytes, filename: str) -> str:
    """Upload tenant logo to FTP server"""
    try:
        ftp = ftplib.FTP()
        ftp.set_pasv(True)
        ftp.connect(FTP_HOST, 21, timeout=30)
        ftp.login(FTP_USER, FTP_PASSWORD)
        
        # Ensure directory exists
        folders = FTP_TENANT_DIR.strip("/").split("/")
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
        with io.BytesIO(image_bytes) as file_stream:
            ftp.storbinary(f"STOR {filename}", file_stream)
        
        ftp.quit()
        
        # Return full URL
        return f"{BASE_URL}/{filename}"
        
    except Exception as e:
        logger.error(f"FTP upload failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload logo: {str(e)}"
        )

def generate_database_name(tenant_name: str, random_id: str) -> str:
    """Generate database name like ABC_Company_TNT001"""

    if not tenant_name or tenant_name.strip() == "":
        return f"Tenant_{random_id}"

    cleaned = tenant_name.strip()

    # Remove special characters (keep letters, numbers, underscore, space, hyphen)
    cleaned = re.sub(r'[^\w\s-]', '', cleaned)

    # Replace spaces & hyphen with underscore
    cleaned = re.sub(r'[-\s]+', '_', cleaned)

    # Remove duplicate underscores
    cleaned = re.sub(r'_+', '_', cleaned)
    cleaned = cleaned.strip('_')

    if not cleaned:
        cleaned = "Tenant"

    # Final format → ABC_Company_TNT001
    db_name = f"{cleaned}_{random_id}"

    return db_name

def setup_tenant_database(tenant_id: str, tenant_name: str, random_id: str):
    """Create database and all empty collections for a new tenant"""
    try:
        # Get MongoDB client
        client, _ = get_sync_connection()  # Get client, ignore the db
        
        # Generate database name
        db_name = generate_database_name(tenant_name, random_id)
        logger.info(f"🔧 Creating database: {db_name} for tenant: {tenant_name}")
        
        # Get the database (creates it implicitly on first use)
        db = client[db_name]  # Use client to access database
        
        # List ALL required collections (empty collections only)
        required_collections = [
            "businessdetails",
            "vendor",
            "purchaseorder",
            "rawMaterials",
            "purchasetax",
            "service",
            "grn",
            "apInvoice",
            "outgoingpayment",
            "advancepayment",
            "Imageforpurchase",
            "storagelocation",
            "vendortype",
            "shippingaddress",
            "purchasesubcategory",
            "purchasecategory",
            "itemtype",
            "itemgroup",
            "freightMaster",
            "ServiceWorkOrder",
            "purchaseuom",
            "revertrawMaterials",
            "revertpurchasecategory",
            "personaldetails",
            "grnDebitNote",
            "ReturnReason"
        ]
        
        # Get existing collections in the database
        existing_collections = db.list_collection_names()
        logger.info(f"Existing collections in {db_name}: {existing_collections}")
        
        collections_created = []
        
        for collection_name in required_collections:
            # Check if collection exists
            if collection_name in existing_collections:
                logger.info(f"📁 Collection already exists: {collection_name}")
                continue
            
            try:
                # Create empty collection
                db.create_collection(collection_name)
                collections_created.append(collection_name)
                logger.info(f"✅ Created empty collection: {collection_name}")
                
            except Exception as e:
                logger.error(f"❌ Failed to create {collection_name}: {str(e)}")
        
        # Update tenant document with database name
        tenant_collection = get_tenant_collection()
        current_time = format_datetime_for_db(get_current_datetime())
        
        tenant_collection.update_one(
            {"_id": ObjectId(tenant_id)},
            {
                "$set": {
                    "databaseName": db_name,
                    "lastUpdatedDate": current_time
                }
            }
        )
        
        # Log summary
        logger.info(f"📊 Database setup complete for {tenant_name}:")
        logger.info(f"   Database: {db_name}")
        logger.info(f"   Collections created: {len(collections_created)} empty collections")
        logger.info(f"   Total collections now in database: {len(db.list_collection_names())}")
        
        return {
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "database_name": db_name,
            "collections_created": collections_created,
            "status": "success",
            "message": "Database created with empty collections"
        }
        
    except Exception as e:
        logger.error(f"Database setup failed: {str(e)}", exc_info=True)
        return {
            "tenant_id": tenant_id,
            "error": str(e),
            "status": "failed"
        }

# ============================
# TENANT CRUD ENDPOINTS (FIXED FIELD NAMES)
# ============================

@router.post("/", response_model=Tenant, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant: TenantCreate,
    background_tasks: BackgroundTasks
):
    """
    Create a new tenant with automatic database setup
    """
    try:
        # Check if tenant name already exists
        existing = get_tenant_collection().find_one({
            "tenantName": tenant.tenantName
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant name already exists"
            )
        
        # Generate tenant random ID
        tenant_random_id = generate_tenant_random_id()
        current_time = format_datetime_for_db(get_current_datetime())
        
        # Prepare tenant document
        tenant_doc = {
            "tenantName": tenant.tenantName,
            "description": tenant.description,
            "status": tenant.status.value,
            "tenantId": tenant_random_id,
            "createdDate": current_time,
            "lastUpdatedDate": current_time,
            "settings": {},
            "databaseName": None  # Will be set during database creation
        }
        
        # Insert tenant
        result = get_tenant_collection().insert_one(tenant_doc)
        tenant_id = str(result.inserted_id)
        
        # Setup database and collections in background if requested
        if tenant.createDefaultCollections:
            background_tasks.add_task(
                setup_tenant_database,
                tenant_id,
                tenant.tenantName,
                tenant_random_id
            )
        
        # Return created tenant with correct field names
        created_tenant = get_tenant_collection().find_one({"_id": ObjectId(tenant_id)})
        if created_tenant:
            # Add _id field for Pydantic model
            created_tenant["_id"] = str(created_tenant["_id"])
            
        return Tenant(**created_tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tenant: {str(e)}"
        )

@router.get("/", response_model=List[Tenant])
async def get_all_tenants(
    status: Optional[TenantStatus] = None,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return")
):
    """
    Get all tenants with optional filtering
    """
    try:
        query = {}
        if status:
            query["status"] = status.value
        
        tenants_cursor = get_tenant_collection().find(query).skip(skip).limit(limit).sort("createdDate", -1)
        tenants_list = []
        
        for tenant in tenants_cursor:
            # Convert ObjectId to string and ensure _id field exists
            tenant["_id"] = str(tenant["_id"])
            tenants_list.append(Tenant(**tenant))
        
        return tenants_list
        
    except Exception as e:
        logger.error(f"Failed to fetch tenants: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch tenants"
        )

@router.get("/{tenant_id}", response_model=Tenant)
async def get_tenant(tenant_id: str):
    """
    Get tenant by ID (MongoDB ObjectId)
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        # Convert ObjectId to string for Pydantic model
        tenant["_id"] = str(tenant["_id"])
        return Tenant(**tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch tenant"
        )

@router.get("/by-random-id/{random_id}", response_model=Tenant)
async def get_tenant_by_random_id(random_id: str):
    """
    Get tenant by random ID (TNT001, TNT002, etc.)
    """
    try:
        tenant = get_tenant_collection().find_one({"tenantId": random_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        # Convert ObjectId to string for Pydantic model
        tenant["_id"] = str(tenant["_id"])
        return Tenant(**tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch tenant"
        )

@router.put("/{tenant_id}", response_model=Tenant)
async def update_tenant(
    tenant_id: str,
    updates: TenantUpdate
):
    """
    Update tenant details
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Check if tenant exists
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        # Check if new name conflicts with other tenants
        if updates.tenantName:
            existing = get_tenant_collection().find_one({
                "tenantName": updates.tenantName,
                "_id": {"$ne": obj_id}
            })
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tenant name already exists"
                )
        
        # Prepare update data
        update_data = updates.dict(exclude_unset=True)
        update_data["lastUpdatedDate"] = get_current_datetime()
        
        # Perform update
        result = get_tenant_collection().update_one(
            {"_id": obj_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No changes made"
            )
        
        # Return updated tenant
        updated_tenant = get_tenant_collection().find_one({"_id": obj_id})
        updated_tenant["_id"] = str(updated_tenant["_id"])
        
        return Tenant(**updated_tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tenant: {str(e)}"
        )

@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(tenant_id: str):
    """
    Soft delete tenant by setting status to inactive
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        result = get_tenant_collection().update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "status": TenantStatus.INACTIVE.value,
                    "lastUpdatedDate": get_current_datetime()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete tenant"
        )

@router.patch("/{tenant_id}/restore", response_model=Tenant)
async def restore_tenant(tenant_id: str):
    """
    Restore inactive tenant
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        result = get_tenant_collection().update_one(
            {"_id": obj_id, "status": TenantStatus.INACTIVE.value},
            {
                "$set": {
                    "status": TenantStatus.ACTIVE.value,
                    "lastUpdatedDate": get_current_datetime()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found or not inactive"
            )
        
        # Return updated tenant
        updated_tenant = get_tenant_collection().find_one({"_id": obj_id})
        updated_tenant["_id"] = str(updated_tenant["_id"])
        
        return Tenant(**updated_tenant)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to restore tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore tenant"
        )

# ============================
# DATABASE MANAGEMENT ENDPOINTS (FIXED FIELD NAMES)
# ============================

@router.post("/{tenant_id}/setup-database")
async def setup_tenant_database_endpoint(
    tenant_id: str,
    background_tasks: BackgroundTasks
):
    """
    Setup database for an existing tenant
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Verify tenant exists
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        # Check if database already exists
        if tenant.get("databaseName"):
            return {
                "message": "Database already exists for this tenant",
                "databaseName": tenant.get("databaseName"),
                "status": "exists"
            }
        
        tenant_name = tenant.get("tenantName", "")
        random_id = tenant.get("tenantId", "")
        
        if not tenant_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant name is required"
            )
        
        # Setup database in background
        background_tasks.add_task(
            setup_tenant_database,
            tenant_id,
            tenant_name,
            random_id
        )
        
        return {
            "message": "Database setup initiated in background",
            "tenantId": random_id,  # Use tenantId as tenantId
            "mongoId": tenant_id,   # MongoDB ObjectId
            "tenantName": tenant_name,
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to setup database: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to setup database: {str(e)}"
        )

@router.get("/{tenant_id}/database-info")
async def get_tenant_database_info(tenant_id: str):
    """
    Get information about tenant's database
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Get tenant
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        db_name = tenant.get("databaseName")
        
        if not db_name:
            return {
                "tenantId": tenant.get("tenantId", ""),  # Use tenantId as tenantId
                "mongoId": tenant_id,  # MongoDB ObjectId
                "tenantName": tenant.get("tenantName"),
                "databaseName": None,
                "databaseStatus": "not_created",
                "message": "Database not yet created. Use /setup-database endpoint."
            }
        
        # Get MongoDB client
        client, _ = get_sync_connection()  # Get client
        
        try:
            # Check if database exists by trying to list its collections
            db = client[db_name]  # Access database through client
            collections = db.list_collection_names()
            
            return {
                "tenantId": tenant.get("tenantId", ""),  # Use tenantId as tenantId
                "mongoId": tenant_id,  # MongoDB ObjectId
                "tenantName": tenant.get("tenantName"),
                "databaseName": db_name,
                "databaseStatus": "active",
                "totalCollections": len(collections),
                "collections": collections,
                "createdDate": tenant.get("createdDate").isoformat() if tenant.get("createdDate") else None
            }
        except Exception as e:
            # Database might not exist or might be inaccessible
            logger.error(f"Failed to access database {db_name}: {str(e)}")
            return {
                "tenantId": tenant.get("tenantId", ""),  # Use tenantId as tenantId
                "mongoId": tenant_id,  # MongoDB ObjectId
                "tenantName": tenant.get("tenantName"),
                "databaseName": db_name,
                "databaseStatus": "error",
                "message": f"Failed to access database: {str(e)}"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get database info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get database info: {str(e)}"
        )

@router.get("/{tenant_id}/collections", response_model=TenantCollectionList)
async def list_tenant_collections(tenant_id: str):
    """
    List all collections belonging to a tenant
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Verify tenant exists
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        db_name = tenant.get("databaseName")
        if not db_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant database not created yet"
            )
        
        # Get MongoDB client
        client, _ = get_sync_connection()
        
        try:
            db = client[db_name]  # Access database through client
            collections = db.list_collection_names()
        except Exception as e:
            logger.error(f"Failed to access database {db_name}: {str(e)}")
            collections = []
        
        return TenantCollectionList(
            tenantId=tenant.get("tenantId", ""),  # Use tenantId as tenantId
            collections=collections,
            totalCollections=len(collections)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list collections: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list collections"
        )

@router.get("/{tenant_id}/stats", response_model=TenantStats)
async def get_tenant_stats(tenant_id: str):
    """
    Get statistics for a tenant
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Verify tenant exists
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        db_name = tenant.get("databaseName")
        if not db_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant database not created yet"
            )
        
        # Get MongoDB client
        client, _ = get_sync_connection()
        
        try:
            db = client[db_name]  # Access database through client
            collections = db.list_collection_names()
        except Exception as e:
            logger.error(f"Failed to access database {db_name}: {str(e)}")
            collections = []
        
        # Count documents in each collection
        collection_stats = {}
        total_documents = 0
        
        for coll_name in collections:
            try:
                count = db[coll_name].estimated_document_count()
                collection_stats[coll_name] = count
                total_documents += count
            except Exception as e:
                logger.warning(f"Failed to count documents in {coll_name}: {str(e)}")
                collection_stats[coll_name] = 0
        
        return TenantStats(
            tenantId=tenant.get("tenantId", ""),  # Use tenantId as tenantId
            tenantName=tenant.get("tenantName"),
            databaseName=db_name,
            totalCollections=len(collections),
            totalDocuments=total_documents,
            collectionStats=collection_stats,
            createdDate=tenant.get("createdDate"),
            status=TenantStatus(tenant.get("status"))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get statistics"
        )

# ============================
# LOGO UPLOAD ENDPOINTS (Keep as is)
# ============================

@router.post("/{tenant_id}/logo")
async def upload_tenant_logo(
    tenant_id: str,
    file: UploadFile = File(...)
):
    """
    Upload logo for tenant
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        # Verify tenant exists
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{file.content_type}' not allowed. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Read file
        file_bytes = await file.read()
        
        # Validate file size (max 10MB)
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds 10MB limit"
            )
        
        # Compress image
        compressed_bytes = compress_image(file_bytes)
        
        # Generate secure filename
        random_string = generate_random_string(8)
        file_extension = "webp"
        filename = f"logo_{tenant_id}_{random_string}.{file_extension}"
        
        # Upload to FTP
        logo_url = await upload_logo_to_ftp(compressed_bytes, filename)
        
        # Update tenant with logo URL
        get_tenant_collection().update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "logoUrl": logo_url,
                    "lastUpdatedDate": get_current_datetime()
                }
            }
        )
        
        return {
            "message": "Logo uploaded successfully",
            "logoUrl": logo_url,
            "filename": filename,
            "tenantId": tenant.get("tenantId", ""),  # Use tenantId as tenantId
            "mongoId": tenant_id  # MongoDB ObjectId
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload logo: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload logo: {str(e)}"
        )

@router.get("/{tenant_id}/logo")
async def get_tenant_logo(tenant_id: str):
    """
    Get tenant logo URL
    """
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(tenant_id)
        except errors.InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )
        
        tenant = get_tenant_collection().find_one({"_id": obj_id})
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        return {
            "logoUrl": tenant.get("logoUrl"),
            "tenantId": tenant.get("tenantId", ""),  # Use tenantId as tenantId
            "mongoId": tenant_id  # MongoDB ObjectId
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get logo: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get logo"
        )