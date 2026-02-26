from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class PurchaseSubcategory(BaseModel):
    purchasesubcategoryId: Optional[str] = None  # Define _id field explicitly
    purchasesubcategoryName: Optional[str] = None
    createdDate:Optional[datetime] = None
    createdTime:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    lastUpdatedTime:Optional[datetime] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
class PurchaseSubcategoryPost(BaseModel):
    purchasesubcategoryName: Optional[str] = None
    createdDate:Optional[datetime] = None
    createdTime:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    lastUpdatedTime:Optional[datetime] = None
    status: Optional[str] = None