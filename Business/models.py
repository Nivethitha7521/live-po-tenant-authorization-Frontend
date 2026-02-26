from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime

class Business(BaseModel):
    businessId: Optional[str] = None  # Define _id field explicitly
    companyName: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    phoneNo: Optional[str] = None
    emailId: Optional[str] = None
    gstIn: Optional[str] = None
    status: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    randomId: Optional[str] = None
    imageUrl: Optional[str] = None

class BusinessPost(BaseModel):
    companyName: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    phoneNo: Optional[str] = None
    emailId: Optional[str] = None
    gstIn: Optional[str] = None
    status: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    randomId: Optional[str] = None
    imageUrl: Optional[str] = None
   