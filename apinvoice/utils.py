
# MongoDB connection and collection getter for item groups
from pymongo import MongoClient

from utils.database import get_collection



def get_safe_value(obj: dict, key: str, default: float = 0.0) -> float:
    """Safely extract a value from a dictionary, returning default if not found or None."""
    value = obj.get(key)
    return float(value) if value is not None else default

