import asyncio
from datetime import datetime, timedelta
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from excel import get_vendor_code, resolve_raw_material
from .models import DropdownResponse, ReportApItem
import pandas as pd
from fastapi.responses import StreamingResponse
from io import BytesIO
from .utils import (
    str_to_int,
)

from db.collections import vendor, apInvoice, purchaseorder, rawMaterials


router = APIRouter()

rawMaterials = rawMaterials


def fmt_date(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%m-%d/%Y")  # MM-DD/YYYY
    return dt or ""


@router.get(
    "/date-dropdown", response_model=DropdownResponse, summary="Ap Invoice Report Dropdown"
)
async def get_apinvoice_endpoint(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):

    collection = apInvoice

    # === 1. Get Years, Months, Days (fast & simple) ===
    pipeline_dates = [
        {"$match": {"invoiceDate": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$invoiceDate"}},
                "months": {"$addToSet": {"$month": "$invoiceDate"}},
                "days": {"$addToSet": {"$dayOfMonth": "$invoiceDate"}},
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


@router.get(
    "/report", summary="AP Invoice Report Data (Line-Item with Scroll Compatible)"
)
async def get_all_apinvoices_lineitem_scroll(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    invoiceNo: Optional[List[str]] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    collection = apInvoice
    vendor_collection = vendor
    purchaseorder_collection = purchaseorder

    # ----------------------------
    # Vendor mapping
    # ----------------------------
    vendor_map = {}
    async for v in vendor_collection.find(
        {}, {"vendorName": 1, "randomId": 1, "sapVendorCode": 1, "_id": 0}
    ):
        vendor_map[v["vendorName"]] = v

    # ----------------------------
    # PO location mapping
    # ----------------------------
    po_location_map = {}
    async for po in purchaseorder_collection.find(
        {}, {"randomId": 1, "locationName": 1, "_id": 0}
    ):
        po_random_id = po.get("randomId")
        location_name = po.get("locationName")
        if po_random_id and location_name:
            po_location_map[po_random_id] = location_name

    # ----------------------------
    # Raw Material mapping
    # ----------------------------
    raw_by_random, raw_by_code, raw_by_name = {}, {}, {}
    async for raw in rawMaterials.find(
        {},
        {
            "randomId": 1,
            "itemCode": 1,
            "itemName": 1,
            "hsnCode": 1,
            "purchasecategoryName": 1,
            "purchasesubcategoryName": 1,
            "_id": 0,
        },
    ):
        if raw.get("randomId"):
            raw_by_random[raw["randomId"]] = raw
        if raw.get("itemCode"):
            raw_by_code[str(raw["itemCode"])] = raw
        if raw.get("itemName"):
            raw_by_name[raw["itemName"]] = raw

    # ----------------------------
    # Query filters
    # ----------------------------
    query = {}
    if startDate or endDate:
        date_range_filter = {}
        if startDate:
            date_range_filter["$gte"] = datetime.combine(
                startDate.date(), datetime.min.time()
            )
        if endDate:
            date_range_filter["$lte"] = datetime.combine(
                endDate.date(), datetime.max.time()
            )
        query["invoiceDate"] = date_range_filter

    if invoiceNo:
        query["invoiceNo"] = {"$in": invoiceNo}
    if vendorName:
        query["vendorName"] = {"$in": vendorName}

    # ----------------------------
    # Invoice-level pagination (Scroll compatible)
    # ----------------------------
    skip = (page - 1) * limit
    total_count = await collection.count_documents(query)
    docs = (
        await collection.find(query)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )

    # ----------------------------
    # Flatten items per invoice
    # ----------------------------
    all_items = []
    for doc in docs:
        v_name = doc.get("vendorName")
        vendor_doc = vendor_map.get(v_name)
        v_id = vendor_doc.get("randomId") if vendor_doc else None
        vendor_code = get_vendor_code(vendor_doc)
        po_random_id = doc.get("poRandomId")
        location_name = po_location_map.get(po_random_id) if po_random_id else None
        item_details = doc.get("itemDetails", [])

        # No items case
        if not item_details:
            all_items.append(
                ReportApItem(
                    createdDate=fmt_date(doc.get("createdDate")),
                    invoiceNo=doc.get("invoiceNo"),
                    invoiceDate=fmt_date(doc.get("invoiceDate")),
                    vendorName=v_name,
                    vendorId=v_id,
                    poRandomId=po_random_id,
                    sapVendorCode=vendor_code,
                    shippingAddress=doc.get("shippingAddress"),
                    locationName=location_name,
                    apInvoice_id=str(doc.get("_id")),
                )
            )
        else:
            for item in item_details:
                resolved = resolve_raw_material(
                    item, raw_by_random, raw_by_code, raw_by_name
                )
                raw_doc = resolved.get("info", {})
                itemCode = resolved.get("display_code")
                hsnCode = raw_doc.get("hsnCode")
                purchasecategoryName = raw_doc.get("purchasecategoryName")
                purchasesubcategoryName = raw_doc.get("purchasesubcategoryName")

                # Tax calculation
                unit_price = float(item.get("unitPrice") or 0)
                quantity = float(item.get("quantity") or 0)
                base_price = unit_price * quantity
                tax_percentage = float(item.get("purchasetaxName") or 0)
                tax_type = item.get("taxType") or "cgst_sgst"
                cgst = sgst = igst = 0
                if tax_type == "cgst_sgst":
                    cgst = sgst = tax_percentage / 2
                elif tax_type == "igst":
                    igst = tax_percentage
                gst_calculated = round(cgst + sgst + igst, 2)
                cgst_amount = round(base_price * (cgst / 100), 2)
                sgst_amount = round(base_price * (sgst / 100), 2)
                igst_amount = round(base_price * (igst / 100), 2)
                total_gst_amount = round(cgst_amount + sgst_amount + igst_amount, 2)

                all_items.append(
                    ReportApItem(
                        randomId=doc.get("randomId"),
                        apInvoice_id=str(doc.get("_id")),
                        createdDate=fmt_date(doc.get("createdDate")),
                        invoiceNo=doc.get("invoiceNo"),
                        invoiceDate=fmt_date(doc.get("invoiceDate")),
                        vendorName=v_name,
                        vendorId=v_id,
                        poRandomId=po_random_id,
                        grnRandomId=doc.get("grnRandomId"),
                        shippingAddress=doc.get("shippingAddress"),
                        locationName=location_name,
                        sapVendorCode=vendor_code,
                        finalPrice=float(item.get("finalPrice") or 0),
                        totalGst=round(cgst + sgst + igst, 2),
                        gstCalculated=gst_calculated,
                        totalGstAmount=total_gst_amount,
                        itemCode=itemCode,
                        hsnCode=hsnCode,
                        itemName=item.get("itemName"),
                        unitPrice=unit_price,
                        purchasecategoryName=purchasecategoryName,
                        purchasesubcategoryName=purchasesubcategoryName,
                        quantity=quantity,
                        sgst=round(sgst, 2),
                        cgst=round(cgst, 2),
                        igst=round(igst, 2),
                        totalPrice=float(item.get("totalPrice") or 0),
                        discountAmount=float(item.get("discountAmount") or 0),
                        befTaxDiscount=item.get("befTaxDiscount"),
                        befTaxDiscountAmount=float(
                            item.get("befTaxDiscountAmount") or 0
                        ),
                        debitAfterSgstAmount=sgst_amount,
                        debitAfterCgstAmount=cgst_amount,
                        debitAfterIgstAmount=igst_amount,
                        taxAmount=total_gst_amount,
                        taxType=tax_type,
                        purchasetaxName=item.get("purchasetaxName"),
                    )
                )

    return {
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "totalPages": (total_count + limit - 1) // limit,
        "items": all_items,
    }


@router.get("/export", summary="Export AP Invoice Report Excel")
async def export_ap_reports_full(
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    query = {}

    # Date filter
    if startDate and endDate:
        query["invoiceDate"] = {"$gte": startDate, "$lt": endDate + timedelta(days=1)}
    elif startDate:
        query["invoiceDate"] = {"$gte": startDate}
    elif endDate:
        query["invoiceDate"] = {"$lt": endDate + timedelta(days=1)}

    # Vendor filter
    if vendorName:
        query["vendorName"] = {"$in": vendorName}

    try:
        # Collections
        ap_collection = apInvoice
        vendor_collection = vendor
        raw_collection = rawMaterials
        po_collection = purchaseorder

        # Step 1: Fetch filtered APs
        aps_task = ap_collection.find(query).to_list(length=None)
        aps = await aps_task

        if not aps:
            output = BytesIO()
            pd.DataFrame().to_excel(output, index=False, sheet_name="Sheet1")
            output.seek(0)
            headers = {
                "Content-Disposition": 'attachment; filename="ap_invoice_full_report.xlsx"'
            }
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers=headers,
            )

        # Step 2: Extract uniques for targeted lookups
        unique_vendors = set(ap.get("vendorName") for ap in aps if ap.get("vendorName"))
        unique_po_ids = set(ap.get("poRandomId") for ap in aps if ap.get("poRandomId"))
        unique_items = set(
            item.get("itemName")
            for ap in aps
            for item in (ap.get("itemDetails", []) or [])
        )

        # Step 3: Fetch relevant lookup data concurrently
        vendors_task = vendor_collection.find(
            {"vendorName": {"$in": list(unique_vendors)}}
        ).to_list(length=None)
        pos_task = po_collection.find(
            {"randomId": {"$in": list(unique_po_ids)}}
        ).to_list(length=None)
        raws_task = raw_collection.find(
            {"itemName": {"$in": list(unique_items)}},
            {
                "randomId": 1,
                "itemCode": 1,
                "itemName": 1,
                "hsnCode": 1,
                "purchasecategoryName": 1,
                "purchasesubcategoryName": 1,
            },
        ).to_list(length=None)

        vendors, pos_list, raws = await asyncio.gather(
            vendors_task, pos_task, raws_task
        )

        # Build lookup maps
        vendor_map = {v.get("vendorName"): v for v in vendors if "vendorName" in v}
        po_map = {p.get("randomId"): p for p in pos_list if "randomId" in p}

        # Raw material lookup maps
        raw_by_random = {}
        raw_by_code = {}
        raw_by_name = {}

        for r in raws:
            if r.get("randomId"):
                raw_by_random[r["randomId"]] = r
            if r.get("itemCode"):
                raw_by_code[str(r["itemCode"])] = r
            if r.get("itemName"):
                raw_by_name[r["itemName"]] = r

        rows = []

        def fmt_date(dt):
            if isinstance(dt, datetime):
                return dt.strftime("%m-%d-%Y")
            if isinstance(dt, str):
                try:
                    return datetime.fromisoformat(dt).strftime("%m-%d-%Y")
                except:
                    pass
            return dt or ""

        # Process each AP invoice
        for ap in aps:
            po_info = po_map.get(ap.get("poRandomId"), {})
            vendor_doc = vendor_map.get(ap.get("vendorName"), {})
            vendor_code = get_vendor_code(vendor_doc)
            items = ap.get("itemDetails", []) or []

            if not items:
                continue

            invoice_amount = ap.get("invoiceAmount", 0)
            discount_price = ap.get("discountPrice", 0)
            doc_discount_pct = round(
                (discount_price / invoice_amount * 100) if invoice_amount > 0 else 0, 2
            )

            for item in items:
                # --- Resolve itemCode like report API ---
                resolved = resolve_raw_material(
                    item,
                    raw_by_random,
                    raw_by_code,
                    raw_by_name,
                )
                raw_info = resolved.get("info", {})
                item_no = resolved.get("display_code")

                # Tax calculation
                tax_str = str(item.get("purchasetaxName", "0"))
                tax_percentage = float(re.sub(r"[^\d.]", "", tax_str))
                tax_type = item.get("taxType") or "cgst_sgst"
                cgst = sgst = igst = 0.0
                if tax_type == "cgst_sgst":
                    cgst = sgst = tax_percentage / 2
                elif tax_type == "igst":
                    igst = tax_percentage
                else:
                    igst = tax_percentage
                gstCalculated = round(cgst + sgst + igst, 2)

                # HSN code
                hsn_code = raw_info.get("hsnCode")
                try:
                    hsn_str = str(hsn_code).strip()
                    if hsn_str and hsn_str.isdigit():
                        hsn_code = int(hsn_str)
                except ValueError:
                    pass

                row = {
                    "Internal No": str(ap.get("_id")),
                    "Posting Date": fmt_date(ap.get("createdDate")),
                    "Invoice No": ap.get("randomId"),
                    "Invoice Date": fmt_date(ap.get("invoiceDate")),
                    "Vendor Ref. No": ap.get("invoiceNo"),
                    "GRN No": ap.get("grnRandomId"),
                    "Customer/Vendor Code": vendor_code,
                    "Customer/Vendor Name": ap.get("vendorName"),
                    "Item No.": item_no,
                    "HSN": hsn_code,
                    "Item/Service Description": item.get("itemName"),
                    "Name": po_info.get("locationName") or ap.get("locationName"),
                    "Price": item.get("unitPrice"),
                    "Line Discount %": item.get("LineDiscount"),
                    "Price Before Discount": item.get("befTaxDiscountAmount"),
                    "Line Discount Value": item.get("lineDiscountValue"),
                    "Category": raw_info.get("purchasecategoryName"),
                    "Sub Category": raw_info.get("purchasesubcategoryName"),
                    "Quantity": item.get("quantity"),
                    "GST%": gstCalculated,
                    "CGST%": cgst,
                    "CGST": item.get("cgst"),
                    "SGST%": sgst,
                    "SGST": item.get("sgst"),
                    "IGST%": igst,
                    "IGST": item.get("igst"),
                    "Tax Amount": item.get("taxAmount"),
                    "Freight Name": item.get("freightName"),
                    "Total": item.get("total"),
                    "Fr CGST%": item.get("FrCgstPercent"),
                    "Fr CGST": item.get("debitAfterFrCgstAmount"),
                    "Fr SGST%": item.get("FrSgstPercent"),
                    "Fr SGST": item.get("debitAfterFrSgstAmount"),
                    "Fr IGST%": item.get("FrIgstPercent"),
                    "Fr IGST": item.get("debitAfterFrIgstAmount"),
                    "Fr Tax Amount": item.get("FrTaxAmount"),
                    "Basic Value": item.get("totalPrice"),
                    "Doc Discount %": doc_discount_pct,
                    "Doc Discount Value": discount_price,
                    "Total value": invoice_amount,
                }
                rows.append(row)

        # Create Excel
        df = pd.DataFrame(rows) if rows else pd.DataFrame()
        output = BytesIO()
        with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
            df.to_excel(writer, index=False, sheet_name="Sheet1")
            worksheet = writer.sheets["Sheet1"]
            for i, col in enumerate(df.columns):
                col_width = min(
                    max(df[col].astype(str).map(len).max(), len(col)) + 2, 50
                )
                worksheet.set_column(i, i, col_width)

        output.seek(0)
        download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
        filename = f"APinvoice_YenERP_{download_time}.xlsx"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
