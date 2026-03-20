from decimal import Decimal, ROUND_HALF_UP


def str_to_int(value, default=None):

    try:
        if value is None:
            return default
        return int(str(value).strip())
    except (ValueError, TypeError):
        return default


# ---------------- ROUNDING FUNCTION ----------------
def round_value(value, digits=2):
    try:
        return float(
            Decimal(str(value or 0)).quantize(
                Decimal("1." + "0" * digits),
                rounding=ROUND_HALF_UP,
            )
        )
    except:
        return 0.0


# ---------------- UOM PRECISION HELPER ----------------
def get_uom_precision(uom_name, uom_map):
    return uom_map.get(uom_name, 2)  # default 2


def to_excel_int_optional(value):

    if value in (None, ""):
        return ""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return ""




def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def safe_int(value):
    if value in [None, "", "None"]:
        return ""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return ""



# ---------------- Helper Functions ----------------
def to_excel_int(value):

    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def safe_excel(value):

    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return str(value)
    return value

