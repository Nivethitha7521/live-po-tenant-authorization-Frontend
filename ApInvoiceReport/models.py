from datetime import datetime
from pydantic import BaseModel
from typing import Any, Literal, Optional


class DropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]


class ReportApItem(BaseModel):
    discount_value: Optional[float] = None
    discountAmount: Optional[float] = None
    apInvoice_id: Optional[str] = None
    createdDate: Optional[str] = None
    invoiceNo: Optional[str] = None
    invoiceDate: Optional[str] = None
    vendorName: Optional[str] = None
    poRandomId: Optional[str] = None
    grnRandomId: Optional[str] = None
    locationName: Optional[str] = None
    debitAfterSgstAmount: Optional[float] = None
    debitAfterCgstAmount: Optional[float] = None
    debitAfterIgstAmount: Optional[float] = None
    itemCode: Optional[Any] = None
    itemName: Optional[str] = None
    unitPrice: Optional[float] = None
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[str] = None
    quantity: Optional[float] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    igst: Optional[float] = None
    totalPrice: Optional[float] = None
    befTaxDiscount: Optional[float] = None
    befTaxDiscountAmount: Optional[float] = None
    finalPrice: Optional[float] = None
    taxAmount: Optional[float] = None
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None
    purchasetaxName: Optional[float] = None
    #  vendorId: Optional[str] = None
    #  internalNo: Optional[str] = None
    grnRandomId: Optional[str] = None
    hsnCode: Optional[str] = None
    #  VendorRefNo: Optional[str] = None
    LineDiscount: Optional[float] = None
    lineDiscountValue: Optional[float] = None
    totalGstAmount: Optional[float] = None
    totalGst: Optional[float] = None
    freightName: Optional[str] = None
    total: Optional[float] = None
    FrCgstPercent: Optional[float] = None
    debitAfterFrCgstAmount: Optional[float] = None
    FrSgstPercent: Optional[float] = None
    debitAfterFrSgstAmount: Optional[float] = None
    FrIgstPercent: Optional[float] = None
    debitAfterFrIgstAmount: Optional[float] = None
    FrTaxAmount: Optional[float] = None
    randomId: Optional[str] = None
    sapVendorCode: Optional[Any] = None


class Config:
    allow_population_by_field_name = True
