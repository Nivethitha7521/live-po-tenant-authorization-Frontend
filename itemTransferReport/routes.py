import io
from math import ceil
from typing import List, Optional
from fastapi import APIRouter, Query
from datetime import datetime
from datetime import datetime, timezone
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi.responses import StreamingResponse
import pandas as pd


from ApInvoiceReport.models import DropdownResponse
from db.collections import ItemMaster, itemtransfer, ItemCategory, ItemSubCategory
from excel import parse_date
from .models import (
    itemTransferReportResponse,
)

router = APIRouter()


# ---------------- Helper ----------------
def safe_index(field_list, idx):
    if isinstance(field_list, list) and len(field_list) > idx:
        return field_list[idx]
    return None


def format_datetime(dt):
    if not dt:
        return None, None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None, None
    return dt.strftime("%d-%m-%Y"), dt.strftime("%H:%M")


# ---------------- Dropdowns ----------------
@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_dispatch_date_dropdown(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    collection = itemtransfer

    pipeline = [
        {"$match": {"requestDateTime": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$requestDateTime"}},
                "months": {"$addToSet": {"$month": "$requestDateTime"}},
                "days": {"$addToSet": {"$dayOfMonth": "$requestDateTime"}},
            }
        },
    ]

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(result[0]["days"]),
    )


# ---------------- Item Master Fetch ----------------
async def get_item_master_details(
    item_code,
    item_cache,
    category_cache,
    subcategory_cache,
    ItemMaster,
    ItemCategory,
    ItemSubCategory,
):
    if not item_code:
        return {}

    item_code = item_code.strip()

    if item_code in item_cache:
        return item_cache[item_code]

    # ---------------- FETCH ITEM ----------------
    item_doc = await ItemMaster.find_one({"itemCode": item_code})

    cat_name = None
    subcat_name = None

    if item_doc:

        cat_code = item_doc.get("category")  # IC001
        subcat_code = item_doc.get("subCategory")  # IS017

        # ---------------- CATEGORY ----------------
        if cat_code:
            if cat_code in category_cache:
                cat_name = category_cache[cat_code]
            else:
                cat_doc = await ItemCategory.find_one(
                    {"categoryId": cat_code}  # ✅ CORRECT FIELD
                )
                cat_name = cat_doc.get("categoryName") if cat_doc else None
                category_cache[cat_code] = cat_name

        # ---------------- SUBCATEGORY ----------------
        if subcat_code:
            if subcat_code in subcategory_cache:
                subcat_name = subcategory_cache[subcat_code]
            else:
                subcat_doc = await ItemSubCategory.find_one(
                    {"subCategoryId": subcat_code}  # ✅ CORRECT FIELD
                )
                subcat_name = subcat_doc.get("subCategoryName") if subcat_doc else None
                subcategory_cache[subcat_code] = subcat_name

    item_cache[item_code] = {
        "category": cat_name,
        "subCategory": subcat_name,
        "hsnCode": item_doc.get("hsnCode") if item_doc else None,
        "TaxCode": item_doc.get("TaxCode") if item_doc else None,
    }

    return item_cache[item_code]


# ---------------- REPORT ----------------
@router.get("/report", response_model=itemTransferReportResponse)
async def get_itemtransfer_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    frombranchName: Optional[List[str]] = Query(None),
    tobranchName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
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
            date_filter["$gte"] = datetime.combine(
                start.date(), datetime.min.time()
            ).replace(tzinfo=timezone.utc)

        if endDate:
            end = parse_date(endDate)
            date_filter["$lte"] = datetime.combine(
                end.date(), datetime.max.time()
            ).replace(tzinfo=timezone.utc)

        query["requestDateTime"] = date_filter

    if frombranchName:
        query["fromBranchId"] = {"$in": frombranchName}
    if tobranchName:
        query["toBranchId"] = {"$in": tobranchName}
    if status:
        query["status"] = {"$in": status}

    # ---------------- Fetch Documents ----------------
    cursor = itemtransfer.find(query).sort("sentDateTime", -1)
    all_docs = [doc async for doc in cursor]

    # ---------------- Prefetch Item Master ----------------
    unique_item_codes = set()
    for doc in all_docs:
        for code in doc.get("itemCode", []):
            if code:
                unique_item_codes.add(code)

    for code in unique_item_codes:
        await get_item_master_details(
            item_code=code,
            item_cache=item_cache,
            category_cache=category_cache,
            subcategory_cache=subcategory_cache,
            ItemMaster=ItemMaster,
            ItemCategory=ItemCategory,
            ItemSubCategory=ItemSubCategory,
        )

    # ---------------- Flatten ----------------
    flattened_results = []
    for doc in all_docs:
        variance_names = doc.get("itemName") or []
        line_id = 1

        for idx, vname in enumerate(variance_names):
            if varianceName and vname.lower() not in [v.lower() for v in varianceName]:
                continue

            item_code = safe_index(doc.get("itemCode"), idx)
            item_doc = item_cache.get(item_code) or {}

            print(
                item_doc.get("category"),
            )

            sent_date, sent_time = format_datetime(doc.get("sentDateTime"))
            recv_date, recv_time = format_datetime(doc.get("receiveDateTime"))

            entry = {
                "DocNo": str(doc.get("_id"))[-5:],
                "LineID": line_id,
                "ItemCode": item_code,
                "ItemName": vname,
                "Group": item_doc.get("category"),
                "Sub-Group": item_doc.get("subCategory"),
                "UOM": safe_index(doc.get("uom"), idx),
                "HSN": item_doc.get("hsnCode"),
                "ReqQty": safe_index(doc.get("reqQty"), idx) or 0,
                "TransferQty": safe_index(doc.get("sendQty"), idx) or 0,
                "Recv.Variance": (safe_index(doc.get("reqQty"), idx) or 0)
                - (safe_index(doc.get("sendQty"), idx) or 0),
                "Unit Price": safe_index(doc.get("price"), idx) or 0,
                "VariancePrice": "",
                "From.Loc": doc.get("fromBranch"),
                "To.Loc": doc.get("toBranch"),
                "Tran.Date": sent_date,
                "Tran.Time": sent_time,
                "Recv.Date": recv_date,
                "Recv.Time": recv_time,
                "DriverCode": "",
                "DriverName": doc.get("driverName"),
                "VehicleCode": doc.get("vehicleNo"),
                "VehicleName": "",
                "Trans.LogID": doc.get("fromLoginId"),
                "Trans.Name": "",
                "Recv.LogID": doc.get("toLoginId"),
                "Recv.Name": "",
            }

            flattened_results.append(entry)
            line_id += 1

    # ---------------- Pagination ----------------
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


# ---------------- EXPORT ----------------
@router.get("/export")
async def export_dispatch_entries(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    frombranchName: Optional[List[str]] = Query(None),
    tobranchName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    data_response = await get_itemtransfer_entries(
        page=1,
        limit=1000000,
        startDate=startDate,
        endDate=endDate,
        varianceName=varianceName,
        frombranchName=frombranchName,
        tobranchName=tobranchName,  # <-- FIXED typo
        status=status,
    )

    results = data_response["items"]
    df = pd.DataFrame(results)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="ItemTransfer")

    output.seek(0)

    filename = f"ItemTransfer_Report_{datetime.now().strftime('%d-%m-%Y_%H-%M')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
