# yen-settings/routes/date_settings.py
from datetime import datetime, timedelta, date
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException, status, Response
import pytz
from dependencies.auth import validate_token
from utils.database import get_settings_collection
from utils.datetime_utils import (
    convert_from_utc, convert_to_utc, format_date_response, get_current_ist,
    get_utc_from_ist, get_ist_from_utc, get_midnight_ist, parse_and_normalize_date,
)
import hashlib
import json
import asyncio
from functools import lru_cache
import time

router = APIRouter()

# Cache settings - NO EXPIRY! Only cleared on POST/PATCH
_settings_cache: Dict[str, Dict[str, Any]] = {}
_cache_etag: Dict[str, str] = {}
_cache_lock = asyncio.Lock()

# Pre-compute timezone once
IST_TIMEZONE = pytz.timezone("Asia/Kolkata")

async def get_cached_settings(tenant_id: str, collection) -> Optional[Dict[str, Any]]:
    """Get settings from cache with minimal overhead"""
    if tenant_id in _settings_cache:
        return _settings_cache[tenant_id]
    
    async with _cache_lock:
        if tenant_id in _settings_cache:
            return _settings_cache[tenant_id]
            
        settings_doc = await collection.find_one(
            {"type": "purchase_date_settings"},
            projection={"_id": 1, "orderDateRestriction": 1,
                       "expectedDeliveryRestriction": 1, "invoiceDateRestriction": 1,
                       "expectedDeliveryDays": 1, "invoiceDaysAfterOrder": 1}
        )
        
        if settings_doc:
            settings_doc["_id"] = str(settings_doc["_id"])
            _settings_cache[tenant_id] = settings_doc
            return settings_doc
    
    return None

def clear_settings_cache(tenant_id: str):
    """Clear cache efficiently"""
    _settings_cache.pop(tenant_id, None)
    _cache_etag.pop(tenant_id, None)

def parse_date_fast(date_str: str) -> Optional[date]:
    """Ultra-fast date parsing - only what we need"""
    try:
        # Remove timezone info and parse
        if 'Z' in date_str:
            date_str = date_str.replace('Z', '+00:00')
        
        # Fast path for ISO format
        dt = datetime.fromisoformat(date_str)
        
        # Convert to IST and get date only
        if dt.tzinfo:
            dt = dt.astimezone(IST_TIMEZONE)
        
        return dt.date()
    except:
        return None

def validate_date_ultra_fast(
    input_date: date,
    restriction: Dict[str, Any],
    today_date: date
) -> Dict[str, Any]:
    """Ultra-fast validation with minimal overhead"""
    
    # Fast path for inactive or no restriction
    if not restriction.get("isActive", True) or restriction.get("restrictionType") == "no_restriction":
        return {
            "valid": True,
            "message": "valid",
            "minDate": None,
            "maxDate": None
        }
    
    restriction_type = restriction.get("restrictionType")
    days_value = restriction.get("daysValue", 0)
    
    # Current only - fastest check
    if restriction_type == "current_only":
        is_valid = input_date == today_date
        return {
            "valid": is_valid,
            "message": "" if is_valid else f"Must be {today_date.strftime('%d-%m-%Y')}",
            "minDate": today_date.isoformat() if not is_valid else None,
            "maxDate": today_date.isoformat() if not is_valid else None
        }
    
    # Days before
    if restriction_type == "days_before":
        min_date = today_date - timedelta(days=days_value)
        is_valid = min_date <= input_date <= today_date
        return {
            "valid": is_valid,
            "message": "" if is_valid else f"Between {min_date.strftime('%d-%m-%Y')} and {today_date.strftime('%d-%m-%Y')}",
            "minDate": min_date.isoformat() if not is_valid else None,
            "maxDate": today_date.isoformat() if not is_valid else None
        }
    
    # Days after
    if restriction_type == "days_after":
        max_date = today_date + timedelta(days=days_value)
        is_valid = today_date <= input_date <= max_date
        return {
            "valid": is_valid,
            "message": "" if is_valid else f"Between {today_date.strftime('%d-%m-%Y')} and {max_date.strftime('%d-%m-%Y')}",
            "minDate": today_date.isoformat() if not is_valid else None,
            "maxDate": max_date.isoformat() if not is_valid else None
        }
    
    # Date range
    if restriction_type == "date_range" and restriction.get("startDate") and restriction.get("endDate"):
        start = restriction["startDate"]
        end = restriction["endDate"]
        
        # Convert to date if needed
        if isinstance(start, datetime):
            start_date = start.date()
        elif isinstance(start, str):
            try:
                start_date = datetime.fromisoformat(start.replace('Z', '+00:00')).date()
            except:
                start_date = None
        else:
            start_date = None
            
        if isinstance(end, datetime):
            end_date = end.date()
        elif isinstance(end, str):
            try:
                end_date = datetime.fromisoformat(end.replace('Z', '+00:00')).date()
            except:
                end_date = None
        else:
            end_date = None
        
        if start_date and end_date:
            is_valid = start_date <= input_date <= end_date
            return {
                "valid": is_valid,
                "message": "" if is_valid else f"Between {start_date.strftime('%d-%m-%Y')} and {end_date.strftime('%d-%m-%Y')}",
                "minDate": start_date.isoformat() if not is_valid else None,
                "maxDate": end_date.isoformat() if not is_valid else None
            }
    
    # Default - valid
    return {"valid": True, "message": "valid", "minDate": None, "maxDate": None}

# GET endpoint - ultra-fast
@router.get("/")
async def get_date_settings(
    request: Request,
    response: Response,
    user = Depends(validate_token),
):
    """Get all date settings"""
    tenant_id = request.state.tenant_id
    collection = await get_settings_collection(tenant_id)
    
    # ETag check
    if_none_match = request.headers.get("If-None-Match")
    if tenant_id in _cache_etag and if_none_match == _cache_etag[tenant_id]:
        response.status_code = status.HTTP_304_NOT_MODIFIED
        return response
    
    # Get from cache
    settings_doc = await get_cached_settings(tenant_id, collection)
    
    if not settings_doc:
        # Create default settings
        current_ist = get_current_ist()
        current_utc = get_utc_from_ist(current_ist)
        
        default_settings = {
            "orderDateRestriction": {
                "restrictionType": "no_restriction",
                "daysValue": 0,
                "isActive": True,
                "startDate": None,
                "endDate": None
            },
            "expectedDeliveryRestriction": {
                "restrictionType": "days_after",
                "daysValue": 7,
                "isActive": True,
                "startDate": None,
                "endDate": None
            },
            "expectedDeliveryDays": 7,
            "invoiceDateRestriction": {
                "restrictionType": "days_after",
                "daysValue": 0,
                "isActive": True,
                "startDate": None,
                "endDate": None
            },
            "invoiceDaysAfterOrder": 0,
            "type": "purchase_date_settings",
            "createdAt": current_utc,
            "updatedAt": current_utc,
            "createdBy": user.get("username", "system"),
            "updatedBy": user.get("username", "system")
        }
        
        result = await collection.insert_one(default_settings)
        default_settings["_id"] = str(result.inserted_id)
        settings_doc = default_settings
        
        # Cache
        _settings_cache[tenant_id] = settings_doc
        
        # Generate ETag
        etag_data = {'id': settings_doc["_id"], 'updatedAt': str(current_utc)}
        _cache_etag[tenant_id] = hashlib.md5(
            json.dumps(etag_data, sort_keys=True).encode()
        ).hexdigest()
    
    # Set ETag
    if tenant_id in _cache_etag:
        response.headers["ETag"] = _cache_etag[tenant_id]
    
    # Remove internal fields
    if "_id" in settings_doc:
        del settings_doc["_id"]
    if "type" in settings_doc:
        del settings_doc["type"]
    
    return settings_doc

# VALIDATE endpoint - ULTRA FAST (should be < 50ms)
@router.get("/validate/{date_type}")
async def validate_date(
    request: Request,
    date_type: str,
    date: str,
    order_date: Optional[str] = None,
    user = Depends(validate_token)
):
    """Validate date - optimized for <100ms response"""
    start_time = time.time()
    
    tenant_id = request.state.tenant_id
    
    # Fast cache lookup - no DB call if cached
    if tenant_id not in _settings_cache:
        # Only fetch if not cached
        collection = await get_settings_collection(tenant_id)
        settings_doc = await get_cached_settings(tenant_id, collection)
    else:
        settings_doc = _settings_cache[tenant_id]
    
    if not settings_doc:
        return {
            "valid": True,
            "message": "",
            "minDate": None,
            "maxDate": None
        }
    
    # Parse input date (fast)
    input_date = parse_date_fast(date)
    if not input_date:
        return {
            "valid": False,
            "message": "Invalid date",
            "minDate": None,
            "maxDate": None
        }
    
    # Get today's date (fast)
    today_date = datetime.now(IST_TIMEZONE).date()
    
    # Map date type to restriction
    restriction_map = {
        "order": "orderDateRestriction",
        "expected": "expectedDeliveryRestriction", 
        "invoice": "invoiceDateRestriction"
    }
    
    restriction_key = restriction_map.get(date_type)
    if not restriction_key:
        return {"valid": False, "message": "Invalid type"}
    
    restriction = settings_doc.get(restriction_key, {})
    
    # Fast validation
    result = validate_date_ultra_fast(input_date, restriction, today_date)
    
    # Additional checks for expected/invoice dates
    if order_date and date_type in ["expected", "invoice"] and result["valid"]:
        order_date_parsed = parse_date_fast(order_date)
        
        if order_date_parsed:
            if date_type == "expected" and input_date < order_date_parsed:
                return {
                    "valid": False,
                    "message": f"Must be on/after {order_date_parsed.strftime('%d-%m-%Y')}",
                    "minDate": order_date_parsed.isoformat(),
                    "maxDate": result.get("maxDate")
                }
            
            if date_type == "invoice":
                min_days = settings_doc.get("invoiceDaysAfterOrder", 0)
                days_diff = (input_date - order_date_parsed).days
                if days_diff < min_days:
                    min_invoice_date = order_date_parsed + timedelta(days=min_days)
                    return {
                        "valid": False,
                        "message": f"Must be {min_days} days after order",
                        "minDate": min_invoice_date.isoformat(),
                        "maxDate": result.get("maxDate")
                    }
    
    # Add timing info in debug mode only
    if request.query_params.get("debug"):
        result["debug_time_ms"] = int((time.time() - start_time) * 1000)
    
    return result

# POST endpoint
@router.post("/")
async def create_date_settings(
    request: Request,
    settings: dict,
    user = Depends(validate_token)
):
    """Create new date settings"""
    tenant_id = request.state.tenant_id
    collection = await get_settings_collection(tenant_id)
    
    existing = await collection.find_one({"type": "purchase_date_settings"}, projection={"_id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="Settings exist")
    
    current_ist = get_current_ist()
    current_utc = get_utc_from_ist(current_ist)
    
    create_data = settings.copy()
    create_data.update({
        "type": "purchase_date_settings",
        "createdAt": current_utc,
        "updatedAt": current_utc,
        "createdBy": user.get("username"),
        "updatedBy": user.get("username")
    })
    
    result = await collection.insert_one(create_data)
    create_data["_id"] = str(result.inserted_id)
    
    clear_settings_cache(tenant_id)
    
    if "_id" in create_data:
        del create_data["_id"]
    if "type" in create_data:
        del create_data["type"]
    
    return create_data

# PATCH endpoint
@router.patch("/")
async def update_date_settings(
    request: Request,
    settings: dict,
    user = Depends(validate_token)
):
    """Update existing date settings"""
    tenant_id = request.state.tenant_id
    collection = await get_settings_collection(tenant_id)
    
    existing = await collection.find_one({"type": "purchase_date_settings"}, projection={"_id": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    if not settings:
        raise HTTPException(status_code=400, detail="No updates")
    
    current_utc = get_utc_from_ist(get_current_ist())
    
    update_data = {"updatedAt": current_utc, "updatedBy": user.get("username")}
    
    # Copy only provided fields
    for key, value in settings.items():
        if value is not None:
            update_data[key] = value
    
    await collection.update_one(
        {"type": "purchase_date_settings"},
        {"$set": update_data}
    )
    
    clear_settings_cache(tenant_id)
    
    return {"message": "Updated successfully"}