from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class ItemType(BaseModel):
    itemtypeId: Optional[str] = None  # Define _id field explicitly
    itemtypeName: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
class ItemTypePost(BaseModel):
    itemtypeName: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None