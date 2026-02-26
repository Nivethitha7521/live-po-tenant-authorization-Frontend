from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, List, Literal, Optional, Union
from fastapi import FastAPI

# Define the ItemDetail model
class ItemDetail(BaseModel):
    itemId: Optional[str] = None
    itemName: Optional[str] = None
    nos: Optional[float]  =None
    purchasecategoryName:Optional[str]=None
    purchasesubcategoryName: Optional[Any] = None
    eachQuantity:  Optional[float]  =None
    quantity: Optional[float]  =None
    uom:Optional[str] =None
    befTaxDiscount:Optional[float] = None
    afTaxDiscount:Optional[float] = None
    befTaxDiscountAmount:Optional[float] = None
    afTaxDiscountAmount:Optional[float] = None
    purchasetaxName:Optional[float] = None
    returnedQuantity:Optional[float] = None
    stockQuantity: Optional[float] = None
    unitPrice: Optional[float] = None
    totalPrice: Optional[float] = None
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    igst: Optional[float] = None
    status: Optional[str] = None
    discountAmount: Optional[float] =None
    taxAmount: Optional[float] =None
    finalPrice: Optional[float] = None
    itemCode:Optional[str] =None
# Define the GRN model
class Apinvoice(BaseModel):
    invoiceId: Optional[str] = None
    purchaseOrderId: Optional[str] = None
    poRandomId: Optional[str] = None
    grnId:Optional[str] = None
    grnRandomId:Optional[str] = None
    vendorName: Optional[str] = None
    apinvoiceDate: Optional[datetime] = None
    apReturnedDate:Optional[datetime] = None
    invoiceDate: Optional[datetime] =None
    grnDate:Optional[datetime]=None
    invoiceNo:Optional[str] =None
    poDate: Optional[datetime] =None
    dueDate: Optional[datetime] = None
    itemDetails: Optional[List[ItemDetail]] = None
    invoiceAmount: Optional[float] = None
    taxDetails: Optional[float] = None
    discountDetails: Optional[float] = None
    discountPrice: Optional[float] = None
    apDiscountPrice:Optional[float] =None
    paymentTerms: Optional[str] = None
    debitAfterTaxAmount: Optional[float] = None
    debitAfterDiscountAmount: Optional[float] = None
    debitAfterSgstAmount: Optional[float] = None
    debitAfterCgstAmount: Optional[float] = None
    debitAfterIgstAmount: Optional[float] = None
    debitOnBasePriceAmount: Optional[float] = None
    debitOnTaxAmount: Optional[float] = None
    paymentStatus: Optional[str] = None
    comments: Optional[str] = None
    debitAmount: Optional[float] = None
    attachments: Optional[Union[str, None]] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    paymentTerms: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    randomId:Optional[str] = None   
    status:Optional[str]= None
    apPerson:Optional[str] =None
    apReturnedPersonId: Optional[str] = None
    debitAmount:Optional[float] =None
    # New detailed debit tracking fields
    debitAfterTaxAmount: Optional[float] = None
    debitAfterDiscountAmount: Optional[float] = None
    debitAfterSgstAmount: Optional[float] = None
    debitAfterCgstAmount: Optional[float] = None
    debitAfterIgstAmount: Optional[float] = None
    debitOnBasePriceAmount: Optional[float] = None
    debitOnTaxAmount: Optional[float] = None
    hasDebitCreditNotes: Optional[bool] = False
    apRoundOff:Optional[float] =None
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
     #service details
    invoiceType: Optional[Literal["goods", "service"]] = Field(default="goods")  # Add this
    serviceId: Optional[str] = None  # Add this for service reference
    serOId:Optional[str]=None
    sacCode: List[str] = Field(default_factory=list)
    desc_ids: List[str] = Field(default_factory=list)
    descriptions: List[str] = Field(default_factory=list)
    from_dates: List[Optional[datetime]] = Field(default_factory=list) # datetime objects
    to_dates: List[Optional[datetime]] = Field(default_factory=list) # datetime objects
    fees: List[float] = Field(default_factory=list)
    remarks: List[Optional[str]] = Field(default_factory=list) # Optional remarks
    quantity: List[Optional[float]] = Field(default_factory=list) # Optional quantity
    desc_tax_types: List[str] = Field(default_factory=list)
    desc_tax_pers: List[float] = Field(default_factory=list)
    desc_sgst: List[float] = Field(default_factory=list)
    desc_cgst: List[float] = Field(default_factory=list)
    desc_igst: List[float] = Field(default_factory=list)
    desc_tax_amounts: List[float] = Field(default_factory=list)
    desc_totals: List[float] = Field(default_factory=list)
    desc_total_fees: List[float] = Field(default_factory=list)
    totalServiceFees: Optional[float] = 0
    totalServiceTax: Optional[float] = 0
    totalServiceDiscount: Optional[float] = 0

class ApinvoicePost(BaseModel):
    purchaseOrderId: Optional[str] = None
    grnId:Optional[str] = None
    vendorName: Optional[str] = None
    apinvoiceDate: Optional[datetime] = None
    apReturnedDate:Optional[datetime] = None
    poDate: Optional[datetime] =None
    invoiceDate: Optional[datetime] =None
    invoiceNo:Optional[str] =None
    dueDate: Optional[datetime] = None
    grnDate:Optional[datetime] =None
    itemDetails: Optional[List[ItemDetail]] = None
    invoiceAmount: Optional[float] = None
    debitAmount: Optional[float] = None
    taxDetails: Optional[float] = None
    discountDetails: Optional[float] = None
    discountPrice: Optional[float] = None
    apDiscountPrice:Optional[float] =None
    paymentTerms: Optional[str] = None
    paymentStatus: Optional[str] = None
    comments: Optional[str] = None
    attachments: Optional[Union[str, None]] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    paymentTerms: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    randomId:Optional[str] = None
    status:Optional[str]= None
    apPerson:Optional[str] = None
    apReturnedPersonId: Optional[str] = None
    debitAmount:Optional[float] =None
    # New detailed debit tracking fields
    debitAfterTaxAmount: Optional[float] = None
    debitAfterDiscountAmount: Optional[float] = None
    debitAfterSgstAmount: Optional[float] = None
    debitAfterCgstAmount: Optional[float] = None
    debitAfterIgstAmount: Optional[float] = None
    debitOnBasePriceAmount: Optional[float] = None
    debitOnTaxAmount: Optional[float] = None
    hasDebitCreditNotes: Optional[bool] = False
    apRoundOff:Optional[float] =None
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0

    #service details
    invoiceType: Optional[Literal["goods", "service"]] = Field(default="goods")  # Add this
    serviceId: Optional[str] = None  # Add this for service reference
    serOId:Optional[str]=None
    sacCode: List[str] = Field(default_factory=list)
    desc_ids: List[str] = Field(default_factory=list)
    descriptions: List[str] = Field(default_factory=list)
    from_dates: List[Optional[datetime]] = Field(default_factory=list) # datetime objects
    to_dates: List[Optional[datetime]] = Field(default_factory=list) # datetime objects
    fees: List[float] = Field(default_factory=list)
    remarks: List[Optional[str]] = Field(default_factory=list) # Optional remarks
    quantity: List[Optional[float]] = Field(default_factory=list) # Optional quantity
    desc_tax_types: List[str] = Field(default_factory=list)
    desc_tax_pers: List[float] = Field(default_factory=list)
    desc_sgst: List[float] = Field(default_factory=list)
    desc_cgst: List[float] = Field(default_factory=list)
    desc_igst: List[float] = Field(default_factory=list)
    desc_tax_amounts: List[float] = Field(default_factory=list)
    desc_totals: List[float] = Field(default_factory=list)
    desc_total_fees: List[float] = Field(default_factory=list)
    totalServiceFees: Optional[float] = 0
    totalServiceTax: Optional[float] = 0
    totalServiceDiscount: Optional[float] = 0

class FrontendItemDetail(BaseModel):
    itemId: str
    itemName: str
    stockQuantity: float
    unitPrice: float
    totalPrice: float
    purchasetaxName: Optional[float] = 0.0
    taxAmount: float
    discountAmount: float
    finalPrice: float

class FrontendApInvoiceResponse(BaseModel):
    invoiceId: str
    randomId: Optional[str] = None
    grnId: Optional[str] = None
    grnRandomId: Optional[str] = None
    vendorName: Optional[str] = None
    apInvoiceDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    itemDetails: Optional[List[FrontendItemDetail]] = None
    invoiceAmount: Optional[float] = None
    paymentStatus: Optional[str] = None
    invoiceType: Optional[Literal["goods", "service"]] = Field(default="goods")  # Add this
    sacCode: List[str] = Field(default_factory=list)
    from_dates: List[Optional[datetime]] = Field(default_factory=list) # datetime objects
    to_dates: List[Optional[datetime]] = Field(default_factory=list) # datetime objects
    fees: List[float] = Field(default_factory=list)
    quantity: List[Optional[float]] = Field(default_factory=list) # Optional quantity
    desc_tax_pers: List[float] = Field(default_factory=list)
    desc_tax_amounts: List[float] = Field(default_factory=list)
    desc_totals: List[float] = Field(default_factory=list)
    remarks:List[str] = Field( default_factory=list)
class ApRandomId(BaseModel):
    invoiceId:str
    randomId:str
# Request model for the combined operation
class PostOutgoingAndUpdateDiscountRequest(BaseModel):
    apDiscountPrice: Optional[float] = 0.0  # Discount to apply
    invoiceId:Optional[str]
    outgoingDate: Optional[datetime] = None  # New field for outgoingDate




class PaginatedApInvoices(BaseModel):
    data: List[Apinvoice]
    total: int
    page: int
    limit: int
    total_pages: int
    has_more: bool