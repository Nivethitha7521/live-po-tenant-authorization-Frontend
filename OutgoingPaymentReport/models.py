from datetime import datetime
from pydantic import BaseModel
from typing import  Optional


class DropdownOutgoing(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
    vendorNameIn: list[str]
    invoiceNoIn: list[str]
   

class DropdownOutstanding(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
    vendorNameIn: list[str]
    invoiceNoIn: list[str]
    statusIn:list[str]
    

class Outstanding(BaseModel):
    apRandomId: Optional[str] = None
    grnRandomId: Optional[str] = None
    apinvoiceDate: Optional[datetime] = None
    grnDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    gstNumber: Optional[str] = None
    vendorName: Optional[str] = None
    gst_bos: Optional[str] = None
    itemName: Optional[str] = None
    item_service: Optional[str] = None
    billingAddress: Optional[str] = None
    totalPrice: Optional[float] = None
    paymentDate: Optional[datetime] = None
    payableAmount: Optional[float] = None
    paidAmount: Optional[float] = 0
    useName: Optional[str] = None
    # apiInvoice 
    taxAmount: Optional[float] = None
    finalPrice: Optional[float] = None
    # vendor 
    randomId: Optional[str] = None 
    contactpersonPhone: Optional[str] = None
    vendorType: Optional[str] = None
    # Additional fields to match export calculations
    vendor_code: Optional[str] = None
    outstanding: Optional[float] = None
    
    
class OutGoingPaymentReport(BaseModel):
    internalNo: Optional[str] = None
    postingDate: Optional[datetime] = None
    createDate: Optional[datetime] = None
    paymentNum: Optional[str] = None
    documentType: str = "AP Invoice"  # Default for outgoing payments
    cusSupInvoiceNo: Optional[str] = None  # Maps to grnRandomId
    cusSupInvoiceDate: Optional[datetime] = None  # Maps to grnDate
    cusSupCode: Optional[str] = None  # Maps to sapVendorCode from vendor
    cusSupName: Optional[str] = None  # vendorName
    cusSupInvoiceAmount: Optional[float] = None  # Maps to paidAmount or totalPrice
    # paymentRef1: Optional[str] = None  # First Payment Ref (often empty)
    paymentDate: Optional[datetime] = None
    paymentAmount: Optional[float] = None  # paidAmount
    modeOfPayment: Optional[str] = None  # Maps to 'Cash', 'Check', 'Wire' based on paymentMode/paymentMethod
    paymentRef2: Optional[str] = None  # Second Payment Ref (neftNo, rtgsNo, etc.)
    cusSupInvoiceRef: Optional[str] = None  # Maps to invoiceNo
    checkNo: Optional[str] = None  # chequeNo