from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator

from outgoingPayment.models import IST

class BaseModelWithConfig(BaseModel):
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }
        validate_assignment = True
        allow_population_by_field_name = True

class PaymentHistory(BaseModel):
    amount: float
    paymentDate: datetime
    paymentMethod: Optional[str] = None  # e.g., "neft", "upi", "cash"
    paymentMode: Optional[str] = None  # "Cash" or "Bank"
    bankName: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    remarks: Optional[str] = None

class AdvancePayment(BaseModel):
    advanceId: Optional[str] = None
    randomId: Optional[str] = None
    vendorId: Optional[str] = None
    vendorName: Optional[str] = None
    amount: Optional[float] = None
    pendingAmount: Optional[float] = None
    paymentDate: Optional[datetime] = None
    paymentType: Optional[str] = None
    bankName: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    paymentHistory: List[PaymentHistory] = []
    status: Optional[str] = None
    remarks: Optional[str] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate: Optional[datetime] = None

    @field_validator('paymentDate', 'createdDate', 'lastUpdatedDate', mode='before')
    def parse_datetime(cls, v):
        if v is None:
            return v
        if isinstance(v, dict) and '$date' in v:
            try:
                dt = datetime.fromisoformat(v['$date'].replace('Z', '+00:00'))
                return dt.astimezone(IST)
            except ValueError:
                raise ValueError(f"Invalid date format: {v['$date']}")
        if isinstance(v, str):
            try:
                dt = datetime.fromisoformat(v.replace('Z', '+00:00'))
                return dt.astimezone(IST)
            except ValueError:
                raise ValueError(f"Invalid date format: {v}")
        return v

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }

class AdvancePayment(BaseModel):
    advanceId: str
    vendorId: str
    vendorName: str
    amount: float
    initialPaid: Optional[float] = None
    pendingAmount: float
    status: str
    randomId: str
    paymentType: str
    paymentMode: Optional[str] = None  # "Cash" or "Bank"
    paymentMethod: Optional[str] = None  # "upi", "neft", "rtgs", "imps"
    bankName: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    remarks: Optional[str] = None
    paymentHistory: List[PaymentHistory] = []
    createdDate: datetime
    lastUpdatedDate: datetime
class AdvancePaymentCreate(BaseModelWithConfig):
    vendorId: str
    vendorName: Optional[str] = None  # Optional, as backend fetches it from vendorId
    amount: float
    initialPaid: Optional[float] = None
    paymentType: str = "advance"  # Default to "advance"
    paymentMode: Optional[str] = None  # "Cash" or "Bank"
    paymentMethod: Optional[str] = None  # "upi", "neft", "rtgs", "imps"
    bankName: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    remarks: Optional[str] = None