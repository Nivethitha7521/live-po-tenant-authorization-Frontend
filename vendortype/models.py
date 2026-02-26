from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class VendorType(BaseModel):
    vendortypeId: Optional[str] = None  # Define _id field explicitly
    vendorType: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
class VendorTypePost(BaseModel):
     vendorType: Optional[str] = None
     createdDate:Optional[datetime] = None
     lastUpdatedDate:Optional[datetime] = None
     status: Optional[str] = None