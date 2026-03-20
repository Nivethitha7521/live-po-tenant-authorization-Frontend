from datetime import datetime
from typing import Optional


# ================== Helpers ==================
def normalize_text(value):
    if isinstance(value, list):
        return "\n".join(str(v) for v in value)
    return value


def normalize_date_field(value):
    if isinstance(value, list) and value:
        return value[0]
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
        first, last = name.rsplit(".", 1)
        return first.strip(), f"{last.strip()}."
    return name, None


def normalize_number(value):
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def fmt_date(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%m-%d-%Y")
    return dt or ""
