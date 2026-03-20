from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class StoreDispatch(BaseModel):
    varianceName: List[str]
    uom: List[str]
    itemName: List[str]
    price: List[float]
    itemCode: List[str]
    weight: List[float]
    qty: List[float]
    amount: List[float]
    totalAmount: float
    warehouseName: Optional[str]
    date: datetime
    reason: Optional[str]
    vehicleNumber: Optional[str]
    driverName: Optional[str]
    branchName: str
    createdBy: str
    type: str
    status: str
    dispatchNumber:Optional[str]=None


class StoreDispatchResponse(StoreDispatch):
    id: str
    
    
class DateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


class branchnameDropdownResponse(BaseModel):
    branchNameIn: List[str]