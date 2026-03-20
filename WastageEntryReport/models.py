from pydantic import BaseModel, Field
from typing import List, Optional


class DateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


class WastageEntryReportItem(BaseModel):
    itemCode: Optional[int] = None
    itemName: Optional[str] = None
    Group: Optional[str] = None
    Sub_Group: Optional[str] = None
    UOM: Optional[str] = None
    HSN: Optional[int] = None
    Qty: Optional[int] = None    
    TaxCode: Optional[str] = None 
    Price: Optional[float] = None
    Amount: Optional[float] = None
    DocNo: Optional[str] = None
    postingDate: Optional[str] = None
    createdBy: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
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
        
        
class wastageEntryReportResponse(BaseModel):
    items: List[WastageEntryReportItem]
    page: int
    limit: int
    total: int
    totalPages: int
    

class VarianceDropdownResponse(BaseModel):
    varianceNameIn: List[str]


class branchnameDropdownResponse(BaseModel):
    branchNameIn: List[str]
    
class statusDropdownResponse(BaseModel):
    statusIn: List[str]    
    


