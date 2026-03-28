import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from io import BytesIO
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query,Request
from fastapi.responses import StreamingResponse
import pandas as pd
from fastapi import Depends
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from excel import get_vendor_code, resolve_raw_material
from .models import purchase, DropdownResponse, purchaseResponse


router = APIRouter()


from db.collections import (
    apInvoice_collection,
    purchaseorder_collection,
    vendor_collection,
    grn_collection,
    rawMaterials_collection
)
@router.get("/global-dropdowns")
async def global_dropdowns(request: Request,
    search: Optional[str] = Query(None), page: int = Query(1), limit: int = Query(20),
     user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id

    rawMaterials_db = rawMaterials_collection(tenant_id)
    vendor_db = vendor_collection(tenant_id)

    skip = (page - 1) * limit

    # ---------------- VARIANCE ----------------
    item_pipeline = []

    if search:
        item_pipeline.append(
            {"$match": {"itemName": {"$regex": search, "$options": "i"}}}
        )

    item_pipeline.extend(
        [
            {"$group": {"_id": "$itemName", "randomId": {"$first": "$randomId"}}},
            {"$project": {"_id": 0, "label": "$_id", "value": "$randomId"}},
            {"$sort": {"label": 1}},
            {"$skip": skip},
            {"$limit": limit},
        ]
    )

    itemName = await rawMaterials_db.aggregate(item_pipeline).to_list(length=limit)

    # ---------------- LOCATION ----------------
    vendor_pipeline = [{"$match": {"status": "active"}}]

    if search:
        vendor_pipeline.append(
            {"$match": {"vendorName": {"$regex": search, "$options": "i"}}}
        )

    vendor_pipeline.extend(
        [
            {"$project": {"_id": 0, "label": "$vendorName", "value": "$vendorName"}},
            {"$sort": {"label": 1}},
            {"$skip": skip},
            {"$limit": limit},
        ]
    )

    vendors = await vendor_db.aggregate(vendor_pipeline).to_list(length=limit)

    return {"itemName": itemName, "vendor": vendors}


@router.get(
    "/date-dropdown",
    response_model=DropdownResponse,
    summary="Purchaseorder Report Dropdown",
)
async def get_apinvoice_endpoint( request:Request,user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))):
    tenant_id = request.state.tenant_id
    collection = purchaseorder_collection(tenant_id)
    # === Years, Months, Days ===
    all_docs_cursor = collection.find({}, {"createdDate": 1})
    all_docs = await all_docs_cursor.to_list(length=None)

    years, months, days = set(), set(), set()
    for doc in all_docs:
        invoice_date = doc.get("createdDate")
        if isinstance(invoice_date, datetime):
            years.add(str(invoice_date.year))
            months.add(str(invoice_date.month).zfill(2))
            days.add(invoice_date.day)

    return DropdownResponse(
        yearIn=sorted(list(years), key=int),
        monthIn=sorted(list(months), key=int),
        daysIn=sorted(list(days)),
    )


def get_dynamic_po_status(po, po_grns):
    """
    po        → PO document
    po_grns   → grn_item_map[poRandomId]
    """

    # Calculate total received qty across ALL items
    total_received = 0
    for item_grns in po_grns.values():
        for g in item_grns:
            total_received += g.get("receivedQty", 0)

    has_any_received = total_received > 0

    # Use poStatus for rules; fallback to empty string
    po_status = (po.get("poStatus") or "").lower()  # ensure string, handle None

    # ---------------- RULES ----------------
    if po_status == "rejected":
        return "Partially Rejected" if has_any_received else "Rejected"

    if po_status == "approved":
        return "PartiallyReceived" if has_any_received else "Approved"

    # ---------------- DEFAULT ----------------
    # Return the actual status from the PO if poStatus is null
    return po.get("poStatus") or po.get("status") or ""


# ---------- SMART ITEM STATUS ----------
def get_db_item_status(item, po, received_qty: int):
    status = (item.get("status") or "").strip()
    po_status = (po.get("poStatus") or "Pending").strip()

    po_qty = item.get("poQuantity") or 0
    cancelled_po_statuses = {"Rejected", "Deactivated", "Cancelled"}

    # ✔ NEW RULE: If PO is rejected/cancelled
    if po_status in cancelled_po_statuses:
        if received_qty == 0:
            return "Rejected"
        if 0 < received_qty < po_qty:
            return "PartiallyRejected"
        if received_qty >= po_qty:
            return "Received"

    # 1️⃣ Explicit item status
    if status == "Received":
        return "Received"

    # 2️⃣ Pending item → derive by qty
    if status == "Pending":
        if 0 < received_qty < po_qty:
            return (
                "PartiallyReceived-C"
                if po_status in cancelled_po_statuses
                else "PartiallyReceived"
            )
        elif received_qty == 0:
            return "Pending"
        else:
            return "Received"

    # 3️⃣ Empty item status → derive by qty
    if status == "":
        if 0 < received_qty < po_qty:
            return (
                "PartiallyReceived-C"
                if po_status in cancelled_po_statuses
                else "PartiallyReceived"
            )

        if received_qty == po_qty and po_qty > 0:
            return "Received"

        #  IMPORTANT: default fallback
        return "Pending"

    # 4️⃣ Any other custom status → FORCE Pending
    return "Pending"


@router.get(
    "/report",
    response_model=purchaseResponse,
    summary="Purchaseorder Report",
)
async def get_po_reports(request:Request,
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    poNo: Optional[List[str]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
    
):
    tenant_id = request.state.tenant_id
    query = {}

    # ---------------- DATE FILTER ----------------
    if startDate and endDate:
        query["createdDate"] = {"$gte": startDate, "$lt": endDate + timedelta(days=1)}
    elif startDate:
        query["createdDate"] = {"$gte": startDate}
    elif endDate:
        query["createdDate"] = {"$lt": endDate + timedelta(days=1)}

    if vendorName:
        query["vendorName"] = {"$in": vendorName}

    if poNo:
        query["randomId"] = {"$in": poNo}

    # ---------------- COLLECTIONS ----------------
    po_collection = purchaseorder_collection(tenant_id)
    vendor_db = vendor_collection(tenant_id)
    raw_db = rawMaterials_collection(tenant_id)
    grn_db = grn_collection(tenant_id)
    ap_db = apInvoice_collection(tenant_id)

    # ---------------- AGGREGATION PIPELINE FOR ITEM-LEVEL ROWS ----------------
    # Each row = one PO item
    pipeline = [
        {"$match": query},
        {"$unwind": "$items"},  # one item per document
        {"$sort": {"createdDate": 1}},
        {"$skip": (page - 1) * limit},
        {"$limit": limit},
        {
            "$project": {
                "_id": 1,
                "randomId": 1,
                "vendorName": 1,
                "orderDate": 1,
                "createdDate": 1,
                "poStatus": 1,
                "items": 1,
            }
        },
    ]

    po_items = await po_collection.aggregate(pipeline).to_list(limit)
    if not po_items:
        return purchaseResponse(
            page=page, limit=limit, total_records=0, totalPages=0, items=[]
        )

    # ---------------- GET RELATED PO IDs FOR CURRENT PAGE ----------------
    po_ids = list(set([po["randomId"] for po in po_items]))

    # ---------------- BULK FETCH RELATED DATA ----------------
    vendors, raws, grns, aps = await asyncio.gather(
        vendor_db.find(
            {"vendorName": {"$in": [po.get("vendorName") for po in po_items]}},
            {"vendorName": 1, "vendorId": 1, "sapVendorCode": 1, "randomId": 1},
        ).to_list(None),
        raw_db.find(
            {},
            {
                "randomId": 1,
                "itemCode": 1,
                "itemName": 1,
                "purchasecategoryName": 1,
                "purchasesubcategoryName": 1,
            },
        ).to_list(None),
        grn_db.find(
            {"poRandomID": {"$in": po_ids}},
            {
                "randomId": 1,
                "poRandomID": 1,
                "status": 1,
                "itemDetails": 1,
                "totalReceivedAmount": 1,
            },
        ).to_list(None),
        ap_db.find(
            {"poRandomId": {"$in": po_ids}},
            {"randomId": 1, "poRandomId": 1, "grnRandomId": 1, "status": 1},
        ).to_list(None),
    )

    # ---------------- LOOKUP MAPS ----------------
    vendor_map = {v["vendorName"]: v for v in vendors if v.get("vendorName")}
    raw_by_random = {r["randomId"]: r for r in raws if r.get("randomId")}
    raw_by_code = {r["itemCode"]: r for r in raws if r.get("itemCode")}
    raw_by_name = {r["itemName"]: r for r in raws if r.get("itemName")}

    # ---------------- GRN MAP ----------------
    grn_item_map = defaultdict(lambda: defaultdict(list))
    for g in grns:
        po_id = g.get("poRandomID")
        for it in g.get("itemDetails", []):
            key = it.get("itemId")
            if key:
                grn_item_map[po_id][key].append(
                    {
                        "grnNo": g.get("randomId"),
                        "grnStatus": g.get("status"),
                        "receivedQty": it.get("receivedQuantity", 0),
                        "totalReceivedAmount": g.get("totalReceivedAmount", 0),
                    }
                )

    # ---------------- AP MAP ----------------
    ap_po_grn_map = {}
    ap_po_map = defaultdict(list)
    for ap in aps:
        po_id = ap.get("poRandomId")
        grn_id = ap.get("grnRandomId")
        if po_id and grn_id:
            ap_po_grn_map[(po_id, grn_id)] = ap
        if po_id:
            ap_po_map[po_id].append(ap)

    # ---------------- PRE-CALCULATE DOCUMENT TOTAL ----------------
    po_doc_total = {}
    for po in po_items:
        po_id = po["randomId"]
        total = 0.0
        item = po["items"]
        qty = item.get("poQuantity", 0)
        price = item.get("newPrice", 0)
        tax = item.get("taxPercentage", 0)
        total += qty * price + (qty * price * tax / 100)
        po_doc_total[po_id] = round(total, 2)

    def fmt_date(dt):
        return dt.strftime("%d-%m-%Y") if isinstance(dt, datetime) else ""

    # ---------------- BUILD ITEM ROWS ----------------
    processed_data = []

    for po in po_items:
        vendor_doc = vendor_map.get(po.get("vendorName"), {})
        vendor_code = get_vendor_code(vendor_doc)
        po_grns = grn_item_map.get(po["randomId"], {})
        derived_po_status = get_dynamic_po_status(po, po_grns)

        item = po["items"]
        item_id = item.get("itemId")
        resolved = resolve_raw_material(item, raw_by_random, raw_by_code, raw_by_name)
        raw_info = resolved["info"]
        item_code_display = resolved["display_code"]

        qty = item.get("poQuantity", 0)
        price = item.get("newPrice", 0)
        tax_percentage = item.get("taxPercentage", 0)
        tax_type = item.get("taxType", "cgst_sgst")

        basic = qty * price
        tax_amount = basic * (tax_percentage / 100)
        line_total = basic + tax_amount

        cgst = sgst = igst = 0
        cgst_amt = sgst_amt = igst_amt = 0
        if tax_type == "cgst_sgst":
            cgst = sgst = tax_percentage / 2
            cgst_amt = sgst_amt = tax_amount / 2
        else:
            igst = tax_percentage
            igst_amt = tax_amount

        item_grns = po_grns.get(item_id, [])
        total_received = sum(g.get("receivedQty", 0) for g in item_grns)

        if item_grns:
            for grn in item_grns:
                grn_id = grn.get("grnNo")
                grn_status = grn.get("grnStatus")

                ap_data = {}
                ap_doc = ap_po_grn_map.get((po["randomId"], grn_id))
                if ap_doc:
                    ap_data = {
                        "apNo": ap_doc.get("randomId", ""),
                        "apStatus": ap_doc.get("status", ""),
                    }
                elif grn_status != "cancelled":
                    for ap_doc in ap_po_map.get(po["randomId"], []):
                        if not ap_doc.get("grnRandomId"):
                            ap_data = {
                                "apNo": ap_doc.get("randomId", ""),
                                "apStatus": ap_doc.get("status", ""),
                            }
                            break

                processed_data.append(
                    purchase(
                        purchaseOrderId=str(po["_id"])[-5:],
                        randomId=po.get("randomId"),
                        poRandomID=po.get("randomId"),
                        orderDate=fmt_date(po.get("orderDate")),
                        createdDate=fmt_date(po.get("createdDate")),
                        vendorName=po.get("vendorName"),
                        vendorId=vendor_doc.get("vendorId"),
                        sapVendorCode=vendor_code,
                        itemCode=item_code_display,
                        purchasecategoryName=raw_info.get("purchasecategoryName"),
                        purchasesubcategoryName=raw_info.get("purchasesubcategoryName"),
                        Dscription=item.get("itemName"),
                        poQuantity=qty,
                        pendingQuantity=qty - total_received,
                        price=price,
                        receivedQuantity=grn.get("receivedQty", 0),
                        totalReceivedAmount=grn.get("totalReceivedAmount", 0),
                        totalReceivedQuantity=total_received,
                        cgst=cgst,
                        sgst=sgst,
                        igst=igst,
                        cgstAmt=round(cgst_amt, 2),
                        sgstAmt=round(sgst_amt, 2),
                        igstAmt=round(igst_amt, 2),
                        taxAmount=round(tax_amount, 2),
                        finalPrice=round(basic, 2),
                        LineTotal=round(line_total, 2),
                        documentTotal=po_doc_total[po["randomId"]],
                        taxType=tax_type,
                        taxPercentage=tax_percentage,
                        grpo_No=grn_id,
                        grpoStatus=grn_status,
                        apNo=ap_data.get("apNo", ""),
                        apStatus=ap_data.get("apStatus", ""),
                        itemStatus=get_db_item_status(item, po, total_received),
                        poStatus=derived_po_status,
                    )
                )

        else:
            processed_data.append(
                purchase(
                    purchaseOrderId=str(po["_id"])[-5:],
                    randomId=po.get("randomId"),
                    poRandomID=po.get("randomId"),
                    orderDate=fmt_date(po.get("orderDate")),
                    createdDate=fmt_date(po.get("createdDate")),
                    vendorName=po.get("vendorName"),
                    vendorId=vendor_doc.get("vendorId"),
                    sapVendorCode=vendor_code,
                    itemCode=item_code_display,
                    purchasecategoryName=raw_info.get("purchasecategoryName"),
                    purchasesubcategoryName=raw_info.get("purchasesubcategoryName"),
                    Dscription=item.get("itemName"),
                    poQuantity=qty,
                    pendingQuantity=qty,
                    price=price,
                    receivedQuantity=0,
                    totalReceivedAmount=0,
                    totalReceivedQuantity=0,
                    cgst=cgst,
                    sgst=sgst,
                    igst=igst,
                    cgstAmt=round(cgst_amt, 2),
                    sgstAmt=round(sgst_amt, 2),
                    igstAmt=round(igst_amt, 2),
                    taxAmount=round(tax_amount, 2),
                    finalPrice=round(basic, 2),
                    LineTotal=round(line_total, 2),
                    documentTotal=po_doc_total[po["randomId"]],
                    taxType=tax_type,
                    taxPercentage=tax_percentage,
                    grpo_No="",
                    grpoStatus="",
                    apNo="",
                    apStatus="",
                    itemStatus=get_db_item_status(item, po, 0),
                    poStatus=derived_po_status,
                )
            )

    # ---------------- TOTAL RECORDS & PAGES ----------------
    total_records = await po_collection.count_documents(query)
    total_pages = (total_records + limit - 1) // limit

    return purchaseResponse(
        page=page,
        limit=limit,
        total_records=total_records,
        totalPages=total_pages,
        items=processed_data,
    )


def str_to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fmt_date(dt):
    return dt.strftime("%m-%d-%Y") if isinstance(dt, datetime) else ""


@router.get("/export", summary="Export Purchaseorder Report Excel")
async def export_po_reports(request:Request,
    startDate: Optional[datetime] = Query(None),
    endDate: Optional[datetime] = Query(None),
    vendorName: Optional[List[str]] = Query(None),
    poNo: Optional[List[str]] = Query(None),
    user=Depends(validate_token),
    permissions=Depends(check_permission("yenerp", "purchaseorderreport", "read"))
):
    tenant_id = request.state.tenant_id
    query = {}

    # ---------------- DATE FILTERS ----------------
    if startDate and endDate:
        query["createdDate"] = {"$gte": startDate, "$lt": endDate + timedelta(days=1)}
    elif startDate:
        query["createdDate"] = {"$gte": startDate}
    elif endDate:
        query["createdDate"] = {"$lt": endDate + timedelta(days=1)}

    if vendorName:
        query["vendorName"] = {"$in": vendorName}

    if poNo:
        query["randomId"] = {"$in": poNo}

    # ---------------- COLLECTIONS ----------------
    po_collection = purchaseorder_collection(tenant_id)
    vendor_db = vendor_collection(tenant_id)
    raw_db = rawMaterials_collection(tenant_id)
    ap_db = apInvoice_collection(tenant_id)

    # ---------------- FETCH POs FIRST ----------------
    pos = await po_collection.find(
        query,
        {
            "_id": 1,
            "randomId": 1,
            "vendorName": 1,
            "createdDate": 1,
            "orderDate": 1,
            "poStatus": 1,
            "items": 1,
        },
    ).to_list(None)

    if not pos:
        raise HTTPException(status_code=404, detail="No records found")

    po_ids = [po["randomId"] for po in pos]
    grn_db = grn_collection(tenant_id)
    # ---------------- FETCH RELATED DATA ONLY ----------------
    vendors, raws, grns, aps = await asyncio.gather(
        vendor_db.find(
            {}, {"vendorName": 1, "sapVendorCode": 1, "randomId": 1}
        ).to_list(None),
        raw_db.find(
            {},
            {
                "itemId": 1,
                "itemName": 1,
                "randomId": 1,
                "itemCode": 1,
                "purchasecategoryName": 1,
                "purchasesubcategoryName": 1,
            },
        ).to_list(None),
        grn_db.find(
            {"poRandomID": {"$in": po_ids}},
            {
                "randomId": 1,
                "poRandomID": 1,
                "status": 1,
                "itemDetails": 1,
                "totalReceivedAmount": 1,
            },
        ).to_list(None),
        ap_db.find(
            {"poRandomId": {"$in": po_ids}},
            {
                "randomId": 1,
                "poRandomId": 1,
                "grnRandomId": 1,  # Added this field
                "status": 1,
                "itemDetails": 1,
            },
        ).to_list(None),
    )

    # ---------------- LOOKUP MAPS ----------------
    vendor_map = {v["vendorName"]: v for v in vendors if v.get("vendorName")}

    raw_by_random = {r["randomId"]: r for r in raws if r.get("randomId")}
    # Map by itemCode
    raw_by_code = {r["itemCode"]: r for r in raws if r.get("itemCode")}
    # Map by itemName
    raw_by_name = {r["itemName"]: r for r in raws if r.get("itemName")}

    # ---------------- GRN MAP ----------------
    # Organize by poRandomID → itemId → list of GRNs
    grn_item_map = defaultdict(lambda: defaultdict(list))

    for g in grns:
        po_id = g.get("poRandomID")
        grn_id = g.get("randomId")
        for it in g.get("itemDetails", []):
            key = it.get("itemId")
            if key:
                grn_item_map[po_id][key].append(
                    {
                        "grnNo": grn_id,
                        "grnStatus": g.get("status"),
                        "receivedQty": it.get("receivedQuantity", 0),
                        "totalReceivedAmount": g.get("totalReceivedAmount", 0),
                    }
                )

    # ---------------- AP MAP ----------------
    # Create a map for quick lookup: (poRandomId, grnRandomId) → AP document
    # Also create a map for poRandomId → list of APs for fallback
    ap_po_grn_map = {}  # Key: (poRandomId, grnRandomId)
    ap_po_map = defaultdict(list)  # Key: poRandomId

    for ap in aps:
        po_id = ap.get("poRandomId")
        grn_id = ap.get("grnRandomId")

        if po_id and grn_id:
            ap_po_grn_map[(po_id, grn_id)] = ap

        if po_id:
            ap_po_map[po_id].append(ap)

    # ---------------- PRE-CALCULATE DOCUMENT TOTAL ----------------
    po_doc_total = {}
    for po in pos:
        total = 0.0
        for item in po.get("items", []):

            qty = item.get("poQuantity", 0)
            price = item.get("newPrice", 0)
            tax = item.get("taxPercentage", 0)
            basic = qty * price
            total += basic + (basic * tax / 100)
        po_doc_total[po["randomId"]] = round(total, 2)

    def fmt_date(dt):
        return dt.strftime("%d-%m-%Y") if isinstance(dt, datetime) else ""

    # ---------------- BUILD ROWS ----------------
    rows = []

    for po in pos:
        vendor_doc = vendor_map.get(po.get("vendorName"), {})
        vendor_code = get_vendor_code(vendor_doc)

        po_grns = grn_item_map.get(po["randomId"], {})
        derived_po_status = get_dynamic_po_status(po, po_grns)

        for item in po.get("items", []):
            item_id = item.get("itemId")

            resolved = resolve_raw_material(
                item, raw_by_random, raw_by_code, raw_by_name
            )
            raw_info = resolved["info"]
            item_code_display = resolved["display_code"]
            raw_info = (
                raw_by_random.get(item.get("randomId"))
                or raw_by_code.get(item.get("itemCode"))
                or raw_by_name.get(item.get("itemName"))
                or {}
            )
            qty = item.get("poQuantity", 0)
            price = item.get("newPrice", 0)
            tax_percentage = item.get("taxPercentage", 0)
            tax_type = item.get("taxType", "cgst_sgst")

            basic = qty * price
            tax_amount = basic * (tax_percentage / 100)
            line_total = basic + tax_amount

            cgst = sgst = igst = 0
            cgst_amt = sgst_amt = igst_amt = 0

            if tax_type == "cgst_sgst":
                cgst = sgst = tax_percentage / 2
                cgst_amt = sgst_amt = tax_amount / 2
            else:
                igst = tax_percentage
                igst_amt = tax_amount

            item_grns = po_grns.get(item_id, [])
            total_received = sum(g.get("receivedQty", 0) for g in item_grns)

            # Process each GRN separately
            for grn_data in item_grns:
                grn_id = grn_data.get("grnNo")
                grn_status = grn_data.get("grnStatus")

                # Try to find matching AP by both poRandomId AND grnRandomId
                ap_data = {}
                if po["randomId"] and grn_id:
                    ap_doc = ap_po_grn_map.get((po["randomId"], grn_id))
                    if ap_doc:
                        ap_data = {
                            "apNo": ap_doc.get("randomId", ""),
                            "apStatus": ap_doc.get("status", ""),
                        }

                # If no AP found for this GRN, check if we should show any AP
                # Only show AP for GRNs that are not cancelled
                if not ap_data and grn_status != "cancelled":
                    # Fallback: get first AP for this PO (but this might not be accurate)
                    aps_for_po = ap_po_map.get(po["randomId"], [])
                    if aps_for_po:
                        # Try to find AP that matches the GRN status logic
                        for ap_doc in aps_for_po:
                            if ap_doc.get("grnRandomId"):
                                continue  # Skip if already matched to another GRN
                            ap_data = {
                                "apNo": ap_doc.get("randomId", ""),
                                "apStatus": ap_doc.get("status", ""),
                            }
                            break

                rows.append(
                    {
                        "Internal No": str(po["_id"]),
                        "POSTING DATE": fmt_date(po.get("createdDate")),
                        "PO.No": po.get("randomId"),
                        "PO Date": fmt_date(po.get("orderDate")),
                        "PO Status": derived_po_status,
                        "Item Status": get_db_item_status(item, po, total_received),
                        "GRPO.No": grn_id or "",
                        "GRPO.Status": grn_status or "",
                        "A/P.No": ap_data.get("apNo", ""),
                        "A/P.Status": ap_data.get("apStatus", ""),
                        "Customer/Vendor Code": vendor_code,
                        "Customer/Vendor Name": po.get("vendorName"),
                        "ItemCode": item_code_display,
                        "Category": raw_info.get("purchasecategoryName"),
                        "Sub Category": raw_info.get("purchasesubcategoryName"),
                        "Dscription": item.get("itemName"),
                        "Order.Qty": qty,
                        "Pending Qty": qty - total_received,
                        "Price": price,
                        "CGST%": cgst,
                        "CGST": round(cgst_amt, 2),
                        "SGST%": sgst,
                        "SGST": round(sgst_amt, 2),
                        "IGST%": igst,
                        "IGST": round(igst_amt, 2),
                        "Tax Amount": round(tax_amount, 2),
                        "LineTotal": round(line_total, 2),
                        "Document Total": po_doc_total[po["randomId"]],
                        "Basic Value": round(basic, 2),
                        "Receive.Qty": grn_data.get("receivedQty", 0),
                        "Receive.Price": grn_data.get("totalReceivedAmount", 0),
                    }
                )

            # If no GRNs exist for this item, add a row without GRN/AP
            if not item_grns:
                rows.append(
                    {
                        "Internal No": str(po["_id"]),
                        "POSTING DATE": fmt_date(po.get("createdDate")),
                        "PO.No": po.get("randomId"),
                        "PO Date": fmt_date(po.get("orderDate")),
                        "PO Status": derived_po_status,
                        "Item Status": get_db_item_status(item, po, 0),
                        "GRPO.No": "",
                        "GRPO.Status": "",
                        "A/P.No": "",
                        "A/P.Status": "",
                        "Customer/Vendor Code": vendor_code,
                        "Customer/Vendor Name": po.get("vendorName"),
                        "ItemCode": item_code_display,
                        "Category": raw_info.get("purchasecategoryName"),
                        "Sub Category": raw_info.get("purchasesubcategoryName"),
                        "Dscription": item.get("itemName"),
                        "Order.Qty": qty,
                        "Pending Qty": qty,
                        "Price": price,
                        "CGST%": cgst,
                        "CGST": round(cgst_amt, 2),
                        "SGST%": sgst,
                        "SGST": round(sgst_amt, 2),
                        "IGST%": igst,
                        "IGST": round(igst_amt, 2),
                        "Tax Amount": round(tax_amount, 2),
                        "LineTotal": round(line_total, 2),
                        "Document Total": po_doc_total[po["randomId"]],
                        "Basic Value": round(basic, 2),
                        "Receive.Qty": 0,
                        "Receive.Price": 0,
                    }
                )

    # ---------------- EXPORT ----------------
    df = pd.DataFrame(rows)
    output = BytesIO()
    download_time = datetime.now().strftime("%d-%m-%Y_%H-%M")
    filename = f"Purchaseorder_YenERP_{download_time}.xlsx"

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")
        writer.sheets["Sheet1"].set_column(0, len(df.columns), 18)

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
