from pydantic import BaseModel
from typing import Any, List, Optional


class Paymode(BaseModel):
    gst: Optional[str] = None
    kotNo: Optional[List[float]] = None
    paymentDescription: Optional[str] = None
    subOrderType: Optional[str] = None
    area: Optional[str] = None
    virtualBranchName: Optional[str] = None
    groupName: Optional[str] = None
    customerName: Optional[str] = None
    customerAddress: Optional[str] = None
    customerLocality: Optional[str] = None
    persons: Optional[str] = None
    tax: Optional[float] = None
    totalTax: Optional[float] = None
    deliveryCharge: Optional[float] = None
    customCharge: Optional[int] = None
    additionalCharge: Optional[float] = None
    invoiceId: Optional[str] = None
    branchName: Optional[str] = None
    invoiceNo: Optional[Any] = None
    invoiceDateTime: Optional[Any] = None
    paymentType: Optional[List[str]] = None
    salesType: Optional[str] = None
    status: Optional[str] = None
    employeeName: Optional[str] = None
    customerNumber: Optional[int] = "No Number"
    totalAmount: Optional[float] = None
    discountAmount: Optional[float] = None
    itemName: Optional[str] = None
    varianceName: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    qty: Optional[int] = None
    uom: Optional[str] = None
    netAmount: Optional[float] = None


class AllRestaurant(BaseModel):
    branchName: Optional[str] = None
    invoiceDate: Optional[str] = None
    invoiceNo: Optional[str] = None
    total_no_of_bills: Optional[int] = 0
    totalAmount: Optional[float] = 0
    discountAmount: Optional[float] = 0
    netAmount: Optional[float] = 0
    deliveryCharge: Optional[float] = 0
    containerCharge: Optional[float] = 0
    serviceCharge: Optional[float] = 0
    additionalCharge: Optional[float] = 0  # New
    totalTax: Optional[float] = 0
    roundOff: Optional[float] = 0
    waivedoff: Optional[float] = 0
    onlineTaxCalculated: Optional[float] = 0  # New
    gstPaidByMerchant: Optional[float] = 0  # New
    gstPaidByEcommerce: Optional[float] = 0  # New
    cash: Optional[float] = 0
    card: Optional[float] = 0
    upi: Optional[float] = 0
    duePayment: Optional[float] = 0
    others: Optional[float] = 0
    wallet: Optional[float] = 0
    online: Optional[float] = 0
    pax: Optional[int] = 0


class BranchData(BaseModel):
    branchName: str
    rows: List[AllRestaurant]


class RestaurantReportResponse(BaseModel):
    summary: dict
    branches: List[BranchData]
    page: int
    limit: int
    total_records: int


class DateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]


class branchnameDropdownResponse(BaseModel):
    branchNameIn: List[str]


class employeeNameDropdownResponse(BaseModel):
    EmployeeNameIn: List[str]


class customerNumberDropdownResponse(BaseModel):
    customerNumberIn: List[str]


class invoiceNoDropdownResponse(BaseModel):
    invoiceNoIn: List[str]
