from datetime import datetime, timezone
from io import BytesIO
import re
from typing import Any, Optional
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd

from fastapi.responses import StreamingResponse
import pandas as pd
from io import BytesIO


def export_to_excel(entries, file_name="Dispatch.xlsx", headers=None):
    if not entries:
        raise HTTPException(status_code=404, detail="No data to export")

    # Convert Pydantic objects to dict
    data_list = [e.dict() if hasattr(e, "dict") else e for e in entries]

    df = pd.json_normalize(data_list)  # Flatten nested fields

    if headers:
        # Keep only columns that exist in the DataFrame, reorder columns
        cols = [col for col in headers if col in df.columns]
        df = df[cols]

    output = BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={file_name}"},
    )


# ---------- Utility: Safe date parser ----------
def parse_date(date_str: str) -> datetime:
    """Parse ISO or YYYY-MM-DD format into datetime."""
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.strptime(date_str, "%Y-%m-%d")


def build_date_filter(start_date: Optional[str], end_date: Optional[str]):
    date_filter = {}
    if start_date:
        start = parse_date(start_date)
        date_filter["$gte"] = datetime.combine(
            start.date(), datetime.min.time()
        ).replace(tzinfo=timezone.utc)
    if end_date:
        end = parse_date(end_date)
        date_filter["$lte"] = datetime.combine(end.date(), datetime.max.time()).replace(
            tzinfo=timezone.utc
        )
    return date_filter if date_filter else None


def get_vendor_code(vendor_doc: dict | None):

    if not vendor_doc:
        return None

    sap = vendor_doc.get("sapVendorCode")
    random_id = vendor_doc.get("randomId")

    if sap and str(sap).strip().isdigit():
        return int(str(sap).strip())

    return random_id


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


def resolve_raw_material(
    item: dict, raw_by_random: dict, raw_by_code: dict, raw_by_name: dict
) -> dict:

    # 1. Try match by randomId
    raw_info = raw_by_random.get(item.get("randomId"))

    # 2. Fallback: Try match by itemCode
    if not raw_info:
        raw_info = raw_by_code.get(item.get("itemCode"))

    # 3. Fallback: Try match by itemName
    if not raw_info:
        raw_info = raw_by_name.get(item.get("itemName"))

    raw_info = raw_info or {}

    # --- LOGIC FOR itemCode -> INT or STR ---
    code_val = raw_info.get("itemCode")

    # Try to convert to Integer
    if code_val is not None:
        try:
            # Handle if it comes as string "123" or int 123
            display_code = int(code_val)
        except (ValueError, TypeError):
            # If conversion fails (e.g. "ABC"), it's not a valid code, use randomId
            display_code = raw_info.get("randomId")
    else:
        # If itemCode is missing/None, use randomId (String)
        display_code = raw_info.get("randomId")

    return {"info": raw_info, "display_code": display_code}


#store dispatch 
def get_final_item_code(item_code, random_ids, index):
    """
    Return item_code if exists, else fallback to randomId at the same index
    """
    if item_code not in [None, "", "None"]:
        return item_code
    if random_ids and len(random_ids) > index:
        return random_ids[index]
    return ""