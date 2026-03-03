from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, List, Literal, Optional, Union
from fastapi import FastAPI
import pytz
class ItemDetail(BaseModel):
    itemId: Optional[str] = None
    itemName: Optional[str] = None
    nos: Optional[float] = None
    grnReturnNos: Optional[float] = None
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[str] = None
    eachQuantity: Optional[float] = None
    grnReturnEachQuantity: Optional[float] = None
    quantity: Optional[float] = None
    uom: Optional[str] = None
    purchasetaxName: Optional[float] = None
    totalQuantity: Optional[float] = None
    receivedQuantity: Optional[float] = None
    returnedQuantity: Optional[float] = None
    unitPrice: Optional[float] = None
    befTaxDiscount: Optional[float] = None
    afTaxDiscount: Optional[float] = None
    befTaxDiscountAmount: Optional[float] = None
    afTaxDiscountAmount: Optional[float] = None
    discountAmount: Optional[float] = None
    taxAmount: Optional[float] = None
    totalPrice: Optional[float] = None
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    igst: Optional[float] = None
    status: Optional[str] = None
    barcode: Optional[str] = None
    expiryDate: Optional[datetime] = None
    finalPrice: Optional[float] = None
    returnedTotalPrice: Optional[float] = None
    returnedTaxAmount: Optional[float] = None
    returnedDiscountAmount: Optional[float] = None
    returnedFinalPrice: Optional[float] = None
    returnedSgst: Optional[float] = None
    returnedCgst: Optional[float] = None
    returnHistory: Optional[List[dict]] = None
    item_rand:Optional[str] =None
    itemCode:Optional[str] =None
    class Config:
        json_encoders = {float: lambda v: round(v, 2)}

class Freight(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None  # Fixed: Consistent naming
    tCode: Optional[str] = None  # Fixed: Consistent with dialog
    amt: Optional[float] = None  # Base amount
    tAmt: Optional[float] = None  # Tax amount
    totalAmt: Optional[float] = None  # Total (amount + tax)
    sgst: Optional[float] = Field(None, ge=0, description="SGST amount")
    cgst: Optional[float] = Field(None, ge=0, description="CGST amount")
    igst: Optional[float] = Field(None, ge=0, description="IGST amount")
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None

class Grn(BaseModel):
    grnId: Optional[str] = None
    purchaseOrderId: Optional[str] = None
    poRandomID: Optional[str] = None
    vendorName: Optional[str] = None
    grnDate: Optional[datetime] = None
    grnVerifiedDate: Optional[datetime] = None
    grnReturnedDate: Optional[datetime] = None
    agingDay: Optional[int] = None
    poDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    receivingLocation: Optional[str] = None
    itemDetails: Optional[List[ItemDetail]] = None
    inspectionStatus: Optional[str] = None
    receivedBy: Optional[str] = None
    totalReceivedAmount: Optional[float] = None
    totalDiscount: Optional[float] = None
    totalTax: Optional[float] = None
    totalReturnedAmount: Optional[float] = None
    totalReturnedTax: Optional[float] = None
    totalReturnedDiscount: Optional[float] = None
    discountPrice: Optional[float] = None
    comments: Optional[str] = None
    attachments: Optional[str] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate: Optional[datetime] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[int] = None
    paymentTerms: Optional[str] = None
    gstNumber: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
   
    grnReturnedPerson: Optional[str] = None
    grnReturnedPersonId: Optional[str] = None
    grnAmount: Optional[float] = None
    totalDebitAmount: Optional[float] = None
    hasDebitCreditNotes: Optional[bool] = False
    grnRoundOffAmount:Optional[float] = 0
    totalAmountBeforeRoundOff:Optional[float] = 0 
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    freights: Optional[List[Freight]] = None  # Added: List of freights
    class Config:
        json_encoders = {float: lambda v: round(v, 2)}

class GrnPost(BaseModel):
    purchaseOrderId: Optional[str] = None
    poRandomID: Optional[str] = None
    vendorName: Optional[str] = None
    grnDate: Optional[datetime] = None
    grnVerifiedDate: Optional[datetime] = None
    grnReturnedDate: Optional[datetime] = None
    agingDay: Optional[int] = None
    poDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    receivingLocation: Optional[str] = None
    itemDetails: Optional[List[ItemDetail]] = None
    inspectionStatus: Optional[str] = None
    receivedBy: Optional[str] = None
    totalReceivedAmount: Optional[float] = None
    totalDiscount: Optional[float] = None
    totalTax: Optional[float] = None
    totalReturnedAmount: Optional[float] = None
    totalReturnedTax: Optional[float] = None
    totalReturnedDiscount: Optional[float] = None
    discountPrice: Optional[float] = None
    comments: Optional[str] = None
    attachments: Optional[Union[str, None]] = None
    createdDate: Optional[datetime] = None
    lastUpdatedDate: Optional[datetime] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[int] = None
    paymentTerms: Optional[str] = None
    gstNumber: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
    grnReturnedPersonId: Optional[str] = None
    grnReturnedPerson: Optional[str] = None
    grnAmount: Optional[float] = None
    totalDebitAmount:Optional[float] = None
    grnRoundOffAmount:Optional[float] = 0
    totalAmountBeforeRoundOff:Optional[float] = 0 
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    freights: Optional[List[Freight]] = None  # Added: List of freights
    class Config:
        json_encoders = {float: lambda v: round(v, 2)}

class ItemDetails(BaseModel):
    itemId: Optional[str] = None
    itemName: Optional[str] = None
    noteType:Optional[str] =None
    quantity: float = Field(..., ge=0)
    unitPrice: float = Field(...,ge=0)
    totalPrice: float = Field(..., ge=0)
    taxAmount: float = Field(..., ge=0)
    discountAmount: float = Field(..., ge=0)
    finalPrice: float = Field(..., ge=0)
    sgst: Optional[float] = Field(None, ge=0)
    cgst: Optional[float] = Field(None, ge=0)
    igst:Optional[float] =Field(None ,ge=0)
    reason: Optional[str] = None

    class Config:
        json_encoders = {float: lambda v: round(v, 2)}

class DebitNote(BaseModel):
    noteId: Optional[str] = None
    grnId: str
    randomId: Optional[str] = None
    vendorName: Optional[str] = None
    itemDetails: List[ItemDetails]
    createdDate: datetime
    createdBy: str
    lastUpdatedDate: Optional[datetime] = None
    noteType: str
    status: Optional[str] = "Active"  # Active, Partially Cleared, Cleared
    clearedBy: Optional[str] = None  # Who cleared the note (for full clear)
    clearedDate: Optional[datetime] = None  # When the note was fully cleared
    clearedAgainstOutgoing: Optional[str] = None  # The outgoing ID for full clear
    requestHash: Optional[str] = None  # For duplicate detection
    pendingAmount: Optional[float] = None  # Initialize to finalAmount on creation
    paymentHistory: Optional[List[dict]] = []  # History entries for partial/full usage

    class Config:
        json_encoders = {float: lambda v: round(v, 2)}

class ReturnItem(BaseModel):
    itemId: str
    nos: Optional[float] = None
    eachQuantity: Optional[float] = None
    returnedQuantity: Optional[float] = None
    returnReason: Optional[str] = None

class ReturnGRNRequest(BaseModel):
    scenario: Literal["full", "partial"]
    returnedDate: datetime
    returnedBy: str 
    comments: Optional[str] = None
    items: Optional[List[ReturnItem]] = None
       
    class Config:
        json_encoders = {float: lambda v: round(v, 2)}
    

class ReturnReason(BaseModel):
    reason: str
    createdDate: Optional[datetime] = None

class ItemUpdate(BaseModel):
    itemId: Optional[str] = None
    befTaxDiscount: Optional[float] = None
    afTaxDiscount: Optional[float] = None
    expiryDate: Optional[datetime] = None

class FrontendItemDetail(BaseModel):
    itemId:str
    itemName: str
    receivedQuantity: int
    returnedQuantity:int
    quantity:int
    unitPrice: float
    totalPrice: float
    purchasetaxName: str
    discountAmount: float
    finalPrice: float

class FrontendGrnResponse(BaseModel):
    grnId: str
    randomId: str
    vendorName:str
    grnDate:datetime
    itemDetails: List[FrontendItemDetail]

