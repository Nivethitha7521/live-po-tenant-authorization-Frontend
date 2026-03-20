import io
from math import ceil
from typing import List, Optional
from fastapi import APIRouter, Query
from datetime import datetime, timezone

from fastapi.responses import StreamingResponse
import pandas as pd

from WastageReceiveReport.models import wastageReceiveReportResponse
from globalsReport.allfuntions import get_item_full_details, to_int
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from db.collections import ItemMaster, wastageEntry, ItemCategory, ItemSubCategory
from excel import parse_date
from .models import (
    DateDropdownResponse,
    VarianceDropdownResponse,
    branchnameDropdownResponse,
    statusDropdownResponse,
)

router = APIRouter()


# Helper function to safely get value from array
def safe_index(field_list, idx):
    if isinstance(field_list, list) and len(field_list) > idx:
        return field_list[idx]
    return None


def format_datetime(dt):
    if not dt:
        return None, None

    dt = dt.astimezone(timezone.utc) if dt.tzinfo else dt
    return dt.strftime("%d-%m-%Y"), dt.strftime("%H:%M")


@router.get("/date-dropdown", response_model=DateDropdownResponse)
async def get_dispatch_date_dropdown( user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    collection = wastageEntry

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


def code_to_int(code):
    if not code:
        return None
    code = str(code).strip()
    digits = "".join([c for c in code if c.isdigit()])
    return int(digits) if digits else None


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
    query = {}

    item_cache = {}
    category_cache = {}
    subcategory_cache = {}

    # ---------------- Date Filter ----------------
    if startDate or endDate:
        date_filter = {}

        if startDate:
            start = parse_date(startDate)
            date_filter["$gte"] = start.replace(
                hour=0, minute=0, second=0, microsecond=0
            )

        if endDate:
            end = parse_date(endDate)
            date_filter["$lte"] = end.replace(
                hour=23, minute=59, second=59, microsecond=999999
            )

        query["date"] = date_filter

    # ---------------- Branch Filter ----------------
    if branchName:
        import re

        query["locationId"] = {"$in": branchName}

    print("Query Dict:", query)

    cursor = wastageEntry.find(query).sort("date", -1)
    all_docs = [doc async for doc in cursor]

    print("Documents Found:", len(all_docs))

    # ==========================================================
    #  STEP 1: Collect unique itemCodes
    # ==========================================================
    unique_item_codes = set()

    for doc in all_docs:
        for code in doc.get("itemCode", []):
            if code:
                unique_item_codes.add(code)

    # ==========================================================
    # STEP 2: Prefetch master item details
    # ==========================================================
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

    # ==========================================================
    # STEP 3: Flatten
    # ==========================================================
    flattened_results = []

    for doc in all_docs:

        variance_names = doc.get("varianceName")

        # 💡 Handle varianceName as list or string
        if isinstance(variance_names, str):
            variance_names = [variance_names]
        if not isinstance(variance_names, list):
            variance_names = []

        for idx, vname in enumerate(variance_names):

            if varianceName and vname.strip().lower() not in [
                v.strip().lower() for v in varianceName
            ]:
                continue

            def safe_index(field):
                values = doc.get(field, [])
                return (
                    values[idx]
                    if isinstance(values, list) and idx < len(values)
                    else None
                )

            tran_date, tran_time = format_datetime(doc.get("date"))

            item_code = safe_index("itemCode")
            item_doc = item_cache.get(item_code)

            category_id = item_doc.get("category") if item_doc else None
            subcategory_id = item_doc.get("subCategory") if item_doc else None

            #  UOM Based Quantity Logic
            uom = safe_index("uom")
            send_qty = safe_index("sendqty") or 0
            send_weight = safe_index("sendweight") or 0

            if uom and uom.strip().lower() == "pcs":
                transfer_qty = send_qty
            elif send_weight > 0:
                transfer_qty = send_weight
            else:
                transfer_qty = send_qty

            price = safe_index("price") or 0
            send_amount = safe_index("sendamount")

            # 💡 Safe total calculation
            if send_amount is not None:
                total = send_amount
            else:
                total = transfer_qty * price

            entry = {
                "DocNo": str(doc.get("_id"))[-5:],
                "UniqueDocNo": doc.get("wastageEntryNumber"),
                "ItemCode": item_code,
                "ItemName": safe_index("itemName"),
                "Group": category_cache.get(category_id),
                "Sub_Group": subcategory_cache.get(subcategory_id),
                "UOM": uom,
                "HSN": to_int(item_doc.get("hsnCode")) if item_doc else None,
                "TransferQty": transfer_qty,
                "Price": price,
                "Total": total,
                "TaxCode": item_doc.get("TaxCode") if item_doc else None,
                "TaxAmt": None,
                "Rec_ID": doc.get("receivedBy") or doc.get("toLoginId"),
                "DriverCode": doc.get("driverCode") or "",
                "VehicleNo": doc.get("vehicleNo") or "",
                "Rec_Date": tran_date,
                "Rec_Time": tran_time,
                "Location": doc.get("branchName") or doc.get("toBranch"),
                "ReasonName": doc.get("reason"),
            }

            flattened_results.append(entry)

    # ---------------- Pagination ----------------
    total_items = len(flattened_results)
    total_pages = ceil(total_items / limit) if total_items > 0 else 0

    start_idx = (page - 1) * limit
    end_idx = start_idx + limit

    return {
        "items": flattened_results[start_idx:end_idx],
        "page": page,
        "limit": limit,
        "total": total_items,
        "totalPages": total_pages,
    }


@router.get("/export")
async def export_dispatch_entries(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    branchName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
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
        df.to_excel(writer, index=False, sheet_name="Sheet1")

    output.seek(0)
    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"WastageEntry_YenERP_{download_time}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
