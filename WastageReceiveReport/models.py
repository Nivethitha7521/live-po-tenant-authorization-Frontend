from pydantic import BaseModel, Field
from typing import List, Optional


class DateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


class WastageReceiveReportItem(BaseModel):
    DocNo: Optional[str] = None
    UniqueDocNo: Optional[str] = None
    ItemCode: Optional[str] = None
    ItemName: Optional[str] = None
    Group: Optional[str] = None
    Sub_Group: Optional[str] = None
    UOM: Optional[str] = None
    HSN: Optional[int] = None
    TransferQty: Optional[int] = None
    ReciveQty: Optional[int] = None
    Price: Optional[float] = None
    Total: Optional[float] = None
    TaxCode: Optional[str] = None
    TaxAmt: Optional[float] = None
    Rec_ID: Optional[str] = None
    Rec_Name: Optional[str] = None
    lastName: Optional[str] = None
    DriverCode: Optional[str] = None
    VehicleNo: Optional[str] = None
    Rec_Date: Optional[str] = None
    Rec_Time: Optional[str] = None
    Location: Optional[str] = None
    ReasonName: Optional[str] = None

    class Config:
        fields = {
            "Sub_Group": "Sub-Group",
            "Rec_ID": "Rec.ID",
            "Rec_Name": "Rec.Name",
            "Rec_Date": "Rec.Date",
            "Rec_Time": "Rec.Time",
        }
        
        
class wastageReceiveReportResponse(BaseModel):
    items: List[WastageReceiveReportItem]
    page: int
    limit: int
    total: int
    totalPages: int
    

class VarianceDropdownResponse(BaseModel):
    varianceNameIn: List[str]


class branchnameDropdownResponse(BaseModel):
    branchNameIn: List[str]
    


