from datetime import datetime, timedelta

from fastapi import HTTPException
import pytz


def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    """Returns current datetime in specified timezone with 5:30 hours added"""
    try:
        tz = pytz.timezone(timezone)
        localized_now = datetime.now(tz)
        # Add 5 hours 30 minutes (like your original logic)
        adjusted_time = localized_now + timedelta(hours=5, minutes=30)
        return {
            "datetime": adjusted_time
        }
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")