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
    DateDropdownResponse,
    orderNoDropdownResponse,
    branchnameDropdownResponse,
    customerNumberDropdownResponse,
    CakeOrderItemModel,
)
from db.collections import cakeappinvoices


router = APIRouter()


collection = cakeappinvoices


def safe_int(value):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
        return int(value)
    return None


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

    pipeline = [
        {
            "$addFields": {
                "invoiceDateObj": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$invoiceDate"}, "date"]},
                        "then": "$invoiceDate",
                        "else": {
                            "$dateFromString": {
                                "dateString": "$invoiceDate",
                                "format": "%d-%m-%Y",
                            }
                        },
                    }
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$invoiceDateObj"}},
                "months": {"$addToSet": {"$month": "$invoiceDateObj"}},
                "days": {"$addToSet": {"$dayOfMonth": "$invoiceDateObj"}},
            }
        },
    ]

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DateDropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(result[0]["days"]),
    )



@router.get("/report")
async def get_cakeapp_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    startDate: Optional[datetime] = None,
    endDate: Optional[datetime] = None,
    branchName: Optional[List[str]] = Query(None),
    customerNo: Optional[List[str]] = Query(None),
    orderNo: Optional[List[str]] = Query(None),
    full_invoice_id: bool = False, user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):

    skip = (page - 1) * limit
    query = {}

    # 1. Filter by Branch Name (Multiple)
    if branchName:
        query["locationId"] = {"$in": branchName}

    # 2. Filter by Order No (Multiple)
    if orderNo:
        query["orderNo"] = {"$in": orderNo}

    # 3. Filter by Customer Phone (Multiple)
    # Convert string input to Integer because DB stores it as Long
    if customerNo:
        cust_ints = []
        for c in customerNo:
            try:
                cust_ints.append(int(c))
            except ValueError:
                pass
        if cust_ints:
            query["customerPhoneNumber"] = {"$in": cust_ints}

    # 4. Filter by Invoice Date (Corrected Logic)
    if startDate and endDate:
        # Prepare string format for String dates in DB
        start_str = startDate.strftime("%d-%m-%Y")
        end_str = endDate.strftime("%d-%m-%Y")

        # Prepare date objects for Date objects in DB (include end of day)
        end_of_day = endDate.replace(hour=23, minute=59, second=59)

        # FIX: Use $or at the TOP LEVEL of the query
        # This tells Mongo: Find documents where (invoiceDate is String AND matches strings)
        # OR (invoiceDate is Date AND matches dates)
        query["$or"] = [
            # Case 1: The date is stored as a String "DD-MM-YYYY"
            {
                "invoiceDate": {"$type": "string"},
                "invoiceDate": {"$gte": start_str, "$lte": end_str},
            },
            # Case 2: The date is stored as a Date Object
            {
                "invoiceDate": {"$type": "date"},
                "invoiceDate": {"$gte": startDate, "$lte": end_of_day},
            },
        ]

    pipeline = [
        {"$match": query},
        {"$unwind": "$name"},
        {"$skip": skip},
        {"$limit": limit},
    ]

    cursor = collection.aggregate(pipeline)
    total = await collection.count_documents(query)

    results = []
    async for doc in cursor:
        invoice_id = doc.get("cakeAppInvoiceId")
        if not full_invoice_id and invoice_id:
            invoice_id = invoice_id[-5:]

        row = CakeOrderItemModel(
            name=doc.get("name"),
            category=safe_index(doc.get("category"), 0),
            price=doc.get("price", [None])[0],
            kgList=doc.get("kgList", [None])[0],
            qty=doc.get("qty", [None])[0],
            amount=doc.get("amount", [None])[0],
            taxPercentage=doc.get("taxPercentage", [None])[0],
            flavourList=doc.get("flavourList", [None])[0],
            totalAmount=doc.get("totalAmount"),
            status=doc.get("status"),
            event=doc.get("event", [None])[0],
            customerPhoneNumber=doc.get("customerPhoneNumber"),
            orderNo=doc.get("orderNo"),
            deliveryDate=doc.get("deliveryDate"),
            deliveryTime=doc.get("deliveryTime"),
            paymentType=doc.get("paymentType"),
            invoiceDate=doc.get("invoiceDate"),
            invoiceTime=doc.get("invoiceTime"),
            warehouseName=doc.get("warehouseName"),
            branch=doc.get("branch"),
            contact=safe_int(doc.get("contact")),
            city=doc.get("city"),
            itemCodes=safe_index(doc.get("itemCodes"), 0),
            birthdayDate=doc.get("birthdayDate"),
            cakeAppInvoiceId=invoice_id,
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
    orderNo: Optional[List[str]] = Query(None), user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "posreport", "read"))
):
    # Call your existing function to get the data
    response = await get_cakeapp_orders(
        page=page,
        limit=limit,
        startDate=startDate,
        endDate=endDate,
        branchName=branchName,
        customerNo=customerNo,
        orderNo=orderNo,
        full_invoice_id=True,
    )

    data = response["items"]

    df = pd.DataFrame(data)
    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"BirthdayCake_YenERP_{download_time}.xlsx"

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
