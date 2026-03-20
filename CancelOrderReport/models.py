
from pydantic import BaseModel, Field
from typing import  Optional, List, Union
from datetime import datetime


class CancelOrder(BaseModel):
    OrderStatus: Optional[str]
    BranchID: Optional[str]
    LocationName: Optional[str]
    OrderNo: Optional[str]
    OrderDate: Optional[str]
    CustomerNo: Optional[Union[str, int]]
    DeliveryDate: Optional[str]=None
    OccCode: Optional[str]
    OccName: Optional[str]
    OccDate: Optional[str]
    Message: Optional[str]

    ShapeCode: Optional[str]
    ShapeName: Optional[str]

    CustCharge: Optional[float]
    AdvanceAmount: Optional[float]
    DelCharge: Optional[float]

    TotQty: Optional[int]
    TotAmount: Optional[float]
    TaxAmount: Optional[float]
    ReqDiscount: Optional[float]

    BalanceDue: Optional[float]
    OverallAmount: Optional[float]

    ScreenName: Optional[str]
    CreatedBy: Optional[str]
    CreatedDate: Optional[str]

    ShaCode: Optional[str]
    ShaName: Optional[str]

    BlanceAmt: Optional[float]
    DeliveryTime: Optional[str]
    SONo: Optional[str]


class PaginatedResponse(BaseModel):
    totalcount: int
    totalpages: int
    page: int
    pagesize: int
    items: List[CancelOrder]
    

class DateDropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
      

class saleOrderNoDropdownResponse(BaseModel):
    saleOrdernoIn: List[str]


class branchnameDropdownResponse(BaseModel):
    branchNameIn: List[str]
    
class customerNumberDropdownResponse(BaseModel):
    customerNumberIn: List[str]    
    

    
    
