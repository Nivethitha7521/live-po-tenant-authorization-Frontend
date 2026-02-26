from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class StorageLocation(BaseModel):
    storageLocationId: Optional[str] = None  # Define _id field explicitly
    locationName: Optional[str] = None
    status: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    randomId: Optional[str] = None
class StorageLocationPost(BaseModel):
    locationName: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None    