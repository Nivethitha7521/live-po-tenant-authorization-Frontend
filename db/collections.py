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