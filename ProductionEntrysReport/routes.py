from datetime import datetime, timedelta
import io
import math
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from globalsReport.allfuntions import get_item_full_details, get_qty_by_uom
from .models import PaginatedProductionReport, ProductionReport
from db.collections import (
    productionEntry,
    ItemMaster,
    ItemCategory,
    ItemSubCategory,
    location,
)
from dateutil import parser as date_parser

router = APIRouter()


@router.get("/global-dropdowns")
async def global_dropdowns(
    search: Optional[str] = Query(None), page: int = Query(1), limit: int = Query(20),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):

    skip = (page - 1) * limit

    # ---------------- VARIANCE ----------------
    variance_pipeline = []

    if search:
        variance_pipeline.append(
            {"$match": {"varianceName": {"$regex": search, "$options": "i"}}}
        )

    variance_pipeline.extend(
        [
            {"$group": {"_id": "$varianceName", "itemCode": {"$first": "$itemCode"}}},
            {"$project": {"_id": 0, "label": "$_id", "value": "$itemCode"}},
            {"$sort": {"label": 1}},
            {"$skip": skip},
            {"$limit": limit},
        ]
    )

    variance = await ItemMaster.aggregate(variance_pipeline).to_list(length=limit)

    # ---------------- LOCATION ----------------
    location_pipeline = [{"$match": {"status": "active"}}]

    if search:
        location_pipeline.append(
            {"$match": {"branchName": {"$regex": search, "$options": "i"}}}
        )

    location_pipeline.extend(
        [
            {"$project": {"_id": 0, "label": "$branchName", "value": "$locationId"}},
            {"$sort": {"label": 1}},
            {"$skip": skip},
            {"$limit": limit},
        ]
    )

    locations = await location.aggregate(location_pipeline).to_list(length=limit)

    return {"variance": variance, "locations": locations}


@router.get("/date-dropdown")
async def get_dates_dropdown( user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    pipeline = [
        {"$match": {"type": {"$ne": "SaleOrder"}, "date": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$date"}},
                "months": {"$addToSet": {"$month": "$date"}},
                "days": {"$addToSet": {"$dayOfMonth": "$date"}},
            }
        },
    ]
    result = await productionEntry.aggregate(pipeline).to_list(1)
    years = sorted(map(str, result[0]["years"])) if result else []
    months = sorted(f"{m:02d}" for m in result[0]["months"]) if result else []
    days = sorted(result[0]["days"]) if result else []

    return {
        "years": years,
        "months": months,
        "days": days,
    }


@router.get("/report", response_model=PaginatedProductionReport)
async def get_outgoing_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1),
    createdBy: Optional[List[str]] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None), user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    query = {}
    query["type"] = {"$ne": "SaleOrder"}

    if createdBy:
        query["createdBy"] = {"$in": createdBy}
    
    # This query finds documents where the itemCode array contains the input
    if varianceName:
        query["itemCode"] = {"$in": varianceName}

    if startDate or endDate:
        query["date"] = {}

        def parse_date(date_str, start=True):
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except Exception:
                dt = datetime.strptime(date_str, "%d-%m-%Y")

            if start:
                return dt.replace(hour=0, minute=0, second=0, microsecond=0)
            return dt.replace(hour=23, minute=59, second=59, microsecond=999999)

        if startDate:
            query["date"]["$gte"] = parse_date(startDate, True)
        if endDate:
            query["date"]["$lte"] = parse_date(endDate, False)

    total_items = await productionEntry.count_documents(query)
    total_pages = math.ceil(total_items / limit) if total_items > 0 else 0

    skip = (page - 1) * limit
    cursor = productionEntry.find(query).skip(skip).limit(limit)

    results = []

    item_cache = {}
    category_cache = {}
    subcategory_cache = {}

    async for doc in cursor:

        parsed_date = None
        if isinstance(doc.get("date"), datetime):
            parsed_date = doc["date"]
        elif isinstance(doc.get("date"), str):
            try:
                parsed_date = date_parser.parse(doc["date"])
            except Exception:
                parsed_date = None

        variances = doc.get("varianceName", [])

        for idx, variance in enumerate(variances):

            def safe(field):
                arr = doc.get(field, [])
                return arr[idx] if isinstance(arr, list) and idx < len(arr) else None

            item_code = safe("itemCode")
            
            # FIX: If searching by itemCode, filter the specific row here
            # We check if the current row's item_code matches the input list
            if varianceName:
                if not item_code or item_code.lower() not in [v.lower() for v in varianceName]:
                    continue

            if not item_code:
                continue

            if item_code not in item_cache:
                item_cache[item_code] = await ItemMaster.find_one(
                    {"itemCode": {"$regex": f"^{item_code}$", "$options": "i"}}
                )

            item_doc = item_cache.get(item_code)

            category_name = None
            subcategory_name = None

            if item_doc:
                category_id = item_doc.get("category")
                subcategory_id = item_doc.get("subCategory")

                if category_id:
                    if category_id not in category_cache:
                        category_doc = await ItemCategory.find_one(
                            {"categoryId": category_id}
                        )
                        category_cache[category_id] = (
                            category_doc.get("categoryName") if category_doc else None
                        )
                    category_name = category_cache[category_id]

                if subcategory_id:
                    if subcategory_id not in subcategory_cache:
                        sub_doc = await ItemSubCategory.find_one(
                            {"subCategoryId": subcategory_id}
                        )
                        subcategory_cache[subcategory_id] = (
                            sub_doc.get("subCategoryName") if sub_doc else None
                        )
                    subcategory_name = subcategory_cache[subcategory_id]

            # --------------- Updated Qty based on UOM ---------------
            qty_value, uom_value = get_qty_by_uom(doc, idx)

            lead_time_days = item_doc.get("shelfLife") if item_doc else None
            exp_date = None

            if parsed_date and lead_time_days:
                try:
                    exp_date = (
                        parsed_date + timedelta(days=int(lead_time_days))
                    ).strftime("%d-%m-%y")
                except Exception:
                    exp_date = None

            results.append(
                ProductionReport(
                    productionEntryNumber=doc.get("productionEntryNumber"),
                    lineId=idx + 1,
                    itemCode=item_code,
                    varianceName=variance,
                    category=category_name,
                    subcategory=subcategory_name,
                    qty=qty_value,
                    uom=uom_value,
                    hsnCode=item_doc.get("hsnCode") if item_doc else None,
                    createdBy=doc.get("createdBy"),
                    firstName=doc.get("firstName"),
                    lastName=doc.get("lastName"),
                    date=parsed_date.strftime("%d-%m-%y") if parsed_date else None,
                    productionTime=(
                        parsed_date.strftime("%H:%M") if parsed_date else None
                    ),
                    LeadTime=lead_time_days,
                    ExpDate=exp_date,
                )
            )

            if len(results) >= limit:
                break

        if len(results) >= limit:
            break

    return {
        "items": results,
        "page": page,
        "limit": limit,
        "totalItems": total_items,
        "totalPages": total_pages,
    }


def parse_iso_date(date_str: str, start=True):
    """Parse ISO 8601 date string; raise error if format is invalid."""
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format: {date_str}. Must be ISO 8601 (e.g., 2025-12-13T10:20:14.261+00:00).",
        )
    if start:
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(hour=23, minute=59, second=59, microsecond=999999)


@router.get("/export")
async def export_outgoing_reports_excel(
    createdBy: Optional[List[str]] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None), user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    query = {"type": {"$ne": "SaleOrder"}}

    if createdBy:
        query["createdBy"] = {"$in": createdBy}

    if varianceName:
        query["itemCode"] = {"$in": varianceName}

    if startDate or endDate:
        query["date"] = {}
        if startDate:
            query["date"]["$gte"] = parse_iso_date(startDate, True)
        if endDate:
            query["date"]["$lte"] = parse_iso_date(endDate, False)

    cursor = productionEntry.find(query)

    rows = []

    # 🔥 CACHES
    item_cache = {}
    category_cache = {}
    subcategory_cache = {}

    async for doc in cursor:

        parsed_date = None
        if isinstance(doc.get("date"), datetime):
            parsed_date = doc["date"]
        elif isinstance(doc.get("date"), str):
            try:
                parsed_date = datetime.fromisoformat(doc["date"].replace("Z", "+00:00"))
            except Exception:
                parsed_date = None

        variances = doc.get("varianceName") or []

        for idx, variance in enumerate(variances):

            def safe(field):
                arr = doc.get(field, [])
                return arr[idx] if isinstance(arr, list) and idx < len(arr) else None

            item_code = safe("itemCode")
            
            # FIX: Apply same logic to export
            if varianceName:
                if not item_code or item_code.lower() not in [v.lower() for v in varianceName]:
                    continue

            if not item_code:
                continue

            # ✅ Reusable function call
            details = await get_item_full_details(
                item_code,
                item_cache,
                category_cache,
                subcategory_cache,
                ItemMaster,
                ItemCategory,
                ItemSubCategory,
            )

            item_doc = details["item_doc"]
            category_name = details["category_name"]
            subcategory_name = details["subcategory_name"]
            qty_value, uom_value = get_qty_by_uom(doc, idx)

            lead_time_days = item_doc.get("shelfLife") if item_doc else None
            exp_date = None

            if parsed_date and lead_time_days:
                try:
                    exp_date = (
                        parsed_date + timedelta(days=int(lead_time_days))
                    ).strftime("%m-%d-%y")
                except Exception:
                    exp_date = None

            rows.append(
                {
                    "DocNo": doc.get("productionEntryNumber"),
                    "LineID": idx + 1,
                    "ItemCode": item_code,
                    "ItemName": variance,
                    "Group": category_name,
                    "Sub-Group": subcategory_name,
                    "Qty": qty_value,
                    "Uom": uom_value,
                    "HSN": item_doc.get("hsnCode") if item_doc else None,
                    "CreatedBy": doc.get("createdBy"),
                    "firstName": doc.get("firstName"),
                    "lastName": doc.get("lastName"),
                    "Despatch-Date&Tme": (
                        parsed_date.strftime("%d-%m-%Y %H:%M") if parsed_date else None
                    ),
                    "LeadTime": lead_time_days,
                    "Exp.date": exp_date,
                    "Production Time": (
                        parsed_date.strftime("%H:%M") if parsed_date else None
                    ),
                }
            )

    # Safe DataFrame creation
    df = pd.DataFrame(rows)

    if df.empty:
        df = pd.DataFrame(
            columns=[
                "DocNo",
                "LineID",
                "ItemCode",
                "ItemName",
                "Group",
                "Sub-Group",
                "Qty",
                "Uom",
                "HSN",
                "CreatedBy",
                "firstName",
                "lastName",
                "Despatch-Date&Tme",
                "LeadTime",
                "Exp.date",
                "Production Time",
            ]
        )
    else:
        df = df[
            [
                "DocNo",
                "LineID",
                "ItemCode",
                "ItemName",
                "Group",
                "Sub-Group",
                "Qty",
                "Uom",
                "HSN",
                "CreatedBy",
                "firstName",
                "lastName",
                "Despatch-Date&Tme",
                "LeadTime",
                "Exp.date",
                "Production Time",
            ]
        ]

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="ProductionEntry_YenERP.xlsx"'
        },
    )