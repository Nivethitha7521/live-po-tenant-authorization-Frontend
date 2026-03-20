

from pydantic import BaseModel
from typing import List, Optional

class datedropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


    
class locationNameresponse(BaseModel):
    loctionNameIn: List[str]

class modeofPaymentResponse(BaseModel):
    modeofpaymentIn:List[str]

    
class PettyCashExpanse(BaseModel):
    documentNo: Optional[str]
    postingDate: Optional[str]
    postingTime: Optional[str]  # <- add this line
    counterReference: Optional[str]
    location: Optional[str]
    modeOfPayment: Optional[str]
    accountName: Optional[str]
    remarks: Optional[str]
    payedAmount: Optional[float]

    
class responseresults(BaseModel):
    page:int
    limit:int
    totalPages:int
    totalrecords:int
    items:List[PettyCashExpanse]