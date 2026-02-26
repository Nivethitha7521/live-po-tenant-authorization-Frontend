from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional

class PurchaseCategory(BaseModel):
    purchasecategoryId: Optional[str] = None
    purchasecategoryName: Optional[str] = None
    subcategories: Optional[List[str]] =[]  # Define subcategories as List[str]
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
    
class PurchaseCategoryPost(BaseModel):
    purchasecategoryName: Optional[str] = None
    subcategories: Optional[List[str]] = [] # Define subcategories as List[str]
    createdDate:Optional[datetime] = None
    lastUpdatedDate:Optional[datetime] = None
    status: Optional[str] = None
    
class RemoveSubcategoryRequest(BaseModel):
    subcategoryToRemove: str