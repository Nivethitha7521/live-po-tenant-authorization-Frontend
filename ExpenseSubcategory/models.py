from pydantic import BaseModel
from typing import Optional

class ExpenseSubcategory(BaseModel):
    expenseSubcategoryId: Optional[str] = None  # Define _id field explicitly
    
    subcategory: Optional[str] = None
    status: Optional[str] = None
    
class ExpenseSubcategoryPost(BaseModel):
    
    subcategory: Optional[str] = None
    status: Optional[str] = None