from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb+srv://admin:3Kdp4Vb85XUqKB4w@cluster0.wlpvoho.mongodb.net/"

client = AsyncIOMotorClient(
    "mongodb://admin:YenE580nOOUE6cDhQERP@194.233.78.90:27017/admin?appName=mongosh+2.1.1&authSource=admin&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster"
)

# Single client
mongo_client = AsyncIOMotorClient(MONGO_URI)

# Databases
db_nextjs = client["MasterAdmin_DB"]
db_flutter = mongo_client["fluttertest_db"]

# Collections
production_entry_collection = db_flutter["productionEntry"]
branchwise_items_collection = db_nextjs["ItemMaster"]
category_collection = db_nextjs["ItemCategory"]
subcategory_collection = db_nextjs["ItemSubCategory"]
uom_collection,= db_nextjs["Uom"]