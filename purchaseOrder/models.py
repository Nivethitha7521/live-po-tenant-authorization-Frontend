from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Union,Any
from datetime import datetime
from fastapi import FastAPI, HTTPException
import pytz

class Item(BaseModel):
    itemId: Optional[str] = None
    itemCode: Optional[str] = None
    itemName: Optional[str] = None
    quantity: Optional[float] = None
    poQuantity: Optional[float] = None
    poQuantityTaxAmount:Optional[float] = None
    poQuantityDiscountAmount:Optional[float] = None
    poQuantitypendingTotalPrice: Optional[float] = Field(None, ge=0)
    poQuantitypendingFinalPrice: Optional[float] = Field(None, ge=0)
    poQuantitysgst: Optional[float] = Field(None, ge=0, description="PoQuantity SGST amount")
    poQuantitycgst: Optional[float] = Field(None, ge=0, description="PoQuantity CGST amount")
    poQuantityigst: Optional[float] = Field(None, ge=0, description="PoQuantity IGST amount")
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[Any] = None
    uom: Optional[str] = None
    count: Optional[float] = None
    eachQuantity: Optional[float] = None
    receivedQuantity: Optional[float] = None
    damagedQuantity: Optional[float] = None
    taxPercentage: Optional[float] = Field(None, ge=0, description="Tax percentage (e.g., 18 for 18%)")
    existingPrice: Optional[float] = Field(None, ge=0, description="Original price of the item")
    newPrice: Optional[float] = Field(None, ge=0, description="New price of the item")
    priceVariance: Optional[float] = None
    sgst: Optional[float] = Field(None, ge=0, description="SGST amount")
    cgst: Optional[float] = Field(None, ge=0, description="CGST amount")
    igst: Optional[float] = Field(None, ge=0, description="IGST amount")
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    befTaxDiscount: Optional[float] = Field(None, ge=0, le=100, description="Before-tax discount percentage (0-100)")
    afTaxDiscount: Optional[float] = Field(None, ge=0, le=100, description="After-tax discount percentage (0-100)")
    befTaxDiscountAmount: Optional[float] = Field(None, ge=0, description="Before-tax discount fixed amount")
    afTaxDiscountAmount: Optional[float] = Field(None, ge=0, description="After-tax discount fixed amount")
    befTaxDiscountType: Optional[Literal["percentage", "amount"]] = Field("percentage", description="Type of before-tax discount")
    afTaxDiscountType: Optional[Literal["percentage", "amount"]] = Field("percentage", description="Type of after-tax discount")
    discountAmount: Optional[float] = Field(None, ge=0, description="Total discount amount applied")
    taxAmount: Optional[float] = Field(None, ge=0, description="Total tax amount")
    barcode: Optional[str] = None
    pendingCount: Optional[float] = Field(None, ge=0)
    pendingQuantity: Optional[float] = Field(None, ge=0)
    pendingTotalQuantity: Optional[float] = Field(None, ge=0)
    pendingTaxAmount: Optional[float] = Field(None, ge=0)
    pendingDiscountAmount: Optional[float] = Field(None, ge=0)
    pendingSgst: Optional[float] = Field(None, ge=0)
    pendingCgst: Optional[float] = Field(None, ge=0)
    pendingIgst: Optional[float] = Field(None, ge=0)
    pendingTotalPrice: Optional[float] = Field(None, ge=0)
    pendingFinalPrice: Optional[float] = Field(None, ge=0)
    pendingBefTaxDiscountAmount: Optional[float] = Field(None, ge=0, description="Pending before-tax discount amount")
    pendingAfTaxDiscountAmount: Optional[float] = Field(None, ge=0, description="Pending after-tax discount amount")
    totalPrice: Optional[float] = Field(None, ge=0, description="Total price before discounts")
    finalPrice: Optional[float] = Field(None, ge=0, description="Final price after discounts and taxes")
    expiryDate: Optional[datetime] = None
    hsnCode: Optional[str] = None
    poPhoto: Optional[str] = None
    status: Optional[str] = None
    randomId:Optional[str] = None
    availableStock: Optional[float] = 0     
    locationId: Optional[str] = ""           
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
# Define the PurchaseOrderState model
class PurchaseOrderState(BaseModel):
    purchaseOrderId:  Optional[str] = None
    vendorName: Optional[str] = None
    vendorContact: Optional[str] = None
    orderDate: Optional[datetime] = None
    approvedDate: Optional[datetime] = None
    rejectedDate: Optional[datetime] = None 
    invoiceDate: Optional[datetime] =None
    invoiceNo: Optional[str] =None
    expectedDeliveryDate: Optional[datetime] = None
    vendorId:Optional[str] = None
    location:Optional[str]=None
    poStatus: Optional[str] = None
    items: Optional[List[Item]] = None
    totalOrderAmount: Optional[float] = None  # Consider using float if it's a numeric value
    discountPrice:Optional[float] = None
    paymentTerms: Optional[str] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None 
    totalDiscount: Optional[float] =None
    totalTax: Optional[float] =None
    comments: Optional[str] = None
    attachments: Optional[str] = None  
    createdDate:Optional[datetime] = None
    createdTime:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    lastUpdatedTime:Optional[datetime] = None
    creditLimit:Optional[int] =None
    randomId:Optional[str] = None
    imageUrl: Optional[str] = None  # New field for the image URL
    contactpersonEmail: Optional[str] = None
    creditLimit:Optional[int] =None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    grnDate:Optional[datetime] = None
    termsandConditions:Optional[List[str]] = None
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    itemStatus: Optional[str] = None
    pendingOrderAmount:Optional[float]=None
    pendingDiscountAmount:Optional[float] = None
    pendingTaxAmount:Optional[float] = None
    poCreatedPerson:Optional[str] = None
    poApprovedPerson:Optional[str] = None
    poRejectedPerson:Optional[str] = None
    roundOffValue: Optional[float] = 0
    overallDiscountValue: Optional[float] = 0
    locationName: Optional[str] =None
    grnRoundOffAmount:Optional[float] = 0
    grnDiscount:Optional[float] = None
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    freights: Optional[List[Freight]] = None  # Added: List of freights
    poCreatedPersonId: Optional[str] = None
    poCreatedPersonName: Optional[str] = None

    poApprovedPersonId: Optional[str] = None
    poApprovedPersonName: Optional[str] = None

    poRejectedPersonId: Optional[str] = None
    poRejectedPersonName: Optional[str] = None
    GrnConvertedPerson:Optional[str]=None
    approvalHistory: Optional[List[dict]] = []
# Define the PurchaseOrderPost model for creating new purchase orders
class PurchaseOrderPost(BaseModel):
    vendorName: Optional[str] = None
    vendorContact: Optional[str] = None
    vendorId:Optional[str] = None
    orderDate: Optional[datetime] = None
    approvedDate: Optional[datetime] = None
    rejectedDate: Optional[datetime] = None
    invoiceDate: Optional[datetime] =None
    invoiceNo: Optional[str] =None
    expectedDeliveryDate: Optional[datetime] = None
    poStatus: Optional[str] = None
    items: Optional[List[Item]] = None
    totalOrderAmount: Optional[float] = None  # Consider using float if it's a numeric value
    discountPrice:Optional[float] = None
    paymentTerms: Optional[str] = None
    shippingAddress: Optional[str] = None
    location:Optional[str] = None
    billingAddress: Optional[str] = None
    totalDiscount: Optional[float] =None
    totalTax: Optional[float] =None
    comments: Optional[str] = None
    attachments:Optional[str] = None 
    createdDate:Optional[datetime] = None
    createdTime:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    creditLimit:Optional[int] =None
    lastUpdatedTime:Optional[datetime] = None
    imageUrl: Optional[str] = None  # New field for the image URL
    contactpersonEmail: Optional[str] = None
    termsandConditions:Optional[List[str]] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    grnDate:Optional[datetime] = None
    itemStatus: Optional[str] = None
    pendingOrderAmount:Optional[float]=None
    pendingDiscountAmount:Optional[float] = None
    pendingTaxAmount:Optional[float] = None
    poCreatedPerson:Optional[str] = None
    poApprovedPerson:Optional[str] = None
    poRejectedPerson:Optional[str] = None
    GrnConvertedPerson:Optional[str]=None
    discountMode: Optional[Literal["percentage", "amount"]] = "percentage"
    roundOffValue: Optional[float] = 0
    overallDiscountValue: Optional[float] = 0
    locationName:Optional[str] = None
    grnDiscount:Optional[float] = None
    grnRoundOffAmount:Optional[float] = 0
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    freights: Optional[List[Freight]] = None  # Added: List of freights
    approvalHistory: Optional[List[dict]] = []
class ItemUpdate(BaseModel):
    itemId: Optional[str] = None  # None for new items
    itemName: Optional[str] = None
    quantity: Optional[float] = None
    count: Optional[float] = None
    eachQuantity: Optional[float] = None
    pendingCount: Optional[float] = None
    pendingQuantity: Optional[float] = None
    newPrice: Optional[float] = None
    taxPercentage: Optional[float] = None
    taxType: Optional[str] = "cgst_sgst"
    befTaxDiscount: Optional[float] = None
    afTaxDiscount: Optional[float] = None
    expiryDate: Optional[datetime] = None
    action: str  # 'add', 'edit', or 'delete'

class PurchaseOrderItemUpdate(BaseModel):
    items: List[ItemUpdate]
    invoiceNo: Optional[str] = None
    invoiceDate: Optional[datetime] = None
    grndiscountPrice: Optional[float] = None
# CSV Import Models

class ImportReturnItem(BaseModel):
    itemId: Optional[str] = None
    itemCode: Optional[str] = None
    itemName: Optional[str] = None
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[str] = None
    uom: Optional[str] = None
    pendingCount: Optional[float] = None
    pendingQuantity: Optional[float] = None
    pendingTotalQuantity: Optional[float] = None
    newPrice: Optional[float] = None
    existingPrice:Optional[float] = None
    priceVariance:Optional[float]=None
    taxPercentage: Optional[float] = None
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    befTaxDiscount: Optional[float] = None
    afTaxDiscount: Optional[float] = None
    pendingTaxAmount: Optional[float] = None
    pendingSgst: Optional[float] = None
    pendingCgst: Optional[float] = None
    pendingIgst: Optional[float] = None
    pendingTotalPrice: Optional[float] = None
    pendingFinalPrice: Optional[float] = None
    pendingBefTaxDiscountAmount: Optional[float] = None
    pendingAfTaxDiscountAmount: Optional[float] = None
    randomId: Optional[str] = None  # ADD THIS FIELD
    
class CSVImportItem(BaseModel):
    itemName: str
    count: Optional[float] = None
    quantity: Optional[float] = None  # eachQuantity
    totalQuantity: Optional[float] = None
    uom: Optional[str] = None
    price: Optional[float] = None
    tax: Optional[float] = None
    beforeTaxDiscount: Optional[float] = None
    afterTaxDiscount: Optional[float] = None
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None  # Add taxType
    
# Update ImportResponse model to explicitly include all fields
class ImportResponse(BaseModel):
    success: bool
    message: str
    imported_items: List[ImportReturnItem]
    total_pending_order_amount: float
    totalTax: float
    totalDiscount: float
    duplicates_merged: List[str]
    errors: List[str]
    updated_items: List[str]
    warnings: List[str]
    success_messages: List[str]

# Define the request model for the PATCH request
class ItemTotalsRequest(BaseModel):
    count:float
    eachQuantity:float
    quantity:float
    pendingCount: float  # Count of items
    pendingQuantity: float  # Each item's pending quantity (eachQuantity)
    pendingTotalQuantity: float  # Total quantity of items pending
    newPrice: float  # New price for the item
    receivedQuantity: Optional[float] = None  # Quantity of items received
    damagedQuantity: Optional[float] = None  # Quantity of items damaged
    befTaxDiscount: Optional[float] = None  # Discount before tax
    afTaxDiscount: Optional[float] = None  # Discount after tax
    taxPercentage: Optional[float] = 0  # Tax percentage on the item
    taxType: str = "cgst_sgst"  # Tax type to apply (cgst_sgst or igst)
    status:str
    invoiceDate:datetime
    invoiceNo:str
    
class ItemPatch(BaseModel):
    itemId: str  # Item ID that needs to be updated
    receivedQuantity: Optional[float] = None  # Received quantity to be updated
    damagedQuantity: Optional[float] = None  # Damaged quantity to be updated
    befTaxDiscount: Optional[float] = None
    afTaxDiscount: Optional[float] = None
    expiryDate: Optional[datetime] = None
    grnPrice: Optional[float] = None

class PurchaseOrderPatch(BaseModel):
    grnDate:Optional[datetime] = None
    invoiceDate: Optional[datetime] = None
    invoiceNo: Optional[str] = None
    grndiscountPrice: Optional[float] = None
    items: List[ItemPatch]  # List of item details to be patched
    grnRoundOffAmount: Optional[float] = 0
    freights:List[Freight]
    
class PurchaseRandomId(BaseModel):
    purchaseOrderId:str
    randomId:str                  

class PurchaseInvoice(BaseModel):
    purchaseOrderId: str
    invoiceNo: str
    vendorName: Optional[str] = None  # Add vendorName to the model

class PurchaseOrderPostExtended(PurchaseOrderPost):
    isHoldOrder: Optional[bool] = False

class ItemInput(BaseModel):
    id: Optional[str] = None
    pendingTotalQuantity: float
    poQuantity: float
    newPrice: float
    befTaxDiscount: Optional[float] = 0
    afTaxDiscount: Optional[float] = 0
    befTaxDiscountAmount: Optional[float] = 0
    afTaxDiscountAmount: Optional[float] = 0
    befTaxDiscountType: Optional[Literal["percentage", "amount"]] = "percentage"
    afTaxDiscountType: Optional[Literal["percentage", "amount"]] = "percentage"
    taxPercentage: Optional[float] = 0
    taxType: Literal["cgst_sgst", "igst"] = "cgst_sgst"

class OverallDiscountRequest(BaseModel):
    items: List[ItemInput]
    overallDiscount: Optional[float] = 0
    overallDiscountAmount: Optional[float] = 0
    overallDiscountType: Literal["percentage", "amount"] = "percentage"
    applyOverallDiscount: bool = False