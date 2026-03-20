from datetime import datetime, time, timedelta
from io import BytesIO
from itertools import zip_longest
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from openpyxl import Workbook

from ApInvoiceReport.models import DropdownResponse
from rawmaterialReport.funtions import (
    get_uom_precision,
    round_value,
    safe_excel,
)

from .utils import (
    format_time,
)
from .models import DateDropdownResponse

from db.collections import Uom, storedispatch, rawMaterials, location, sections

router = APIRouter()

collection = storedispatch
itemsCollection = rawMaterials
branch_collection = location
section_collection = sections


# ----------------- UPDATE HELPER FUNCTION -----------------
# We redefine safe_excel locally to ensure it returns "" (empty) instead of 0 for missing values
def safe_excel(value):
    if value is None:
        return ""
    if isinstance(value, str) and value.strip().lower() in ("none", "null", "nan", ""):
        return ""
    return str(value)
# ----------------------------------------------------------


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_dispatch_date_dropdown(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):

    pipeline = [
        {"$match": {"date": {"$type": "string", "$regex": "^\\d{4}-\\d{2}-\\d{2}T"}}},
        {
            "$addFields": {
                "dateObj": {
                    "$dateFromString": {
                        "dateString": "$date",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {"$match": {"dateObj": {"$ne": None}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$dateObj"}},
                "months": {"$addToSet": {"$month": "$dateObj"}},
                "days": {"$addToSet": {"$dayOfMonth": "$dateObj"}},
            }
        },
    ]

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(f"{d:02d}" for d in result[0]["days"]),
    )



def format_date_only(value):
    if not value:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return None
    return value.strftime("%m-%d-%Y")


def get_qty_by_uom(uom, qty, weight):
    if not uom:
        return float(qty or 0)
    uom = uom.lower().strip()
    if uom in ("kgs", "kg", "ltr", "ltrs", "liter", "litre"):
        return float(weight or 0)
    if uom in ("pcs", "pkt", "nos", "no"):
        return float(qty or 0)
    return float(qty or 0)


@router.get("/report")
async def get_all_dispatch(
    branch: Optional[List[str]] = Query(None),
    status: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    match_stage = {}

    if branch:
        match_stage["locationId"] = {"$in":branch}
    if status:
        match_stage["status"] = status

    if startDate and endDate:
        try:
            start_dt = datetime.fromisoformat(startDate).date()
            end_dt = datetime.fromisoformat(endDate).date()
            start_iso = datetime.combine(start_dt, time.min).isoformat()
            end_iso = datetime.combine(end_dt + timedelta(days=1), time.min).isoformat()
            match_stage["date"] = {"$gte": start_iso, "$lt": end_iso}
        except Exception:
            return {"error": "Invalid date format. Use YYYY-MM-DD"}

    skip = (page - 1) * limit

    pipeline = [
        {"$match": match_stage},
        {
            "$addFields": {
                "dateObj": {
                    "$dateFromString": {
                        "dateString": "$date",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {
            "$project": {
                "dispatchNumber": 1,
                "date": 1,
                "sentDate": 1,
                "totalAmount": 1,
                "from": 1,
                "towarehouseCode": 1,
                "location": 1,
                "branchName": 1,
                "createdBy": 1,
                "status": 1,
                "items": {
                    "$zip": {
                        "inputs": [
                            "$randomId",
                            "$varianceName",
                            "$uom",
                            "$qty",
                            "$weight",
                            "$price",
                            "$amount",
                            "$category",
                            "$subCategory",
                        ],
                        "useLongestLength": True,
                    }
                },
            }
        },
        {"$unwind": "$items"},
        {
            "$addFields": {
                "itemCode": {"$arrayElemAt": ["$items", 0]},
                "itemName": {"$arrayElemAt": ["$items", 1]},
                "uom": {"$arrayElemAt": ["$items", 2]},
                "rawQty": {"$arrayElemAt": ["$items", 3]},
                "weight": {"$arrayElemAt": ["$items", 4]},
                "price": {"$arrayElemAt": ["$items", 5]},
                "amount": {"$arrayElemAt": ["$items", 6]},
                "category": {"$arrayElemAt": ["$items", 7]},
                "subcategory": {"$arrayElemAt": ["$items", 8]},
                "qty": {
                    "$cond": [
                        {"$gt": [{"$arrayElemAt": ["$items", 4]}, 0]},
                        {"$arrayElemAt": ["$items", 4]},
                        {"$arrayElemAt": ["$items", 3]},
                    ]
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "dispatchNumber": 1,
                "docInternalId": {
                    "$substr": [
                        {"$toString": "$_id"},
                        {"$subtract": [{"$strLenCP": {"$toString": "$_id"}}, 5]},
                        5,
                    ]
                },
                "docDate": {
                    "$dateToString": {
                        "format": "%m-%d-%Y",
                        "date": {
                            "$dateFromString": {
                                "dateString": "$date",
                                "onError": None,
                                "onNull": None,
                            }
                        },
                    }
                },
                "postingDate": {
                    "$dateToString": {
                        "format": "%m-%d-%Y",
                        "date": {
                            "$dateFromString": {
                                "dateString": "$sentDate",
                                "onError": None,
                                "onNull": None,
                            }
                        },
                    }
                },
                "totalAmount": 1,
                "fromWhsCode": "$from",
                "toWhsCode": "$towarehouseCode",
                "location": 1,
                "section": "$branchName",
                "createdBy": 1,
                "status": 1,
                "itemCode": 1,
                "itemName": 1,
                "uom": 1,
                "qty": 1,
                "price": 1,
                "amount": 1,
                "category": 1,
                "subcategory": 1,
            }
        },
        {"$sort": {"dateObj": -1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    data = await collection.aggregate(pipeline).to_list(length=None)
    count_pipeline = pipeline[:-3] + [{"$count": "total"}]
    count_result = await collection.aggregate(count_pipeline).to_list(1)
    total_count = count_result[0]["total"] if count_result else 0

    return {
        "totalCount": total_count,
        "page": page,
        "limit": limit,
        "totalPages": (total_count + limit - 1) // limit,
        "items": data,
    }


# ---------------- Export API ----------------
@router.get("/export")
async def export_dispatch_excel(
    startDate: str = Query(None),
    endDate: str = Query(None),
    branch: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):

    match_stage = {}
    if branch:
        match_stage["locationId"] = {"$in":branch}

    if startDate and endDate:
        start_dt = datetime.fromisoformat(startDate).date()
        end_dt = datetime.fromisoformat(endDate).date()
        start_iso = datetime.combine(start_dt, time.min).isoformat()
        end_iso = datetime.combine(end_dt + timedelta(days=1), time.min).isoformat()
        match_stage["date"] = {"$gte": start_iso, "$lt": end_iso}

    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})

    pipeline.append(
        {
            "$project": {
                "dispatchNumber": 1,
                "date": 1,
                "sentDate": 1,
                "from": 1,
                "towarehouseCode": 1,
                "location": 1,
                "branchName": 1,
                "createdBy": 1,
                "status": 1,
                "totalAmount": 1,
                "varianceName": 1,
                "randomId": 1,
                "uom": 1,
                "qty": 1,
                "price": 1,
                "weight": 1,
                "amount": 1,
                "category": 1,
                "subCategory": 1,
                "hsnCode": 1,
            }
        }
    )

    cursor = collection.aggregate(pipeline, allowDiskUse=True)

    uom_cursor = Uom.find({"status": "active"}, {"_id": 0, "uom": 1, "precision": 1})
    uom_list = await uom_cursor.to_list(length=None)
    uom_precision_map = {u["uom"]: int(u.get("precision", 2)) for u in uom_list}

    output = BytesIO()
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Dispatch Report")

    headers = [
        "Document Number",
        "Document Internal ID",
        "Document Date",
        "Issue_Time",
        "Posting Date",
        "RowID",
        "Item Code",
        "Item Description",
        "UOM",
        "HSN",
        "From Warehouse Code",
        "To Whscode",
        "Location",
        "Quantity",
        "Stock Price",
        "Row Total",
        "Document Total",
        "CreatedBy",
        "Section",
        "Category",
        "Sub Category",
    ]
    ws.append(headers)

    async for d in cursor:
        item_codes = d.get("randomId") or []
        item_names = d.get("varianceName") or []
        uoms = d.get("uom") or []
        qtys = d.get("qty") or []
        prices = d.get("price") or []
        weights = d.get("weight") or []
        amounts = d.get("amount") or []
        hsns = d.get("hsnCode") or []
        category_names = d.get("category") or []
        subcategory_names = d.get("subCategory") or []

        items = zip_longest(
            item_codes,
            item_names,
            uoms,
            qtys,
            prices,
            weights,
            amounts,
            hsns,
            category_names,
            subcategory_names,
            fillvalue=None,
        )

        for row_id, item in enumerate(items, start=1):
            (
                item_code,
                item_name,
                uom,
                qty,
                price,
                weight,
                amount,
                hsn,
                category,
                subcategory,
            ) = item

            final_qty = get_qty_by_uom(uom, qty, weight)
            precision = get_uom_precision(uom, uom_precision_map)
            rounded_qty = round_value(final_qty, precision)

            rounded_price = round_value(price, 2)
            rounded_amount = round_value(amount, 2)
            rounded_total = round_value(d.get("totalAmount", 0), 2)

            ws.append(
                [
                    safe_excel(d.get("dispatchNumber")),
                    safe_excel(str(d.get("_id"))),
                    safe_excel(format_date_only(d.get("date"))),
                    safe_excel(format_time(d.get("date"))),
                    safe_excel(format_date_only(d.get("sentDate"))),
                    row_id,
                    # FIX 1: Use safe_excel for Item Code to keep "PI199" as text
                    # FIX 2: safe_excel now returns "" instead of 0 for missing values
                    safe_excel(item_code), 
                    safe_excel(item_name),
                    safe_excel(uom),
                    safe_excel(hsn), # Changed to safe_excel to return "" instead of 0
                    safe_excel(d.get("from")),
                    safe_excel(d.get("towarehouseCode")),
                    safe_excel(d.get("location")),
                    float(rounded_qty or 0),
                    float(rounded_price or 0),
                    float(rounded_amount or 0),
                    float(rounded_total or 0),
                    safe_excel(d.get("createdBy")),
                    safe_excel(d.get("branchName")),
                    safe_excel(category),
                    safe_excel(subcategory),
                ]
            )

    wb.save(output)
    output.seek(0)

    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"RawMaterialRequest_YenERP_{download_time}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )