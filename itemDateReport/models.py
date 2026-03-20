

from datetime import datetime
from pydantic import BaseModel
from typing import Any, List,Optional



class GrnAgainst(BaseModel):  
     grnId: Optional[str] = None  
     itemName: Optional[str] = None
     grnDate: Optional[datetime] = None
     apcreatedDate: Optional[datetime] = None
     invoiceNo:Optional[str] =None
     createdDate: Optional[datetime] =None
     vendorName: Optional[str] = None
     billingAddress: Optional[str] = None
     gstNumber: Optional[str] = None
     vendor_randomId: Optional[str] = None
     randomId: Optional[str] = None
     netAmount: Optional[float] = None
     taxAmount: Optional[float] = None
     grnAmount: Optional[float] = None
     aprandomId: Optional[str] = None
     grn_randomId: Optional[str] = None
     gst_bos:Optional[str] =None
     item_service:Optional[str] =None
     role :Optional[str] =None
     grpo_Remarks:Optional[str] =None
     ap_Remarks:Optional[str] =None
     userName :Optional[str]=None

class ReportField(BaseModel):
     createdDate: Optional[str] = None
     invoiceDate: Optional[str] = None
     invoiceNo: Optional[str] = None 
     grnDate: Optional[str] = None
     grnId: Optional[str] = None
     poRandomID: Optional[str] = None
     vendorName: Optional[str] = None
     randomId: Optional[str] = None
     itemCode: Optional[Any] = None
     itemName: Optional[str] = None
     purchasecategoryName: Optional[str] = None
     purchasesubcategoryName: Optional[str] = None
     uom: Optional[str] = None
     hsnCode: Optional[str] = None
     quantity: Optional[float] = None
     priceInclGST: Optional[float] 
     unitPrice: Optional[float] = None
     # taxType: Optional[Literal["cgst_sgst", "igst"]] = None
     befTaxDiscountAmount: Optional[float] = None
     sgst: Optional[float] = None
     cgst: Optional[float] = None
     igst: Optional[float] = None
     taxAmount: Optional[float] = None
     totalPrice: Optional[float] = None
     finalPrice: Optional[float] = None
     # vendorId: Optional[float] = None
     gstNumber: Optional[str] = None
     # status: Optional[str] = None
     purchasetaxName: Optional[float] = None
     # taxType: Optional[str] = None
     taxDisplay: Optional[str] = None
     sapVendorCode: Optional[Any] = None
     

class PaginatedReportResponse(BaseModel):
    page: int
    limit: int
    total_records: int
    totalPages: int
    items: List[ReportField]
     
     