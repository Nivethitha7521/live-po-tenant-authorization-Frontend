# models/tenant.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId
import pytz
from datetime import timedelta

class TenantStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class TenantBase(BaseModel):
    tenantName: str = Field(
        ..., 
        min_length=1, 
        max_length=200, 
        description="Name of the tenant"
    )
    description: Optional[str] = Field(
        None, 
        max_length=1000, 
        description="Tenant description"
    )
    status: TenantStatus = TenantStatus.ACTIVE

class TenantCreate(TenantBase):
    domains: Optional[List[str]] = None
    createDefaultCollections: bool = True

class TenantUpdate(BaseModel):
    tenantName: Optional[str] = Field(
        None, 
        min_length=1, 
        max_length=200
    )
    description: Optional[str] = Field(
        None, 
        max_length=1000
    )
    logoUrl: Optional[str] = None
    status: Optional[TenantStatus] = None
    domains: Optional[List[str]] = None

class Tenant(TenantBase):
    mongo_id: str = Field(..., alias="_id", description="MongoDB ObjectId")
    tenantId: str = Field(..., description="Tenant ID like TNT001, TNT002, etc.")
    logoUrl: Optional[str] = None
    domains: Optional[List[str]] = [] 
    createdDate: datetime
    databaseName: Optional[str] = None
    lastUpdatedDate: Optional[datetime] = None
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    @validator('createdDate', 'lastUpdatedDate', pre=True)
    def parse_datetime(cls, value):
        """Parse datetime from MongoDB"""
        if isinstance(value, str):
            try:
                # Try to parse ISO format
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                return value
        return value
    
    @validator('mongo_id', pre=True)
    def convert_objectid(cls, value):
        """Convert ObjectId to string"""
        if isinstance(value, ObjectId):
            return str(value)
        return value
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            ObjectId: str
        }
        populate_by_name = True  # Allows using alias names
        allow_population_by_field_name = True  # Backward compatibility

class TenantStats(BaseModel):
    tenantId: str  # This will be the tenantId (TNT001)
    tenantName: str
    totalCollections: int
    databaseName: Optional[str] = None
    totalDocuments: int
    collectionStats: Dict[str, int]
    createdDate: datetime
    status: TenantStatus

class TenantCollectionList(BaseModel):
    tenantId: str  # This will be the tenantId (TNT001)
    collections: List[str]
    totalCollections: int

class TenantMinimal(BaseModel):
    """Minimal tenant info for dropdowns/lists"""
    tenantId: str  # This will be the tenantId (TNT001)
    mongo_id: str = Field(..., alias="_id", description="MongoDB ObjectId")
    tenantName: str
    status: TenantStatus
    
    @validator('mongo_id', pre=True)
    def convert_objectid(cls, value):
        """Convert ObjectId to string"""
        if isinstance(value, ObjectId):
            return str(value)
        return value
    
    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True