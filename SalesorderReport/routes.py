import math
import io
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import pandas as pd
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from ApInvoiceReport.models import DropdownResponse
from .models import SalesOrderReport, PaginatedResponse
from .funtions import (
    split_customer_name,
    normalize_number,
)

from db.collections import salesorder, invoices
from .funtions import (
    normalize_text,
    normalize_date_field,
    split_date_time,
    split_employee_field,
    fmt_date,
)
from datetime import datetime

router = APIRouter()


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_apinvoice_endpoint(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    collection = salesorder

    pipeline_dates = [
        {"$match": {"orderDate": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$orderDate"}},
                "months": {"$addToSet": {"$month": "$orderDate"}},
                "days": {"$addToSet": {"$dayOfMonth": "$orderDate"}},
            }
        },
    ]
    date_result = await collection.aggregate(pipeline_dates).to_list(1)

    years = sorted(map(str, date_result[0]["years"])) if date_result else []
    months = sorted(f"{m:02d}" for m in date_result[0]["months"]) if date_result else []
    days = sorted(date_result[0]["days"]) if date_result else []

    return DropdownResponse(
        yearIn=years,
        monthIn=months,
        daysIn=days,
    )


@router.get("/report", response_model=PaginatedResponse)
async def get_presales_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    startDate: Optional[datetime] = None,
    endDate: Optional[datetime] = None,
    employeeName: Optional[List[str]] = Query(None),
    customerNumber: Optional[List[str]] = Query(None),
    branchName: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    try:
        collection = salesorder
        invoices_collection = invoices

        # ---------------- FILTERS ----------------
        filters = {}

        # FIX: Use $in for multiple employee names (OR logic)
        if employeeName:
            filters["employeeName"] = {"$in": employeeName}

        # FIX: Use $in for multiple customer numbers
        if customerNumber:
            filters["customerNumber"] = {"$in": customerNumber}

        # FIX: Use $in for multiple branch names
        # The input branchName is already a List[str] thanks to Query(None)
        if branchName:
            filters["branchId"] = {"$in": branchName}

        # ---------------- DATE FILTER ----------------
        if startDate or endDate:
            date_filter = {}
            if startDate:
                start = datetime.combine(startDate.date(), datetime.min.time())
                date_filter["$gte"] = start
            if endDate:
                end = datetime.combine(endDate.date(), datetime.max.time())
                date_filter["$lte"] = end
            filters["orderDate"] = date_filter

        # ---------------- PAGINATION ----------------
        skip_amount = (page - 1) * limit

        # ---------------- AGGREGATION PIPELINE ----------------
        pipeline = [
            {"$match": filters},
            {
                "$lookup": {
                    "from": invoices_collection.name,
                    "localField": "saleOrderNo",
                    "foreignField": "saleOrderNo",
                    "as": "invoice_docs",
                }
            },
            {"$unwind": {"path": "$invoice_docs", "preserveNullAndEmptyArrays": True}},
            {"$sort": {"orderDate": -1}},
            {"$skip": skip_amount},
            {"$limit": limit},
        ]

        cursor = collection.aggregate(pipeline)
        results = []

        async for doc in cursor:
            doc["_id"] = str(doc.get("_id"))

            invoice_doc = doc.get("invoice_docs", {})
            invoice_no = invoice_doc.get("invoiceNo")
            raw_invoice = normalize_date_field(invoice_doc.get("invoiceDateTime"))
            bill_date, bill_time = split_date_time(raw_invoice)

            raw_cash = normalize_date_field(doc.get("advanceDateTime"))
            cash_date, cash_time = split_date_time(raw_cash)

            raw_delivery = normalize_date_field(doc.get("deliveryDate"))
            delivery_date, _ = split_date_time(raw_delivery)

            PaymentType = normalize_text(
                normalize_date_field(doc.get("advancePaymentType"))
            )
            advance_amt = normalize_number(doc.get("advanceAmount"))

            final_price = normalize_number(doc.get("finalPrice")) or 0
            discount = normalize_number(doc.get("discountAmount")) or 0
            tax_percent = normalize_number(doc.get("tax")) or 0

            tax_amount = (
                (final_price * tax_percent) / (100 + tax_percent)
                if tax_percent > 0
                else 0
            )
            net_amount = final_price - tax_amount

            emp_id, emp_name = split_employee_field(
                normalize_text(doc.get("employeeName"))
            )
            first_name, last_name = split_customer_name(
                normalize_text(doc.get("customerName"))
            )

            result = SalesOrderReport(
                billDate=bill_date,
                billTime=bill_time,
                cashReciveDate=cash_date,
                cashReciveTime=cash_time,
                deliveryDate=delivery_date,
                billNo=normalize_text(invoice_no) if invoice_no else None,
                headerDocNo=normalize_text(doc.get("saleOrderNo")),
                netAmount=round(float(net_amount), 2),
                discount=discount,
                billTax=round(float(tax_amount), 2),
                billTotalAmount=normalize_text(doc.get("finalPrice") or 0),
                locationName=normalize_text(doc.get("branchName")),
                customerNo=normalize_text(doc.get("customerNumber")),
                firstName=first_name,
                lastName=last_name,
                empID=emp_id,
                SalesPerson=normalize_text(emp_name),
                type=normalize_text(doc.get("status")),
                type1=PaymentType,
                advanceAmount=advance_amt,
            )

            results.append(result)

        # ---------------- TOTAL COUNT ----------------
        totalcount = await collection.count_documents(filters)
        totalpages = math.ceil(totalcount / limit) if totalcount else 0

        return PaginatedResponse(
            totalcount=totalcount,
            totalpages=totalpages,
            page=page,
            limit=limit,
            items=results,
        )

    except Exception as e:
        raise HTTPException(500, f"Internal server error: {e}")


@router.get("/export")
async def export_saleorder_to_excel(
    startDate: Optional[datetime] = None,
    endDate: Optional[datetime] = None,
    employeeName: Optional[List[str]] = Query(None),
    customerNumber: Optional[List[str]] = Query(None),
    branchName: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    try:
        collection = salesorder
        invoices_collection = invoices
        filters = {}

        # ---------------- BASIC FILTERS ----------------
        # FIX: Use $in for multiple values
        if employeeName:
            filters["employeeName"] = {"$in": employeeName}
            
        if customerNumber:
            filters["customerNumber"] = {"$in": customerNumber}
            
        if branchName:
            filters["branchId"] = {"$in": branchName}

        # ---------------- DATE FILTER ----------------
        if startDate and endDate:
            start = datetime.combine(startDate.date(), datetime.min.time())
            end = datetime.combine(endDate.date(), datetime.max.time())
            filters["orderDate"] = {"$gte": start, "$lte": end}

        # ---------------- AGGREGATION PIPELINE ----------------
        pipeline = [
            {"$match": filters},
            {
                "$lookup": {
                    "from": invoices_collection.name,
                    "localField": "saleOrderNo",
                    "foreignField": "saleOrderNo",
                    "as": "invoice_docs",
                }
            },
            {"$unwind": {"path": "$invoice_docs", "preserveNullAndEmptyArrays": True}},
            {"$sort": {"orderDate": -1}},
        ]

        cursor = collection.aggregate(pipeline)
        excel_data = []

        async for doc in cursor:
            sale_order_no = doc.get("saleOrderNo")
            invoice_doc = doc.get("invoice_docs", {})

            invoice_no = invoice_doc.get("invoiceNo")
            raw_invoice = normalize_date_field(invoice_doc.get("invoiceDateTime"))
            bill_date, bill_time = split_date_time(raw_invoice)

            raw_cash = normalize_date_field(doc.get("advanceDateTime"))
            cash_date, cash_time = split_date_time(raw_cash)

            raw_delivery = normalize_date_field(doc.get("deliveryDate"))
            delivery_date, _ = split_date_time(raw_delivery)

            PaymentType = normalize_text(
                normalize_date_field(doc.get("advancePaymentType"))
            )
            advance_amt = normalize_number(doc.get("advanceAmount"))

            final_price = normalize_number(doc.get("finalPrice")) or 0
            discount = normalize_number(doc.get("discountAmount")) or 0
            tax_percent = normalize_number(doc.get("tax")) or 0

            tax_amount = (
                (final_price * tax_percent) / (100 + tax_percent)
                if tax_percent > 0
                else 0
            )
            net_amount = final_price - tax_amount - discount
            if net_amount < 0:
                net_amount = 0

            bill_total = final_price

            emp_id, emp_name = split_employee_field(
                normalize_text(doc.get("employeeName"))
            )
            first_name, last_name = split_customer_name(
                normalize_text(doc.get("customerName"))
            )

            row_data = [
                fmt_date(bill_date) or "",
                bill_time or "",
                fmt_date(delivery_date) or "",
                fmt_date(cash_date) or "",
                cash_time or "",
                normalize_text(invoice_no) if invoice_no else "",
                normalize_text(sale_order_no) or "",
                round(float(net_amount), 2),
                round(float(discount), 2),
                round(float(tax_amount), 2),
                round(float(bill_total), 2),
                normalize_text(doc.get("branchName")) or "",
                normalize_text(doc.get("customerNumber")) or "",
                first_name or "",
                last_name or "",
                emp_id or "",
                normalize_text(emp_name) or "",
                normalize_text(doc.get("status")) or "",
                PaymentType or "",
                round(float(advance_amt), 2) if advance_amt else 0.0,
            ]
            excel_data.append(row_data)

        if not excel_data:
            raise HTTPException(404, "No data found to export")

        headers = [
            "BillDate", "BillTime", "DeliveryDate", "CashReciveDate", "CashReciveTime",
            "BillNo", "HeaderDocNo", "NetAmount", "Discount", "BillTax",
            "Bill Total Amount", "LocationName", "CustomerNo", "firstName", "lastName",
            "empID", "SalesPerson", "Type", "Type1", "RecvAmount",
        ]

        df = pd.DataFrame(excel_data, columns=headers)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Sheet1", index=False)
            worksheet = writer.sheets["Sheet1"]

            numeric_columns = ["NetAmount", "Discount", "BillTax", "Bill Total Amount", "RecvAmount"]
            for col_idx, col_name in enumerate(headers):
                if col_name in numeric_columns:
                    col_letter = chr(65 + col_idx)
                    for row in range(2, len(df) + 2):
                        cell = worksheet[f"{col_letter}{row}"]
                        if cell.value is not None:
                            cell.number_format = "#,##0.00"

            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                worksheet.column_dimensions[column_letter].width = min(max_length + 2, 50)

        output.seek(0)
        download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
        filename = f"SalesOrder_YenERP_{download_time}.xlsx"

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Internal server error: {e}")