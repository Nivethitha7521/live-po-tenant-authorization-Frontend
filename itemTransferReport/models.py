from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional





class itemtransferReportItem(BaseModel):
    DocNo: str
    LineID: int

    ItemCode: Optional[str]
    ItemName: Optional[str]

    Group: Optional[str]
    Sub_Group: Optional[str] = Field(None, alias="Sub-Group")

    UOM: Optional[str]
    HSN: Optional[int]

    ReqQty: float
    TransferQty: float
    Recv_Variance: float = Field(..., alias="Recv.Variance")

    Unit_Price: float = Field(..., alias="Unit Price")
    VariancePrice: Optional[str]

    From_Loc: Optional[str] = Field(None, alias="From.Loc")
    To_Loc: Optional[str] = Field(None, alias="To.Loc")

    Tran_Date: Optional[str] = Field(None, alias="Tran.Date")
    Tran_Time: Optional[str] = Field(None, alias="Tran.Time")

    Recv_Date: Optional[str] = Field(None, alias="Recv.Date")
    Recv_Time: Optional[str] = Field(None, alias="Recv.Time")

    DriverCode: Optional[str]
    DriverName: Optional[str]

    VehicleCode: Optional[str]
    VehicleName: Optional[str]

    Trans_LogID: Optional[str] = Field(None, alias="Trans.LogID")
    Trans_Name: Optional[str] = Field(None, alias="Trans.Name")

    Recv_LogID: Optional[str] = Field(None, alias="Recv.LogID")
    Recv_Name: Optional[str] = Field(None, alias="Recv.Name")

    class Config:
        orm_mode = True
        allow_population_by_field_name = True



class itemTransferReportResponse(BaseModel):
    items: List[itemtransferReportItem]
    page: int
    limit: int
    total: int
    totalPages: int
    

class VarianceDropdownResponse(BaseModel):
    varianceNameIn: List[str]


class frombranchDropdownResponse(BaseModel):
    frombranchNameIn: List[str]


class tobranchDropdownResponse(BaseModel):
    tobranchNameIn: List[str]


class statusDropdownResponse(BaseModel):
    statusIn: List[str]


# class loginDropdownresponse(BaseModel):
#     loginNameIn:List[str]
