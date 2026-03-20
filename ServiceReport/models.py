from pydantic import BaseModel
from typing import  Any, List, Literal, Optional
 
 
class DropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
     

class VendorResponse(BaseModel):
    vendorName:list[str]
    
class InvoiceNoResponse(BaseModel):
    invoiceNo:list[str]    
    

class ReportApItem(BaseModel):
    # --- Invoice Details ---
    InternalNo: Optional[str] = None
    PostingDate: Optional[str] = None
    InvoiceNo: Optional[str] = None
    InvoiceDate: Optional[str] = None
    VendorRefNo: Optional[str] = None

    # --- Vendor Details ---
    CustomerVendorCode: Optional[Any] = None
    CustomerVendorName: Optional[str] = None

    # --- Item Details ---
    ItemNo: Optional[str] = None
    ItemServiceDescription: Optional[str] = None
    CATEGORY: Optional[str] = None
    SUB_CATEGORY: Optional[str] = None
    Name: Optional[str] = None

    # --- Price & Discount ---
    Price: Optional[float] = None
    LineDiscountPercent: Optional[float] = None
    PriceBeforeDiscount: Optional[float] = None
    LineDiscountValue: Optional[float] = None
    Quantity: Optional[float] = None

    # --- GST ---
    GSTPercent: Optional[float] = None
    CGSTPercent: Optional[float] = None
    CGST: Optional[float] = None
    SGSTPercent: Optional[float] = None
    SGST: Optional[float] = None
    IGSTPercent: Optional[float] = None
    IGST: Optional[float] = None
    TaxAmount: Optional[float] = None

    # --- Freight ---
    FreightName: Optional[str] = None
    Total: Optional[float] = None

    # --- Freight GST ---
    FrCGSTPercent: Optional[float] = None
    FrCGST: Optional[float] = None
    FrSGSTPercent: Optional[float] = None
    FrSGST: Optional[float] = None
    FrIGSTPercent: Optional[float] = None
    FrIGST: Optional[float] = None
    FrTaxAmount: Optional[float] = None

    # --- Basic & Discounts ---
    BasicValue: Optional[float] = None
    DocDiscountPercent: Optional[float] = None
    DocDiscountValue: Optional[float] = None
    TotalValue: Optional[float] = None

    class Config:
        allow_population_by_field_name = True



class ReportResponse(BaseModel):
    page: int
    limit: int
    total_count: int
    totalPages: int
    items: List[ReportApItem]
