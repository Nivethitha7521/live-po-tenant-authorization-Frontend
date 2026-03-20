import math
import re
import io
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import openpyxl
from urllib.parse import unquote_plus
from datetime import datetime, timedelta
from ApInvoiceReport.models import DropdownResponse
from globalsReport.allfuntions import get_item_full_details
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from db.collections import invoices, ItemMaster, salesorder, ItemCategory, ItemSubCategory
from .utils import normalize_text, split_employee_field, split_customer_name

router = APIRouter()


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_apinvoice_endpoint(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    collection = invoices

    # ===================== Dates =====================
    pipeline_dates = [
        {
            "$addFields": {
                "invoiceDateParsed": {
                    "$cond": [
                        {"$eq": [{"$type": "$invoiceDateTime"}, "string"]},
                        {"$dateFromString": {"dateString": "$invoiceDateTime"}},
                        "$invoiceDateTime",
                    ]
                }
            }
        },
        {"$match": {"invoiceDateParsed": {"$ne": None}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$invoiceDateParsed"}},
                "months": {"$addToSet": {"$month": "$invoiceDateParsed"}},
                "days": {"$addToSet": {"$dayOfMonth": "$invoiceDateParsed"}},
            }
        },
    ]

    date_result = await collection.aggregate(pipeline_dates).to_list(1)

    years = sorted(map(str, date_result[0]["years"])) if date_result else []
    months = sorted(f"{m:02d}" for m in date_result[0]["months"]) if date_result else []
    days = sorted(date_result[0]["days"]) if date_result else []

    # ========= Final Response =========
    return DropdownResponse(
        yearIn=years,
        monthIn=months,
        daysIn=days,
    )


# ---------------------------------
# ITEM WISE SALES ENDPOINT
# ---------------------------------
@router.get("/report", response_model=dict)
async def get_itemwisesales_by_date_range(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    branchName: Optional[List[str]] = Query(None),
    salesPersonName: Optional[List[str]] = Query(None),
    customerNo: Optional[List[str]] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    try:
        collection = invoices
        branchwise_collection = ItemMaster
        sales_order_collection = salesorder

        # -----------------------------
        # caches for item/category/subcategory
        # -----------------------------
        item_cache = {}
        category_cache = {}
        subcategory_cache = {}

        # -----------------------------
        # Build Main Query
        # -----------------------------
        query = {}

        if startDate or endDate:
            date_filter = {}
            if startDate:
                date_filter["$gte"] = datetime.fromisoformat(startDate)
            if endDate:
                date_filter["$lte"] = datetime.fromisoformat(endDate) + timedelta(
                    hours=23, minutes=59, seconds=59
                )
            query["invoiceDateTime"] = date_filter

        if branchName:
            query["locationId"] = {"$in": branchName}

        if salesPersonName:
            query["salesPersonName"] = {
                "$in": [re.compile(f"^{re.escape(n)}$", re.I) for n in salesPersonName]
            }

        if customerNo:
            query["customerPhoneNumber"] = {
                "$in": [re.compile(f"^{re.escape(n)}$", re.I) for n in customerNo]
            }

        if varianceName:
          decoded_variances = [unquote_plus(v) for v in varianceName]
          query["varianceitemCode"] = {"$in": decoded_variances}

        projection = {
            "_id": 1,
            "invoiceDateTime": 1,
            "invoiceNo": 1,
            "branchName": 1,
            "salesPersonName": 1,
            "LoginName": 1,
            "salesType": 1,
            "itemName": 1,
            "varianceitemCode": 1,
            "varianceName": 1,
            "price": 1,
            "qty": 1,
            "weight": 1,
            "gstValue": 1,
            "amount": 1,
            "netAmount": 1,
            "uom": 1,
            "customerPhoneNumber": 1,
            "saleOrderNo": 1,
        }

        total_count = await collection.count_documents(query)
        total_pages = max(1, math.ceil(total_count / limit))

        cursor = (
            collection.find(query, projection).skip((page - 1) * limit).limit(limit)
        )

        all_entries = []

        async for doc in cursor:

            raw_bill = doc.get("invoiceDateTime")
            parsed_dt = None

            if isinstance(raw_bill, datetime):
                parsed_dt = raw_bill
            elif isinstance(raw_bill, str):
                try:
                    parsed_dt = datetime.fromisoformat(raw_bill)
                except:
                    try:
                        parsed_dt = datetime.fromisoformat(
                            raw_bill.replace("Z", "+00:00")
                        )
                    except:
                        parsed_dt = None

            bill_date = parsed_dt.strftime("%d-%m-%Y") if parsed_dt else None
            bill_time = parsed_dt.strftime("%H:%M") if parsed_dt else None

            login_name, last_letter = split_employee_field(
                normalize_text(doc.get("LoginName"))
            )
            first_name, last_name = split_customer_name(
                normalize_text(doc.get("salesPersonName"))
            )

            sale_order_no = doc.get("saleOrderNo")

            if not sale_order_no:
                item_codes = doc.get("varianceitemCode") or []
                variance_list = doc.get("varianceName") or []
                item_list = doc.get("itemName") or []

                item_code = item_codes[0] if item_codes else None

                if parsed_dt:
                    filter_query = {
                        "$and": [
                            {"branchName": doc.get("branchName")},
                            {"customerNumber": doc.get("customerPhoneNumber")},
                            {
                                "orderDate": {
                                    "$gte": parsed_dt.replace(
                                        hour=0, minute=0, second=0
                                    ),
                                    "$lte": parsed_dt.replace(
                                        hour=23, minute=59, second=59
                                    ),
                                }
                            },
                            {
                                "$or": [
                                    {"itemCode": item_code},
                                    {"varianceName": {"$in": variance_list}},
                                    {"itemName": {"$in": item_list}},
                                ]
                            },
                        ]
                    }

                    so_doc = await sales_order_collection.find_one(filter_query)
                    if so_doc:
                        sale_order_no = so_doc.get("saleOrderNo")

            # ------------------------------
            # ITEM LOOP
            # ------------------------------
            items = doc.get("itemName") or []
            variance_list = doc.get("varianceName") or []
            item_codes = doc.get("varianceitemCode") or []
            qty_list = doc.get("qty") or []
            weight_list = doc.get("weight") or []
            price_list = doc.get("price") or []
            gst_list = doc.get("gstValue") or []
            amt_list = doc.get("amount") or []

            for idx, item in enumerate(items):

                item_code = item_codes[idx] if idx < len(item_codes) else None

                item_details = await get_item_full_details(
                    item_code=item_code,
                    item_cache=item_cache,
                    category_cache=category_cache,
                    subcategory_cache=subcategory_cache,
                    ItemMaster=branchwise_collection,
                    ItemCategory=ItemCategory,
                    ItemSubCategory=ItemSubCategory,
                )

                category_val = item_details["category_name"]
                subCategory_val = item_details["subcategory_name"]
                hsn_code = item_details["hsn_code"]

                qty_val = qty_list[idx] if idx < len(qty_list) else None
                weight_val = weight_list[idx] if idx < len(weight_list) else None
                final_qty = qty_val if qty_val is not None else weight_val

                price_val = price_list[idx] if idx < len(price_list) else 0
                gst_val = gst_list[idx] if idx < len(gst_list) else 0
                amount_val = amt_list[idx] if idx < len(amt_list) else 0

                net_value = doc.get("netAmount", amount_val - gst_val)

                all_entries.append(
                    {
                        "screenID": doc.get("salesType"),
                        "rowNo": idx + 1,
                        "billDate": bill_date,
                        "billTime": bill_time,
                        "billNo": doc.get("invoiceNo"),
                        "itemCode": item_code,
                        "itemName": (
                            variance_list[idx] if idx < len(variance_list) else None
                        ),
                        "uom": (
                            doc.get("uom")[idx]
                            if "uom" in doc and idx < len(doc["uom"])
                            else None
                        ),
                        "hsn": hsn_code,
                        "categoryName": category_val,
                        "subGroup": subCategory_val,
                        "itemPrice": price_val,
                        "qty": final_qty,
                        "tax": doc.get("tax"),
                        "netValue": net_value,
                        "taxValue": gst_val,
                        "lineTotal": amount_val,
                        "loginID": None,
                        "loginName": login_name,
                        "lastName": last_letter,
                        "branchName": doc.get("branchName"),
                        "customerNo": doc.get("customerPhoneNumber"),
                        "saleOrderNo": sale_order_no,
                        "salesPerson": first_name,
                        "initial": last_name,
                    }
                )

        return {
            "items": all_entries,
            "page": page,
            "limit": limit,
            "total": total_count,
            "total_pages": total_pages,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------
# EXPORT EXCEL ENDPOINT
# ---------------------------------
@router.get("/export")
async def export_itemwisesales_excel(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    branchName: Optional[List[str]] = Query(None),
    salesPersonName: Optional[List[str]] = Query(None),
    customerNo: Optional[List[str]] = Query(None),
    varianceName: Optional[List[str]] = Query(None),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    try:
        collection = invoices
        branchwise_collection = ItemMaster
        sales_order_collection = salesorder

        # -----------------------------
        # caches for item/category/subcategory
        # -----------------------------
        item_cache = {}
        category_cache = {}
        subcategory_cache = {}

        # -----------------------------
        # Collections (YOUR EXISTING ONES)
        # -----------------------------

        # ----------------------------- QUERY BUILD -----------------------------
        query = {}

        if startDate or endDate:
            date_filter = {}
            if startDate:
                date_filter["$gte"] = datetime.fromisoformat(startDate)
            if endDate:
                date_filter["$lte"] = datetime.fromisoformat(endDate) + timedelta(
                    hours=23, minutes=59, seconds=59
                )
            query["invoiceDateTime"] = date_filter

        if branchName:
            query["locationId"] = {"$in": branchName}

        if salesPersonName:
            query["salesPersonName"] = {
                "$in": [re.compile(f"^{re.escape(n)}$", re.I) for n in salesPersonName]
            }

        if customerNo:
            query["customerName"] = {
                "$in": [re.compile(f"^{re.escape(n)}$", re.I) for n in customerNo]
            }

        if varianceName:
            decoded_variances = [unquote_plus(v) for v in varianceName]
            query["varianceitemCode"] = {"$in": decoded_variances}

        cursor = collection.find(query)

        excel_rows = []

        async for doc in cursor:

            raw_bill = doc.get("invoiceDateTime")
            parsed_dt = None

            if isinstance(raw_bill, datetime):
                parsed_dt = raw_bill
            elif isinstance(raw_bill, str):
                try:
                    parsed_dt = datetime.fromisoformat(raw_bill)
                except:
                    try:
                        parsed_dt = datetime.fromisoformat(
                            raw_bill.replace("Z", "+00:00")
                        )
                    except:
                        parsed_dt = None

            bill_date = parsed_dt.strftime("%d-%m-%Y") if parsed_dt else None
            bill_time = parsed_dt.strftime("%H:%M") if parsed_dt else None

            login_name, last_letter = split_employee_field(
                normalize_text(doc.get("LoginName"))
            )
            first_name, last_name = split_customer_name(
                normalize_text(doc.get("salesPersonName"))
            )

            sale_order_no = doc.get("saleOrderNo")

            if not sale_order_no:
                item_codes = doc.get("varianceitemCode") or []
                variance_list = doc.get("varianceName") or []
                item_list = doc.get("itemName") or []

                item_code = item_codes[0] if item_codes else None

                if parsed_dt:
                    filter_query = {
                        "$and": [
                            {"branchName": doc.get("branchName")},
                            {"customerNumber": doc.get("customerPhoneNumber")},
                            {
                                "orderDate": {
                                    "$gte": parsed_dt.replace(
                                        hour=0, minute=0, second=0
                                    ),
                                    "$lte": parsed_dt.replace(
                                        hour=23, minute=59, second=59
                                    ),
                                }
                            },
                            {
                                "$or": [
                                    {"itemCode": item_code},
                                    {"varianceName": {"$in": variance_list}},
                                    {"itemName": {"$in": item_list}},
                                ]
                            },
                        ]
                    }

                    so_doc = await sales_order_collection.find_one(filter_query)
                    if so_doc:
                        sale_order_no = so_doc.get("saleOrderNo")

            # ----------------------------- ITEM LOOP -----------------------------
            items = doc.get("itemName") or []
            variance_list = doc.get("varianceName") or []
            item_codes = doc.get("varianceitemCode") or []
            qty_list = doc.get("qty") or []
            weight_list = doc.get("weight") or []
            price_list = doc.get("price") or []
            gst_list = doc.get("gstValue") or []
            amt_list = doc.get("amount") or []

            for idx, item in enumerate(items):

                item_code = item_codes[idx] if idx < len(item_codes) else None

                item_details = await get_item_full_details(
                    item_code=item_code,
                    item_cache=item_cache,
                    category_cache=category_cache,
                    subcategory_cache=subcategory_cache,
                    ItemMaster=branchwise_collection,
                    ItemCategory=ItemCategory,
                    ItemSubCategory=ItemSubCategory,
                )

                category_val = item_details["category_name"]
                subCategory_val = item_details["subcategory_name"]
                hsn_code = item_details["hsn_code"]

                qty_val = qty_list[idx] if idx < len(qty_list) else None
                weight_val = weight_list[idx] if idx < len(weight_list) else None
                final_qty = qty_val if qty_val is not None else weight_val

                price_val = price_list[idx] if idx < len(price_list) else 0
                gst_val = gst_list[idx] if idx < len(gst_list) else 0
                amount_val = amt_list[idx] if idx < len(amt_list) else 0

                net_value = doc.get("netAmount", amount_val - gst_val)

                excel_rows.append(
                    [
                        doc.get("salesType"),
                        idx + 1,
                        bill_date,
                        bill_time,
                        doc.get("invoiceNo"),
                        item_code,
                        variance_list[idx] if idx < len(variance_list) else None,
                        (
                            doc.get("uom")[idx]
                            if "uom" in doc and idx < len(doc["uom"])
                            else None
                        ),
                        hsn_code,
                        category_val,
                        subCategory_val,
                        price_val,
                        final_qty,
                        None,
                        net_value,
                        gst_val,
                        amount_val,
                        doc.get("LoginID", None),
                        login_name,
                        last_letter,
                        doc.get("branchName"),
                        doc.get("customerPhoneNumber"),
                        sale_order_no,
                        first_name,
                        last_name,
                    ]
                )

        # ----------------------------- CREATE EXCEL -----------------------------
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Sheet1"

        headers = [
            "ScreenID",
            "RowNo",
            "BillDate",
            "BillTime",
            "BillNo",
            "ItemCode",
            "ItemName",
            "Uom",
            "HSN",
            "CategoryName",
            "Sub-Group",
            "ItemPrice",
            "Qty",
            "Tax",
            "NetValue",
            "TaxValue",
            "LineTotal",
            "LoginID",
            "LoginName",
            "lastName",
            "Location",
            "CustomerNo",
            "SalesID",
            "SalesPerson",
            "Initial",
        ]

        ws.append(headers)

        for row in excel_rows:
            ws.append(row)

        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    max_length = max(max_length, len(str(cell.value)))
                except:
                    pass
            ws.column_dimensions[column_letter].width = min(max_length + 2, 50)

        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)

        download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
        filename = f"ItemwiseSales_YenERP_{download_time}.xlsx"
        if startDate and endDate:
            filename += f"_{startDate}_to_{endDate}"
        elif startDate:
            filename += f"_{startDate}"
        elif endDate:
            filename += f"_{endDate}"
        filename += ".xlsx"

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
