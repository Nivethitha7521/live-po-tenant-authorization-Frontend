from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


class MongoDB:
    test_client = None
    live_client = None
    inventory_client = None
    purchase_client = None

    @classmethod
    def connect(cls):
        cls.test_client = AsyncIOMotorClient(settings.TEST_URI)
        cls.live_client = AsyncIOMotorClient(settings.LIVE_URI)
        cls.inventory_client = AsyncIOMotorClient(settings.INVENTORY_URI)
        cls.purchase_client = AsyncIOMotorClient(settings.PURCHASE_URI)

    @classmethod
    def close(cls):
        cls.test_client.close()
        cls.live_client.close()
        cls.inventory_client.close()
        cls.purchase_client.close()
