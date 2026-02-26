from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import pytz

# Define IST timezone
IST = pytz.timezone('Asia/Kolkata')

class BaseModelWithConfig(BaseModel):
    """Base model with datetime configuration"""
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }
        validate_assignment = True
        # Allow population by field name or alias
        allow_population_by_field_name = True

class ItemDetails(BaseModelWithConfig):
    itemId: Optional[str] = None
    itemName: Optional[str] = None
    quantity: Optional[float] = None
    unitPrice: Optional[float] = None
    purchasetaxName: Optional[float] = None
    taxType: Optional[str] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    igst: Optional[float] = None
    taxAmount: Optional[float] = None
    totalPrice: Optional[float] = None
    finalPrice: Optional[float] = None
    discountAmount: Optional[float] = None
    uom: Optional[str] = None
    hsnCode: Optional[str] = None
    item_rand:Optional[str] =None
class PaymentHistory(BaseModelWithConfig):
    amount: Optional[float] = None
    paymentType: Optional[str] = None
    paymentMethod: Optional[str] = None
    paymentMode: Optional[str] = None
    cashAmount: Optional[float] = None  # New field for cash payments
    bankName: Optional[str] = None
    impsNo: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    upi: Optional[str] = None
    date: Optional[datetime] = None
    debitNotesApplied: Optional[List[str]] = None
    debitAmount: Optional[float] = None
    advancePaymentsApplied:Optional[List[str]] = None
    paymentId: Optional[str] = None  # Added PaymentID field

    @field_validator('date', mode='before')
    def parse_date(cls, v):
        """Convert string date to datetime in IST"""
        if v is None:
            return v
        if isinstance(v, str):
            # Handle MongoDB date string format
            try:
                dt = datetime.fromisoformat(v.replace('Z', '+00:00'))
                return dt.astimezone(IST)
            except ValueError:
                raise ValueError(f"Invalid date format: {v}")
        return v

class Outgoing(BaseModelWithConfig):
    outgoingId: Optional[str] = None
    purchaseOrderId: Optional[str] = None
    serOId:Optional[str] = None
    serviceId:Optional[str] = None
    invoiceType:Optional[str] = None
    invoiceId: Optional[str] = None
    grnId: Optional[str] = None
    poRandomId: Optional[str] = None
    grnRandomId: Optional[str] = None
    apRandomId: Optional[str] = None
    vendorName: Optional[str] = None
    orderDate: Optional[datetime] = None
    grnDate: Optional[datetime] = None
    outgoingDate: Optional[datetime] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    poDate: Optional[datetime] = None
    paymentDate: Optional[datetime] = None
    apinvoiceDate: Optional[datetime] = None
    receivingLocation: Optional[str] = None
    totalPayableAmount: Optional[float] = None
    paidAmount: Optional[float] = 0
    comments: Optional[str] = None
    invoiceNo: Optional[str] = None
    poCreatedPerson: Optional[str] = None
    grnCreatedPerson: Optional[str] = None
    apCreatedPerson: Optional[str] = None
   
    apVerifiedPerson: Optional[str] = None
    intimationDays: Optional[int] = None
    paymentMethod: Optional[str] = None
    paymentMode: Optional[str] = None
    advanceAmount: Optional[float] = None
    totalPrice: Optional[float] = None
    payableAmount: Optional[float] = None
    partialAmount: Optional[float] = None
    fullPaymentAmount: Optional[float] = None
    paymentType: Optional[str] = None
    chequeNo: Optional[float] = None
    onlinePayment: Optional[float] = None
    discountDetails: Optional[float] = None
    taxDetails: Optional[float] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    itemDetails: Optional[List[ItemDetails]] = None
    status: Optional[str] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    bankName: Optional[str] = None
    cashAmount: Optional[float] = None  # Replace pettyCashAmount and hoCash
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    paymentTerms: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    randomId: Optional[str] = None
    debitAmount: Optional[float] = None
    hasDebitCreditNotes: Optional[bool] = False
    selectedDebitNotes: Optional[List[str]] = None
    paymentHistory: Optional[List[PaymentHistory]] = None  # Changed to List[PaymentHistory]
    paymentId: Optional[str] = None  # Added PaymentID field
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    class Config:
        orm_mode = True
    @field_validator('orderDate', 'grnDate', 'outgoingDate', 'createdDate', 'lastUpdatedDate', 'invoiceDate', 'poDate', 'paymentDate', 'apinvoiceDate', mode='before')
    def parse_datetime(cls, v):
        """Convert MongoDB date format to IST datetime"""
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

class OutgoingPost(BaseModelWithConfig):
    purchaseOrderId: Optional[str] = None
    grnId: Optional[str] = None
    invoiceId: Optional[str] = None
    serOId:Optional[str] = None
    serviceId:Optional[str] = None
    invoiceType:Optional[str] = None
    vendorName: Optional[str] = None
    orderDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    grnDate: Optional[datetime] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate: Optional[datetime] = None
    paymentDate: Optional[datetime] = None
    poDate: Optional[datetime] = None
    outgoingDate: Optional[datetime] = None
    apinvoiceDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    receivingLocation: Optional[str] = None
    totalPayableAmount: Optional[float] = None
    comments: Optional[str] = None
    poCreatedPerson: Optional[str] = None
    grnCreatedPerson: Optional[str] = None
    apCreatedPerson: Optional[str] = None
   
    apVerifiedPerson: Optional[str] = None
    paymentType: Optional[str] = None
    payableAmount: Optional[float] = None
    paymentMethod: Optional[str] = None
    paymentMode: Optional[str] = None
    advanceAmount: Optional[float] = None
    totalPrice: Optional[float] = None
    partialAmount: Optional[float] = None
    fullPaymentAmount: Optional[float] = None
    paymentTerms: Optional[str] = None
    intimationDays: Optional[int] = None
    discountDetails: Optional[float] = None
    taxDetails: Optional[float] = None
    chequeNo: Optional[float] = None
    onlinePayment: Optional[float] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    bankName: Optional[str] = None
    cashAmount: Optional[float] = None  # Replace pettyCashAmount and hoCash
    itemDetails: Optional[List[ItemDetails]] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
    debitAmount: Optional[float] = None
    hasDebitCreditNotes: Optional[bool] = False
    selectedDebitNotes: Optional[List[str]] = None
    paymentHistory: Optional[List[PaymentHistory]] = None  # Changed to List[PaymentHistory]
    paymentId: Optional[str] = None  # Added PaymentID field
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0 
    @field_validator('orderDate', 'grnDate', 'outgoingDate', 'createdDate', 'lastUpdatedDate', 'invoiceDate', 'poDate', 'paymentDate', 'apinvoiceDate', mode='before')
    def parse_datetime(cls, v):
        """Convert MongoDB date format to IST datetime"""
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

class UpdatePaymentRequest(BaseModelWithConfig):
    outgoingId: str
    paymentType: str
    totalPayableAmount: float
    fullPaymentAmount: float = 0
    partialAmount: float = 0
    advanceAmount: float = 0
    paymentMethod: str
    paymentMode: str
    cashAmount: float = 0  # New field for cash payments
    upi: Optional[str] = None
    bankName: Optional[str] = None
    impsNo: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    selectedDebitNotes: List[str] = []
# Pydantic Models
class TransactionDetail(BaseModel):
    date: datetime
    formatted_date: Optional[str] = None  # Add this field
    type: str
    reference_id: str
    description: str
    debit_amount: float
    credit_amount: float
    balance: float
    status: str
    payment_method: Optional[str] = None
    notes: Optional[str] = None
class InvoiceDetail(BaseModel):
    poId: Optional[str] = "N/A"
    grnId: Optional[str] = "N/A"
    invoiceNo: Optional[str] = "N/A"
    invoiceDate: Optional[datetime] = None
    totalPayableAmount: float = 0.0
    paidAmount: float = 0.0
    debitAmount: float = 0.0
    creditAmount: float = 0.0
    remainingAmount: float = 0.0
    status: str = "Open"
    lastPaymentDate: Optional[datetime] = None

class VendorLedgerResponse(BaseModel):
    vendorId: str
    vendorName: str
    totalPayableAmount: float
    totalPaidAmount: float
    totalDebitAmount: float
    totalCreditAmount: float
    outstandingAmount: float
    invoices: List[InvoiceDetail]
    transactions: List[TransactionDetail]
    lastTransactionDate: Optional[datetime] = None


class VendorDetail(BaseModel):
    vendorName: str
    count: int = 0
    totalAmount: float = 0.0
    statuses: List[str] = []
    class Config:
        orm_mode = True  # For MongoDB compatibility
class TaxDetail(BaseModel):
    taxName: str
    taxPercentage: float
    taxAmount: float

class ItemDetail(BaseModel):
    itemId: str
    purchasetaxName: float  # Tax percentage
    taxType: str
    sgst: float = 0
    cgst: float = 0
    igst: float = 0
    taxAmount: float = 0

class OutgoingResponse(BaseModel):
    taxes: List[TaxDetail]
class OutgoingResponseGET(BaseModel):
    outgoings: List[Outgoing]
    totalItems: int
    totalPayableAmount: float  # ADD THIS FIELD
# Pydantic Models
class PaymentDetails(BaseModel):
    vendorName: str
    paymentType: str  # "partial", "full", "advance"
    paymentMode: str  # "Bank", "Cash"
    paymentMethod: str  # "neft", "rtgs", "imps", "upi", "pettyCash", "hoCash"
    fullPaymentAmount: Optional[float] = None
    partialAmount: Optional[float] = None
    advanceAmount: Optional[float] = None
    bankName: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    impsNo: Optional[str] = None
    upi: Optional[str] = None
    pettyCashAmount: Optional[float] = None
    hoCash: Optional[float] = None
    poId: Optional[str] = None
    grnId: Optional[str] = None
    isPreOutgoing: Optional[bool] = False
