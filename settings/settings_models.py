# yen-purchase/PurchaseOrder/settings_models.py
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class DateRestriction(BaseModel):
    id: Optional[str] = None
    restrictionType: Literal["no_restriction", "current_only", "days_before", "days_after", "date_range"] = "no_restriction"
    daysValue: int = Field(default=0, ge=0)
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    isActive: bool = True
    createdBy: Optional[str] = None
    updatedBy: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class PurchaseDateSettings(BaseModel):
    id: Optional[str] = None
    orderDateRestriction: DateRestriction
    expectedDeliveryDays: int = Field(default=7, ge=1, le=365)
    invoiceDateRestriction: Literal["same_as_order", "after_order", "any"] = "any"
    invoiceDaysAfterOrder: int = Field(default=0, ge=0, le=365)
    createdBy: Optional[str] = None
    updatedBy: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

