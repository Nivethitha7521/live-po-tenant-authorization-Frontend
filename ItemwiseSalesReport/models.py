from fastapi import HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Union
from datetime import datetime


class itemwiseReport(BaseModel):
    branchName: Optional[str] = None
    invoiceNo: Optional[Union[str, int]] = None
    deliveryDate: Optional[datetime] = Field(default_factory=datetime.now)
    invoiceDate: Optional[datetime] = None
    varianceName: Optional[List[str]] = None
    itemCode: Optional[List[Union[str, int]]] = None
    uom: Optional[List[str]] = None
    weight: Optional[List[float]] = None
    qty: Optional[List[int]] = None
    TaxCode: Optional[str] = None  # no field
    price: Optional[List[float]] = None
    saleOrderNo: Optional[str] = None
    salesPersonName: Optional[str] = None
    employeeInitial: Optional[str] = None
    customerNumber: Optional[Union[str, int]] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    hsnCode: Optional[int] = None
    # --- New Calculated fields ---
    rowId: Optional[float] = None
    LoginName: Optional[str] = None
    lastName: Optional[str] = None
    totalValue: Optional[float] = None
    netValueBeforeTax: Optional[float] = None
    taxValue: Optional[float] = None
    salesType: Optional[str] = None


def convert_to_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Please use dd-MM-yyyy."
        )



def convert_to_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Please use dd-MM-yyyy."
        )
