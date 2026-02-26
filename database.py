from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import FastAPI

MONGO_URL = MONGODB_URL = "mongodb://purchasetestuser:qv8D%25%3AWZG%7DRmW%3B%5Du@194.233.78.90:27017/purchasetest?authSource=purchasetest&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster"
DB_NAME = "purchasetest"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
db_global = client[DB_NAME]