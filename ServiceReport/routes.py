import asyncio
from datetime import datetime, timedelta
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from excel import get_vendor_code
from .models import (
    DropdownResponse,
    InvoiceNoResponse,
    ReportApItem,
    ReportResponse,
    VendorResponse,
)
import pandas as pd
from fastapi.responses import StreamingResponse
from io import BytesIO
from .funtions import (
    fmt_date,
)

from db.collections import apInvoice, vendor, rawMaterials


router = APIRouter()

collection = apInvoice


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_date_dropdown(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):

    pipeline = [
        {"$match": {"invoiceType": "service", "createdDate": {"$type": "date"}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$createdDate"}},
                "months": {"$addToSet": {"$month": "$createdDate"}},
                "days": {"$addToSet": {"$dayOfMonth": "$createdDate"}},
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



@router.get("/report", response_model=ReportResponse)
async def get_all_apinvoices(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    invoiceNo: Optional[List[str]] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    startDate: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    collection = apInvoice
    vendor_collection = vendor

    # Vendor mapping
    vendor_map = {}
    async for v in vendor_collection.find(
        {}, {"vendorName": 1, "sapVendorCode": 1, "randomId": 1, "_id": 0}
    ):
        vendor_map[v["vendorName"]] = v

    # Query filter
    query = {"invoiceType": "service"}  # ONLY service invoices
    if startDate and end_date:
        query["invoiceDate"] = {"$gte": startDate, "$lt": end_date + timedelta(days=1)}
    elif startDate:
        query["invoiceDate"] = {"$gte": startDate}
    elif end_date:
        query["invoiceDate"] = {"$lt": end_date + timedelta(days=1)}

    if invoiceNo:
        query["invoiceNo"] = {"$in": invoiceNo}
    if vendorName:
        query["vendorName"] = {"$in": vendorName}

    skip = (page - 1) * limit
    total_count = await collection.count_documents(query)
    docs = (
        await collection.find(query)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )

    results = []

    for ap in docs:
        vendor_doc = vendor_map.get(ap.get("vendorName"), {})
        vendor_code = get_vendor_code(vendor_doc)

        desc_list = ap.get("descriptions", []) or []
        qty_list = ap.get("quantity", []) or []
        fees_list = ap.get("fees", []) or []
        tax_type_list = ap.get("desc_tax_types", []) or []
        tax_per_list = ap.get("desc_tax_pers", []) or []
        tax_amt_list = ap.get("desc_tax_amounts", []) or []
        total_list = ap.get("desc_totals", []) or []

        for idx in range(len(desc_list)):
            desc = desc_list[idx] if idx < len(desc_list) else ""
            qty = qty_list[idx] if idx < len(qty_list) else 0
            price = fees_list[idx] if idx < len(fees_list) else 0
            tax_type = tax_type_list[idx] if idx < len(tax_type_list) else "cgst_sgst"
            tax_per = float(tax_per_list[idx] if idx < len(tax_per_list) else 0)
            tax_amt = tax_amt_list[idx] if idx < len(tax_amt_list) else 0
            total = total_list[idx] if idx < len(total_list) else 0

            raw_material_doc = await rawMaterials.find_one(
                {"itemName": {"$regex": f"^{re.escape(desc)}$", "$options": "i"}}
            )

            itemCode = raw_material_doc.get("itemCode") if raw_material_doc else None
            category = (
                raw_material_doc.get("purchasecategoryName")
                if raw_material_doc
                else None
            )
            subcategory = (
                raw_material_doc.get("purchasesubcategoryName")
                if raw_material_doc
                else None
            )

            cgst = sgst = igst = 0.0
            if tax_type == "cgst_sgst":
                cgst = sgst = tax_per / 2
            elif tax_type == "igst":
                igst = tax_per

            results.append(
                ReportApItem(
                    InternalNo=str(ap.get("_id"))[-5:],
                    PostingDate=fmt_date(ap.get("createdDate")),
                    InvoiceNo=ap.get("randomId"),
                    InvoiceDate=fmt_date(ap.get("invoiceDate")),
                    VendorRefNo=ap.get("invoiceNo"),
                    CustomerVendorCode=vendor_code,
                    CustomerVendorName=ap.get("vendorName"),
                    ItemNo=itemCode,
                    ItemServiceDescription=desc,
                    CATEGORY=category,
                    SUB_CATEGORY=subcategory,
                    Name=ap.get("locationName"),
                    Price=price,
                    LineDiscountPercent=0,
                    PriceBeforeDiscount=price,
                    LineDiscountValue=0,
                    Quantity=qty,
                    GSTPercent=tax_per,
                    CGSTPercent=cgst,
                    CGST=(tax_amt / 2) if tax_type == "cgst_sgst" else 0,
                    SGSTPercent=sgst,
                    SGST=(tax_amt / 2) if tax_type == "cgst_sgst" else 0,
                    IGSTPercent=igst,
                    IGST=tax_amt if tax_type == "igst" else 0,
                    TaxAmount=tax_amt,
                    FreightName=None,
                    Total=None,
                    FrCGSTPercent=None,
                    FrCGST=None,
                    FrSGSTPercent=None,
                    FrSGST=None,
                    FrIGSTPercent=None,
                    FrIGST=None,
                    FrTaxAmount=None,
                    BasicValue=total,
                    DocDiscountPercent=0,
                    DocDiscountValue=0,
                    TotalValue=ap.get("invoiceAmount"),
                )
            )

    return {
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "totalPages": (total_count + limit - 1) // limit,
        "items": results,
    }


@router.get("/export")
async def export_ap_reports_service(
    startDate: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    query = {"invoiceType": "service"}  # ONLY service invoices

    # Date filter
    if startDate and end_date:
        query["invoiceDate"] = {"$gte": startDate, "$lt": end_date + timedelta(days=1)}
    elif startDate:
        query["invoiceDate"] = {"$gte": startDate}
    elif end_date:
        query["invoiceDate"] = {"$lt": end_date + timedelta(days=1)}

    if vendorName:
        query["vendorName"] = {"$in": vendorName}

    try:
        ap_collection = apInvoice
        vendor_collection = vendor
        raw_collection = rawMaterials

        aps = await ap_collection.find(query).to_list(length=None)

        if not aps:
            output = BytesIO()
            pd.DataFrame().to_excel(output, index=False, sheet_name="Sheet1")
            output.seek(0)
            filename = "ApInvoice_Service_YenERP_Empty.xlsx"
            headers = {"Content-Disposition": f"attachment; filename={filename}"}
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers=headers,
            )

        # Unique vendors and items for batch fetching
        unique_vendors = set(ap.get("vendorName") for ap in aps if ap.get("vendorName"))
        unique_items = set(
            item for ap in aps for item in (ap.get("descriptions", []) or [])
        )

        vendors, raws = await asyncio.gather(
            vendor_collection.find(
                {"vendorName": {"$in": list(unique_vendors)}}
            ).to_list(length=None),
            raw_collection.find({"itemName": {"$in": list(unique_items)}}).to_list(
                length=None
            ),
        )

        # Lookup maps
        vendor_map = {v.get("vendorName"): v for v in vendors if "vendorName" in v}
        raw_map = {r.get("itemName"): r for r in raws if "itemName" in r}

        rows = []

        for ap in aps:
            vendor_doc = vendor_map.get(ap.get("vendorName"), {})
            vendor_code = get_vendor_code(vendor_doc)

            desc_list = ap.get("descriptions", []) or []
            qty_list = ap.get("quantity", []) or []
            fees_list = ap.get("fees", []) or []
            tax_type_list = ap.get("desc_tax_types", []) or []
            tax_per_list = ap.get("desc_tax_pers", []) or []
            tax_amt_list = ap.get("desc_tax_amounts", []) or []
            total_list = ap.get("desc_totals", []) or []

            for idx in range(len(desc_list)):
                desc = desc_list[idx] if idx < len(desc_list) else ""
                qty = qty_list[idx] if idx < len(qty_list) else 0
                price = fees_list[idx] if idx < len(fees_list) else 0
                tax_type = (
                    tax_type_list[idx] if idx < len(tax_type_list) else "cgst_sgst"
                )
                tax_per = float(tax_per_list[idx] if idx < len(tax_per_list) else 0)
                tax_amt = tax_amt_list[idx] if idx < len(tax_amt_list) else 0
                total = total_list[idx] if idx < len(total_list) else 0

                # --- RESOLVE itemCode ---
                raw_info = raw_map.get(desc, {})
                itemCode = raw_info.get("itemCode")

                cgst = sgst = igst = 0.0
                if tax_type == "cgst_sgst":
                    cgst = sgst = tax_per / 2
                elif tax_type == "igst":
                    igst = tax_per

                row = {
                    "Internal No": str(ap.get("_id")),
                    "Posting Date": fmt_date(ap.get("createdDate")),
                    "Invoice No": ap.get("randomId"),
                    "Invoice Date": fmt_date(ap.get("invoiceDate")),
                    "Vendor Ref. No": str(ap.get("invoiceNo")),
                    "Customer/Vendor Code": vendor_code,
                    "Customer/Vendor Name": ap.get("vendorName"),
                    "Item No.": itemCode,  # <--- itemCode from rawMaterials
                    "Item/Service Description": desc,
                    "CATEGORY": raw_info.get("purchasecategoryName"),
                    "SUB_CATEGORY": raw_info.get("purchasesubcategoryName"),
                    "Name": ap.get("locationName"),
                    "Price": price,
                    "Line Discount %": 0,
                    "Price Before Discount": price,
                    "Line Discount Value": 0,
                    "Quantity": qty,
                    "GST %": tax_per,
                    "CGST%": cgst,
                    "CGST": (tax_amt / 2) if tax_type == "cgst_sgst" else 0,
                    "SGST%": sgst,
                    "SGST": (tax_amt / 2) if tax_type == "cgst_sgst" else 0,
                    "IGST%": igst,
                    "IGST": tax_amt if tax_type == "igst" else 0,
                    "Tax Amount": tax_amt,
                    "Freight Name": "",
                    "Total": "",
                    "Fr CGST% ": "",
                    "Fr CGST": "",
                    "Fr SGST%": "",
                    "Fr SGST": "",
                    "Fr IGST%": "",
                    "Fr IGST": "",
                    "Fr Tax Amount": "",
                    "Basic Value": total,
                    "Doc Discount %": 0,
                    "Doc Discount Value": 0,
                    "Total value": ap.get("invoiceAmount"),
                }
                rows.append(row)

        df = pd.DataFrame(rows)

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
        filename = f"ApInvoice_Service_YenERP_{download_time}.xlsx"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
