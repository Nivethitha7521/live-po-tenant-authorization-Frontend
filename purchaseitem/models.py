from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional,Any


class PurchaseItem(BaseModel):
    purchaseitemId: Optional[str] = None  # Define _id field explicitly
    itemCode:Optional[str] =None
    itemName: Optional[str] = None
    purchasecategoryName:Optional[str]=None
    purchasesubcategoryName: Optional[Any] = None
    itemgroupName: Optional[str] = None
    uom: Optional[str] = None
    stockQuantity: Optional[float] =None
    supplier: Optional[str] = None
    purchasePrice: Optional[float] = None
    purchasetaxName: Optional[int] = None
    reorderLevel: Optional[int] =None
    itemType: Optional[str] = None
    hsnCode: Optional[str] = None
    shelfLife: Optional[str] = None
    vendorTag: Optional[List[str]] = None
    locationName: Optional[str] = None
    measurentType:Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    createdDate:Optional[datetime] = None
    createdTime:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    lastUpdatedTime:Optional[datetime] = None
    status: Optional[str] =None
    vendorName:Optional[str] = None
    randomId: Optional[str]= None

class PurchaseItemPost(BaseModel):
    itemName: Optional[str] = None
    itemCode:Optional[str] =None 
    purchasecategoryName:Optional[str]=None
    purchasesubcategoryName: Optional[Any] = None
    itemgroupName: Optional[str] = None
    uom: Optional[str] = None
    stockQuantity: Optional[float] =None
    supplier: Optional[str] = None
    purchasePrice: Optional[float] = None
    purchasetaxName: Optional[int] = None
    measurementType:Optional[str] =None
    reorderLevel: Optional[int] =None   
    itemType: Optional[str] = None
    hsnCode: Optional[str] = None
    shelfLife: Optional[str] = None
    vendorTag: Optional[List[str]] = None
    locationName: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    createdDate:Optional[datetime] = None
    createdTime:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    lastUpdatedTime:Optional[datetime] = None
    status: Optional[str] =None
    vendorName:Optional[str] = None
    randomId: Optional[str] =None
    