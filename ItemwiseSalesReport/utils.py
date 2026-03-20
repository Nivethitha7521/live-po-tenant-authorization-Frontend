from datetime import date, datetime
from typing import Optional

def fmt_date(dt):
    try:
        # If already datetime
        if isinstance(dt, datetime):
            return dt.strftime("%m-%d-%Y")

        # If only date (no time)
        if isinstance(dt, date):
            return dt.strftime("%m-%d-%Y")

        # If string → try parsing
        if isinstance(dt, str) and dt.strip():
            # Try multiple formats
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


def normalize_text(value):
    if isinstance(value, list):
        return "\n".join(str(v) for v in value)
    return value


def normalize_date_field(value):
    """If field is list → take first value"""
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


def split_employee_field(raw_value: Optional[str]):
    if not raw_value or " - " not in raw_value:
        return None, raw_value
    emp_id, emp_name = raw_value.split(" - ", 1)
    return emp_id.strip(), emp_name.strip()


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


def safe_index(data, field, idx, default=None):
    values = data.get(field)

    # If the field is a list, get by index
    if isinstance(values, list):
        return values[idx] if len(values) > idx else default

    # If the field is a direct value (not list), return it directly
    # This handles fields like netAmount, totalAmount, etc.
    return values
