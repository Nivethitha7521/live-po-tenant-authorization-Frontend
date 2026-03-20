
from fastapi import HTTPException
from pydantic import BaseModel, Field
from typing import  Optional, List, Union
from datetime import datetime


class SalesOrderReport(BaseModel):
    billDate: Optional[str] = None
    billTime: Optional[str] = None
    deliveryDate: Optional[str] = None
    cashReciveDate: Optional[str] = None
    cashReciveTime: Optional[str] = None
    billNo: Optional[str] = None
    headerDocNo: Optional[str] = None
    netAmount: Optional[float] = None
    discount: Optional[float] = None
    billTax: Optional[float] = None
    billTotalAmount: Optional[float] = None  # (renamed for Pydantic)
    locationName: Optional[str] = None
    customerNo: Optional[str] = None
    customerName:Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    empID: Optional[str] = None
    SalesPerson: Optional[str] = None
    type1: Optional[str] = None
    type: Optional[str] = None
    saleOrderNo: Optional[str] = None
    advanceAmount: Optional[int] = None
   
class PaginatedResponse(BaseModel):
    totalcount: int
    totalpages: int
    page: int
    limit: int
    items: List[SalesOrderReport]
    

class CancelOrder(BaseModel):
      status: Optional[str] = None
      branchID: Optional[float] = None
      branchName: Optional[str] = None
      saleOrderNo: Optional[str] = None
      orderDate: Optional[datetime] = Field(default_factory=datetime.now)
      customerNumber: Optional[Union[str, int]] = None
      DeliveryDate: Optional[float] = None
      OccCode: Optional[float] = None
      event: Optional[str] = None
      eventDate: Optional[datetime] = Field(default_factory=datetime.now)
      canceledPersonName: Optional[str] = None
      canceledPersonId: Optional[str] = None
      Message: Optional[str] = None
      customCharge: Optional[float] = None
      advanceAmount: Optional[List[float]] = None
      delCharge: Optional[float] = None
      qty: Optional[list[int]] = None
      totalAmount: Optional[float] = None
      discountAmount: Optional[float] = None
      balanceAmount: Optional[float] = None
      finalPrice: Optional[float] = None
      deliveryTime: Optional[str] = None
      soNo: Optional[str] = None
      orderType: Optional[str] = None
      shaCode: Optional[float] = None
      shaName: Optional[str] = None
  


class DropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
    employeeNameIn: list[str]
    branchNameIn: list[str]
      
def convert_to_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Please use dd-MM-yyyy."
        )


    
    
