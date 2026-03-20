from db.connection import MongoDB
from utils.database import get_tenant_database

# ---------- MASTER COLLECTION ----------


def item_master_collection():
    return MongoDB.live_client["MasterAdmin_DB"]["ItemMaster"]


def location_collection():
    return MongoDB.live_client["MasterAdmin_DB"]["Location"]


def uom_collection():
    return MongoDB.live_client["MasterAdmin_DB"]["Uom"]


def warehouse_collection():
    return MongoDB.live_client["MasterAdmin_DB"]["Warehouse"]


def category_collection():
    return MongoDB.live_client["MasterAdmin_DB"]["ItemCategory"]


def subcategory_collection():
    return MongoDB.live_client["MasterAdmin_DB"]["ItemSubCategory"]


def stockclosing_collection():
    return MongoDB.inventory_client["master"]["stockclosing"]


# ---------- SALE ORDER COLLECTIONS ----------


def dispatch_collection():
    return MongoDB.test_client["fluttertest_db"]["dispatch"]


def invoices_collection():
    return MongoDB.test_client["fluttertest_db"]["invoices"]


def get_salesreturn_collection():
    return MongoDB.test_client["fluttertest_db"]["salesreturn"]


def stock_transfer_collection():
    return MongoDB.test_client["fluttertest_db"]["itemtransfer"]


def wastage_entry_collection():
    return MongoDB.test_client["fluttertest_db"]["wastageEntry"]


def warehouse_return_collection():
    return MongoDB.test_client["fluttertest_db"]["warehouseReturn"]


# ---------- PURCHASE COLLECTIONS ----------


def purchaseitem_collection():
    return MongoDB.test_client["nextjstest_db"]["rawMaterials"]


def grn_collection():
    return MongoDB.live_client["purchase"]["grn"]


def storeDispatch_collection():
    return MongoDB.test_client["reactfluttertest"]["storeDispatch"]


def purchase_uom_collection():
    return MongoDB.live_client["purchase"]["purchaseuom"]


# =====================================================
# 🔥 INVENTORY COLLECTIONS (TENANT BASED 🔥)
# =====================================================

def inventory_stock_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["inventoryStock"]


def stock_history_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["stockOutHist"]


def stock_updates_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["stockWhHist"]


def approvedstocks_fg_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["approvedstocksOutlet"]


def approvedstocks_rm_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["approvedstocksWarehouse"]


def closingstocks_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["closingstocksOutlet"]


def closingstocks_rm_collection(tenant_id: str):
    _, db = get_tenant_database(tenant_id, use_async=True)
    return db["closingstocksWarehouse"]






from motor.motor_asyncio import AsyncIOMotorClient

# ------------------ URIs ------------------
LIVE_URI = "mongodb://admin:YenE580nOOUE6cDhQERP@194.233.78.90:27017/admin?appName=mongosh+2.1.1&authSource=admin&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster"
TEST_URI = "mongodb+srv://admin:3Kdp4Vb85XUqKB4w@cluster0.wlpvoho.mongodb.net/"

# ------------------ SINGLE CLIENTS ------------------
LIVE = AsyncIOMotorClient(LIVE_URI)
TEST = AsyncIOMotorClient(TEST_URI)

# ------------------ DATABASES ------------------
db_purchase = LIVE["purchase"]
db_reactfluter = LIVE["reactfluttertest"]

db_master = LIVE["master"]
db_birthday = LIVE["birthdaycakeApp"]

db_flutter = TEST["fluttertest_db"]
db_flutter_optimized = TEST["fluttertest_optimize_db"]
db_nextjs = TEST["nextjstest_db"]
db_masteradmin = LIVE["MasterAdmin_DB"]

# ------------------ COLLECTIONS ------------------
# Purchase DB
purchaseorder = db_purchase["purchaseorder"]
apInvoice = db_purchase["apInvoice"]
purchaseOrder = db_purchase["purchaseorder"]
vendor = db_purchase["vendor"]
rawMaterials = db_purchase["rawMaterials"]
grn = db_purchase["grn"]
outgoingpayment = db_purchase["outgoingpayment"]
storedispatch = db_reactfluter["storeDispatch2"]


# Master DB
pettycash = db_master["pettycash"]

# Birthday
cakeappinvoices = db_birthday["cakeappinvoices"]

# Flutter DB
salesorder = db_flutter["salesorder"]
invoices = db_flutter["invoices"]
dispatch = db_flutter["dispatch"]
dayEnd = db_flutter["dayEnd"]
wastageEntry = db_flutter["wastageEntry"]
warehouseReturn = db_flutter["warehouseReturn"]
productionEntry = db_flutter["productionEntrys"]
itemtransfer = db_flutter["itemtransfer"]
grnDebitNote = db_purchase["grnDebitNote"]

# NextJS DB
ItemMaster = db_masteradmin["ItemMaster"]
Uom = db_masteradmin["Uom"]

location = db_nextjs["location"]
sections = db_nextjs["sections"]

# MasterAdmin DB
EventMaster = db_masteradmin["EventMaster"]
Vehicles = db_masteradmin["Vehicles"]
ItemCategory = db_masteradmin["ItemCategory"]
ItemSubCategory = db_masteradmin["ItemSubCategory"]
