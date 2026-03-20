from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional


class ProductionReport(BaseModel):
    productionEntryNumber: Optional[str]
    lineId: int
    itemCode: Optional[str]         # MUST be str not int
    category: Optional[str]
    varianceName: Optional[str]
    subcategory: Optional[str]
    qty: Optional[float]
    uom: Optional[str]
    date: Optional[str]
    productionTime: Optional[str] = None
    firstName: Optional[str]
    lastName: Optional[str]
    hsnCode: Optional[int]          # MUST be str not int
    LeadTime: Optional[int]
    createdBy: Optional[str]
    ExpDate: Optional[str]


class PaginatedProductionReport(BaseModel):
    items: List[ProductionReport]
    page: int
    limit: int
    totalItems: int
    totalPages: int
