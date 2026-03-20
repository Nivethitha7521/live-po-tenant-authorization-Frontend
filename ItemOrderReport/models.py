from pydantic import BaseModel
from typing import  List, Optional



class ItemOrder(BaseModel):
    itemOrderId: Optional[str] = None
    billDate: Optional[str] = None
    billTime: Optional[str] = None
    billNo: Optional[str] = None
    netAmount: Optional[float] = None
    discount: Optional[float] = None
    billTax: Optional[float] = None
    billTotalAmount: Optional[float] = None
    locationName: Optional[str] = None
    customerNo: Optional[int] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    empId: Optional[int] = None
    salesPersonName: Optional[str] = None
    types: Optional[str] = None


class PaginatedResponse(BaseModel):
    totalcount: int
    totalpages: int
    limit: int
    page: int
    skip: int
    items: List[ItemOrder]
