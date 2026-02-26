# models.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Service(BaseModel):
    serviceId: Optional[str] = Field(default=None)
    serviceName: Optional[str] = Field(default=None)
    saccode: Optional[int] = Field(default=None)
    status: Optional[str] = Field(default=None)
    mongoId: Optional[str] = Field(default=None)
    createdDate: Optional[datetime] = Field(default=None)
    lastUpdatedDate: Optional[datetime] = Field(default=None)

    class Config:
        from_attributes = True

class ServicePost(BaseModel):
    serviceName: Optional[str] = Field(default=None)
    saccode: Optional[int] = Field(default=None)
    status: Optional[str] = Field(default=None)
    createdDate: Optional[datetime] = Field(default=None)
    lastUpdatedDate: Optional[datetime] = Field(default=None)

    class Config:
        from_attributes = True

class ImportResult(BaseModel):
    message: str
    inserted_count: int
    updated_count: int
    successful: List[Dict[str, Any]]
    failed: List[Dict[str, Any]]
    errorCount: int
    detail: Optional[Dict[str, Any]] = None
  
class PaginatedServiceResponse(BaseModel):
    data: List[Service]
    total: int
    page: int
    limit: int
    total_pages: int
class ServiceSummary(BaseModel):
    serviceId: Optional[str] = Field(default=None)
    saccode: Optional[int] = Field(default=None)
    mongoId: Optional[str] = Field(default=None)
    serviceName: Optional[str] = Field(default=None)
    class Config:
        from_attributes = True
class PaginatedServiceSummary(BaseModel):
    data: List[ServiceSummary]
    total: int
    page: int
    limit: int
    total_pages: int