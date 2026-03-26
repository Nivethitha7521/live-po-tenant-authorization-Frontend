import os
from typing import Optional, Dict, Any, List, Union
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv
import logging
from fastapi import HTTPException, status, Request

load_dotenv()
logger = logging.getLogger(__name__)

# ============================
# GLOBAL CONNECTIONS
# ============================

_sync_client: Optional[MongoClient] = None
_sync_db = None
_async_client: Optional[AsyncIOMotorClient] = None
_async_db = None

_inventory_client: Optional[MongoClient] = None
_inventory_db = None

# Tenant-specific connections
_tenant_sync_clients: Dict[str, MongoClient] = {}
_tenant_sync_dbs: Dict[str, Any] = {}
_tenant_async_clients: Dict[str, AsyncIOMotorClient] = {}
_tenant_async_dbs: Dict[str, Any] = {}

SECRET_KEY = "492e0b54a3130055fe6c0b698127ffa904069f189b467ab6564471b2d4840550"
ALGORITHM = "HS256"

# ============================
# MAIN DATABASE CONNECTIONS
# ============================

def get_sync_connection():
    global _sync_client, _sync_db
    if _sync_client is None:
        try:
            mongodb_uri = os.getenv("MONGODB_URI")
            if not mongodb_uri:
                raise ValueError("MONGODB_URI not found")
            _sync_client = MongoClient(mongodb_uri)
            _sync_db = _sync_client[os.getenv("MONGODB_DATABASE", "purchasetest")]
            logger.info("✅ Main sync connection created")
        except Exception as e:
            logger.error(f"❌ Error: {e}")
            raise
    return _sync_client, _sync_db

def get_async_connection():
    global _async_client, _async_db
    if _async_client is None:
        try:
            mongodb_uri = os.getenv("MONGODB_URI")
            if not mongodb_uri:
                raise ValueError("MONGODB_URI not found")
            _async_client = AsyncIOMotorClient(mongodb_uri)
            _async_db = _async_client[os.getenv("MONGODB_DATABASE", "purchasetest")]
            logger.info("✅ Main async connection created")
        except Exception as e:
            logger.error(f"❌ Error: {e}")
            raise
    return _async_client, _async_db

# ============================
# TENANT DATABASE CONNECTIONS (UNIFIED)
# ============================

def get_tenant_database(tenant_id: str, use_async: bool = False):
    """
    Get tenant database connection.
    If use_async=True, returns async connection, else sync.
    """
    try:
        # Get tenant info from main database
        tenant_collection = get_tenant_collection()
        tenant = tenant_collection.find_one({"_id": ObjectId(tenant_id)})
        
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")
        
        database_name = tenant.get("databaseName")
        if not database_name:
    # Generate database name from tenant name
           import re
           tenant_name = tenant.get("tenantName", "").strip()
  
           if tenant_name:
              db_name = tenant_name.lower()
              db_name = re.sub(r'[^a-z0-9_]', '_', db_name)
              db_name = db_name.strip('_')
              database_name = f"{db_name}_purchase"
           else:
              database_name = f"tenant_{tenant_id}_purchase"

    # Save DB name
           tenant_collection.update_one(
               {"_id": ObjectId(tenant_id)},
               {"$set": {"databaseName": database_name}}
    )

    # 🔥🔥🔥 MUST ADD THIS LINE
           create_inventory_collections_for_tenant(database_name)
       
        mongodb_uri = os.getenv("MONGODB_URI")
        if not mongodb_uri:
            raise ValueError("MONGODB_URI not found")
        
        if use_async:
            # Async connection
            if tenant_id not in _tenant_async_clients:
                _tenant_async_clients[tenant_id] = AsyncIOMotorClient(mongodb_uri)
                _tenant_async_dbs[tenant_id] = _tenant_async_clients[tenant_id][database_name]
                logger.info(f"✅ Tenant {tenant_id} async DB: {database_name}")
            return _tenant_async_clients[tenant_id], _tenant_async_dbs[tenant_id]
        else:
            # Sync connection
            if tenant_id not in _tenant_sync_clients:
                _tenant_sync_clients[tenant_id] = MongoClient(mongodb_uri)
                _tenant_sync_dbs[tenant_id] = _tenant_sync_clients[tenant_id][database_name]
                logger.info(f"✅ Tenant {tenant_id} sync DB: {database_name}")
            return _tenant_sync_clients[tenant_id], _tenant_sync_dbs[tenant_id]
            
    except Exception as e:
        logger.error(f"❌ Tenant DB error: {e}")
        raise

# ============================
# UNIFIED COLLECTION GETTERS (KEEPING SAME NAMES)
# ============================

# BUSINESS & PURCHASE COLLECTIONS (Sync by default)
def get_businessdetails_collection(tenant_id: Optional[str] = None):
    """Get business details collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['businessdetails']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['businessdetails']

def get_vendor_collection(tenant_id: Optional[str] = None):
    """Get vendor collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['vendor']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['vendor']

def get_purchaseorder_collection(tenant_id: Optional[str] = None):
    """Get purchase order collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['purchaseorder']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['purchaseorder']

def get_image_collection(tenant_id: Optional[str] = None):
    """Get image collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['Imageforpurchase']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['Imageforpurchase']

def get_purchaseitem_collection(tenant_id: Optional[str] = None):
    """Get purchase item collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['rawMaterials']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['rawMaterials']

def get_grn_collection(tenant_id: Optional[str] = None):
    """Get GRN collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['grn']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['grn']

def get_apinvoice_collection(tenant_id: Optional[str] = None):
    """Get AP invoice collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['apInvoice']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['apInvoice']

def get_outgoingpayment_collection(tenant_id: Optional[str] = None):
    """Get outgoing payment collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['outgoingpayment']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['outgoingpayment']

def get_advancepayment_collection(tenant_id: Optional[str] = None):
    """Get advance payment collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['advancepayment']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['advancepayment']

def get_revert_collection(tenant_id: Optional[str] = None):
    """Get revert collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['revertrawMaterials']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['revertrawMaterials']

def get_debit_collection(tenant_id: Optional[str] = None):
    """Get debit note collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['grnDebitNote']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['grnDebitNote']

def get_return_reasons_collection(tenant_id: Optional[str] = None):
    """Get return reasons collection - sync"""
    if not tenant_id:
        _, db = get_sync_connection()
        return db['ReturnReason']
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['ReturnReason']

# ASYNC COLLECTIONS (Keeping same names - but will return async collections)
def get_storagelocation_collection(tenant_id: Optional[str] = None):
    """Get storage location collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['storagelocation']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['storagelocation']

def get_vendortype_collection(tenant_id: Optional[str] = None):
    """Get vendor type collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['vendortype']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['vendortype']

def get_shippingaddress_collection(tenant_id: Optional[str] = None):
    """Get shipping address collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['shippingaddress']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['shippingaddress']

def get_service_collection(tenant_id: Optional[str] = None):
    """Get service collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['service']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['service']

def get_purchasetax_collection(tenant_id: Optional[str] = None):
    """Get purchase tax collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['purchasetax']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['purchasetax']

def get_purchasesubcategory_collection(tenant_id: Optional[str] = None):
    """Get purchase subcategory collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['purchasesubcategory']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['purchasesubcategory']

def get_serviceworkorder_collection(tenant_id: Optional[str] = None):
    """Get ServiceWorkOrder collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['ServiceWorkOrder']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['ServiceWorkOrder']

def get_purchaseuom_collection(tenant_id: Optional[str] = None):
    """Get purchase UOM collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['purchaseuom']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['purchaseuom']

def get_purchasecategory_collection(tenant_id: Optional[str] = None):
    """Get purchase category collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['purchasecategory']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['purchasecategory']

def get_revert_purchasecategory_collection(tenant_id: Optional[str] = None):
    """Get revert purchase category collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['revertpurchasecategory']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['revertpurchasecategory']

def get_personaldetails_collection(tenant_id: Optional[str] = None):
    """Get personal details collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['personaldetails']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['personaldetails']

def get_itemtype_collection(tenant_id: Optional[str] = None):
    """Get item type collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['itemtype']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['itemtype']

def get_itemgroup_collection(tenant_id: Optional[str] = None):
    """Get item group collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['itemgroup']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['itemgroup']


def get_freight_collection(tenant_id: Optional[str] = None):
    """Get freight collection - async"""
    if not tenant_id:
        _, db = get_async_connection()
        return db['freightMaster']
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db['freightMaster']
def get_expensecategory_collection():
    """MASTER DB → expensecategory (async)"""
    client, _ = get_async_connection()
    db = client["master"]   # ✅ force master DB
    return db["expensecategory"]


def get_expensename_collection():
    """MASTER DB → expensename (async)"""
    client, _ = get_async_connection()
    db = client["master"]
    return db["expensename"]


def get_expensesubcategory_collection():
    """MASTER DB → expensesubcategory (async)"""
    client, _ = get_async_connection()
    db = client["master"]
    return db["expensesubcategory"]
# ============================
# GLOBAL COLLECTIONS
# ============================

def get_tenant_collection():
    """Get tenant collection - sync"""
    _, db = get_sync_connection()
    return db['tenants']
async def get_settings_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["purchasesettings"]
def get_tenant_image_collection(tenant_id: str):
    """
    Get image collection for a specific tenant.
    This is used for tenant-specific image uploads.
    """
    # This uses the same logic as other collection getters
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db['Imagefortenant']

def get_counter_collection(tenant_id: Optional[str] = None):
    """
    Get counter collection.
    If tenant_id provided → use tenant DB
    Else → use main DB
    """
    if not tenant_id:
        _, db = get_sync_connection()
        return db["counters"]
    
    _, db = get_tenant_database(tenant_id, use_async=False)
    return db["counters"]





def get_purchaseusers_collection():
    """Get login check collection - async"""
    _, db = get_async_connection()
    return db['logincheck']

def get_inventory_collection():
    """Get inventory collection"""
    global _inventory_client, _inventory_db   # ✅ ADD THIS LINE

    if _inventory_client is None:
        try:
            _inventory_client = MongoClient(
                "mongodb://admin:YenE580nOOUE6cDhQERP@194.233.78.90:27017/admin"
                "?authSource=admin&authMechanism=SCRAM-SHA-256"
                "&replicaSet=yenerp-cluster"
            )
            _inventory_db = _inventory_client["yen_inventorytest"]
            logger.info("✅ Inventory connection created")
        except Exception as e:
            logger.error(f"❌ Inventory connection error: {e}")
            raise

    return _inventory_db["inventoryStocktest"]

# ============================
# BACKWARD COMPATIBILITY
# ============================

def get_mongodb_client() -> MongoClient:
    client, _ = get_sync_connection()
    return client

def get_database():
    _, db = get_sync_connection()
    return db

def get_async_client() -> AsyncIOMotorClient:
    client, _ = get_async_connection()
    return client

def get_async_database():
    _, db = get_async_connection()
    return db

def get_collection(collection_name: str, tenant_id: Optional[str] = None):
    """Generic collection getter - tries to detect sync/async based on collection name"""
    # Default to sync for known sync collections
    sync_collections = [
        'businessdetails', 'vendor', 'purchaseorder', 'Imageforpurchase',
        'rawMaterials', 'grn', 'apInvoice', 'outgoingpayment', 'advancepayment',
        'revertrawMaterials', 'grnDebitNote', 'ReturnReason'
    ]
    
    # Default to async for known async collections
    async_collections = [
        'storagelocation', 'vendortype', 'shippingaddress', 'service',
        'purchasetax', 'purchasesubcategory', 'ServiceWorkOrder', 'purchaseuom',
        'purchasecategory', 'revertpurchasecategory', 'personaldetails',
        'itemtype', 'itemgroup', 'freightMaster', 'logincheck'
    ]
    
    if not tenant_id:
        if collection_name in sync_collections:
            _, db = get_sync_connection()
        else:
            _, db = get_async_connection()
    else:
        if collection_name in sync_collections:
            _, db = get_tenant_database(tenant_id, use_async=False)
        else:
            _, db = get_tenant_database(tenant_id, use_async=True)
    
    return db[collection_name]

# ============================
# CONNECTION MANAGEMENT
# ============================

def close_connection():
    global _sync_client, _async_client, _inventory_client
    global _tenant_sync_clients, _tenant_async_clients
    
    if _sync_client:
        _sync_client.close()
        _sync_client = None
    if _async_client:
        _async_client.close()
        _async_client = None
    if _inventory_client:
        _inventory_client.close()
        _inventory_client = None
    
    for client in _tenant_sync_clients.values():
        client.close()
    for client in _tenant_async_clients.values():
        client.close()
    
    _tenant_sync_clients.clear()
    _tenant_sync_dbs.clear()
    _tenant_async_clients.clear()
    _tenant_async_dbs.clear()

def test_connection() -> bool:
    try:
        client, _ = get_sync_connection()
        client.admin.command('ping')
        return True
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return False

# ============================
# HELPER FUNCTIONS
# ============================

def get_tenant_info(tenant_id: str) -> Dict[str, Any]:
    """Get tenant information"""
    collection = get_tenant_collection()
    tenant = collection.find_one({"_id": ObjectId(tenant_id)})
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")
    tenant["tenantId"] = str(tenant["_id"])
    return tenant

def get_tenant_from_request(request: Request) -> Optional[str]:
    """Extract tenant_id from request"""
    # From request state (middleware)
    tenant_id = getattr(request.state, 'tenant_id', None)
    
    # From headers
    if not tenant_id:
        tenant_id = request.headers.get('x-tenant-id')
    
    # From query params
    if not tenant_id:
        tenant_id = request.query_params.get('tenant_id')
    
    # From path params (for routes like /tenants/{tenant_id}/...)
    if not tenant_id and request.url.path.startswith('/purchasetestapi/tenants/'):
        parts = request.url.path.split('/')
        if len(parts) > 3 and ObjectId.is_valid(parts[3]):
            tenant_id = parts[3]
    
    return tenant_id

# ============================
# DEPENDENCY INJECTION
# ============================

from fastapi import Depends

def get_current_tenant(request: Request):
    """Dependency to get current tenant"""
    tenant_id = get_tenant_from_request(request)
    
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required"
        )
    
    try:
        return get_tenant_info(tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )



# ============================
# INVENTORY CONNECTION FIX
# ============================

def get_inventory_connection():
    """Get inventory connection"""
    global _inventory_client, _inventory_db
    if _inventory_client is None:
        try:
            _inventory_client = MongoClient(
                "mongodb://admin:YenE580nOOUE6cDhQERP@194.233.78.90:27017/admin"
                "?authSource=admin&authMechanism=SCRAM-SHA-256"
                "&replicaSet=yenerp-cluster"
            )
            _inventory_db = _inventory_client["yen_inventorytest"]
            logger.info("✅ Inventory connection created")
        except Exception as e:
            logger.error(f"❌ Inventory connection error: {e}")
            raise
    return _inventory_client, _inventory_db


def create_inventory_collections_for_tenant(database_name: str):
    """
    Auto-create inventory collections when new tenant DB is created
    """
    try:
        mongodb_uri = os.getenv("MONGODB_URI")
        client = MongoClient(mongodb_uri)
        db = client[database_name]

        collections = [
            "approvedstocksOutlet",
            "approvedstocksWarehouse",
            "closingstocksOutlet",
            "closingstocksWarehouse",
            "inventoryStock",
            "stockOutHist",
            "stockWhHist"
        ]

        for col in collections:
            if col not in db.list_collection_names():
                db[col].insert_one({"_init": True})   # 🔥 FORCE CREATE
                db[col].delete_many({"_init": True})  # clean
                logger.info(f"✅ Created {col} for {database_name}")

    except Exception as e:
        logger.error(f"❌ Inventory collection create error: {e}")