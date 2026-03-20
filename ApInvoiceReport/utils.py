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

 
