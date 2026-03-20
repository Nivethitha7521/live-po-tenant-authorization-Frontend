

from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional


class DispatchDropdownResponse(BaseModel):
    yearIn: list[str]
    monthIn: list[str]
    daysIn: list[int]
    varianceNameIn: list[str]
    branchNameIn: list[str]
    driverNameIn: list[str]
    
class DispatchDateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


class VarianceDropdownResponse(BaseModel):
    varianceNameIn: List[str]
    
class branchDropdownResponse(BaseModel):
    branchNameIn: List[str]

class driverDropdownResponse(BaseModel):
    driverNameIn: List[str]  
    
    
class DispatchReport(BaseModel):
    DocNo: Optional[str] = None
    dispatchNo: Optional[str] = None
    lineID: Optional[int] = None
    ItemCode: Optional[str] = None
    ItemName: Optional[str] = None
    varianceName: Optional[str] = None
    Group: Optional[str] = None
    SubGroup: Optional[str] = None
    HSN: Optional[str] = None
    UOM: Optional[str] = None
    Qty: Optional[int] = None
    Price: Optional[float] = None
    Total: Optional[float] = None
    TaxCode: Optional[str] = None
    LoginID: Optional[str] = None
    LoginName: Optional[str] = None
    LastName: Optional[str] = None
    LocationId: Optional[str] = None
    Location: Optional[str] = None
    VehicleName: Optional[str] = None
    VehicleNo: Optional[str] = None
    DriverName: Optional[str] = None
    Initial: Optional[str] = None
    Date: Optional[str] = None
    DespTime: Optional[str] = None
    LeadTime: Optional[int] = None
    ExpDate: Optional[str] = None


class dispatchReceive(BaseModel):
    dispatchId: Optional[str] = None
    dispatchNo: Optional[str] = None
    lineID: Optional[int] = None
    itemCode: Optional[str] = None
    itemName: Optional[str] = None
    varianceName: Optional[str] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    hsnCode: Optional[str] = None
    uom: Optional[str] = None
    receivedQty: Optional[int] = None
    weight: Optional[float] = None
    price: Optional[float] = None
    amount: Optional[float] = None
    tax: Optional[str] = None
    LoginID: Optional[str] = None
    LoginName: Optional[str] = None
    LocationId: Optional[str] = None
    branchName: Optional[str] = None
    vehicleNumber: Optional[str] = None
    vehicleName: Optional[str] = None
    driverName: Optional[str] = None
    driverNumber: Optional[str] = None
    date: Optional[str] = None
    LeadTime: Optional[str] = None
    Exp_Date: Optional[datetime] = None
    status: Optional[str] = None
    saleOrderNo: Optional[str] = None

class DropdownResponse(BaseModel):
    values: List[str]

