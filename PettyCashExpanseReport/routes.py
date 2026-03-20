from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
import pymongo
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from ApInvoiceReport.models import DropdownResponse

from .models import (
    PettyCashExpanse,
    responseresults,
)
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from io import BytesIO

from db.collections import pettycash

router = APIRouter()


@router.get("/date-dropdown", response_model=DropdownResponse)
async def get_pettycash_expanse(user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):

    collection = pettycash

    pipeline = [
        {
            "$addFields": {
                "parsedDate": {
                    "$dateFromString": {
                        "dateString": "$date",
                        "format": "%d-%m-%Y",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {"$match": {"parsedDate": {"$ne": None}}},
        {
            "$group": {
                "_id": None,
                "years": {"$addToSet": {"$year": "$parsedDate"}},
                "months": {"$addToSet": {"$month": "$parsedDate"}},
                "days": {"$addToSet": {"$dayOfMonth": "$parsedDate"}},
            }
        },
    ]

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return DropdownResponse(yearIn=[], monthIn=[], daysIn=[])

    return DropdownResponse(
        yearIn=sorted(map(str, result[0]["years"])),
        monthIn=sorted(f"{m:02d}" for m in result[0]["months"]),
        daysIn=sorted(f"{d:02d}" for d in result[0]["days"]),
    )




@router.get("/report", response_model=responseresults)
async def get_pettycash_reports(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, description="Items per page"),
    createdBy: Optional[List[str]] = Query(None, description="Filter by createdBy"),
    startDate: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    endDate: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    modeofpayment: Optional[List[str]] = Query(None),
    location: Optional[List[str]] = Query(
        None, description="Filter by location (branchName)"
    ),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    collection = pettycash
    query = {}

    # ---- Filters ----
    if createdBy:
        query["createdBy"] = {"$in": createdBy}
    if location:
        query["branchName"] = {"$in": location}
    if modeofpayment:
        query["paymentMethod"] = {"$in": modeofpayment}

    pipeline = []

    # Add match stage for createdBy/location filters
    if query:
        pipeline.append({"$match": query})

    # ---- Date Filter ----
    if startDate or endDate:
        pipeline.append(
            {
                "$addFields": {
                    "convertedDate": {
                        "$dateFromString": {
                            "dateString": "$date",
                            "format": "%d-%m-%Y",
                            "onError": None,
                            "onNull": None,
                        }
                    }
                }
            }
        )
        date_filter = {}
        try:
            if startDate:
                start_iso = datetime.fromisoformat(startDate)
                date_filter["$gte"] = start_iso
            if endDate:
                end_iso = datetime.fromisoformat(endDate) + timedelta(days=1)
                date_filter["$lt"] = end_iso
        except Exception:
            raise HTTPException(
                status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
            )

        if date_filter:
            pipeline.append({"$match": {"convertedDate": date_filter}})

    # ---- Total count for pagination ----
    try:
        total_records_cursor = collection.aggregate(pipeline + [{"$count": "total"}])
        total_records_list = await total_records_cursor.to_list(length=None)
        total_records = total_records_list[0]["total"] if total_records_list else 0
        total_pages = (total_records + limit - 1) // limit  # ceil division

        # ---- Pagination ----
        pipeline.extend([{"$skip": (page - 1) * limit}, {"$limit": limit}])

        results_docs = []
        async for doc in collection.aggregate(pipeline):
            results_docs.append(
                PettyCashExpanse(
                    pettycashExpanseId=str(doc.get("_id")),
                    documentNo=doc.get("docNumber"),  # Document Number
                    postingDate=doc.get("date"),  # Posting Date
                    postingTime=doc.get(
                        "time", ""
                    ),  # Posting Time (make sure your DB has this field)
                    counterReference=doc.get("counterReference"),
                    location=doc.get("branchName"),
                    modeOfPayment=doc.get("paymentMethod"),
                    accountName=doc.get("subcategory"),
                    remarks=doc.get("remark"),
                    payedAmount=doc.get("amount"),
                )
            )

    except pymongo.errors.PyMongoError:
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return responseresults(
        page=page,
        limit=limit,
        totalPages=total_pages,
        totalrecords=total_records,
        items=results_docs,
    )


headers = [
    "Document Number",
    "Posting Date",
    "Posting Time",
    "Counter Reference",
    "Location",
    "Mode Of Payment",
    "Account Name",
    "Remarks",
    "PayedAmnt",
]


@router.get("/export")
async def export_pettycash_report_excel(
    createdBy: Optional[List[str]] = Query(None, description="Filter by createdBy"),
    startDate: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    endDate: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    modeofpayment: Optional[List[str]] = Query(None),
    location: Optional[List[str]] = Query(
        None, description="Filter by location (branchName)"
    ),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    collection = pettycash
    query = {}

    # Basic filters
    if createdBy:
        query["createdBy"] = {"$in": createdBy}
    if location:
        query["branchName"] = {"$in": location}
    if modeofpayment:
        query["paymentMethod"] = {"$in": modeofpayment}

    pipeline = []
    if query:
        pipeline.append({"$match": query})

    # Date filter using $dateFromString on 'date' (DD-MM-YYYY)
    if startDate or endDate:
        pipeline.append(
            {
                "$addFields": {
                    "convertedDate": {
                        "$dateFromString": {
                            "dateString": "$date",
                            "format": "%d-%m-%Y",
                            "onError": None,
                            "onNull": None,
                        }
                    }
                }
            }
        )
        date_filter = {}
        try:
            if startDate:
                start_iso = datetime.fromisoformat(startDate)
                date_filter["$gte"] = start_iso
            if endDate:
                end_iso = datetime.fromisoformat(endDate) + timedelta(days=1)
                date_filter["$lt"] = end_iso
        except Exception:
            raise HTTPException(
                status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
            )
        if date_filter:
            pipeline.append({"$match": {"convertedDate": date_filter}})

    # Pagination

    try:
        docs = []
        async for doc in collection.aggregate(pipeline):
            docs.append(doc)
    except pymongo.errors.PyMongoError:
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Create Excel
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    # Write headers
    ws.append(headers)

    # Fill rows
    for doc in docs:
        row = [
            doc.get("docNumber", ""),
            doc.get("date"),  # POSTING DATE (string DD-MM-YYYY)
            doc.get("time", ""),
            doc.get("counterConference", ""),
            doc.get("branchName", ""),
            doc.get("paymentMethod", ""),  # Mode Of Payment
            doc.get("merchant", ""),
            doc.get("remark", ""),  # Expence Description
            float(
                doc.get("amount", 0),
            ),  # Gross Amount
        ]
        ws.append(row)

    # Save to bytes buffer
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"PettyCashExpenses_YenERP_{download_time}.xlsx"

    # Return as downloadable Excel file
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
