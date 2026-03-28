from typing import Dict, Any, List
from datetime import date, datetime, timedelta
from io import BytesIO
from fastapi import APIRouter, HTTPException, Query, Request
from bson import ObjectId
from typing import Optional
from fastapi.responses import StreamingResponse
import pandas as pd
from ApInvoiceReport.models import DropdownResponse
from db.collections import (
    outgoingpayment_collection,
    vendor_collection,
    apInvoice_collection,
    grn_collection
)
from excel import get_vendor_code
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission

router = APIRouter()


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_apinvoice_endpoint(request:Request,user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):

    tenant_id = request.state.tenant_id
    collection = outgoingpayment_collection(tenant_id)
    # === 1. Get Years, Months, Days (fast & simple) ===
    pipeline_dates = [
        {"$match": {"createdDate": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$createdDate"}},
                "months": {"$addToSet": {"$month": "$createdDate"}},
                "days": {"$addToSet": {"$dayOfMonth": "$createdDate"}},
            }
        },
    ]
    date_result = await collection.aggregate(pipeline_dates).to_list(1)

    years = sorted(map(str, date_result[0]["years"])) if date_result else []
    months = sorted(f"{m:02d}" for m in date_result[0]["months"]) if date_result else []
    days = sorted(date_result[0]["days"]) if date_result else []

    # === Return ===
    return DropdownResponse(
        yearIn=years,
        monthIn=months,
        daysIn=days,
    )


def serialize_doc(doc: dict) -> dict:
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc



@router.get("/report", summary="Outgoing Payment Report Data (Fast)")
async def get_outgoing_reports_fast(request:Request,
    invoiceNo: Optional[str] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    collection = outgoingpayment_collection(tenant_id)
    try:
       

        # Build query filters
        query = {"status": {"$in": ["Fully Paid", "Partially Paid"]}}
        if invoiceNo:
            query["invoiceNo"] = invoiceNo
        if vendorName:
            query["vendorName"] = {"$in": vendorName}
        if startDate or endDate:
            date_filter = {}
            if startDate:
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                date_filter["$gte"] = start_dt
            if endDate:
                end_dt = datetime(
                    endDate.year, endDate.month, endDate.day
                ) + timedelta(days=1)
                date_filter["$lt"] = end_dt
            query["createdDate"] = date_filter

        skip = (page - 1) * limit

        # Aggregation pipeline
        pipeline = [
            {"$match": query},
            {"$sort": {"createdDate": 1}},
            {"$skip": skip},
            {"$limit": limit},
            # Convert invoiceId string → ObjectId for correct lookup
            {
                "$addFields": {
                    "invoiceIdObj": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$ne": ["$invoiceId", None]},
                                    {"$ne": ["$invoiceId", ""]},
                                ]
                            },
                            {"$toObjectId": "$invoiceId"},
                            None,
                        ]
                    }
                }
            },
            # Lookup vendor
            {
                "$lookup": {
                    "from": "vendor",
                    "localField": "vendorName",
                    "foreignField": "vendorName",
                    "as": "vendor",
                }
            },
            {"$unwind": {"path": "$vendor", "preserveNullAndEmptyArrays": True}},
            # Lookup AP Invoice
            {
                "$lookup": {
                    "from": "apInvoice",
                    "localField": "invoiceIdObj",
                    "foreignField": "_id",
                    "as": "apinvoice",
                }
            },
            {"$unwind": {"path": "$apinvoice", "preserveNullAndEmptyArrays": True}},
        ]

        docs = await collection.aggregate(pipeline).to_list(length=limit)

        def fmt_date(dt):
            return (
                dt.strftime("%m-%d-%Y")
                if isinstance(dt, datetime)
                else "" if dt is None else str(dt)
            )

        records = []
        for doc in docs:
            # Internal number
            internal_no = str(doc.get("outgoingId") or doc.get("_id"))

            # Payment info
            payment_entry = doc.get("paymentHistory", [{}])[0]
            payment_mode = (doc.get("paymentMode") or "Bank").lower()
            mode_of_payment = "Cash" if payment_mode == "cash" else "Bank"

            payment_ref2_raw = (
                payment_entry.get("neftNo")
                or payment_entry.get("rtgsNo")
                or payment_entry.get("impsNo")
            )
            try:
                payment_ref2 = int(payment_ref2_raw) if payment_ref2_raw else None
            except:
                payment_ref2 = None

            # Vendor code
            vendor_doc = doc.get("vendor", {})
            vendor_code = get_vendor_code(vendor_doc)

            # AP Invoice info
            apinvoice_doc = doc.get("apinvoice", {})
            randomId = apinvoice_doc.get("randomId")
            invoiceDate_raw = apinvoice_doc.get("invoiceDate")
            invoiceDate = None
            if isinstance(invoiceDate_raw, datetime):
                invoiceDate = invoiceDate_raw
            elif isinstance(invoiceDate_raw, str):
                try:
                    invoiceDate = datetime.fromisoformat(
                        invoiceDate_raw.replace("Z", "").replace("T", " ")
                    )
                except:
                    invoiceDate = None

            record = {
                "internalNo": internal_no,
                "postingDate": fmt_date(doc.get("outgoingDate")),
                "createDate": fmt_date(doc.get("createdDate")),
                "paymentNum": doc.get("randomId"),
                "documentType": "AP Invoice",
                "invoiceNo": randomId,  # <-- Fixed
                "invoiceDate": fmt_date(invoiceDate),  # <-- Fixed
                "vendorCode": vendor_code,
                "vendorName": doc.get("vendorName"),
                "invoiceAmount": doc.get("paidAmount", 0),
                "paymentDate": fmt_date(doc.get("paymentDate")),
                "paymentAmount": doc.get("paidAmount", 0),
                "modeofPayment": mode_of_payment,
                "paymentRef2": payment_ref2,
                "invoiceRef": doc.get("invoiceNo"),
                "chequeNo": doc.get("chequeNo"),
            }
            records.append(record)

        total_count = await collection.count_documents(query)
        total_pages = (total_count + limit - 1) // limit

        return {
            "items": records,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_records": total_count,
                "totalPages": total_pages,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
 
@router.get("/export", summary="Export Outgoing Payment Report to Excel")
async def export_outgoing_reports(request:Request,
    invoiceNo: Optional[str] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    collection = outgoingpayment_collection(tenant_id)
    try:
        query = {"status": {"$in": ["Fully Paid", "Partially Paid"]}}

        if invoiceNo:
            query["invoiceNo"] = invoiceNo
        if vendorName:
            query["vendorName"] = {"$in":vendorName}

        if startDate or endDate:
            if startDate and endDate and startDate.date() == endDate.date():
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                end_dt = start_dt + timedelta(days=1)
                query["createdDate"] = {"$gte": start_dt, "$lt": end_dt}
            elif startDate and endDate:
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                end_dt = datetime(
                    endDate.year, endDate.month, endDate.day
                ) + timedelta(days=1)
                query["createdDate"] = {"$gte": start_dt, "$lt": end_dt}
            elif startDate:
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                end_dt = start_dt + timedelta(days=1)
                query["createdDate"] = {"$gte": start_dt, "$lt": end_dt}
            elif endDate:
                end_dt = datetime(
                    endDate.year, endDate.month, endDate.day
                ) + timedelta(days=1)
                query["createdDate"] = {"$lt": end_dt}

        pipeline = [
            {"$match": query},
            # Vendor lookup
            {
                "$lookup": {
                    "from": "vendor",
                    "localField": "vendorName",
                    "foreignField": "vendorName",
                    "as": "vendor",
                }
            },
            {"$unwind": {"path": "$vendor", "preserveNullAndEmptyArrays": True}},
            # AP Invoice lookup
            {
                "$lookup": {
                    "from": "apInvoice",
                    "let": {"invoiceId": "$invoiceId"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$eq": ["$_id", {"$toObjectId": "$$invoiceId"}]
                                }
                            }
                        }
                    ],
                    "as": "apinvoice",
                }
            },
            {"$unwind": {"path": "$apinvoice", "preserveNullAndEmptyArrays": True}},
            {"$sort": {"createdDate": 1}},
        ]

        docs = await collection.aggregate(pipeline).to_list(length=None)

        if not docs:
            raise HTTPException(status_code=404, detail="No records found for export")

        def fmt_date(dt):
            if isinstance(dt, datetime):
                return dt.strftime("%m-%d-%Y")
            return "" if dt is None else str(dt)

        rows = []
        for doc in docs:
            payment_entry = doc.get("paymentHistory", [{}])[0]

            payment_mode = (doc.get("paymentMode") or "Bank").lower()
            mode_of_payment = "Cash" if payment_mode == "cash" else "Bank"

            payment_ref2_raw = (
                payment_entry.get("neftNo")
                or payment_entry.get("rtgsNo")
                or payment_entry.get("impsNo")
                or None
            )

            try:
                payment_ref2 = int(payment_ref2_raw) if payment_ref2_raw else None
            except:
                payment_ref2 = None

            # Use sapVendorCode if exists, else fallback to vendor randomId
            vendor_doc = doc.get("vendor", {})
            sapVendorCode = get_vendor_code(vendor_doc)

            randomId = doc.get("apinvoice", {}).get("randomId")
            invoiceDate_raw = doc.get("apinvoice", {}).get("invoiceDate")

            invoiceDate = None
            if isinstance(invoiceDate_raw, (datetime, date)):
                invoiceDate = invoiceDate_raw
            elif isinstance(invoiceDate_raw, str):
                try:
                    invoiceDate = datetime.fromisoformat(
                        invoiceDate_raw.replace("Z", "").replace("T", " ")
                    )
                except:
                    invoiceDate = None

            rows.append(
                [
                    str(doc.get("outgoingId") or doc.get("_id")),
                    fmt_date(doc.get("outgoingDate")),
                    fmt_date(doc.get("createdDate")),
                    doc.get("randomId"),
                    "AP Invoice",
                    randomId,
                    fmt_date(invoiceDate),
                    sapVendorCode,  # Cus/Sup Code (works now)
                    doc.get("vendorName"),
                    doc.get("paidAmount", 0),
                    None,
                    fmt_date(doc.get("paymentDate")),
                    doc.get("paidAmount", 0),
                    mode_of_payment,
                    payment_ref2,
                    doc.get("invoiceNo"),
                    doc.get("chequeNo"),
                ]
            )

        columns = [
            "Internal No",
            "Posting Date",
            "Create Date",
            "Payment Num",
            "Document Type",
            "Cus/Sup Invoice No",
            "Cus/Sup Invoice Date",
            "Cus/Sup Code",
            "Cus/Sup Name",
            "Cus/Sup Invoice Amount",
            "Payment Ref",
            "Payment Date",
            "Payment Amount",
            "Mode Of Payment",
            "Payment Ref",
            "Cus/Sup Invoice Ref",
            "Check No",
        ]

        df = pd.DataFrame(rows, columns=columns)

        # Don't convert Cus/Sup Code to numeric
        df["Cus/Sup Invoice Amount"] = pd.to_numeric(
            df["Cus/Sup Invoice Amount"], errors="coerce"
        )
        df["Payment Amount"] = pd.to_numeric(df["Payment Amount"], errors="coerce")
        df.iloc[:, 10] = pd.to_numeric(df.iloc[:, 10], errors="coerce")
        df.iloc[:, 14] = pd.to_numeric(df.iloc[:, 14], errors="coerce")

        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Sheet1")

        output.seek(0)
        filename = (
            f"OutgoingPayment_YenERP_{datetime.now().strftime('%d-%m-%Y_%H-%M')}.xlsx"
        )
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    
   
@router.get("/Outstanding/report", summary="Outstanding Report Data (Fast)")
async def get_outgoing_payments_fast(request:Request,
    vendorName: Optional[List[str]] = Query(None),
    invoiceNo: Optional[str] = Query(None),
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    payment_collection = outgoingpayment_collection(tenant_id)
    try:
       

        # Build filters
        filters = {"status": {"$nin": ["Returned", "Fully Paid"]}}
        if vendorName:
            filters["vendorName"] = {"$in": vendorName}
        if invoiceNo:
            filters["invoiceNo"] = {"$regex": invoiceNo, "$options": "i"}
        if startDate or endDate:
            date_filter = {}
            if startDate:
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                date_filter["$gte"] = start_dt
            if endDate:
                end_dt = datetime(
                    endDate.year, endDate.month, endDate.day
                ) + timedelta(days=1)
                date_filter["$lt"] = end_dt
            filters["apinvoiceDate"] = date_filter

        skip = (page - 1) * limit

        pipeline = [
            {"$match": filters},
            {"$sort": {"apinvoiceDate": 1}},
            {"$skip": skip},
            {"$limit": limit},
            # Join vendor once
            {
                "$lookup": {
                    "from": "vendor",
                    "localField": "vendorName",
                    "foreignField": "vendorName",
                    "as": "vendor",
                }
            },
            {"$unwind": {"path": "$vendor", "preserveNullAndEmptyArrays": True}},
            # Join AP Invoice once
            {
                "$lookup": {
                    "from": "apInvoice",
                    "localField": "apRandomId",
                    "foreignField": "randomId",
                    "as": "apinvoice",
                }
            },
            {"$unwind": {"path": "$apinvoice", "preserveNullAndEmptyArrays": True}},
        ]

        docs = await payment_collection.aggregate(pipeline).to_list(length=limit)

        def fmt_date(dt):
            return (
                dt.strftime("%m-%d-%Y")
                if isinstance(dt, datetime)
                else "" if dt is None else str(dt)
            )

        rows = []
        for payment in docs:
            vendor_doc = payment.get("vendor", {})
            vendor_code = get_vendor_code(vendor_doc)
            gst_number = (
                vendor_doc.get("gstNumber") if vendor_doc else payment.get("gstNumber")
            )
            gst_bos = (
                "GST"
                if gst_number and str(gst_number).strip().upper() not in ["NULL"]
                else "BOS"
            )
            item_service = (
                "I"
                if any(i.get("itemName") for i in payment.get("itemDetails", []) if i)
                else None
            )

            payment_method = (payment.get("paymentMethod") or "").upper()
            specific_no = None
            if payment_method in ["NEFT", "RTGS", "IMPS", "CHEQUE"]:
                key_map = {
                    "NEFT": "neftNo",
                    "RTGS": "rtgsNo",
                    "IMPS": "impsNo",
                    "CHEQUE": "chequeNo",
                }
                val = payment.get(key_map[payment_method])
                if val:
                    try:
                        specific_no = int(val)
                    except:
                        specific_no = val

            net_amount = (payment.get("payableAmount") or 0) - (
                payment.get("taxDetails") or 0
            )
            gross_amount = payment.get("payableAmount") or 0
            total_paid_amount = payment.get("paidAmount") or 0
            outstanding = payment.get("totalPayableAmount") or 0

            row_data = {
                "grpoNo": payment.get("grnRandomId"),
                "grpoDate": fmt_date(payment.get("grnDate")),
                "apinvoiceDate": fmt_date(payment.get("apinvoiceDate")),
                "apinvoiceNo": payment.get("apRandomId"),
                "gstBos": gst_bos,
                "itemService": item_service,
                "userName": payment.get("poCreatedPerson")
                or payment.get("apCreatedPerson"),
                "vendorRefno": payment.get("invoiceNo"),
                "vendorCode": vendor_code,
                "VendorName": payment.get("vendorName"),
                "billTo": payment.get("billingAddress"),
                "gstNo": gst_number,
                "netAmount": net_amount,
                "taxAmount": payment.get("taxDetails"),
                "GrossAmount": gross_amount,
                "paymentNo": specific_no,
                "paymentDate": fmt_date(payment.get("paymentDate")),
                "paymentAmount": payment.get("paidAmount"),
                "type": payment_method,
                "totalpaidAmount": total_paid_amount,
                "outstanding": outstanding,
            }
            rows.append(row_data)

        total_records = await payment_collection.count_documents(filters)
        total_pages = (total_records + limit - 1) // limit

        return {
            "items": rows,
            "page": page,
            "limit": limit,
            "total": total_records,
            "totalPages": total_pages,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.get("/Outstanding/export", summary="Export Full Outstanding Report to Excel")
async def export_outstanding_reports(request:Request,
    vendorName: Optional[List[str]] = Query(None, description="Filter by vendor name"),
    startDate: Optional[datetime] = Query(
        None, description="Filter from AP invoice date (start)"
    ),
    endDate: Optional[datetime] = Query(
        None, description="Filter to AP invoice date (end)"
    ),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id

    try:
        # Get collections
       
        payment_collection = outgoingpayment_collection(tenant_id)
        apinvoice_collection = apInvoice_collection(tenant_id)
        grn_col = grn_collection(tenant_id)
        vendor_col = vendor_collection(tenant_id)
        # Build filters
        filters: Dict[str, Any] = {}

        filters["status"] = {"$nin": ["Returned", "Fully Paid"]}
        if vendorName:
            filters["vendorName"] = {"$in": vendorName}

        # Single day or range filter
        if startDate or endDate:
            if startDate and endDate and startDate.date() == endDate.date():
                # Single day
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                end_dt = start_dt + timedelta(days=1)
                filters["apinvoiceDate"] = {"$gte": start_dt, "$lt": end_dt}
            elif startDate and endDate:
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                end_dt = datetime(
                    endDate.year, endDate.month, endDate.day
                ) + timedelta(days=1)
                filters["apinvoiceDate"] = {"$gte": start_dt, "$lt": end_dt}
            elif startDate:
                start_dt = datetime(startDate.year, startDate.month, startDate.day)
                end_dt = start_dt + timedelta(days=1)
                filters["apinvoiceDate"] = {"$gte": start_dt, "$lt": end_dt}
            elif endDate:
                end_dt = datetime(
                    endDate.year, endDate.month, endDate.day
                ) + timedelta(days=1)
                filters["apinvoiceDate"] = {"$lt": end_dt}

        # Fetch payments
        cursor = payment_collection.find(filters)
        payments = await cursor.to_list(length=None)
        if not payments:
            raise HTTPException(status_code=404, detail="No records found for export")

        # Batch fetch vendors, AP invoices, GRNs
        vendor_names = list(
            {p.get("vendorName") for p in payments if p.get("vendorName")}
        )
        vendors = await vendor_col.find(
            {"vendorName": {"$in": vendor_names}}
        ).to_list(length=None)
        vendor_map = {v["vendorName"]: v for v in vendors}

        ap_random_ids = [p.get("apRandomId") for p in payments if p.get("apRandomId")]
        aps = await apinvoice_collection.find(
            {"randomId": {"$in": ap_random_ids}}
        ).to_list(length=None)
        ap_map = {a["randomId"]: a for a in aps}

        grn_random_ids = [
            p.get("grnRandomId") for p in payments if p.get("grnRandomId")
        ]
        grns = await grn_collection.find({"randomId": {"$in": grn_random_ids}}).to_list(
            length=None
        )
        grn_map = {g["randomId"]: g for g in grns}

        # Helper to format dates
        def fmt_date(dt):
            if isinstance(dt, datetime):
                return dt.strftime("%m-%d-%Y")
            return "" if dt is None else str(dt)

        rows = []
        for payment in payments:
            vendor_doc = vendor_map.get(payment.get("vendorName"))

            vendor_code = get_vendor_code(vendor_doc)

            gst_number = (
                vendor_doc.get("gstNumber") if vendor_doc else payment.get("gstNumber")
            )
            gst_bos = (
                "GST"
                if gst_number and str(gst_number).strip().upper() != "NULL"
                else "BOS"
            )

            # Item/Service
            item_details = payment.get("itemDetails", [])
            item_service = (
                "I"
                if any(item.get("itemName") for item in item_details if item)
                else None
            )

            # Payment method and reference number
            payment_method_lower = (payment.get("paymentMethod") or "").lower()
            specific_no = None
            if payment_method_lower in ["neft", "rtgs", "imps", "cheque"]:
                key_map = {
                    "neft": "neftNo",
                    "rtgs": "rtgsNo",
                    "imps": "impsNo",
                    "cheque": "chequeNo",
                }
                raw_no = payment.get(key_map[payment_method_lower])
                if raw_no is not None:
                    try:
                        specific_no = int(raw_no)
                    except ValueError:
                        specific_no = raw_no

            net_amount = (payment.get("payableAmount") or 0) - (
                payment.get("taxDetails") or 0
            )
            gross_amount = payment.get("payableAmount") or 0
            total_paid_amount = payment.get("paidAmount") or 0
            outstanding = payment.get("totalPayableAmount") or 0
            user_name = (
                payment.get("poCreatedPerson") or payment.get("apCreatedPerson") or None
            )
            vendor_ref_no = payment.get("invoiceNo")

            rows.append(
                {
                    "GRPO_NO": payment.get("grnRandomId"),
                    "GRPO_DATE": fmt_date(payment.get("grnDate")),
                    "A/P_INVOICE_DATE": fmt_date(payment.get("apinvoiceDate")),
                    "A/P_INVOICE_NO": payment.get("apRandomId"),
                    "GST/BOS": gst_bos,
                    "ITEM/SERVICE": item_service,
                    "USER NAME": user_name,
                    "VENDOR_REF_NO": vendor_ref_no,
                    "VENDOR_CODE": vendor_code,
                    "VENDOR_NAME": payment.get("vendorName"),
                    "Bill to": payment.get("billingAddress"),
                    "GST_NO": gst_number,
                    "NET_AMOUNT": net_amount,
                    "TAX_AMOUNT": payment.get("taxDetails"),
                    "GROSS_AMOUNT": gross_amount,
                    "PAYMENT NO": specific_no,
                    "PAYMENT DATE": fmt_date(payment.get("paymentDate")),
                    "PAYMENT AMOUNT": payment.get("paidAmount"),
                    "Type": payment_method_lower.upper(),
                    "TOTAL PAID AMOUNT": total_paid_amount,
                    "OUTSTANDING": outstanding,
                }
            )

        # Export to Excel
        df = pd.DataFrame(rows)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
            df.to_excel(writer, index=False, sheet_name="Sheet1")
            worksheet = writer.sheets["Sheet1"]
            for i, col in enumerate(df.columns):
                max_length = max(df[col].astype(str).map(len).max(), len(col))
                worksheet.set_column(i, i, min(max_length + 2, 50))

        output.seek(0)
        download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
        file_name = f"VendorOutstanding_YenERP_{download_time}.xlsx"
        headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

