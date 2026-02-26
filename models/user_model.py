from pydantic import BaseModel
from typing import Optional
from typing import List
class User(BaseModel):
    username: str
    password: str
    role_name: str
    email: Optional[str] = None
    tenants: Optional[List[str]] = [] # 👈 ADD THIS
    full_name: Optional[str] = None
    is_active: bool = True
    role_is_active: bool = True

class UserLogin(BaseModel):
    username: str
    password: str