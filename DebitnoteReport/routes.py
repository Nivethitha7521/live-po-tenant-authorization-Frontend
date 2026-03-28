from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone, time
import pandas as pd
import io
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from db.collections import grnDebitNote_collection
from .models import (
    DateDropdownResponse,
    VendorDropdownResponse,
    ItemDropdownResponse,
    StatusDropdownResponse,
    PaginatedResponse,
)

router = APIRouter()


# -------------------------
# Helpers
# -------------------------
def build_date_filter(startDate, endDate):
    if not startDate and not endDate:
        return None

    if not startDate:
        startDate = endDate
    if not endDate:
        endDate = startDate

    start_dt = datetime.combine(startDate.date(), time.min).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(endDate.date(), time.max).replace(tzinfo=timezone.utc)

    # Safe date filter using $toDate
    return {
        "$expr": {
            "$and": [
                {"$gte": [{"$toDate": "$createdDate"}, start_dt]},
                {"$lte": [{"$toDate": "$createdDate"}, end_dt]},
            ]
        }
    }


def excel_response(df: pd.DataFrame, filename: str):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")
        worksheet = writer.sheets["Sheet1"]
        for col in worksheet.columns:
            width = max(len(str(cell.value)) if cell.value else 0 for cell in col) + 2
            worksheet.column_dimensions[col[0].column_letter].width = width
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# =====================================================
# Dropdown APIs
# =====================================================


@router.get("/date-dropdown", response_model=DateDropdownResponse)
async def get_dispatch_date_dropdown(request:Request,user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):
    tenant_id = request.state.tenant_id
    collection = grnDebitNote_collection(tenant_id)

    pipeline = [
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

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DateDropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DateDropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(result[0]["days"]),
    )


# =====================================================
# Item-wise report
# =====================================================
@router.get("/item-wise/report", response_model=PaginatedResponse)
async def debit_note_item_wise(request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    itemName: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    collection = grnDebitNote_collection(tenant_id)

    pipeline = []
    base_match = {"noteType": "debit"}

    if vendorName:
        base_match["vendorName"] = {"$in": vendorName}

    if itemName:
        base_match["itemDetails.itemName"] = {"$in": itemName}

    pipeline.append({"$match": base_match})

    # date filter
    date_filter = build_date_filter(startDate, endDate)
    if date_filter:
        pipeline.append({"$match": date_filter})

    # unwind itemDetails
    pipeline.append({"$unwind": "$itemDetails"})

    # lookup rawMaterial by itemName
    pipeline.append(
        {
            "$lookup": {
                "from": "rawMaterials",
                "let": {"itemName": "$itemDetails.itemName"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$itemName", "$$itemName"]}}},
                    {
                        "$project": {
                            "_id": 0,
                            "purchasecategoryName": 1,
                            "purchasesubcategoryName": 1,
                            "uom": 1,
                            "hsnCode": 1,
                        }
                    },
                ],
                "as": "rawData",
            }
        }
    )

    # lookup vendor by vendorName
    pipeline.append(
        {
            "$lookup": {
                "from": "vendor",
                "let": {"vendorName": "$vendorName"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$vendorName", "$$vendorName"]}}},
                    {"$project": {"_id": 0, "sapVendorCode": 1, "randomId": 1}},
                ],
                "as": "vendorData",
            }
        }
    )

    # Add fields
    pipeline.append(
        {
            "$addFields": {
                "rawData": {"$arrayElemAt": ["$rawData", 0]},
                "vendorData": {"$arrayElemAt": ["$vendorData", 0]},
            }
        }
    )

    # project fields
    pipeline.append(
        {
            "$project": {
                "_id": 0,
                "NOTE_NO": "$randomId",
                "VENDOR_NAME": "$vendorName",
                "VENDOR_CODE": {
                    "$ifNull": [
                        {"$toInt": "$vendorData.sapVendorCode"},  # Primary
                        "$vendorData.randomId",  # Fallback
                    ]
                },
                "ITEM_NAME": "$itemDetails.itemName",
                "CATEGORY": "$rawData.purchasecategoryName",
                "SUBCATEGORY": "$rawData.purchasesubcategoryName",
                "HSN": "$rawData.hsnCode",
                "UOM": "$rawData.uom",
                "QTY": "$itemDetails.quantity",
                "UNIT_PRICE": "$itemDetails.unitPrice",
                "TOTAL_PRICE": "$itemDetails.totalPrice",
                "TAX_AMOUNT": "$itemDetails.taxAmount",
                "FINAL_PRICE": "$itemDetails.finalPrice",
                # "SGST": "$itemDetails.sgst",
                # "CGST": "$itemDetails.cgst",
                "REASON": "$itemDetails.reason",
                "CREATED_DATE": {
                    "$dateToString": {
                        "format": "%m-%d-%Y",
                        "date": {"$toDate": "$createdDate"},
                    }
                },
            }
        }
    )

    # sort and paginate
    pipeline.append({"$sort": {"CREATED_DATE": -1}})
    pipeline.append({"$skip": (page - 1) * limit})
    pipeline.append({"$limit": limit})

    data = await collection.aggregate(pipeline).to_list(None)

    # total records
    count_pipeline = [{"$match": base_match}]
    if date_filter:
        count_pipeline.append({"$match": date_filter})
    total_records = await collection.aggregate(
        count_pipeline + [{"$count": "count"}]
    ).to_list(length=1)
    total_records = total_records[0]["count"] if total_records else 0

    total_pages = (total_records + limit - 1) // limit

    return {
        "page": page,
        "limit": limit,
        "totalRecords": total_records,
        "totalPages": total_pages,
        "items": data,
    }



# =====================================================
# EXPORT ITEM WISE
# =====================================================
@router.get("/item-wise/export")
async def export_debit_note_item_wise(request: Request,
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    itemName: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
   
    tenant_id = request.state.tenant_id
    collection = grnDebitNote_collection(tenant_id)
    pipeline = []
    base_match = {"noteType": "debit"}

    if vendorName:
        base_match["vendorName"] = {"$in": vendorName}

    if itemName:
        base_match["itemDetails.itemName"] = {"$in": itemName}

    pipeline.append({"$match": base_match})

    date_filter = build_date_filter(startDate, endDate)
    if date_filter:
        pipeline.append({"$match": date_filter})

    pipeline.append({"$unwind": "$itemDetails"})

    # Lookup rawMaterial collection by itemName
    pipeline.append(
        {
            "$lookup": {
                "from": "rawMaterials",  # correct collection name
                "let": {"itemName": "$itemDetails.itemName"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$itemName", "$$itemName"]}}},
                    {
                        "$project": {
                            "_id": 0,
                            "purchasecategoryName": 1,
                            "purchasesubcategoryName": 1,
                            "uom": 1,
                            "hsnCode": 1,
                        }
                    },
                ],
                "as": "rawData",
            }
        }
    )

    # Lookup vendor collection for sapVendorCode
    pipeline.append(
        {
            "$lookup": {
                "from": "vendor",
                "let": {"vendorName": "$vendorName"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$vendorName", "$$vendorName"]}}},
                    {"$project": {"_id": 0, "sapVendorCode": 1, "randomId": 1}},
                ],
                "as": "vendorData",
            }
        }
    )

    # Add first element from rawData & vendorData
    pipeline.append(
        {
            "$addFields": {
                "rawData": {"$arrayElemAt": ["$rawData", 0]},
                "vendorData": {"$arrayElemAt": ["$vendorData", 0]},
            }
        }
    )

    # Project final fields
    pipeline.append(
        {
            "$project": {
                "_id": 0,
                "Date": {
                    "$dateToString": {
                        "format": "%m-%d-%Y",
                        "date": {"$toDate": "$createdDate"},
                    }
                },
                "Note No": "$randomId",
                "Vendor Code": {
                    "$ifNull": [
                        {"$toInt": "$vendorData.sapVendorCode"},  # Primary
                        "$vendorData.randomId",  # Fallback
                    ]
                },
                "Vendor Name": "$vendorName",
                "Item Description": "$itemDetails.itemName",
                "Category": "$rawData.purchasecategoryName",
                "Subcategory": "$rawData.purchasesubcategoryName",
                "HSN": "$rawData.hsnCode",
                "UOM": "$rawData.uom",
                "Quantity": "$itemDetails.quantity",
                "Unit Price": "$itemDetails.unitPrice",
                "Tax Amount": "$itemDetails.taxAmount",
                # "SGST": "$itemDetails.sgst",
                # "CGST": "$itemDetails.cgst",
                # "IGST": "$itemDetails.igst",
                "Total Price": "$itemDetails.totalPrice",
                "Final Price": "$itemDetails.finalPrice",
                "Reason": "$itemDetails.reason",
            }
        }
    )

    results = await collection.aggregate(pipeline).to_list(None)

    if not results:
        raise HTTPException(404, "No data found")

    df = pd.DataFrame(results)
    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"DebitnoteItemwise_YenERP_{download_time}.xlsx"

    return excel_response(df, f"{filename}.xlsx")



# =====================================================
# Amount-wise report
# =====================================================
@router.get("/amount-wise/report", response_model=PaginatedResponse)
async def debit_note_amount_wise(request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    collection = grnDebitNote_collection(tenant_id)

    pipeline = []
    base_match = {"noteType": "debit"}

    if vendorName:
        base_match["vendorName"] = {"$in": vendorName}
    if status:
        base_match["status"] = {"$in": status}

    pipeline.append({"$match": base_match})

    # Date filter
    date_filter = build_date_filter(startDate, endDate)
    if date_filter:
        pipeline.append({"$match": date_filter})

    # Lookup vendor collection for sapVendorCode
    pipeline.append(
        {
            "$lookup": {
                "from": "vendor",
                "let": {"vendorName": "$vendorName"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$vendorName", "$$vendorName"]}}},
                    {"$project": {"_id": 0, "sapVendorCode": 1}},
                ],
                "as": "vendorData",
            }
        }
    )

    pipeline.append(
        {
            "$addFields": {
                "vendorData": {"$arrayElemAt": ["$vendorData", 0]},
            }
        }
    )

    pipeline.append(
        {
            "$project": {
                "_id": 0,
                "NOTE_ID": "$noteId",
                "RETURN_DATE": {
                    "$dateToString": {
                        "format": "%m-%d-%Y",
                        "date": {"$toDate": "$returnDate"},
                    }
                },
                "NOTE_NO": "$randomId",
                "NOTE_TYPE": "$noteType",
                "VENDOR_NAME": "$vendorName",
                "VENDOR_CODE": {"$toInt": "$vendorData.sapVendorCode"},  # number
                "TOTAL_AMOUNT": "$totalAmount",
                "TAX_AMOUNT": "$totalTax",
                "FINAL_AMOUNT": "$finalAmount",
                "STATUS": "$status",
            }
        }
    )

    # Sort by return date (or created date if needed)
    pipeline.append({"$sort": {"RETURN_DATE": -1}})
    pipeline.append({"$skip": (page - 1) * limit})
    pipeline.append({"$limit": limit})

    data = await collection.aggregate(pipeline).to_list(None)

    # total records with same filters
    count_pipeline = [{"$match": base_match}]
    if date_filter:
        count_pipeline.append({"$match": date_filter})

    total_records_res = await collection.aggregate(
        count_pipeline + [{"$count": "count"}]
    ).to_list(length=1)

    total_records = total_records_res[0]["count"] if total_records_res else 0
    total_pages = (total_records + limit - 1) // limit

    return {
        "page": page,
        "limit": limit,
        "totalRecords": total_records,
        "totalPages": total_pages,
        "items": data,
    }




# =====================================================
# EXPORT AMOUNT WISE
# =====================================================
@router.get("/amount-wise/export")
async def export_debit_note_amount_wise(request:Request,
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
   
    tenant_id = request.state.tenant_id
    collection = grnDebitNote_collection(tenant_id)
    pipeline = []
    base_match = {"noteType": "debit"}

    if vendorName:
        base_match["vendorName"] = {"$in": vendorName}
    if status:
        base_match["status"] = {"$in": status}

    pipeline.append({"$match": base_match})

    date_filter = build_date_filter(startDate, endDate)
    if date_filter:
        pipeline.append({"$match": date_filter})

    # Lookup vendor collection for sapVendorCode
    pipeline.append(
        {
            "$lookup": {
                "from": "vendor",
                "let": {"vendorName": "$vendorName"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$vendorName", "$$vendorName"]}}},
                    {"$project": {"_id": 0, "sapVendorCode": 1, "randomId": 1}},
                ],
                "as": "vendorData",
            }
        }
    )

    pipeline.append(
        {
            "$addFields": {
                "vendorData": {"$arrayElemAt": ["$vendorData", 0]},
            }
        }
    )

    pipeline.append(
        {
            "$project": {
                "_id": 0,
                "N0te Id": "$noteId",
                "Date": {
                    "$dateToString": {
                        "format": "%m-%d-%Y",
                        "date": {"$toDate": "$returnDate"},
                    }
                },
                "Note No": "$randomId",
                "Note Type": "$noteType",
                "Vendor Code": {
                    "$ifNull": [
                        {"$toInt": "$vendorData.sapVendorCode"},
                        "$vendorData.randomId",
                    ]
                },
                "Vendor Name": "$vendorName",
                "Total Amount": "$totalAmount",
                "Tax Amount": "$totalTax",
                "Final Amount": "$finalAmount",
                "Status": "$status",
            }
        }
    )

    results = await collection.aggregate(pipeline).to_list(None)
    if not results:
        raise HTTPException(404, "No data found")

    df = pd.DataFrame(results)
    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"DebitAmount_YenERP_{download_time}.xlsx"

    return excel_response(df, f"{filename}.xlsx")

