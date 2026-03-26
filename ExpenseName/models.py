from pydantic import BaseModel, Field
from typing import Optional

class ExpenseName(BaseModel):
    expenseNameId: Optional[str] = None  # Define _id field explicitly
    expenseName: Optional[str] = None
    categories: Optional[str] = None
    subcategories: Optional[str] = None
    status: Optional[str] = None
    
class ExpenseNamePost(BaseModel):
    expenseName: Optional[str] = None
    categories: Optional[str] = None
    subcategories: Optional[str] = None
    status: Optional[str] = None