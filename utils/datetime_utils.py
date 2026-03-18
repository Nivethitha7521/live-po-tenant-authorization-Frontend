# utils/datetime_utils.py
from datetime import datetime, timedelta
from typing import Optional, Union, Any
import pytz
from pytz import timezone

# Constants
IST = timezone('Asia/Kolkata')
UTC = pytz.UTC  # Use pytz.UTC instead of timezone.utc


def format_date_response(dt: Optional[datetime]) -> Optional[str]:
    """Format datetime for API response (ISO format with timezone)"""
    if dt is None:
        return None
    
    try:
        # Make sure datetime is timezone aware
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                # If naive, assume UTC using pytz.UTC
                dt = dt.replace(tzinfo=UTC)  # Use UTC constant
            return dt.isoformat()
        return str(dt)
    except Exception as e:
        print(f"Error formatting date: {e}")
        return str(dt) if dt else None


def get_current_ist() -> datetime:
    """Get current time in IST (timezone-aware)"""
    return datetime.now(IST)

def get_ist_now() -> datetime:
    """
    Get current time in IST (timezone-aware)
    Alias for get_current_ist() for compatibility
    """
    return get_current_ist()

def get_utc_from_ist(dt: Optional[datetime] = None) -> datetime:
    """
    Convert IST datetime to UTC for storage
    If no datetime provided, use current IST time
    """
    if dt is None:
        dt = get_current_ist()
    
    # Ensure datetime is timezone-aware in IST
    if dt.tzinfo is None:
        dt = IST.localize(dt)
    elif dt.tzinfo != IST:
        dt = dt.astimezone(IST)
    
    # Convert to UTC
    return dt.astimezone(UTC)

def convert_to_utc(dt: datetime, source_tz: str = "Asia/Kolkata") -> datetime:
    """
    Convert any datetime to UTC for storage
    Handles both naive and aware datetimes
    """
    if dt.tzinfo is None:
        # If naive, assume it's in source timezone
        source_timezone = timezone(source_tz)
        dt = source_timezone.localize(dt)
    
    # Convert to UTC
    return dt.astimezone(UTC)

def convert_from_utc(dt: datetime, target_tz: str = "Asia/Kolkata") -> datetime:
    """
    Convert UTC datetime to target timezone for display
    """
    if dt.tzinfo is None:
        dt = UTC.localize(dt)
    elif dt.tzinfo != UTC:
        dt = dt.astimezone(UTC)
    
    target_timezone = timezone(target_tz)
    return dt.astimezone(target_timezone)

def get_ist_from_utc(utc_dt: datetime) -> datetime:
    """
    Convert UTC datetime to IST for display
    This is an alias for convert_from_utc with target_tz="Asia/Kolkata"
    """
    return convert_from_utc(utc_dt, "Asia/Kolkata")

def to_midnight_ist(dt: Optional[datetime] = None) -> datetime:
    """
    Convert datetime to midnight in IST (00:00:00)
    Used for date-only fields like orderDate
    """
    if dt is None:
        dt = get_current_ist()
    elif dt.tzinfo is None:
        dt = IST.localize(dt)
    else:
        dt = dt.astimezone(IST)
    
    # Set to midnight IST
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)

def format_date_for_display(dt: datetime, format: str = "%d/%m/%Y") -> str:
    """Format date for display in UI (DD/MM/YYYY)"""
    if dt.tzinfo is None:
        dt = UTC.localize(dt)
    
    # Convert to IST for display
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime(format)

def get_midnight_utc(dt: Optional[datetime] = None) -> datetime:
    """
    Get midnight UTC for a given date
    Used for storing date-only fields
    """
    if dt is None:
        dt = get_current_ist()
    
    # Convert to IST and set to midnight
    if dt.tzinfo is None:
        dt = IST.localize(dt)
    else:
        dt = dt.astimezone(IST)
    
    # Set to midnight IST
    midnight_ist = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Convert to UTC for storage
    return midnight_ist.astimezone(UTC)

def get_midnight_ist(dt: Optional[datetime] = None) -> datetime:
    """
    Get midnight IST for a given date
    Used for date comparisons in IST
    """
    if dt is None:
        dt = get_current_ist()
    
    # Ensure we have a timezone-aware datetime
    if dt.tzinfo is None:
        dt = IST.localize(dt)
    else:
        dt = dt.astimezone(IST)
    
    # Set to midnight IST
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)

def parse_ist_date(date_str: str) -> Optional[datetime]:
    """
    Parse a date string and return midnight IST datetime
    Supports formats: YYYY-MM-DD, DD/MM/YYYY, ISO format
    """
    if not date_str:
        return None
    
    try:
        # Try ISO format first
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return get_midnight_ist(dt)
    except (ValueError, TypeError):
        pass
    
    try:
        # Try DD/MM/YYYY format
        day, month, year = map(int, date_str.split('/'))
        dt = datetime(year, month, day)
        return IST.localize(dt).replace(hour=0, minute=0, second=0, microsecond=0)
    except (ValueError, TypeError):
        pass
    
    try:
        # Try YYYY-MM-DD format
        year, month, day = map(int, date_str.split('-'))
        dt = datetime(year, month, day)
        return IST.localize(dt).replace(hour=0, minute=0, second=0, microsecond=0)
    except (ValueError, TypeError):
        pass
    
    return None

def get_date_range(start_date: datetime, end_date: datetime) -> dict:
    """
    Get date range with proper timezone handling
    Returns start and end dates in both IST and UTC
    """
    start_ist = get_midnight_ist(start_date)
    end_ist = get_midnight_ist(end_date)
    
    return {
        "start": {
            "ist": start_ist,
            "utc": get_midnight_utc(start_date),
            "display": format_date_for_display(start_ist)
        },
        "end": {
            "ist": end_ist,
            "utc": get_midnight_utc(end_date),
            "display": format_date_for_display(end_ist)
        }
    }

def add_days_ist(dt: datetime, days: int) -> datetime:
    """
    Add days to a date while preserving IST midnight
    """
    ist_dt = get_midnight_ist(dt)
    new_ist = ist_dt + timedelta(days=days)
    return new_ist

def is_same_day_ist(date1: datetime, date2: datetime) -> bool:
    """
    Check if two dates are the same day in IST
    """
    d1 = get_midnight_ist(date1)
    d2 = get_midnight_ist(date2)
    return d1.date() == d2.date()

def is_date_before_ist(date1: datetime, date2: datetime) -> bool:
    """
    Check if date1 is before date2 in IST
    """
    d1 = get_midnight_ist(date1)
    d2 = get_midnight_ist(date2)
    return d1 < d2

def is_date_after_ist(date1: datetime, date2: datetime) -> bool:
    """
    Check if date1 is after date2 in IST
    """
    d1 = get_midnight_ist(date1)
    d2 = get_midnight_ist(date2)
    return d1 > d2

def get_min_max_dates_ist(dates: list) -> tuple:
    """
    Get minimum and maximum dates from a list in IST
    """
    if not dates:
        return None, None
    
    ist_dates = [get_midnight_ist(d) for d in dates]
    return min(ist_dates), max(ist_dates)

def format_date_short(dt: datetime) -> str:
    """Format date as DD/MM/YYYY for display"""
    return format_date_for_display(dt, "%d/%m/%Y")

def format_date_long(dt: datetime) -> str:
    """Format date as DD MMM YYYY for display (e.g., 15 Apr 2024)"""
    return format_date_for_display(dt, "%d %b %Y")

def format_datetime_full(dt: datetime) -> str:
    """Format datetime as DD/MM/YYYY HH:MM for display"""
    if dt.tzinfo is None:
        dt = UTC.localize(dt)
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime("%d/%m/%Y %H:%M")

def get_current_utc() -> datetime:
    """Get current time in UTC"""
    return datetime.now(UTC)

def to_client_timezone(dt: datetime, client_tz: str = "Asia/Kolkata") -> datetime:
    """
    Convert UTC datetime to client timezone for display
    """
    if dt.tzinfo is None:
        dt = UTC.localize(dt)
    elif dt.tzinfo != UTC:
        dt = dt.astimezone(UTC)
    
    client_timezone = timezone(client_tz)
    return dt.astimezone(client_timezone)

def format_date_response(dt: Any) -> Any:
    """
    Safely format date fields for API response.
    Handles datetime objects, strings, and nested structures.
    """
    if dt is None:
        return None
    
    # Handle datetime objects
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)  # Use UTC constant
        return dt.isoformat()
    
    # Handle dictionaries recursively
    if isinstance(dt, dict):
        return {key: format_date_response(value) for key, value in dt.items()}
    
    # Handle lists recursively
    if isinstance(dt, list):
        return [format_date_response(item) for item in dt]
    
    # Handle strings that might be dates
    if isinstance(dt, str):
        try:
            # Try to parse as ISO datetime
            parsed_dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            return parsed_dt.isoformat()
        except (ValueError, AttributeError, TypeError):
            # Not a valid datetime string, return as is
            return dt
    
    # Return other types as is
    return dt

def parse_date_string(date_str: Optional[str]) -> Optional[datetime]:
    """
    Parse a date string to datetime object.
    """
    if not date_str:
        return None
    
    try:
        # Handle ISO format strings
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        try:
            # Handle simple date strings (YYYY-MM-DD)
            return datetime.fromisoformat(date_str)
        except (ValueError, AttributeError):
            return None

def ensure_datetime(obj: Any) -> Any:
    """
    Recursively ensure all date strings are converted to datetime objects.
    Use this before processing data in your routes.
    """
    if obj is None:
        return None
    
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            # Check if this might be a date field
            if key in ['startDate', 'endDate', 'createdAt', 'updatedAt', 'orderDate', 'expectedDeliveryDate']:
                result[key] = parse_date_string(value) if isinstance(value, str) else value
            else:
                result[key] = ensure_datetime(value)
        return result
    
    if isinstance(obj, list):
        return [ensure_datetime(item) for item in obj]
    
    return obj

def parse_and_normalize_date(date_value: Any) -> Optional[datetime]:
    """
    Parse a date from various formats and return midnight UTC datetime for storage.
    This is the main function to use when processing incoming date data.
    """
    if date_value is None:
        return None
    
    # If it's already a datetime object
    if isinstance(date_value, datetime):
        # Convert to midnight IST then to UTC for storage
        return get_midnight_utc(date_value)
    
    # If it's a string
    if isinstance(date_value, str):
        # Parse the string to a datetime
        parsed_dt = parse_ist_date(date_value)
        if parsed_dt:
            # Convert to UTC for storage
            return get_midnight_utc(parsed_dt)
    
    return None