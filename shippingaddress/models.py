# Define a model to store shipping address details with timestamps
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ShippingAddress(BaseModel):
    shippingId: Optional[str] = None
    address: str  # Shipping address
    phoneNo: Optional[str] = None
    emailId: Optional[str] = None
    gstIn: Optional[str] = None
    randomId: Optional[str] = None
    status: Optional[str] = None
    createdDate: Optional[datetime] = None  # Address creation timestamp
    lastUpdatedDate: Optional[datetime] = None  # Last updated date

class ShippingAddressPost(BaseModel):
    address: str  # Shipping address
    phoneNo: Optional[str] = None
    emailId: Optional[str] = None
    gstIn: Optional[str] = None
    status: Optional[str] = None
    randomId: Optional[str] = None
    createdDate: Optional[datetime] = None  # Address creation timestamp
    lastUpdatedDate: Optional[datetime] = None  # Last updated date
