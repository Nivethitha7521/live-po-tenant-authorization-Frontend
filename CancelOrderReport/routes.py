from datetime import datetime
import io
from typing import List, Optional
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
import pandas as pd
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from ApInvoiceReport.models import DropdownResponse
from .models import (
    CancelOrder,
)
from db.collections import (
    EventMaster,
    salesorder,
    location,
)

router = APIRouter()


# Helper function to safely get value from array
def safe_index(field_list, idx):
    if isinstance(field_list, list) and len(field_list) > idx:
        return field_list[idx]
    return None


def format_datetime(dt):
    """Safely format a datetime object or ISO string."""
    if not dt:
        return None, None
    if isinstance(dt, str):
        # convert ISO string to datetime
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None, None
    return dt.strftime("%d-%m-%Y"), dt.strftime("%H:%M")




@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_dispatch_date_dropdown( user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))):
    collection = salesorder

    pipeline = [
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

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(result[0]["days"]),
    )


@router.get("/report")
async def get_sales_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    startDate: Optional[datetime] = None,
    endDate: Optional[datetime] = None,
    branchName: Optional[List[str]] = Query(None),
    customerNo: Optional[List[str]] = Query(None),
    salorderNo: Optional[List[str]] = Query(None),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    collection = salesorder
    event_collection = EventMaster
    branch_collection = location

    skip = (page - 1) * limit

    # Mongo query
    query = {"status": "cancelled"}

    if branchName:
        query["branchId"] = {"$in": branchName}

    if customerNo:
        query["customerNumber"] = {"$in": customerNo}

    if salorderNo:
        query["saleOrderNo"] = {"$in": salorderNo}

    if startDate and endDate:
        start = datetime.combine(startDate.date(), datetime.min.time())
        end = datetime.combine(endDate.date(), datetime.max.time())
        query["orderDate"] = {"$gte": start, "$lte": end}

    cursor = collection.find(query).skip(skip).limit(limit)

    total = await collection.count_documents(query)

    results = []

    async for doc in cursor:

        variance_list = doc.get("varianceName", [])
        qty_list = doc.get("qty", [])
        amount_list = doc.get("amount", [])
        tax_list = doc.get("tax", [])
        item_code_list = doc.get("itemCode", [])

        delivery_date, delivery_time = format_datetime(doc.get("deliveryDate"))
        order_date, order_time = format_datetime(doc.get("orderDate"))
        occ_date, occ_time = format_datetime(doc.get("eventDate"))
        created_date, created_time = format_datetime(doc.get("orderDate"))

        event_name = doc.get("event")
        branchName_doc = doc.get("branchName")

        branchid_doc = None
        if branchName_doc:
            branchid_doc = await branch_collection.find_one(
                {"branchName": branchName_doc}
            )

        BranchID = branchid_doc.get("locationId") if branchid_doc else None

        event_doc = None
        if event_name:
            event_doc = await event_collection.find_one({"eventName": event_name})

        occ_code = event_doc.get("eventCode") if event_doc else None

        for i, variance in enumerate(variance_list):

            row = CancelOrder(
                OrderStatus=doc.get("status"),
                BranchID=BranchID,
                LocationName=branchName_doc,
                OrderNo=doc.get("saleOrderNo"),
                OrderDate=order_date,
                CustomerNo=doc.get("customerNumber"),
                DeliveryDate=delivery_date,
                OccCode=occ_code,
                OccName=event_name,
                OccDate=occ_date,
                Message=doc.get("remark"),
                ShapeCode=item_code_list[i] if i < len(item_code_list) else None,
                ShapeName=variance,
                CustCharge=doc.get("totalCustomCharge", 0),
                AdvanceAmount=(
                    sum(doc.get("advanceAmount", [])) if doc.get("advanceAmount") else 0
                ),
                DelCharge=0,
                TotQty=qty_list[i] if i < len(qty_list) else 0,
                TotAmount=amount_list[i] if i < len(amount_list) else 0,
                TaxAmount=tax_list[i] if i < len(tax_list) else 0,
                ReqDiscount=doc.get("discountAmount", 0),
                BalanceDue=doc.get("balanceAmount"),
                OverallAmount=doc.get("finalPrice"),
                ScreenName="SalesOrder",
                CreatedBy=doc.get("employeeName"),
                CreatedDate=created_date,
                ShaCode=item_code_list[i] if i < len(item_code_list) else None,
                ShaName=variance,
                BlanceAmt=doc.get("balanceAmount"),
                DeliveryTime=doc.get("deliveryTime"),
                SONo=doc.get("saleOrderNo"),
            )

            results.append(row.dict())

    return {
        "page": page,
        "limit": limit,
        "totalItems": total,
        "totalPages": (total + limit - 1) // limit,
        "items": results,
    }


@router.get("/export")
async def export_sales_orders_excel(
    page: int = 1,
    limit: int = 50,
    startDate: Optional[datetime] = None,
    endDate: Optional[datetime] = None,
    branchName: Optional[List[str]] = Query(None),
    customerNo: Optional[List[str]] = Query(None),
    salorderNo: Optional[List[str]] = Query(None),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):

    response = await get_sales_orders(
        page=page,
        limit=limit,
        startDate=startDate,
        endDate=endDate,
        branchName=branchName,
        customerNo=customerNo,
        salorderNo=salorderNo,
    )

    data = response["data"]

    df = pd.DataFrame(data)

    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"cancelorder_YenERP_{download_time}.xlsx"

    buffer = io.BytesIO()

    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
