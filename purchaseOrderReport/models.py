from pydantic import BaseModel
from typing import List, Literal, Optional, Any
from datetime import datetime


class PurchaseRandomId(BaseModel):
    purchaseOrderId: str
    randomId: str


class DropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]


class Podropdown(BaseModel):
    poNumber: Optional[list[str]] = None


class purchase(BaseModel):
    purchaseOrderId: Optional[str] = None
    orderDate: Optional[str] = None
    createdDate: Optional[str] = None
    # postalCode: Optional[int] = None
    poStatus: Optional[str] = None
    poRandomID: Optional[str] = None
    vendorName: Optional[str] = None
    itemCode: Optional[Any] = None
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[Any] = None
    Dscription: Optional[str] = None
    poQuantity: Optional[float] = None
    pendingQuantity: Optional[float] = None
    price: Optional[float] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    igst: Optional[float] = None
    cgstAmt: float
    sgstAmt: float
    igstAmt: float
    # pendingSgst: Optional[float] = None
    # pendingCgst: Optional[float] = None
    # pendingIgst: Optional[float] = None
    # pendingTaxAmount: Optional[float] = None
    taxAmount: Optional[float] = None
    finalPrice: Optional[float] = None
    totalReceivedAmount: Optional[float] = None
    receivedQuantity: Optional[float] = None
    grpo_No: Optional[str] = None
    grpoStatus: Optional[str] = None
    apNo: Optional[str] = None
    apStatus: Optional[str] = None
    LineTotal: Optional[float] = None
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    taxPercentage: Optional[float] = None
    newPrice: Optional[float] = None
    randomId: Optional[str] = None
    sapVendorCode: Optional[Any] = None
    itemStatus: Optional[str] = None
    documentTotal: Optional[float] = None

    class Config:
        orm_mode = (
            True  # allows Pydantic to work with ORM objects like MongoDB documents
        )
        anystr_strip_whitespace = (
            True  # automatically trims whitespace from string fields
        )
        use_enum_values = True  # if you use Enum types, it will store the actual value


class purchaseResponse(BaseModel):
    page: int
    limit: int
    total_records: int
    totalPages: int
    items: List[purchase]
