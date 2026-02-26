from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class PurchaseUOM(BaseModel):
    purchaseuomId: Optional[str] = None  # Define _id field explicitly
    uom: Optional[str] = None
    precisionValue: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None 
    randomId: Optional[str] = None
    
class PurchaseUOMPost(BaseModel):
    uom: Optional[str] = None
    precisionValue: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None