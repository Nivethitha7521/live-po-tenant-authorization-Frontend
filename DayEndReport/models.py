

from pydantic import BaseModel
from typing import List, Literal, Optional

class DropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
    branchNameIn: list[str]


    
    
class DayEndReport(BaseModel):
    date: str
    time: str
    branch:Optional [str]=None
    type: Literal["Take Away", "Dine In", "Sale Order", "BD Cake"]
    cash: float
    card: float
    upi: float
    others: float
    total: float
    
class PaginatedResponse(BaseModel):
    page: int
    limit: int
    totalrecords: int
    totalpages: int
    items: List[DayEndReport]


class Sales(BaseModel):
    dayClosingDateTime: Optional[str] = None
    randomId: Optional[str] = None
    branchName: Optional[str] = None
    systemCashSales: Optional[float] = None
    systemCardSales: Optional[float] = None
    systemUpiSales: Optional[float] = None
    systemOtherSales: Optional[float] = None
    totalSystemSales: Optional[float] = None
    totalKotSales: Optional[float] = None
    totalTakeAwaySales: Optional[float] = None
    totalSaleOrderSales: Optional[float] = None
    Dinning: Optional[float] = None



class PaginatedSales(BaseModel):
    page: int
    limit: int
    totalrecords: int
    totalpages: int
    items: List[Sales]    




    