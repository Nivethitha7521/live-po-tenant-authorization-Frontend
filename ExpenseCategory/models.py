from pydantic import BaseModel
from typing import Optional

class ExpenseCategory(BaseModel):
    expenseCategoryId: Optional[str] = None  # Define _id field explicitly
    category: Optional[str] = None
    subcategories: Optional[list] = None
    status: Optional[str] = None
    
class ExpenseCategoryPost(BaseModel):
    category: Optional[str] = None
    subcategories: Optional[list] = None
    status: Optional[str] = None