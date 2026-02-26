from pydantic import BaseModel, validator
from typing import Optional

class Role(BaseModel):
    name: str
    description: Optional[str] = None



    @validator("name")
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Role name cannot be empty")
        return v.strip()