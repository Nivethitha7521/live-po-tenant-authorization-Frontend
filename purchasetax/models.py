from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class PurchaseTax(BaseModel):
    purchasetaxId: Optional[str] = None  # Define _id field explicitly
    purchasetaxName: Optional[str] = None
    purchasetaxPercentage:Optional[float] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
class PurchaseTaxPost(BaseModel):
    purchasetaxName: Optional[str] = None
    purchasetaxPercentage:Optional[float] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None