from datetime import datetime
import io
import tempfile
import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query,Request
from fastapi.responses import FileResponse, StreamingResponse
import pandas as pd
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from ApInvoiceReport.models import DropdownResponse
from ApInvoiceReport.utils import str_to_int

from .models import PaginatedReportResponse, ReportField
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Query
from db.collections import grn_collection, vendor_collection

router = APIRouter()


@router.get(
    "/date-dropdown",
    response_model=DropdownResponse,
    summary=" Itemwise Date Report Dropdown",
)
async def get_apinvoice_endpoint(request:Request,user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):
    """
    Simple dropdown: years, months, days + searchable & paginated vendors/invoices
    """
    tenant_id = request.state.tenant_id
    collection = grn_collection(tenant_id)

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


def fmt_date(dt):
    try:
        if isinstance(dt, datetime):
            return dt.strftime("%m-%d-%Y")  # MM-DD/YYYY
        return dt or ""
    except Exception as e:
        return ""


@router.get(
    "/report",
    response_model=PaginatedReportResponse,
    summary="Get AP Invoice Reports",
   
)
async def get_apinvoice_reports(request:Request,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    invoiceNo: Optional[List[str]] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    try:
        collection = grn_collection(tenant_id)
        vendor_db = vendor_collection(tenant_id)

        # ---------------- Single date handling ----------------
        if start_date and not end_date:
            end_date = start_date
        elif end_date and not start_date:
            start_date = end_date

        # ---------------- Normalize to full-day range ----------------
        if start_date:
            start_date = datetime(
                start_date.year, start_date.month, start_date.day, 0, 0, 0
            )
        if end_date:
            end_date = datetime(
                end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999
            )

        # ---------------- Filters ----------------
        match_stage = {}
        if start_date and end_date:
            match_stage["createdDate"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            match_stage["createdDate"] = {"$gte": start_date}
        elif end_date:
            match_stage["createdDate"] = {"$lte": end_date}

        if invoiceNo:
            match_stage["invoiceNo"] = {"$in": invoiceNo}
        if vendorName:
            match_stage["vendorName"] = {"$in": vendorName}
        if status:
            match_stage["status"] = {"$in": status}

        # ---------------- Count total records ----------------
        count_pipeline = [{"$match": match_stage}] if match_stage else []
        count_pipeline.append({"$count": "total"})
        count_result = await collection.aggregate(count_pipeline).to_list(length=1)
        total_records = count_result[0]["total"] if count_result else 0

        # ---------------- Main Aggregation ----------------
        pipeline = []
        if match_stage:
            pipeline.append({"$match": match_stage})

        pipeline.extend(
            [
                {
                    "$unwind": {
                        "path": "$itemDetails",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$lookup": {
                        "from": "grn",
                        "localField": "grnId",
                        "foreignField": "grnId",
                        "as": "grn",
                    }
                },
                {"$unwind": {"path": "$grn", "preserveNullAndEmptyArrays": True}},
                {
                    "$lookup": {
                        "from": "purchaseOrder",
                        "localField": "purchaseOrderId",
                        "foreignField": "purchaseOrderId",
                        "as": "purchaseOrder",
                    }
                },
                {
                    "$unwind": {
                        "path": "$purchaseOrder",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$lookup": {
                        "from": "rawMaterials",
                        "localField": "itemDetails.itemName",
                        "foreignField": "itemName",
                        "as": "itemDetailsWithHSN",
                    }
                },
                {
                    "$unwind": {
                        "path": "$itemDetailsWithHSN",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$lookup": {
                        "from": vendor_db.name,
                        "localField": "vendorName",
                        "foreignField": "vendorName",
                        "as": "vendorData",
                    }
                },
                {
                    "$unwind": {
                        "path": "$vendorData",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$project": {
                        "createdDate": {
                            "$dateToString": {
                                "format": "%m-%d-%Y",
                                "date": "$createdDate",
                            }
                        },
                        "invoiceDate": {
                            "$dateToString": {
                                "format": "%m-%d-%Y",
                                "date": "$invoiceDate",
                            }
                        },
                        "invoiceNo": 1,
                        "vendorName": 1,
                        "randomId": 1,
                        "poRandomID": 1,
                        "grnId": 1,
                        "grnDate": {
                            "$dateToString": {
                                "format": "%m-%d-%Y",
                                "date": "$grn.grnDate",
                            }
                        },
                        "poNo": "$purchaseOrder.poNo",
                        "sapVendorCode": {
                            "$ifNull": [
                                "$vendorData.sapVendorCode",
                                "$vendorData.randomId",
                            ]
                        },
                        "gstNumber": "$vendorData.gstNumber",
                        # Fetch both itemCode and randomId from Raw Materials
                        "itemCode": "$itemDetailsWithHSN.itemCode",
                        "rawMaterialRandomId": "$itemDetailsWithHSN.randomId",
                        "hsnCode": "$itemDetailsWithHSN.hsnCode",
                        "purchasecategoryName": "$itemDetailsWithHSN.purchasecategoryName",
                        "purchasesubcategoryName": "$itemDetailsWithHSN.purchasesubcategoryName",
                        "itemName": "$itemDetails.itemName",
                        "quantity": "$itemDetails.quantity",
                        "unitPrice": "$itemDetails.unitPrice",
                        "sgst": "$itemDetails.sgst",
                        "cgst": "$itemDetails.cgst",
                        "igst": "$itemDetails.igst",
                        "uom": "$itemDetails.uom",
                        "totalPrice": "$itemDetails.totalPrice",
                        "befTaxDiscountAmount": "$itemDetails.befTaxDiscountAmount",
                        "finalPrice": "$itemDetails.finalPrice",
                        "taxAmount": "$itemDetails.taxAmount",
                        "purchasetaxName": "$itemDetails.purchasetaxName",
                        "priceInclGST": {
                            "$multiply": [
                                "$itemDetails.unitPrice",
                                {
                                    "$add": [
                                        1,
                                        {
                                            "$divide": [
                                                "$itemDetails.purchasetaxName",
                                                100,
                                            ]
                                        },
                                    ]
                                },
                            ]
                        },
                        # Tax Display Logic
                        "taxDisplay": {
                            "$cond": [
                                {"$gt": ["$itemDetails.igst", 0]},
                                {
                                    "$concat": [
                                        "IGST@",
                                        {"$toString": "$itemDetails.purchasetaxName"},
                                    ]
                                },
                                {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$gt": ["$itemDetails.cgst", 0]},
                                                {"$gt": ["$itemDetails.sgst", 0]},
                                            ]
                                        },
                                        {
                                            "$concat": [
                                                "SCGST@",
                                                {
                                                    "$toString": "$itemDetails.purchasetaxName"
                                                },
                                            ]
                                        },
                                        {"$concat": ["SCGST@", "0"]},
                                    ]
                                },
                            ]
                        },
                    }
                },
                {"$skip": (page - 1) * limit},
                {"$limit": limit},
            ]
        )

        cursor = collection.aggregate(pipeline)
        processed_data = await cursor.to_list(length=None)

        # ---------------- PROCESS DATA (ItemCode Logic) ----------------
        final_report_data = []
        for doc in processed_data:
            # 1. Get values
            code_val = doc.get("itemCode")
            raw_random_id = doc.get("rawMaterialRandomId")
            display_code = None

            # 2. Try to convert itemCode to Integer
            if code_val is not None:
                try:
                    display_code = int(code_val)
                except (ValueError, TypeError):
                    # Conversion failed (it's a string like "ABC"), will fallback below
                    pass

            # 3. Fallback: If itemCode is missing/invalid, use randomId
            if display_code is None and raw_random_id:
                display_code = raw_random_id  # Keep as string

            # 4. Update doc
            doc["itemCode"] = display_code
            # Clean up helper field
            if "rawMaterialRandomId" in doc:
                del doc["rawMaterialRandomId"]

            final_report_data.append(ReportField(**doc))

        return PaginatedReportResponse(
            page=page,
            limit=limit,
            total_records=total_records,
            totalPages=(
                (total_records + limit - 1) // limit if total_records > 0 else 0
            ),
            items=final_report_data,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")


@router.get("/export", summary="Export Itemwisedate Report Excel")
async def export_apinvoice_report_to_excel(request:Request,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    invoiceNo: Optional[List[str]] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    try:
        collection = grn_collection(tenant_id)
        vendor_collection_db = vendor_collection(tenant_id)

        # ---------------- Filters ----------------

        if start_date and not end_date:
            end_date = start_date
        elif end_date and not start_date:
            start_date = end_date

        if start_date:
            start_date = datetime(
                start_date.year, start_date.month, start_date.day, 0, 0, 0
            )
        if end_date:
            end_date = datetime(
                end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999
            )

        match_stage = {}
        if start_date and end_date:
            match_stage["createdDate"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            match_stage["createdDate"] = {"$gte": start_date}
        elif end_date:
            match_stage["createdDate"] = {"$lte": end_date}
        if invoiceNo:
            match_stage["invoiceNo"] = {"$in": invoiceNo}
        if vendorName:
            match_stage["vendorName"] = {"$in": vendorName}
        if status:
            match_stage["status"] = {"$in": status}

        pipeline = [{"$match": match_stage}] if match_stage else []

        # ---------------- Aggregation ----------------
        pipeline.extend(
            [
                {
                    "$unwind": {
                        "path": "$itemDetails",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$lookup": {
                        "from": "grn",
                        "localField": "grnId",
                        "foreignField": "grnId",
                        "as": "grn",
                    }
                },
                {"$unwind": {"path": "$grn", "preserveNullAndEmptyArrays": True}},
                {
                    "$lookup": {
                        "from": "purchaseOrder",
                        "localField": "purchaseOrderId",
                        "foreignField": "purchaseOrderId",
                        "as": "purchaseOrder",
                    }
                },
                {
                    "$unwind": {
                        "path": "$purchaseOrder",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$lookup": {
                        "from": "rawMaterials",
                        "localField": "itemDetails.itemName",
                        "foreignField": "itemName",
                        "as": "itemDetailsWithHSN",
                    }
                },
                {
                    "$unwind": {
                        "path": "$itemDetailsWithHSN",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$lookup": {
                        "from": vendor_collection_db.name,
                        "localField": "vendorName",
                        "foreignField": "vendorName",
                        "as": "vendorData",
                    }
                },
                {
                    "$unwind": {
                        "path": "$vendorData",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$project": {
                        "createdDate": 1,
                        "invoiceDate": 1,
                        "invoiceNo": 1,
                        "vendorName": 1,
                        "randomId": 1,
                        "poRandomID": 1,
                        "grnId": 1,
                        "grnDate": "$grn.grnDate",
                        "poNo": "$purchaseOrder.poNo",
                        # Fetch fields for logic
                        "sapVendorCode": "$vendorData.sapVendorCode",
                        "vendorRandomId": "$vendorData.randomId",
                        "itemCode": "$itemDetailsWithHSN.itemCode",
                        "rawMaterialRandomId": "$itemDetailsWithHSN.randomId",
                        "hsnCode": "$itemDetailsWithHSN.hsnCode",
                        "purchasecategoryName": "$itemDetailsWithHSN.purchasecategoryName",
                        "purchasesubcategoryName": "$itemDetailsWithHSN.purchasesubcategoryName",
                        "itemName": "$itemDetails.itemName",
                        "quantity": "$itemDetails.quantity",
                        "unitPrice": "$itemDetails.unitPrice",
                        "sgst": "$itemDetails.sgst",
                        "cgst": "$itemDetails.cgst",
                        "igst": "$itemDetails.igst",
                        "uom": "$itemDetails.uom",
                        "totalPrice": "$itemDetails.totalPrice",
                        "befTaxDiscountAmount": "$itemDetails.befTaxDiscountAmount",
                        "finalPrice": "$itemDetails.finalPrice",
                        "taxAmount": "$itemDetails.taxAmount",
                        "purchasetaxName": "$itemDetails.purchasetaxName",
                        "totalReceivedAmount": 1,
                        #  Tax Display Logic
                        "taxDisplay": {
                            "$cond": [
                                {"$gt": ["$itemDetails.igst", 0]},
                                {
                                    "$concat": [
                                        "IGST@",
                                        {"$toString": "$itemDetails.purchasetaxName"},
                                    ]
                                },
                                {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$gt": ["$itemDetails.cgst", 0]},
                                                {"$gt": ["$itemDetails.sgst", 0]},
                                            ]
                                        },
                                        {
                                            "$concat": [
                                                "SCGST@",
                                                {
                                                    "$toString": "$itemDetails.purchasetaxName"
                                                },
                                            ]
                                        },
                                        "SCGST@0",
                                    ]
                                },
                            ]
                        },
                    }
                },
            ]
        )

        cursor = collection.aggregate(pipeline)
        data = await cursor.to_list(length=None)

        if not data:
            raise HTTPException(status_code=404, detail="No records found to export.")

        # ---------------- Convert to DataFrame ----------------
        df = pd.DataFrame(data)

        # Convert numeric safely
        df["unitPrice"] = pd.to_numeric(df["unitPrice"], errors="coerce").fillna(0)
        df["cgst"] = pd.to_numeric(df["cgst"], errors="coerce").fillna(0)
        df["sgst"] = pd.to_numeric(df["sgst"], errors="coerce").fillna(0)
        df["igst"] = pd.to_numeric(df["igst"], errors="coerce").fillna(0)
        df["purchasetaxName"] = pd.to_numeric(
            df["purchasetaxName"], errors="coerce"
        ).fillna(0)

        #  Base Price = unitPrice
        df["Base Price"] = df["unitPrice"]

        #  Price Incl GST
        df["Price Incl GST"] = df["Base Price"] * (1 + df["purchasetaxName"] / 100)

        # Document Total
        df["Document Total"] = df["totalReceivedAmount"]

        # ---------------- PROCESS DATA: TYPE LOGIC ----------------

        # 1. Vendor Code Logic
        # Convert sapVendorCode to numeric. If NaN, fill with vendorRandomId (string).
        df["temp_vendor_code"] = pd.to_numeric(df["sapVendorCode"], errors="coerce")
        # Where temp is NaN (not an int), use the string randomId
        df["VendorCode"] = df["temp_vendor_code"].fillna(df["vendorRandomId"])

        # 2. Item Code Logic
        # Convert itemCode to numeric. If NaN, fill with rawMaterialRandomId (string).
        df["temp_item_code"] = pd.to_numeric(df["itemCode"], errors="coerce")
        # Where temp is NaN, use the string randomId
        df["ItemCode"] = df["temp_item_code"].fillna(df["rawMaterialRandomId"])

        # -----------------------------------------------------

        df["hsnCode"] = (
            pd.to_numeric(df["hsnCode"], errors="coerce").fillna(0).astype(int)
        )

        # Format dates
        for col in ["createdDate", "grnDate", "invoiceDate"]:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%m-%d-%Y")

        # Rename columns
        df.rename(
            columns={
                "vendorName": "VendorName",
                "grnId": "Internal No",
                "createdDate": "POSTING DATE",
                "randomId": "GRNNo",
                "grnDate": "GRNDate",
                "poRandomID": "PO No",
                "invoiceNo": "Inv no",
                "invoiceDate": "Inv Date",
                "itemName": "ItemName",
                "purchasecategoryName": "Category",
                "purchasesubcategoryName": "Sub Category",
                "uom": "UOM",
                "hsnCode": "HSN",
                "quantity": "Quantity",
                "totalPrice": "Total",
                "taxDisplay": "TaxCode",
                "purchasetaxName": "TaxRate",
                "cgst": "CGST",
                "sgst": "SGST",
                "igst": "IGST",
                "taxAmount": "TaxAmount",
                "finalPrice": "TotalAmount",
            },
            inplace=True,
        )

        # Round values
        for col in [
            "Base Price",
            "Price Incl GST",
            "TaxAmount",
            "TotalAmount",
            "Document Total",
        ]:
            if col in df.columns:
                df[col] = df[col].round(2)

        #  Correct Excel Column Order
        desired_columns = [
            "Internal No",
            "POSTING DATE",
            "GRNNo",
            "GRNDate",
            "PO No",
            "Inv no",
            "Inv Date",
            "VendorCode",  # Calculated column
            "VendorName",
            "ItemCode",  # Calculated column
            "ItemName",
            "Category",
            "Sub Category",
            "UOM",
            "HSN",
            "Quantity",
            "Price Incl GST",
            "Base Price",
            "Total",
            "TaxCode",
            "TaxRate",
            "CGST",
            "SGST",
            "IGST",
            "TaxAmount",
            "TotalAmount",
            "Document Total",
        ]

        # Ensure we don't error if a column is missing
        final_cols = [c for c in desired_columns if c in df.columns]
        df = df[final_cols]

        df["Inv no"] = df["Inv no"].apply(lambda x: str_to_int(x, default=0))

        # Save Excel file
        download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
        file_name = f"Item_datewise_YenERP_{download_time}.xlsx"
        file_path = os.path.join(tempfile.gettempdir(), file_name)
        df.to_excel(file_path, index=False)

        return FileResponse(
            file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")
