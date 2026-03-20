from datetime import datetime


# ------------------- SAFE DATE PARSER ------------------- #
def format_date(date_str):
    if not date_str or not isinstance(date_str, str):
        return ""
    try:
        cleaned = date_str.replace("Z", "").replace("T", " ")
        dt = datetime.fromisoformat(cleaned)
        return dt.strftime("%m-%d-%Y")
    except Exception:
        return ""


# ------------------- SAFE TIME PARSER ------------------- #
def format_time(date_str):
    if not date_str or not isinstance(date_str, str):
        return ""
    try:
        cleaned = date_str.replace("Z", "").replace("T", " ")
        dt = datetime.fromisoformat(cleaned)
        return dt.strftime("%H:%M")
    except Exception:
        return ""
