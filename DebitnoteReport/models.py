from pydantic import BaseModel
from typing import List


class DebitNoteAmountResponse(BaseModel):
    NOTE_NO: str
    NOTE_ID: str
    NOTE_TYPE: str
    VENDOR_NAME: str

    TOTAL_AMOUNT: float
    TAX_AMOUNT: float
    FINAL_AMOUNT: float
    STATUS: str
    CREATED_DATE: str
    RETURN_DATE: str


class DebitNoteItemResponse(BaseModel):
    NOTE_NO: str
    VENDOR_NAME: str
    ITEM_NAME: str
    QTY: float
    UNIT_PRICE: float
    TOTAL_PRICE: float
    TAX_AMOUNT: float
    FINAL_PRICE: float
    SGST: float
    CGST: float
    REASON: str
    CREATED_DATE: str


class PaginatedResponse(BaseModel):
    page: int
    limit: int
    totalRecords: int
    totalPages: int
    items: List[dict]


class VendorDropdownResponse(BaseModel):
    vendorNameIn: List[str]


class ItemDropdownResponse(BaseModel):
    itemNameIn: List[str]


class StatusDropdownResponse(BaseModel):
    statusIn: List[str]


class DateDropdownResponse(BaseModel):
    yearIn: List[str]
    monthIn: List[str]
    daysIn: List[int]
