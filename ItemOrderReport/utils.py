from datetime import date, datetime
from typing import Optional


def fmt_date(dt_str: str):
    try:
        return datetime.strptime(dt_str, "%d-%m-%Y").strftime("%Y-%m-%d")
    except:
        return dt_str
    
    
def normalize_date_field(value):
    if isinstance(value, list) and value:
        value = value[0]
    return value


def split_date_time(value):
    if not value:
        return None, None
    
    if isinstance(value, datetime):
        return value.strftime("%d-%m-%Y"), value.strftime("%H:%M")

    try:
        parsed = datetime.fromisoformat(value)
        return parsed.strftime("%d-%m-%Y"), parsed.strftime("%H:%M")
    except:
        try:
            parsed = datetime.strptime(value, "%d-%m-%Y")
            return parsed.strftime("%d-%m-%Y"), None
        except:
            return value, None
        
        
        
def split_customer_name(name: Optional[str]):
    if not name or not isinstance(name, str):
        return None, None
    
    name = name.strip()

    if "." in name:
        # Only return last name when there's a dot
        last = name.rsplit(".", 1)[1].strip()
        return None, f"{last}. "
    
    # Split by space and take the last part as last name, rest as first name
    parts = name.split()
    if len(parts) > 1:
        first_name = " ".join(parts[:-1])  # Everything except last part
        last_name = parts[-1]  # Last part
        return first_name, last_name
    
    # If only one word, return as first name
    return name, None

def normalize_text(value):
   
    if isinstance(value, list):
        return "\n".join(str(v) for v in value)
    return value

def normalize_str(value):
    
    if isinstance(value, list):
        return str(value[0]) if value else ""
    if value is None:
        return ""
    return str(value)
    
def split_employee_field(raw_value: Optional[str]):
    if not raw_value or " - " not in raw_value:
        return None, raw_value
    emp_id, emp_name = raw_value.split(" - ", 1)
    return emp_id.strip(), emp_name.strip()
    
def to_float(value, default=0.0):

    try:
        if value is None or value == "":
            return default
        return float(value)
    except:
        return default


    
def fmt_date(dt):
    
    try:
        # If already datetime
        if isinstance(dt, datetime):
            return dt.strftime("%m-%d-%Y")

        # If only date object
        if isinstance(dt, date):
            return dt.strftime("%m-%d-%Y")

        # If string → try parsing
        if isinstance(dt, str) and dt.strip():

            # FIRST: handle full ISO format: 2025-11-23T11:27:12.125522
            try:
                parsed = datetime.fromisoformat(dt)
                return parsed.strftime("%m-%d-%Y")
            except:
                pass

            # Other fallback formats
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
                try:
                    parsed = datetime.strptime(dt, fmt)
                    return parsed.strftime("%m-%d-%Y")
                except:
                    pass

        # If nothing matched
        return ""

    except:
        return ""
