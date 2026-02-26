from datetime import datetime, date, time
import logging
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
import pytz

logger = logging.getLogger(__name__)

def parse_datetime_to_utc_date_only(value: Optional[Any]) -> Optional[datetime]:
    if value is None or value == '' or value == 'null':
        return None
    
    if isinstance(value, datetime):
        dt = value.replace(hour=0, minute=0, second=0, microsecond=0)
        if dt.tzinfo is None:
            return pytz.UTC.localize(dt)
        return dt.astimezone(pytz.UTC)
    
    if isinstance(value, date) and not isinstance(value, datetime):
        dt = datetime.combine(value, time.min)
        return pytz.UTC.localize(dt)
    
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        
        try:
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
                try:
                    dt = datetime.strptime(value, fmt)
                    dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                    return pytz.UTC.localize(dt)
                except ValueError:
                    continue
        except Exception:
            pass
        
        try:
            if 'T' in value:
                date_part = value.split('T')[0]
                dt = datetime.strptime(date_part, '%Y-%m-%d')
            else:
                dt = datetime.fromisoformat(value)
            dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
            if dt.tzinfo is None:
                return pytz.UTC.localize(dt)
            return dt.astimezone(pytz.UTC)
        except Exception:
            return None
    
    return None

def parse_datetime_to_utc_full(value: Optional[str | datetime]) -> Optional[datetime]:
    if value is None:
        return None
   
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return pytz.UTC.localize(value)
        return value.astimezone(pytz.UTC)
   
    if isinstance(value, str):
        if 'T' in value:
            try:
                if value.endswith('Z'):
                    value = value[:-1] + '+00:00'
                dt = datetime.fromisoformat(value)
                if dt.tzinfo is None:
                    return pytz.UTC.localize(dt)
                else:
                    return dt.astimezone(pytz.UTC)
            except ValueError:
                pass
       
        for fmt in ['%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S', '%d-%m-%Y %H:%M:%S',
                   '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f']:
            try:
                dt = datetime.strptime(value, fmt)
                return pytz.UTC.localize(dt)
            except ValueError:
                continue
       
        try:
            dt = datetime.strptime(value, '%Y-%m-%d')
            return pytz.UTC.localize(dt)
        except ValueError:
            pass
   
    raise ValueError(f"Cannot parse datetime from: {value}")

class Freight(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    tCode: Optional[str] = None
    amt: Optional[float] = None
    tAmt: Optional[float] = None
    totalAmt: Optional[float] = None
    sgst: Optional[float] = Field(None, ge=0)
    cgst: Optional[float] = Field(None, ge=0)
    igst: Optional[float] = Field(None, ge=0)
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    taxPercentage: Optional[float] = 0

class ServiceDescription(BaseModel):
    sacCode: str = ""
    description: str = Field(..., description="Description (required)")
    quantity: float = Field(1.0, ge=0.01, description="Quantity (must be >= 0.01)")
    remarks: Optional[str] = None
    from_date: Optional[datetime] = Field(None, description="From date (optional)")
    to_date: Optional[datetime] = Field(None, description="To date (optional)")
        # CRITICAL: Separate individual and overall discounts
    individual_discount_amount: float = Field(0, description="Line-specific discount amount")
    individual_discount_percentage: float = Field(0, description="Line-specific discount percentage")

    # CRITICAL FIX: Two separate fields for different UI modes
    fee_with_tax: Optional[float] = Field(None, description="Amount WITH tax per unit (user enters this when include_tax=True)")
    base_amount: Optional[float] = Field(None, description="Amount WITHOUT tax per unit (user enters this when include_tax=False)")
    
    include_tax: bool = Field(True, description="True: fee_with_tax is provided, False: base_amount is provided")
    tax_type: str = "cgst_sgst"
    tax_per: float = 0
    discount_percentage: float = 0
    discount_amount: float = 0
    
        # Overall discount will be calculated and stored separately
    discount_percentage: float = 0  # Combined total
    discount_amount: float = 0      # Combined total
    @field_validator('from_date', 'to_date', mode='before')
    @classmethod
    def parse_description_date(cls, v):
        return parse_datetime_to_utc_date_only(v)
    
    @model_validator(mode='after')
    def validate_datetimes(self):
        if self.from_date is not None and self.to_date is not None and self.from_date > self.to_date:
            raise ValueError('from_date must be before or equal to to_date')
        return self
    
    @model_validator(mode='after')
    def validate_amounts(self):
        """Validate and calculate based on include_tax flag"""
        if self.include_tax:
            if self.fee_with_tax is None or self.fee_with_tax <= 0:
                raise ValueError("fee_with_tax is required when include_tax=True")
        else:
            if self.base_amount is None or self.base_amount <= 0:
                raise ValueError("base_amount is required when include_tax=False")
        return self

class CalculateTotalsRequest(BaseModel):
    descriptions: List[ServiceDescription] = Field(default_factory=list)
    overall_discount_value: float = 0
    overall_discount_applied_on: str = "after_tax"
    overall_discount_type: str = "percentage"
    round_off: float = 0
    total_freight_amount: float = 0
    total_freight_tax: float = 0
    fees_are_total_including_tax: bool = True  # ALWAYS true for backend

class ServicePost(BaseModel):
    vendorId: str = ""
    vendorName: str = ""
    vendorContact: str = ""
    contactpersonEmail: Optional[str] = None
    vendorPhone: Optional[str] = None
   
    workOrderDate: Optional[datetime] = Field(None)
    approvedDate: Optional[datetime] = None
    rejectedDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    invoiceNo: str = ""
    status: str = "Pending"
    freights: Optional[List[Freight]] = Field(default_factory=list)
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0

    # FLAT ARRAYS
    sacCode: List[str] = Field(default_factory=list)
    desc_ids: List[str] = Field(default_factory=list)
    descriptions: List[str] = Field(default_factory=list)
    from_dates: List[Optional[datetime]] = Field(default_factory=list)
    to_dates: List[Optional[datetime]] = Field(default_factory=list)
    fees: List[float] = Field(default_factory=list)  # PER UNIT WITH TAX
    remarks: List[Optional[str]] = Field(default_factory=list)
    quantity: List[Optional[float]] = Field(default_factory=list)
    desc_tax_types: List[str] = Field(default_factory=list)
    desc_tax_pers: List[float] = Field(default_factory=list)
    desc_sgst: List[float] = Field(default_factory=list)  # LINE TOTAL
    desc_cgst: List[float] = Field(default_factory=list)  # LINE TOTAL
    desc_igst: List[float] = Field(default_factory=list)  # LINE TOTAL
    desc_tax_amounts: List[float] = Field(default_factory=list)  # LINE TOTAL
    desc_totals: List[float] = Field(default_factory=list)  # LINE TOTAL WITH TAX
    base_amounts: Optional[List[float]] = Field(default_factory=list)  # PER UNIT WITHOUT TAX
    include_tax: List[bool] = Field(default_factory=list)  # USER PREFERENCE
    desc_individual_discount_amounts: List[float] = Field(default_factory=list)
    desc_individual_discount_percentages: List[float] = Field(default_factory=list)

    desc_discount_percentages: List[float] = Field(default_factory=list)
    desc_discount_amounts: List[float] = Field(default_factory=list)
    desc_overall_discounts: List[float] = Field(default_factory=list)
    
    totalAmount: float = 0
    totalFees: float = 0
    totalTax: float = 0
    totalDiscount: float = 0
    totalOverallDiscount: float = 0
    paymentTerms: str = ""
    shippingAddress: str = ""
    billingAddress: str = ""
    comments: str = ""
    termsandConditions: List[str] = Field(default_factory=list)
    address: str = ""
    country: str = ""
    state: str = ""
    city: str = ""
    creditLimit: float = 0
    locationName: str = ""
    overallDiscountValue: float = 0
    overallDiscountType: str = "percentage"
    overallDiscountAppliedOn: str = "after_tax"
    roundOffValue: float = 0
   
    serviceCreatedPerson: Optional[str] = None
    serviceApprovedPerson: Optional[str] = None
    serviceRejectedPerson: Optional[str] = None
    imageUrl: str = ""
    rejectionReason: Optional[str] = None
    
    @field_validator('workOrderDate', 'approvedDate', 'rejectedDate',
                    'invoiceDate', mode='before')
    @classmethod
    def parse_datetime_fields(cls, v):
        return parse_datetime_to_utc_full(v)
    
    @field_validator('from_dates', 'to_dates', mode='before')
    @classmethod
    def validate_date_arrays(cls, v):
        if isinstance(v, list):
            validated_dates = []
            for item in v:
                if item is None:
                    validated_dates.append(None)
                    continue
                parsed_date = parse_datetime_to_utc_date_only(item)
                validated_dates.append(parsed_date)
            return validated_dates
        return v
    
    @model_validator(mode='after')
    def validate_workorder_date(self):
        now_utc = datetime.now(pytz.UTC)
        if self.workOrderDate and self.workOrderDate > now_utc:
            raise ValueError('workOrderDate cannot be in the future')
        return self
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None,
            date: lambda v: v.isoformat() if v else None,
        },
        arbitrary_types_allowed=True
    )

class ServiceState(BaseModel):
    serviceId: Optional[str] = None
    vendorId: Optional[str] = None
    vendorName: Optional[str] = None
    vendorContact: Optional[str] = None
    contactpersonEmail: Optional[str] = None
    vendorPhone: Optional[str] = None
    workOrderDate: Optional[datetime] = None
    approvedDate: Optional[datetime] = None
    rejectedDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    status: Optional[str] = None
    serviceAmount: Optional[float] = None
    
    sacCode: Optional[List[str]] = None
    descriptions: Optional[List[str]] = None
    desc_ids: Optional[List[str]] = None
    from_dates: Optional[List[Optional[datetime]]] = None
    to_dates: Optional[List[Optional[datetime]]] = None
    fees: Optional[List[float]] = None  # PER UNIT WITH TAX
    remarks: Optional[List[Optional[str]]] = None
    quantity: Optional[List[Optional[float]]] = None
    desc_tax_types: Optional[List[str]] = None
    desc_tax_pers: Optional[List[float]] = None
    desc_sgst: Optional[List[float]] = None
    desc_cgst: Optional[List[float]] = None
    desc_igst: Optional[List[float]] = None
    desc_tax_amounts: Optional[List[float]] = None
    desc_totals: Optional[List[float]] = None
    base_amounts: Optional[List[float]] = None  # PER UNIT WITHOUT TAX
    include_tax: List[bool] = Field(default_factory=list)
    
    desc_discount_percentages: Optional[List[float]] = None
    desc_discount_amounts: Optional[List[float]] = None
    desc_overall_discounts: Optional[List[float]] = None
    
    totalAmount: Optional[float] = None
    totalFees: Optional[float] = None
    totalTax: Optional[float] = None
    totalDiscount: Optional[float] = None
    totalOverallDiscount: Optional[float] = None
    paymentTerms: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    comments: Optional[str] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate: Optional[datetime] = None
    lastUpdatedTime: Optional[str] = None
    creditLimit: Optional[int] = None
    imageUrl: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    termsandConditions: Optional[List[str]] = None
    serviceCreatedPerson: Optional[str] = None
    serviceApprovedPerson: Optional[str] = None
    serviceRejectedPerson: Optional[str] = None
    roundOffValue: Optional[float] = 0
    overallDiscountValue: Optional[float] = 0
    overallDiscountAppliedOn: str = "after_tax"
    overallDiscountType: Optional[str] = "percentage"
    locationName: Optional[str] = None
    desc_individual_discount_amounts: List[float] = Field(default_factory=list)
    desc_individual_discount_percentages: List[float] = Field(default_factory=list)

    rejectionReason: Optional[str] = None
    statusComments: Optional[List[Dict[str, Any]]] = None
    freights: Optional[List[Freight]] = Field(default_factory=list)
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    mongoId: Optional[str] = None
    
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None,
        },
        arbitrary_types_allowed=True
    )

class ServiceRejectRequest(BaseModel):
    reason: str = Field(..., description="Reason for rejection")
    send_notification: bool = True

class ServiceStatusUpdate(BaseModel):
    status: str = Field(..., description="New status")
    comment: Optional[str] = Field(None, description="Optional comment")

class ServiceInvoiceNo(BaseModel):
    mongoId: str
    invoiceNo: str
    vendorName: str

class ServiceServiceId(BaseModel):
    mongoId: str
    serviceId: str