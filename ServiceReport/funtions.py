from datetime import datetime
import re

def str_to_int(value, default=0):
    """
    Safely convert a string or other type to int.
    Returns `default` if conversion fails.
    """
    try:
        if value is None:
            return default
        if isinstance(value, int):
            return value
        # Remove any non-digit characters (like spaces, %, etc.)
        value_str = re.sub(r"[^\d]", "", str(value))
        return int(value_str) if value_str else default
    except (ValueError, TypeError):
        return default


def fmt_date(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%m-%d-%Y")  # Correct format
    if isinstance(dt, dict) and "$date" in dt:
        try:
            return datetime.fromisoformat(dt["$date"].replace("Z", "+00:00")).strftime(
                "%m-%d-%Y"
            )
        except:
            return ""
    if isinstance(dt, str):
        try:
            return datetime.fromisoformat(dt).strftime("%m-%d-%Y")
        except:
            return dt
    return ""
