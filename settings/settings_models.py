# models/settings_models.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DateRestriction(BaseModel):
    restrictionType: str
    daysValue: int = 0
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    isActive: bool = True
    
    class Config:
        # Allow ORM mode and handle datetime serialization
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }

class PurchaseDateSettings(BaseModel):
    orderDateRestriction: DateRestriction
    expectedDeliveryRestriction: DateRestriction
    invoiceDateRestriction: DateRestriction
    expectedDeliveryDays: int = 7
    invoiceDaysAfterOrder: int = 0
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }