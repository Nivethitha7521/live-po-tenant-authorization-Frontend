from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response
from datetime import date, datetime, time
from datetime import datetime
import io
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
import pandas as pd

from ApInvoiceReport.models import DropdownResponse
from .models import PaginatedResponse, ItemOrder
from db.collections import invoices
from .utils import split_customer_name

router = APIRouter()


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_apinvoice_endpoint( user=Depends(validate_token),
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


# ---------------- SAFE ROUND FUNCTION ----------------
def safe_round(value, digits=2):
    try:
        if value is None:
            return 0
        return round(float(value), digits)
    except (TypeError, ValueError):
        return 0


@router.get("/report", response_model=PaginatedResponse)
async def get_item_order_report(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    branchName: Optional[List[str]] = Query(None),
    salesPersonName: Optional[List[str]] = Query(None),
    customerPhoneNumber: Optional[List[str]] = Query(None),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    collection = invoices

    # Build query
    query = {}

    if branchName:
        query["locationId"] = {"$in": branchName}

    if salesPersonName:
        query["salesPersonName"] = {"$in": salesPersonName}

    if customerPhoneNumber:
        query["customerPhoneNumber"] = {"$in": customerPhoneNumber}

    # Date filtering
    if startDate and endDate:
        query["invoiceDateTime"] = {
            "$gte": datetime.combine(startDate, time.min),
            "$lte": datetime.combine(endDate, time.max),
        }
    elif startDate:
        query["invoiceDateTime"] = {"$gte": datetime.combine(startDate, time.min)}
    elif endDate:
        query["invoiceDateTime"] = {"$lte": datetime.combine(endDate, time.max)}

    # Pipeline
    pipeline = []
    if query:
        pipeline.append({"$match": query})

    pipeline.append({"$sort": {"invoiceDateTime": -1}})

    # Count pipeline
    count_pipeline = pipeline.copy()
    count_pipeline.append({"$count": "total"})

    # Pagination
    pipeline.extend([{"$skip": (page - 1) * limit}, {"$limit": limit}])

    try:
        # Count
        total_count = 0
        async for c in collection.aggregate(count_pipeline):
            total_count = c.get("total", 0)
            break

        total_pages = (total_count + limit - 1) // limit
        skip = (page - 1) * limit

        results = []

        async for doc in collection.aggregate(pipeline):

            # Parse datetime
            raw_dt = doc.get("invoiceDateTime")
            dt = raw_dt if isinstance(raw_dt, datetime) else None

            bill_date = dt.strftime("%d-%m-%Y") if dt else None
            bill_time = dt.strftime("%H:%M") if dt else None

            # GST
            gst_list = doc.get("gstValue", [])
            if isinstance(gst_list, list):
                gst_total = sum(v for v in gst_list if isinstance(v, (float, int)))
            else:

                gst_total = gst_list if isinstance(gst_list, (float, int)) else 0
            gst_total = safe_round(gst_total)

            # Split customer name
            first_name, last_name = split_customer_name(doc.get("customerName", ""))

            results.append(
                ItemOrder(
                    billDate=bill_date,
                    billTime=bill_time,
                    billNo=doc.get("invoiceNo", ""),
                    netAmount=safe_round(doc.get("netAmount")),
                    discount=safe_round(doc.get("discountAmount")),
                    billTax=safe_round(gst_total),
                    billTotalAmount=safe_round(doc.get("totalAmount")),
                    locationName=doc.get("branchName", ""),
                    customerNo=doc.get("customerPhoneNumber", ""),
                    firstName=first_name,
                    lastName=last_name,
                    empId=doc.get("salesPersonId", ""),
                    salesPersonName=doc.get("salesPersonName", ""),
                    types=doc.get("salesType", ""),
                )
            )

        return PaginatedResponse(
            totalcount=total_count,
            totalpages=total_pages,
            limit=limit,
            page=page,
            skip=skip,
            items=results,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.get("/export")
async def export_pettycash_reports_from_paginated(
    startDate: Optional[date] = Query(
        None, description="Filter from date (YYYY-MM-DD)"
    ),
    endDate: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    branchName: Optional[List[str]] = Query(None, description="Filter by location"),
    salesPersonName: Optional[List[str]] = Query(
        None, description="Filter by sales person"
    ),
    customerPhoneNumber: Optional[List[str]] = Query(
        None, description="Filter by customer phone"
    ),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    collection = invoices

    # ------------------------
    # Build Query
    # ------------------------
    query = {}

    if branchName:
        query["locationId"] = {"$in": branchName}

    if salesPersonName:
        query["salesPersonName"] = {"$in": salesPersonName}

    if customerPhoneNumber:
        query["customerPhoneNumber"] = {"$in": customerPhoneNumber}

    # Date filter
    if startDate and endDate:
        query["invoiceDateTime"] = {
            "$gte": datetime.combine(startDate, time.min),
            "$lte": datetime.combine(endDate, time.max),
        }
    elif startDate:
        query["invoiceDateTime"] = {"$gte": datetime.combine(startDate, time.min)}
    elif endDate:
        query["invoiceDateTime"] = {"$lte": datetime.combine(endDate, time.max)}

    # Pipeline
    pipeline = []
    if query:
        pipeline.append({"$match": query})
    pipeline.append({"$sort": {"invoiceDateTime": -1}})

    try:
        # ------------------------
        # Fetch Data
        # ------------------------
        results = []
        async for doc in collection.aggregate(pipeline):

            # Handle invoiceDateTime (string or datetime)
            invoice_datetime = doc.get("invoiceDateTime")
            if isinstance(invoice_datetime, str):
                try:
                    invoice_datetime = datetime.fromisoformat(
                        invoice_datetime.replace("Z", "+00:00")
                    )
                except:
                    invoice_datetime = None

            bill_date = (
                invoice_datetime.date().isoformat() if invoice_datetime else None
            )
            bill_time = invoice_datetime.strftime("%H:%M") if invoice_datetime else None

            customer_name = doc.get("customerName", "")
            first_name, last_name = split_customer_name(customer_name)

            # Safe numeric conversions
            def safe_float(v):
                if v in ["", None]:
                    return 0.0
                try:
                    return float(v)
                except:
                    return 0.0

            net_amount = safe_float(doc.get("netAmount"))
            discount_amount = safe_float(doc.get("discountAmount"))
            total_amount = safe_float(doc.get("totalAmount"))
            bill_tax = safe_float(doc.get("taxAmount"))

            # Collect cleaned data
            results.append(
                {
                    "BillDate": bill_date,
                    "BillTime": bill_time,
                    "BillNo": doc.get("invoiceNo", ""),
                    "NetAmount": net_amount,
                    "Discount": discount_amount,
                    "BillTax": bill_tax,
                    "Bill Total Amount": total_amount,
                    "LocationName": doc.get("branchName", ""),
                    "CustomerNo": doc.get("customerPhoneNumber", ""),
                    "firstName": first_name,
                    "lastName": last_name,
                    "empID": doc.get("salesPersonId", 0),
                    "SalesPerson": doc.get("salesPersonName", ""),
                    "Type": doc.get("salesType", ""),
                }
            )

        if not results:
            raise HTTPException(status_code=404, detail="No data found to export")

        # ------------------------
        # Create Excel File
        # ------------------------
        df = pd.DataFrame(results)
        output = io.BytesIO()

        with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
            # Write WITHOUT header → we add styled header manually
            df.to_excel(
                writer, sheet_name="Sheet1", index=False, header=False, startrow=1
            )

            workbook = writer.book
            worksheet = writer.sheets["Sheet1"]

            # Styled header format
            header_format = workbook.add_format(
                {
                    "bold": True,
                    "text_wrap": True,
                    "valign": "top",
                    "border": 1,
                }
            )

            # Write manual header (fix duplicate header issue)
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)

            # Currency formatting
            currency_format = workbook.add_format({"num_format": "#,##0.00"})

            amount_columns = ["NetAmount", "Discount", "BillTax", "Bill Total Amount"]

            for col_num, column_name in enumerate(df.columns):
                if column_name in amount_columns:
                    worksheet.set_column(col_num, col_num, 15, currency_format)
                else:
                    worksheet.set_column(col_num, col_num, 20)

        output.seek(0)
        download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
        filename = f"ItemOrder_YenERP_{download_time}.xlsx"

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating Excel file: {str(e)}"
        )
