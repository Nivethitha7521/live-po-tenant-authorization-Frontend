import io
from math import ceil
from typing import List, Optional
from fastapi import APIRouter, Query
from datetime import datetime, timezone
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi.responses import StreamingResponse
import pandas as pd

from globalsReport.allfuntions import get_item_full_details, to_int
from db.collections import warehouseReturn, ItemMaster, ItemCategory, ItemSubCategory
from excel import parse_date
from .models import (
    DateDropdownResponse,
    wastageReceiveReportResponse,
    VarianceDropdownResponse,
    branchnameDropdownResponse,
)

router = APIRouter()


# ---------------- Safe Index ----------------
def safe_index(values, idx):
    if isinstance(values, list) and len(values) > idx:
        return values[idx]
    return None


# ---------------- Format DateTime ----------------
def format_datetime(dt):
    if not dt:
        return None, None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None, None

    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc)

    return dt.strftime("%d-%m-%Y"), dt.strftime("%H:%M")




@router.get("/date-dropdown", response_model=DateDropdownResponse)
async def get_dispatch_date_dropdown( user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    collection = warehouseReturn

    pipeline = [
        {"$match": {"date": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$date"}},
                "months": {"$addToSet": {"$month": "$date"}},
                "days": {"$addToSet": {"$dayOfMonth": "$date"}},
            }
        },
    ]

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DateDropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DateDropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(result[0]["days"]),
    )

# ================= REPORT =================
@router.get("/report", response_model=wastageReceiveReportResponse)
async def get_wastage_received_report(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    branchName: Optional[List[str]] = Query(None),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    # <-- NOTE: use your actual status in DB (Pending/Received)
    query = {"status": "Pending"}

    # ---------------- Date Filter ----------------
    if startDate or endDate:
        date_filter = {}
        if startDate:
            start = parse_date(startDate)
            date_filter["$gte"] = datetime.combine(
                start.date(), datetime.min.time()
            ).replace(tzinfo=timezone.utc)
        if endDate:
            end = parse_date(endDate)
            date_filter["$lte"] = datetime.combine(
                end.date(), datetime.max.time()
            ).replace(tzinfo=timezone.utc)
        query["date"] = date_filter

    if branchName:
        query["locationId"] = {"$in": branchName}

    cursor = warehouseReturn.find(query).sort("date", -1)
    all_docs = [doc async for doc in cursor]

    # ---------------- MASTER ITEM CACHE ----------------
    item_cache = {}
    category_cache = {}
    subcategory_cache = {}

    # collect itemcodes
    unique_item_codes = set()
    for doc in all_docs:
        for code in doc.get("itemCode", []):
            if code:
                unique_item_codes.add(code)

    # prefetch all
    for code in unique_item_codes:
        await get_item_full_details(
            item_code=code,
            item_cache=item_cache,
            category_cache=category_cache,
            subcategory_cache=subcategory_cache,
            ItemMaster=ItemMaster,
            ItemCategory=ItemCategory,
            ItemSubCategory=ItemSubCategory,
        )

    flattened_results = []

    for doc in all_docs:
        variance_names = doc.get("varianceName") or []

        for idx, vname in enumerate(variance_names):
            if varianceName and vname.strip().lower() not in [
                v.strip().lower() for v in varianceName
            ]:
                continue

            tran_date, tran_time = format_datetime(doc.get("date"))

            item_code = safe_index(doc.get("itemCode"), idx)
            item_doc = item_cache.get(item_code, {})

            category_id = item_doc.get("category")
            subcategory_id = item_doc.get("subCategory")

            # ---------------- UOM logic ----------------
            uom = safe_index(doc.get("uom"), idx)
            send_qty = safe_index(doc.get("sendqty"), idx) or 0
            send_weight = safe_index(doc.get("sendweight"), idx) or 0

            if uom and uom.strip().lower() == "pcs":
                transfer_qty = send_qty
            else:
                transfer_qty = send_weight

            price = safe_index(doc.get("price"), idx) or 0
            total = (
                safe_index(doc.get("sendamount"), idx)
                or doc.get("sendtotalamount")
                or transfer_qty * price
            )

            entry = {
                "DocNo": str(doc.get("_id"))[-5:],
                "UniqueDocNo": doc.get("warehouseReturnNumber"),
                "ItemCode": item_code,
                "ItemName": safe_index(doc.get("itemName"), idx),
                "Group": category_cache.get(category_id),
                "Sub_Group": subcategory_cache.get(subcategory_id),
                "UOM": uom,
                "HSN": to_int(item_doc.get("hsnCode")) if item_doc else None,
                "TransferQty": transfer_qty,
                "ReciveQty": safe_index(doc.get("receivedqty"), idx) or 0,
                "Price": price,
                "Total": total,
                "TaxCode": item_doc.get("TaxCode") if item_doc else None,
                "TaxAmt": None,
                "DriverCode": doc.get("driverName") or "",
                "VehicleNo": doc.get("vehicleNo") or "",
                "Rec_Date": tran_date,
                "Rec_Time": tran_time,
                "Location": doc.get("branchName"),
                "ReasonName": doc.get("reason"),
            }

            flattened_results.append(entry)

    total_items = len(flattened_results)
    total_pages = ceil(total_items / limit)
    start = (page - 1) * limit
    end = start + limit

    return {
        "items": flattened_results[start:end],
        "page": page,
        "limit": limit,
        "total": total_items,
        "totalPages": total_pages,
    }


# ================= EXPORT =================
@router.get("/export")
async def export_dispatch_entries(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    branchName: Optional[List[str]] = Query(None),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    data_response = await get_wastage_received_report(
        page=1,
        limit=9999999,
        startDate=startDate,
        endDate=endDate,
        varianceName=varianceName,
        branchName=branchName,
    )

    results = data_response["items"]
    df = pd.DataFrame(results)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="WastageReceive")

    output.seek(0)
    filename = f"WastageReceive_YenERP_{datetime.now().strftime('%d-%m-%Y_%H-%M')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
