from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional

class Freight(BaseModel):
    freightId: Optional[str] = None  # Define _id field explicitly
    freightName: Optional[str] = None
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None
    randomId: Optional[str] = None

class FreightPost(BaseModel):
     freightName: Optional[str] = None
     createdDate:Optional[datetime] = None
     lastUpdatedDate:Optional[datetime] = None
     status: Optional[str] = None