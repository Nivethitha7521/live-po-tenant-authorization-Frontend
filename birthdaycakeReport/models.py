from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Union


class MongoObjectId(BaseModel):
    oid: str = Field(..., alias="$oid")


class MongoLong(BaseModel):
    numberLong: str = Field(..., alias="$numberLong")
    
class CakeOrderItemModel(BaseModel):
    # Item-level fields
    cakeAppInvoiceId: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    itemCodes: Optional[str] = None
    price: Optional[Union[int, float]] = None
    kgList: Optional[Union[int, float]] = None
    qty: Optional[int] = None
    amount: Optional[Union[int, float]] = None
    taxPercentage: Optional[Union[int, float]] = None
    flavourList: Optional[str] = None

    # Order-level fields
    totalAmount: Optional[Union[int, float]] = None
    status: Optional[str] = None
    customerPhoneNumber: Optional[int] = None
    orderNo: Optional[str] = None

    deliveryDate: Optional[str] = None
    deliveryTime: Optional[str] = None
    paymentType: Optional[str] = None

    event: Optional[str] = None

    invoiceDate: Optional[datetime] = None
    invoiceTime: Optional[str] = None
    warehouseName: Optional[str] = None
    branch: Optional[str] = None
    contact: Optional[int] = None
    city: Optional[str] = None
    birthdayDate: Optional[str] = None


class PaginatedResponse(BaseModel):
    totalcount: int
    totalpages: int
    page: int
    pagesize: int
    items: List[CakeOrderItemModel]


class DateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


class orderNoDropdownResponse(BaseModel):
    ordernoIn: List[str]


class branchnameDropdownResponse(BaseModel):
    branchNameIn: List[str]


class customerNumberDropdownResponse(BaseModel):
    customerNumberIn: List[str]
