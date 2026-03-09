# yen-purchase/PurchaseOrder/settings_routes.py
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from bson import ObjectId
from dependencies.auth import validate_token
from utils.database import get_settings_collection, get_tenant_database

from .settings_models import PurchaseDateSettings, DateRestriction

router = APIRouter()

@router.get("/date-settings", response_model=PurchaseDateSettings)
async def get_date_settings(
    request: Request,
    user = Depends(validate_token),
):
    """
    Get purchase order date settings
    """
    tenant_id = request.state.tenant_id
    
  
    collection = await get_settings_collection(tenant_id)
    
    # Default settings if none exist
    default_settings = PurchaseDateSettings(
        orderDateRestriction=DateRestriction(
            restrictionType="no_restriction",
            daysValue=0,
            isActive=True
        ),
        expectedDeliveryDays=7,
        invoiceDateRestriction="any",
        invoiceDaysAfterOrder=0
    )
    
    # Find existing settings (sync operations in thread pool)
    settings_doc = await collection.find_one({"type": "purchase_date_settings"})
    
    if not settings_doc:
        # Create default settings
        settings_doc = default_settings.dict()
        settings_doc["type"] = "purchase_date_settings"
        settings_doc["createdAt"] = datetime.utcnow()
        settings_doc["updatedAt"] = datetime.utcnow()
        settings_doc["createdBy"] = user.get("username")
        
        result = await collection.insert_one(settings_doc)
        settings_doc["_id"] = str(result.inserted_id)
    else:
        settings_doc["_id"] = str(settings_doc["_id"])
    
    settings_doc.pop("_id", None)
    return PurchaseDateSettings(**settings_doc)

@router.post("/date-settings", response_model=PurchaseDateSettings)
async def save_date_settings(
    request: Request,
    settings: PurchaseDateSettings,
    user = Depends(validate_token)
):
    """
    Save purchase order date settings
    """
    tenant_id = request.state.tenant_id
    collection = await get_settings_collection(tenant_id)
    
    # Prepare update data
    update_data = settings.dict(exclude_unset=True)
    update_data["type"] = "purchase_date_settings"
    update_data["updatedAt"] = datetime.utcnow()
    update_data["updatedBy"] = user.get("username")
    
    # Update or insert
    await collection.update_one(
    {"type": "purchase_date_settings"},
    {"$set": update_data},
    upsert=True
)
    
    # Fetch updated settings
    updated_doc = await collection.find_one({"type": "purchase_date_settings"})
    updated_doc.pop("_id", None)
    
    return PurchaseDateSettings(**updated_doc)



@router.get("/validate-order-date")
async def validate_order_date(
    request: Request,
    date: datetime,
    user = Depends(validate_token)
):
    """
    Validate if order date is allowed based on settings
    """
    tenant_id = request.state.tenant_id
   
    collection = await get_settings_collection(tenant_id)
    
    # Get settings
    settings_doc = await collection.find_one({"type": "purchase_date_settings"})
    
    if not settings_doc:
        return {
            "valid": True, 
            "message": "No restrictions",
            "minDate": None,
            "maxDate": None,
            "restrictionType": "no_restriction"
        }
    
    settings_doc.pop("_id", None)
    settings = PurchaseDateSettings(**settings_doc)
    restriction = settings.orderDateRestriction
    
    if not restriction.isActive or restriction.restrictionType == "no_restriction":
        return {
            "valid": True, 
            "message": "No restrictions",
            "minDate": None,
            "maxDate": None,
            "restrictionType": "no_restriction"
        }
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    input_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    min_date = None
    max_date = None
    
    # Validate based on restriction type
    if restriction.restrictionType == "current_only":
        min_date = today
        max_date = today
        if input_date.date() != today.date():
            return {
                "valid": False,
                "message": f"Only today's date ({today.strftime('%d-%m-%Y')}) is allowed",
                "minDate": min_date,
                "maxDate": max_date,
                "restrictionType": restriction.restrictionType
            }
    
    elif restriction.restrictionType == "days_before":
        min_date = today - timedelta(days=restriction.daysValue)
        max_date = today
        if input_date < min_date or input_date > today:
            return {
                "valid": False,
                "message": f"Date must be between {min_date.strftime('%d-%m-%Y')} and {today.strftime('%d-%m-%Y')}",
                "minDate": min_date,
                "maxDate": max_date,
                "restrictionType": restriction.restrictionType,
                "daysValue": restriction.daysValue
            }
    
    elif restriction.restrictionType == "days_after":
        min_date = today
        max_date = today + timedelta(days=restriction.daysValue)
        if input_date < today or input_date > max_date:
            return {
                "valid": False,
                "message": f"Date must be between {today.strftime('%d-%m-%Y')} and {max_date.strftime('%d-%m-%Y')}",
                "minDate": min_date,
                "maxDate": max_date,
                "restrictionType": restriction.restrictionType,
                "daysValue": restriction.daysValue
            }
    
    elif restriction.restrictionType == "date_range":
        if restriction.startDate and restriction.endDate:
            min_date = restriction.startDate.replace(hour=0, minute=0, second=0, microsecond=0)
            max_date = restriction.endDate.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if input_date < min_date or input_date > max_date:
                return {
                    "valid": False,
                    "message": f"Date must be between {min_date.strftime('%d-%m-%Y')} and {max_date.strftime('%d-%m-%Y')}",
                    "minDate": min_date,
                    "maxDate": max_date,
                    "restrictionType": restriction.restrictionType
                }
    
    return {
        "valid": True, 
        "message": "Date is valid",
        "minDate": min_date,
        "maxDate": max_date,
        "restrictionType": restriction.restrictionType,
        "daysValue": restriction.daysValue if hasattr(restriction, 'daysValue') else 0
    }

@router.get("/expected-delivery")
async def calculate_expected_delivery(
    request: Request,
    order_date: datetime,
    user = Depends(validate_token)
):
    """
    Calculate expected delivery date based on settings
    """
    tenant_id = request.state.tenant_id
    collection = await get_settings_collection(tenant_id)
    
    # Get settings
    settings_doc = await collection.find_one({"type": "purchase_date_settings"})
    
    if not settings_doc:
        days_to_add = 7
    else:
        settings_doc.pop("_id", None)
        settings = PurchaseDateSettings(**settings_doc)
        days_to_add = settings.expectedDeliveryDays
    
    expected_date = order_date + timedelta(days=days_to_add)
    
    return {
        "expectedDeliveryDate": expected_date,
        "daysAdded": days_to_add
    }

@router.get("/validate-invoice-date")
async def validate_invoice_date(
    request: Request,
    invoice_date: datetime,
    order_date: datetime,
    user = Depends(validate_token)
):
    """
    Validate if invoice date is allowed based on settings
    """
    tenant_id = request.state.tenant_id
    collection = await get_settings_collection(tenant_id)
    
    # Get settings
    settings_doc = await collection.find_one({"type": "purchase_date_settings"})
    
    if not settings_doc:
        return {"valid": True, "message": "No restrictions"}
    
    settings_doc.pop("_id", None)
    settings = PurchaseDateSettings(**settings_doc)
    
    if settings.invoiceDateRestriction == "any":
        return {"valid": True, "message": "Any date allowed"}
    
    invoice = invoice_date.replace(hour=0, minute=0, second=0, microsecond=0)
    order = order_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if settings.invoiceDateRestriction == "same_as_order":
        if invoice.date() != order.date():
            return {
                "valid": False,
                "message": "Invoice date must be the same as order date"
            }
    
    elif settings.invoiceDateRestriction == "after_order":
        if invoice < order:
            return {
                "valid": False,
                "message": "Invoice date cannot be before order date"
            }
        
        if settings.invoiceDaysAfterOrder > 0:
            min_invoice_date = order + timedelta(days=settings.invoiceDaysAfterOrder)
            if invoice < min_invoice_date:
                return {
                    "valid": False,
                    "message": f"Invoice date must be at least {settings.invoiceDaysAfterOrder} days after order date"
                }
    
    return {"valid": True, "message": "Invoice date is valid"}