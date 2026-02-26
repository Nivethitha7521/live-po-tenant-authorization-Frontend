from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class Personal(BaseModel):
    personalId: Optional[str] = None  # Define _id field explicitly
    personName: Optional[str] = None
    phoneNo:Optional[str] = None
    email:Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    randomId: Optional[str] = None
class PersonalPost(BaseModel):
    personName: Optional[str] = None
    phoneNo:Optional[str] = None
    email:Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    randomId: Optional[str] = None