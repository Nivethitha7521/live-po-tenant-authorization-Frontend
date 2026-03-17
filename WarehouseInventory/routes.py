import csv
from datetime import datetime
import io
import json
import math
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, Query, File, UploadFile,Request
from fastapi.responses import StreamingResponse
from pymongo import UpdateOne
import pandas as pd
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from OutletInventory.funtions import ist_now
from db.collections import (
    purchaseitem_collection,
    stock_updates_collection,
    inventory_stock_collection,
    warehouse_collection,
    purchase_uom_collection,  # Added UOM collection
)
from WarehouseInventory.funtions import get_filter_options
from WarehouseInventoryVariance.funtions import round3
from .models import (
    RawMaterialResponse,
    SearchResponse,
    StockBulkUpdateModel,
    StockResponseModel,
    StockUpdateModel,
    WarehouseResponse,
)

router = APIRouter()

# ==================== UOM PRECISION HELPER ====================


async def get_uom_precision_map() -> Dict[str, int]:

    cursor = purchase_uom_collection().find({}, {"uom": 1, "precisionValue": 1})
    docs = await cursor.to_list(None)

    uom_map = {}
    for doc in docs:
        uom_name = doc.get("uom")
        prec_val = doc.get("precisionValue", "1")  # Default to "1" (Integer) if missing

        precision_int = 0

        # Logic to convert "0.001" -> 3, "1" -> 0, "0.01" -> 2
        if isinstance(prec_val, (int, float)):
            # If stored as number 0.001
            if prec_val == 0:
                precision_int = 0
            else:
                precision_int = int(round(-math.log10(abs(prec_val))))

        elif isinstance(prec_val, str):
            try:
                # If stored as string "0.001"
                float_val = float(prec_val)
                if float_val == 0:
                    precision_int = 0
                else:
                    # Calculate decimal places: -log10(0.001) = 3
                    precision_int = int(round(-math.log10(abs(float_val))))
            except:
                # Fallback: count decimal places in string "0.001" -> 3
                if "." in prec_val:
                    precision_int = len(prec_val.split(".")[1])
                else:
                    precision_int = 0

        if uom_name:
            uom_map[uom_name] = precision_int

    return uom_map


def round_by_precision(value: float, precision: int) -> float:
    """
    Rounds value to specific decimal places.
    If precision is 0, returns effectively an integer (e.g., 1.0).
    """
    if value is None:
        return 0.0
    # Using python round. round(1.5, 0) -> 2.0 (float), round(1.5, 3) -> 1.5
    return round(float(value), precision)


# ==================== EXISTING HELPERS ====================


def calculate_variance(system_stock: float, physical_stock: float) -> float:
    """Calculate variance between system and physical stock"""
    return round3(physical_stock - system_stock)


def is_duplicate_stock(doc: dict | None, incoming: float) -> bool:
    if not doc:
        return False
    return float(doc.get("systemStock", 0)) == float(incoming)


# ==================== ENDPOINTS ====================


@router.post("/inventory", response_model=StockResponseModel)
async def create_inventory_stock(
    payload: StockUpdateModel,
    request: Request, 
    updated_by: str = Query("System"),
    description: str = Query(""),
    status: str = Query("approved", description="Stock status - default: approved"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","add"))
):
    tenant_id = request.state.tenant_id
    purchase = purchaseitem_collection()
    inventory = inventory_stock_collection(tenant_id)
    history = stock_updates_collection(tenant_id)

    # 1. Fetch Item and UOM Precision
    item = await purchase.find_one({"randomId": payload.randomId})
    if not item:
        raise HTTPException(404, "Item not found in purchase")

    uom_map = await get_uom_precision_map()
    uom_name = item.get("uom", "")
    precision = uom_map.get(uom_name, 0)

    now = ist_now()
    # Apply precision to incoming stock
    incoming_stock = round_by_precision(float(payload.physicalStock), precision)

    doc = await inventory.find_one(
        {
            "randomId": payload.randomId,
            "locationId": payload.warehouseId,
        }
    )

    # DUPLICATE CHECK
    if is_duplicate_stock(doc, incoming_stock):
        raise HTTPException(409, "Same stock already exists")

    if doc:
        before_stock = float(doc.get("systemStock", 0)) if doc else 0
        after_stock = incoming_stock
        variance = calculate_variance(after_stock, after_stock)
        variance_history = round_by_precision(after_stock - before_stock, precision)

        await inventory.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "previousSystemStock": before_stock,
                    "systemStock": after_stock,
                    "physicalStock": after_stock,
                    "variance": 0,
                    "status": status,
                    "updatedAt": now,
                    "lastUpdatedBy": updated_by,
                }
            },
        )
        action = "MANUAL_UPDATE"
    else:
        before_stock = 0
        after_stock = incoming_stock
        variance = calculate_variance(after_stock, after_stock)

        doc = {
            "randomId": payload.randomId,
            "locationId": payload.warehouseId,
            "itemType": item.get("itemType", ""),
            "systemStock": after_stock,
            "physicalStock": after_stock,
            "systemStockSo": 0,
            "physicalStockSo": 0,
            "previousSystemStock": 0,
            "variance": variance,
            "status": status,
            "createdAt": now,
            "updatedAt": now,
            "createdBy": updated_by,
            "lastUpdatedBy": updated_by,
        }
        await inventory.insert_one(doc)
        action = "POST_CREATE"

    await history.insert_one(
        {
            "randomId": payload.randomId,
            "locationId": payload.warehouseId,
            "itemType": item.get("itemType", ""),
            "beforeStock": before_stock,
            "afterStock": after_stock,
            "variance": variance_history,
            "status": status,
            "updatedAt": now,
            "action": action,
            "updatedBy": updated_by,
            "description": description,
        }
    )

    doc.pop("_id", None)
    return StockResponseModel(**doc)


@router.get("/warehouses", response_model=List[WarehouseResponse])
async def get_item_names(
    page: int = Query(1, ge=1),
    limit: int = Query(30, le=50),
    search: str | None = None
):
    collection = warehouse_collection()

    query = {}
    if search:
        query = {"warehouseName": {"$regex": search, "$options": "i"}, "status": 1}

    cursor = (
        collection.find(
            query,
            {
                "_id": 0,
                "aliasName": 1,
                "warehouseName": 1,
                "warehouseId": 1,
            },
        )
        .sort("warehouseId", 1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(
            {
                "aliasName": doc["aliasName"],
                "locationName": doc["warehouseName"],
                "locationId": doc["warehouseId"],
            }
        )

    return items


@router.get("/", response_model=SearchResponse)
async def search_raw_materials(request:Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    locationId: str = Query(...),
    purchasecategoryName: Optional[str] = None,
    purchasesubcategoryName: Optional[str] = None,
    itemName: Optional[str] = None,
    varianceName: Optional[str] = None,
    category_page: int = Query(1, alias="categoryPage"),
    category_limit: int = Query(10, alias="categoryLimit"),
    category_search: Optional[str] = Query(None, alias="categorySearch"),
    subcategory_page: int = Query(1, alias="subCategoryPage"),
    subcategory_limit: int = Query(10, alias="subCategoryLimit"),
    subcategory_search: Optional[str] = Query(None, alias="subCategorySearch"),
    item_page: int = Query(1, alias="itemNamePage"),
    item_limit: int = Query(10, alias="itemNameLimit"),
    item_search: Optional[str] = Query(None, alias="itemNameSearch"),
    variance_page: int = Query(1, alias="varianceNamePage"),
    variance_limit: int = Query(10, alias="varianceNameLimit"),
    variance_search: Optional[str] = Query(None, alias="varianceNameSearch"),
    includeDropdowns: bool = Query(True),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","read"))
):
    tenant_id = request.state.tenant_id

    purchase = purchaseitem_collection()
    inventory = inventory_stock_collection(tenant_id)

    try:
        # 1. Fetch UOM Precision Map
        uom_precision_map = await get_uom_precision_map()

        def to_list(s: Optional[str]) -> List[str]:
            return [v.strip() for v in (s or "").split(",") if v.strip()]

        or_conditions = []
        if cats := to_list(purchasecategoryName):
            or_conditions.append({"purchasecategoryName": {"$in": cats}})
        if subs := to_list(purchasesubcategoryName):
            or_conditions.append({"purchasesubcategoryName": {"$in": subs}})
        if items := to_list(itemName):
            or_conditions.append({"itemgroupName": {"$in": items}})
        if vars_ := to_list(varianceName):
            or_conditions.append({"itemName": {"$in": vars_}})

        grid_query = {}
        if or_conditions:
            grid_query = {"$and": or_conditions}

        total = await purchase.count_documents(grid_query)

        cursor = purchase.find(
            grid_query,
            {
                "_id": 1,
                "randomId": 1,
                "purchasecategoryName": 1,
                "purchasesubcategoryName": 1,
                "itemgroupName": 1,
                "itemName": 1,
                "itemCode": 1,
                "itemType": 1,
                "uom": 1,  # Fetch UOM
            },
        )

        paginated = (
            await cursor.skip((page - 1) * limit).limit(limit).to_list(length=limit)
        )

        random_ids = [d["randomId"] for d in paginated if d.get("randomId")]

        inv_docs = await inventory.find(
            {"locationId": locationId, "randomId": {"$in": random_ids}},
            {
                "randomId": 1,
                "systemStock": 1,
                "previousSystemStock": 1,
                "physicalStock": 1,
                "systemStockSo": 1,
                "variance": 1,
                "status": 1,
                "updatedAt": 1,
            },
        ).to_list(length=None)

        inv_map = {d["randomId"]: d for d in inv_docs}

        results = []
        for d in paginated:
            rid = d.get("randomId")
            inv = inv_map.get(rid)

            # Get precision for this item
            uom_name = d.get("uom", "")
            precision = uom_precision_map.get(uom_name, 0)

            system_stock = (
                round_by_precision(inv.get("systemStock", 0), precision) if inv else 0
            )
            physical_stock = (
                round_by_precision(inv.get("physicalStock", 0), precision) if inv else 0
            )

            # Calculate variance if not present, otherwise use stored value
            if inv and "variance" in inv:
                variance = round_by_precision(inv.get("variance", 0), precision)
            else:
                variance = round_by_precision(
                    calculate_variance(system_stock, physical_stock), precision
                )

            systemStockSo = (
                round_by_precision(inv.get("systemStockSo", 0), precision) if inv else 0
            )
            prev = (
                float(
                    round_by_precision(
                        inv.get("previousSystemStock", 0) or 0, precision
                    )
                )
                if inv
                else 0
            )
            status = inv.get("status", "approved") if inv else "approved"
            updated_at = (
                inv.get("updatedAt", datetime.utcnow()) if inv else datetime.utcnow()
            )

            results.append(
                RawMaterialResponse(
                    randomId=d.get("randomId"),
                    category=(d.get("purchasecategoryName") or "").upper(),
                    subcategory=(d.get("purchasesubcategoryName") or "").upper(),
                    itemName=(d.get("itemgroupName") or "").upper(),
                    varianceName=(d.get("itemName") or "").upper(),
                    itemCode=d.get("randomId"),
                    systemStockSo=systemStockSo,
                    stockQuantity=system_stock,
                    physicalStock=physical_stock,
                    previousSystemStock=prev,
                    variance=variance,
                    status=status,
                    updatedAt=updated_at,
                )
            )

        dropdowns = None
        if includeDropdowns:
            active = {
                "purchasecategoryName": purchasecategoryName or "",
                "purchasesubcategoryName": purchasesubcategoryName or "",
                "itemgroupName": itemName or "",
                "itemName": varianceName or "",
            }

            dropdowns = {
                "categories": await get_filter_options(
                    purchase,
                    "purchasecategoryName",
                    category_page,
                    category_limit,
                    category_search,
                    purchasecategoryName,
                    active,
                ),
                "subcategories": await get_filter_options(
                    purchase,
                    "purchasesubcategoryName",
                    subcategory_page,
                    subcategory_limit,
                    subcategory_search,
                    purchasesubcategoryName,
                    active,
                ),
                "itemNames": await get_filter_options(
                    purchase,
                    "itemgroupName",
                    item_page,
                    item_limit,
                    item_search,
                    itemName,
                    active,
                ),
                "varianceNames": await get_filter_options(
                    purchase,
                    "itemName",
                    variance_page,
                    variance_limit,
                    variance_search,
                    varianceName,
                    active,
                ),
            }

        return SearchResponse(
            results=results,
            total=total,
            page=page,
            limit=limit,
            dropdown_values=dropdowns,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/inventory", response_model=StockResponseModel)
async def update_inventory_stock(request:Request,
    payload: StockUpdateModel,
    updated_by: str = Query(""),
    description: str = Query(""),
    status: str = Query("approved", description="Stock status - default: approved"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","edit"))
):
    tenant_id = request.state.tenant_id
    purchase = purchaseitem_collection()
    inventory = inventory_stock_collection(tenant_id)
    history = stock_updates_collection(tenant_id)

    # 1️⃣ Fetch purchase item
    item = await purchase.find_one({"randomId": payload.randomId})
    if not item:
        raise HTTPException(404, "Item not found in purchase")

    # 2️⃣ UOM precision
    uom_map = await get_uom_precision_map()
    precision = uom_map.get(item.get("uom", ""), 0)

    now = ist_now()
    incoming_stock = round_by_precision(float(payload.physicalStock), precision)

    # 3️⃣ Fetch existing inventory (if any)
    doc = await inventory.find_one(
        {
            "randomId": payload.randomId,
            "locationId": payload.warehouseId,
        }
    )

    # 4️⃣ Duplicate check
    if doc and is_duplicate_stock(doc, incoming_stock):
        raise HTTPException(409, "Stock unchanged. Update skipped.")

    # 5️⃣ Determine before and after stock
    before_stock = float(doc.get("systemStock", 0)) if doc else 0
    after_stock = incoming_stock

    # 6️⃣ Calculate variance
    variance = round_by_precision(after_stock - before_stock, precision)

    # 7️⃣ Update or insert inventory
    if doc:
        await inventory.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "previousSystemStock": before_stock,
                    "systemStock": after_stock,
                    "physicalStock": after_stock,
                    "variance": 0,  # inventory variance = physical - system
                    "status": status,
                    "updatedAt": now,
                    "lastUpdatedBy": updated_by,
                }
            },
        )
        action = "MANUAL_UPDATE"
    else:
        doc = {
            "randomId": payload.randomId,
            "locationId": payload.warehouseId,
            "itemType": item.get("itemType", ""),
            "systemStock": after_stock,
            "physicalStock": after_stock,
            "systemStockSo": 0,
            "physicalStockSo": 0,
            "previousSystemStock": 0,
            "variance": 0,  # new stock variance
            "status": status,
            "createdAt": now,
            "updatedAt": now,
            "createdBy": updated_by,
            "lastUpdatedBy": updated_by,
        }
        await inventory.insert_one(doc)
        action = "PATCH_CREATE"

    # 8️⃣ Insert history
    await history.insert_one(
        {
            "randomId": payload.randomId,
            "locationId": payload.warehouseId,
            "itemType": item.get("itemType", ""),
            "beforeStock": before_stock,  # 0 if inventory missing
            "afterStock": after_stock,
            "variance": variance,  # after - before
            "status": status,
            "systemStockSo": 0,
            "physicalStockSo": 0,
            "updatedAt": now,
            "action": action,
            "updatedBy": updated_by,
            "description": description,
        }
    )

    doc.pop("_id", None)
    return StockResponseModel(**doc)


@router.patch("/inventory/bulk")
async def update_inventory_stock_bulk(request:Request,
    payload: StockBulkUpdateModel,
    updated_by: str = Query(""),
    description: str = Query(""),
    status: str = Query("approved", description="Stock status - default: approved"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","edit"))

):
    tenant_id = request.state.tenant_id
    inventory = inventory_stock_collection(tenant_id)
    history = stock_updates_collection(tenant_id)
    purchase = purchaseitem_collection()

    # Get UOM Map
    uom_map = await get_uom_precision_map()

    now = ist_now()
    skipped = updated = created = 0

    # Pre-fetch purchase items to get UOM
    random_ids = [u.randomId for u in payload.updates]
    purchase_items = await purchase.find(
        {"randomId": {"$in": random_ids}}, {"randomId": 1, "uom": 1}
    ).to_list(None)
    purchase_map = {p["randomId"]: p for p in purchase_items}

    for u in payload.updates:
        doc = await inventory.find_one(
            {
                "randomId": u.randomId,
                "locationId": u.warehouseId,
            }
        )

        # Determine precision
        p_item = purchase_map.get(u.randomId)
        precision = uom_map.get(p_item.get("uom", ""), 0) if p_item else 0

        incoming = round_by_precision(float(u.physicalStock), precision)

        # Skip if duplicate
        if doc and is_duplicate_stock(doc, incoming):
            skipped += 1
            continue

        # Before and after stock
        before_stock = float(doc.get("systemStock", 0)) if doc else 0
        after_stock = incoming

        # Correct variance: after - before
        variance = round_by_precision(after_stock - before_stock, precision)

        if doc:
            # Update existing inventory
            await inventory.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "previousSystemStock": before_stock,
                        "systemStock": after_stock,
                        "physicalStock": after_stock,
                        "variance": 0,  # corrected
                        "status": status,
                        "updatedAt": now,
                        "lastUpdatedBy": updated_by,
                    }
                },
            )
            updated += 1
            action = "MANUAL_UPDATE"
        else:
            # Insert new inventory
            await inventory.insert_one(
                {
                    "randomId": u.randomId,
                    "locationId": u.warehouseId,
                    "systemStock": after_stock,
                    "physicalStock": after_stock,
                    "systemStockSo": 0,
                    "physicalStockSo": 0,
                    "previousSystemStock": 0,
                    "variance": 0,  # corrected
                    "status": status,
                    "createdAt": now,
                    "updatedAt": now,
                    "createdBy": updated_by,
                    "lastUpdatedBy": updated_by,
                }
            )
            created += 1
            action = "PATCH_CREATE"

        # Insert history
        await history.insert_one(
            {
                "randomId": u.randomId,
                "locationId": u.warehouseId,
                "beforeStock": before_stock,  # 0 if missing
                "afterStock": after_stock,
                "variance": variance,  # corrected
                "status": status,
                "updatedAt": now,
                "action": action,
                "updatedBy": updated_by,
                "description": description,
            }
        )

    return {
        "updated": updated,
        "created": created,
        "skipped": skipped,
    }


# EXPORT CSV
@router.get("/export")
async def export_all_items_with_inventory_stock(request:Request,
    locationId: str = Query(...),
    purchasecategoryName: Optional[str] = None,
    purchasesubcategoryName: Optional[str] = None,
    itemName: Optional[str] = None,
    varianceName: Optional[str] = None,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","read"))
):
    tenant_id = request.state.tenant_id
    purchase = purchaseitem_collection()
    inventory = inventory_stock_collection(tenant_id)

    try:
        # Get UOM Map
        uom_map = await get_uom_precision_map()

        def to_list(s):
            return [v.strip() for v in (s or "").split(",") if v.strip()]

        pur_query = {"status": "active"}

        if c := to_list(purchasecategoryName):
            pur_query["purchasecategoryName"] = {"$in": c}
        if s := to_list(purchasesubcategoryName):
            pur_query["purchasesubcategoryName"] = {"$in": s}
        if i := to_list(itemName):
            pur_query["itemgroupName"] = {"$in": i}
        if v := to_list(varianceName):
            pur_query["itemName"] = {"$in": v}

        pur_docs = await purchase.find(
            pur_query,
            {
                "randomId": 1,
                "itemCode": 1,
                "purchasecategoryName": 1,
                "purchasesubcategoryName": 1,
                "itemgroupName": 1,
                "itemName": 1,
                "uom": 1,  # Include UOM
            },
        ).to_list(length=None)

        if not pur_docs:
            raise HTTPException(404, "No purchase items found")

        random_ids = [d["randomId"] for d in pur_docs if d.get("randomId")]

        inv_docs = await inventory.find(
            {
                "locationId": locationId,
                "randomId": {"$in": random_ids},
            },
            {
                "randomId": 1,
                "systemStock": 1,
                "physicalStock": 1,
                "variance": 1,
                "status": 1,
                "updatedAt": 1,
            },
        ).to_list(length=None)

        inv_map = {d["randomId"]: d for d in inv_docs}

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "S.No",
                "RandomId",
                "Item Code",
                "Category",
                "Subcategory",
                "Item Name",
                "Variance Name",
                "System Stock",
                "PhysicalStock",
            ]
        )

        for idx, p in enumerate(pur_docs, 1):
            rid = p["randomId"]
            inv = inv_map.get(rid, {})

            # Apply precision
            uom_name = p.get("uom", "")
            precision = uom_map.get(uom_name, 0)

            system_stock = round_by_precision(inv.get("systemStock", 0), precision)
            physical_stock = round_by_precision(inv.get("physicalStock", 0), precision)

            variance = round_by_precision(
                inv.get("variance", calculate_variance(system_stock, physical_stock)),
                precision,
            )

            writer.writerow(
                [
                    idx,
                    rid,
                    p.get("itemCode", ""),
                    p.get("purchasecategoryName", ""),
                    p.get("purchasesubcategoryName", ""),
                    p.get("itemgroupName", ""),
                    p.get("itemName", ""),
                    system_stock,
                    physical_stock,  # Fixed export to show physical stock
                ]
            )

        output.seek(0)

        filename = (
            f"inventory_all_items_{locationId}_{datetime.utcnow():%Y%m%d_%H%M%S}.csv"
        )

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/importstocks")
async def import_inventory_onhand(request:Request,
    file: UploadFile = File(...),
    locationId: str = Query(...),
    updated_by: str = Query(""),
    status: str = Query("approved", description="Stock status - default: approved"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","add"))
):
    tenant_id = request.state.tenant_id
    purchase = purchaseitem_collection()
    inventory = inventory_stock_collection(tenant_id)
    history = stock_updates_collection(tenant_id)

    try:
        content = await file.read()

        # Read CSV or JSON
        try:
            df = pd.read_csv(io.BytesIO(content))
        except Exception:
            data = json.loads(content.decode())
            df = pd.DataFrame(data if isinstance(data, list) else [data])

        df.columns = df.columns.str.strip()

        if "RandomId" not in df.columns or "PhysicalStock" not in df.columns:
            raise HTTPException(
                400, "File must contain RandomId and PhysicalStock columns"
            )

        df["RandomId"] = df["RandomId"].astype(str).str.strip()
        df = df[df["RandomId"] != ""]

        if df.empty:
            raise HTTPException(400, "No valid RandomId found")

        now = ist_now()
        random_ids = df["RandomId"].unique().tolist()

        # Fetch purchase items
        purchase_items = await purchase.find(
            {"randomId": {"$in": random_ids}},
            {"randomId": 1, "itemType": 1, "status": 1, "uom": 1},
        ).to_list(length=None)
        purchase_map = {p["randomId"]: p for p in purchase_items}
        uom_map = await get_uom_precision_map()

        # Fetch existing inventory
        inv_docs = await inventory.find(
            {"locationId": locationId, "randomId": {"$in": random_ids}}
        ).to_list(length=None)
        inv_map = {d["randomId"]: d for d in inv_docs}

        # Initialize counters and tracking lists
        updates: list[UpdateOne] = []
        history_docs = []
        updated = created = skipped = 0
        skipped_rows = []
        failed_rows = []

        for row in df.itertuples(index=False):
            random_id = row.RandomId

            # Parse physical stock
            try:
                raw_physical = float(str(row.PhysicalStock).replace(",", ""))
            except Exception:
                failed_rows.append(
                    {"randomId": random_id, "reason": "Invalid PhysicalStock"}
                )
                continue

            doc = inv_map.get(random_id)
            purchase_item = purchase_map.get(random_id)

            # Check missing or inactive purchase items
            if not purchase_item:
                failed_rows.append(
                    {"randomId": random_id, "reason": "Item missing in purchase"}
                )
                continue
            elif purchase_item.get("status") != "active":
                failed_rows.append({"randomId": random_id, "reason": "Item inactive"})
                continue

            uom_name = purchase_item.get("uom", "")
            precision = uom_map.get(uom_name, 0)
            physical_qty = round_by_precision(raw_physical, precision)

            # Determine before & after stock
            before_stock_inventory = float(doc.get("systemStock", 0)) if doc else 0
            after_stock_inventory = physical_qty

            # Skip if no change
            if doc and before_stock_inventory == physical_qty:
                skipped += 1
                skipped_rows.append(
                    {"randomId": random_id, "reason": "Stock unchanged"}
                )
                # Insert history even for skipped
                variance_history = 0
                history_docs.append(
                    {
                        "randomId": random_id,
                        "locationId": locationId,
                        "itemType": purchase_item.get("itemType", ""),
                        "beforeStock": before_stock_inventory,
                        "afterStock": after_stock_inventory,
                        "variance": variance_history,
                        "status": status,
                        "updatedAt": now,
                        "action": "CSV_IMPORT",
                        "updatedBy": updated_by,
                        "description": "Skipped - no change in inventory",
                    }
                )
                continue

            # Variance calculation
            variance_inventory = round_by_precision(
                after_stock_inventory - before_stock_inventory, precision
            )

            # Update inventory
            if doc:
                updates.append(
                    UpdateOne(
                        {"randomId": random_id, "locationId": locationId},
                        {
                            "$set": {
                                "systemStock": after_stock_inventory,
                                "physicalStock": after_stock_inventory,
                                "previousSystemStock": before_stock_inventory,
                                "variance": variance_inventory,
                                "status": status,
                                "updatedAt": now,
                                "lastUpdatedBy": updated_by,
                            }
                        },
                    )
                )
                updated += 1
            else:
                # New inventory
                new_doc = {
                    "randomId": random_id,
                    "locationId": locationId,
                    "itemType": purchase_item.get("itemType", ""),
                    "systemStock": after_stock_inventory,
                    "physicalStock": after_stock_inventory,
                    "systemStockSo": 0,
                    "physicalStockSo": 0,
                    "variance": 0,
                    "previousSystemStock": 0,
                    "status": status,
                    "createdAt": now,
                    "updatedAt": now,
                    "createdBy": updated_by,
                    "lastUpdatedBy": updated_by,
                }
                updates.append(
                    UpdateOne(
                        {"randomId": random_id, "locationId": locationId},
                        {"$set": new_doc},
                        upsert=True,
                    )
                )
                created += 1

            # Insert history
            history_docs.append(
                {
                    "randomId": random_id,
                    "locationId": locationId,
                    "itemType": purchase_item.get("itemType", ""),
                    "beforeStock": before_stock_inventory,
                    "afterStock": after_stock_inventory,
                    "variance": variance_inventory,
                    "status": status,
                    "updatedAt": now,
                    "action": "CSV_IMPORT",
                    "updatedBy": updated_by,
                    "description": "",
                }
            )

        # Execute bulk writes
        if updates:
            await inventory.bulk_write(updates, ordered=False)

        if history_docs:
            await history.insert_many(history_docs)

        # Return summary with skipped/failed details
        return {
            "message": "Inventory import completed successfully",
            "locationId": locationId,
            "totalRows": len(df),
            "updated": updated,
            "created": created,
            "skipped": skipped,
            "skippedRows": skipped_rows,
            "failedRows": failed_rows,
        }

    except Exception as e:
        raise HTTPException(500, f"Import failed: {e}")


@router.post("/bulk-inventory")
async def bulk_create_update_stock(request:Request,
    items: List[StockUpdateModel],
    updated_by: str = Query("System"),
    description: str = Query(""),
    status: str = Query("approved", description="Stock status - default: approved"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp","warehousephysicalstockmodification","add"))
):
    tenant_id = request.state.tenant_id
    purchase = purchaseitem_collection()
    inventory = inventory_stock_collection(tenant_id)
    history = stock_updates_collection(tenant_id)

    if not items:
        raise HTTPException(400, "No items provided")

    now = ist_now()
    updates = []
    history_docs = []
    results = []

    random_ids = [item.randomId for item in items]
    purchase_items = await purchase.find(
        {"randomId": {"$in": random_ids}},
        {"randomId": 1, "itemType": 1, "uom": 1},  # Get UOM
    ).to_list(length=None)

    purchase_map = {item["randomId"]: item for item in purchase_items}

    # Get UOM Map
    uom_map = await get_uom_precision_map()

    inv_docs = await inventory.find(
        {
            "locationId": items[0].warehouseId,
            "randomId": {"$in": random_ids},
        }
    ).to_list(length=None)

    inv_map = {d["randomId"]: d for d in inv_docs}

    for item in items:
        random_id = item.randomId
        warehouse_id = item.warehouseId

        if random_id not in purchase_map:
            results.append(
                {
                    "randomId": random_id,
                    "status": "error",
                    "message": "Item not found in purchase",
                }
            )
            continue

        purchase_item = purchase_map[random_id]
        item_type = purchase_item.get("itemType", "")

        # Precision
        uom_name = purchase_item.get("uom", "")
        precision = uom_map.get(uom_name, 0)
        physical_qty = round_by_precision(item.physicalStock, precision)
        variance = round_by_precision(
            calculate_variance(physical_qty, physical_qty), precision
        )

        existing_stock = inv_map.get(random_id)

        if existing_stock:
            prev_stock = existing_stock.get("systemStock", 0)
            prev_so = existing_stock.get("systemStockSo", prev_stock)
            prev_phy_so = existing_stock.get("physicalStockSo", prev_stock)

            updates.append(
                UpdateOne(
                    {"_id": existing_stock["_id"]},
                    {
                        "$set": {
                            "systemStock": physical_qty,
                            "physicalStock": physical_qty,
                            "previousSystemStock": prev_stock,
                            "variance": variance,
                            "status": status,
                            "updatedAt": now,
                            "lastUpdatedBy": updated_by,
                        }
                    },
                )
            )

            history_docs.append(
                {
                    "randomId": random_id,
                    "locationId": warehouse_id,
                    "itemType": item_type,
                    "systemStock": physical_qty,
                    "physicalStock": physical_qty,
                    "previousSystemStock": prev_stock,
                    "variance": variance,
                    "status": status,
                    "systemStockSo": prev_so,
                    "physicalStockSo": prev_phy_so,
                    "updatedAt": now,
                    "action": "MANUAL_UPDATE",
                    "updatedBy": updated_by,
                    "description": description,
                }
            )

            action = "updated"
        else:
            new_doc = {
                "randomId": random_id,
                "locationId": warehouse_id,
                "itemType": item_type,
                "systemStock": physical_qty,
                "physicalStock": physical_qty,
                "systemStockSo": 0,
                "physicalStockSo": 0,
                "previousSystemStock": 0,
                "variance": variance,
                "status": status,
                "createdAt": now,
                "updatedAt": now,
                "createdBy": updated_by,
                "lastUpdatedBy": updated_by,
            }

            updates.append(
                UpdateOne(
                    {"randomId": random_id, "locationId": warehouse_id},
                    {"$set": new_doc},
                    upsert=True,
                )
            )

            history_docs.append(
                {
                    **new_doc,
                    "action": "BULK_CREATE",
                    "description": description,
                }
            )

            action = "created"

        results.append(
            {
                "randomId": random_id,
                "status": "success",
                "action": action,
                "stock": physical_qty,
                "variance": variance,
            }
        )

    if updates:
        await inventory.bulk_write(updates, ordered=False)

    if history_docs:
        await history.insert_many(history_docs)

    return {
        "message": "Bulk operation completed",
        "results": results,
        "timestamp": now.isoformat(),
    }


@router.get("/export/sample")
async def export_sample_onhand():
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["RandomId", "PhysicalStock"])
    writer.writerow(["1757", "10"])
    writer.writerow(["1758", "0"])
    writer.writerow(["1759", "25"])

    output.seek(0)
    filename = f"sample_rmstock{datetime.utcnow():%Y%m%d_%H%M%S}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# import csv
# from datetime import datetime
# import io
# import json
# import math
# from typing import Optional, List, Dict
# from fastapi import APIRouter, HTTPException, Query, File, UploadFile
# from fastapi.responses import StreamingResponse
# from pymongo import UpdateOne
# import pandas as pd

# from OutletInventory.funtions import ist_now
# from db.collections import (
#     purchaseitem_collection,
#     stock_updates_collection,
#     inventory_stock_collection,
#     warehouse_collection,
#     purchase_uom_collection,  # Added UOM collection
# )
# from WarehouseInventory.funtions import get_filter_options
# from WarehouseInventoryVariance.funtions import round3
# from .models import (
#     RawMaterialResponse,
#     SearchResponse,
#     StockBulkUpdateModel,
#     StockResponseModel,
#     StockUpdateModel,
#     WarehouseResponse,
# )

# router = APIRouter()

# # ==================== UOM PRECISION HELPER ====================


# async def get_uom_precision_map() -> Dict[str, int]:

#     cursor = purchase_uom_collection().find({}, {"uom": 1, "precisionValue": 1})
#     docs = await cursor.to_list(None)

#     uom_map = {}
#     for doc in docs:
#         uom_name = doc.get("uom")
#         prec_val = doc.get("precisionValue", "1")  # Default to "1" (Integer) if missing

#         precision_int = 0

#         # Logic to convert "0.001" -> 3, "1" -> 0, "0.01" -> 2
#         if isinstance(prec_val, (int, float)):
#             # If stored as number 0.001
#             if prec_val == 0:
#                 precision_int = 0
#             else:
#                 precision_int = int(round(-math.log10(abs(prec_val))))

#         elif isinstance(prec_val, str):
#             try:
#                 # If stored as string "0.001"
#                 float_val = float(prec_val)
#                 if float_val == 0:
#                     precision_int = 0
#                 else:
#                     # Calculate decimal places: -log10(0.001) = 3
#                     precision_int = int(round(-math.log10(abs(float_val))))
#             except:
#                 # Fallback: count decimal places in string "0.001" -> 3
#                 if "." in prec_val:
#                     precision_int = len(prec_val.split(".")[1])
#                 else:
#                     precision_int = 0

#         if uom_name:
#             uom_map[uom_name] = precision_int

#     return uom_map


# def round_by_precision(value: float, precision: int) -> float:
#     """
#     Rounds value to specific decimal places.
#     If precision is 0, returns effectively an integer (e.g., 1.0).
#     """
#     if value is None:
#         return 0.0
#     # Using python round. round(1.5, 0) -> 2.0 (float), round(1.5, 3) -> 1.5
#     return round(float(value), precision)


# # ==================== EXISTING HELPERS ====================


# def calculate_variance(system_stock: float, physical_stock: float) -> float:
#     """Calculate variance between system and physical stock"""
#     return round3(physical_stock - system_stock)


# def is_duplicate_stock(doc: dict | None, incoming: float) -> bool:
#     if not doc:
#         return False
#     return float(doc.get("systemStock", 0)) == float(incoming)


# # ==================== ENDPOINTS ====================


# # @router.post("/inventory", response_model=StockResponseModel)
# # async def create_inventory_stock(
# #     payload: StockUpdateModel,
# #     updated_by: str = Query("System"),
# #     description: str = Query(""),
# #     status: str = Query("approved", description="Stock status - default: approved"),
# # ):
# #     purchase = purchaseitem_collection()
# #     inventory = inventory_stock_collection()
# #     history = stock_updates_collection()

# #     # 1. Fetch Item and UOM Precision
# #     item = await purchase.find_one({"randomId": payload.randomId})
# #     if not item:
# #         raise HTTPException(404, "Item not found in purchase")

# #     uom_map = await get_uom_precision_map()
# #     uom_name = item.get("uom", "")
# #     precision = uom_map.get(uom_name, 0)

# #     now = ist_now()
# #     # Apply precision to incoming stock
# #     incoming_stock = round_by_precision(float(payload.physicalStock), precision)

# #     doc = await inventory.find_one(
# #         {
# #             "randomId": payload.randomId,
# #             "locationId": payload.warehouseId,
# #         }
# #     )

# #     # DUPLICATE CHECK
# #     if is_duplicate_stock(doc, incoming_stock):
# #         raise HTTPException(409, "Same stock already exists")

# #     if doc:
# #         before_stock = float(doc.get("systemStock", 0))
# #         after_stock = incoming_stock
# #         variance = calculate_variance(after_stock, after_stock)

# #         await inventory.update_one(
# #             {"_id": doc["_id"]},
# #             {
# #                 "$set": {
# #                     "previousSystemStock": before_stock,
# #                     "systemStock": after_stock,
# #                     "physicalStock": after_stock,
# #                     "variance": variance,
# #                     "status": status,
# #                     "updatedAt": now,
# #                     "lastUpdatedBy": updated_by,
# #                 }
# #             },
# #         )
# #         action = "MANUAL_UPDATE"
# #     else:
# #         before_stock = 0
# #         after_stock = incoming_stock
# #         variance = calculate_variance(after_stock, after_stock)

# #         doc = {
# #             "randomId": payload.randomId,
# #             "locationId": payload.warehouseId,
# #             "itemType": item.get("itemType", ""),
# #             "systemStock": after_stock,
# #             "physicalStock": after_stock,
# #             "systemStockSo": 0,
# #             "physicalStockSo": 0,
# #             "previousSystemStock": 0,
# #             "variance": variance,
# #             "status": status,
# #             "createdAt": now,
# #             "updatedAt": now,
# #             "createdBy": updated_by,
# #             "lastUpdatedBy": updated_by,
# #         }
# #         await inventory.insert_one(doc)
# #         action = "POST_CREATE"

# #     await history.insert_one(
# #         {
# #             "randomId": payload.randomId,
# #             "locationId": payload.warehouseId,
# #             "itemType": item.get("itemType", ""),
# #             "beforeStock": before_stock,
# #             "afterStock": after_stock,
# #             "variance": variance,
# #             "status": status,
# #             "updatedAt": now,
# #             "action": action,
# #             "updatedBy": updated_by,
# #             "description": description,
# #         }
# #     )

# #     doc.pop("_id", None)
# #     return StockResponseModel(**doc)


# @router.post("/inventory", response_model=StockResponseModel)
# async def create_inventory_stock(
#     payload: StockUpdateModel,
#     updated_by: str = Query("System"),
#     description: str = Query(""),
#     status: str = Query("approved", description="Stock status - default: approved"),
# ):
#     purchase = purchaseitem_collection()
#     inventory = inventory_stock_collection()
#     history = stock_updates_collection()

#     # 1. Fetch Item and UOM Precision
#     item = await purchase.find_one({"randomId": payload.randomId})
#     if not item:
#         raise HTTPException(404, "Item not found in purchase")

#     uom_map = await get_uom_precision_map()
#     uom_name = item.get("uom", "")
#     precision = uom_map.get(uom_name, 0)

#     now = ist_now()
#     # Apply precision to incoming stock
#     incoming_stock = round_by_precision(float(payload.physicalStock), precision)

#     doc = await inventory.find_one(
#         {
#             "randomId": payload.randomId,
#             "locationId": payload.warehouseId,
#         }
#     )

#     # DUPLICATE CHECK
#     if is_duplicate_stock(doc, incoming_stock):
#         raise HTTPException(409, "Same stock already exists")

#     if doc:
#         before_stock = float(doc.get("systemStock", 0))
#         after_stock = incoming_stock
#         variance = calculate_variance(after_stock, after_stock)

#         await inventory.update_one(
#             {"_id": doc["_id"]},
#             {
#                 "$set": {
#                     "previousSystemStock": before_stock,
#                     "systemStock": after_stock,
#                     "physicalStock": after_stock,
#                     "variance": variance,
#                     "status": status,
#                     "updatedAt": now,
#                     "lastUpdatedBy": updated_by,
#                 }
#             },
#         )
#         action = "MANUAL_UPDATE"
#     else:
#         before_stock = 0
#         after_stock = incoming_stock
#         variance = calculate_variance(after_stock, after_stock)

#         doc = {
#             "randomId": payload.randomId,
#             "locationId": payload.warehouseId,
#             "itemType": item.get("itemType", ""),
#             "systemStock": after_stock,
#             "physicalStock": after_stock,
#             "systemStockSo": 0,
#             "physicalStockSo": 0,
#             "previousSystemStock": 0,
#             "variance": variance,
#             "status": status,
#             "createdAt": now,
#             "updatedAt": now,
#             "createdBy": updated_by,
#             "lastUpdatedBy": updated_by,
#         }
#         await inventory.insert_one(doc)
#         action = "POST_CREATE"

#     # --- Update purchase collection stockQuantity ---
#     await purchase.update_one(
#         {"randomId": payload.randomId},
#         {
#             "$set": {
#                 "stockQuantity": after_stock,
#                 "lastUpdatedDate": now,
#                 "updatedBy": updated_by,
#             }
#         },
#     )

#     # Insert stock update history
#     await history.insert_one(
#         {
#             "randomId": payload.randomId,
#             "locationId": payload.warehouseId,
#             "itemType": item.get("itemType", ""),
#             "beforeStock": before_stock,
#             "afterStock": after_stock,
#             "variance": variance,
#             "status": status,
#             "updatedAt": now,
#             "action": action,
#             "updatedBy": updated_by,
#             "description": description,
#         }
#     )

#     doc.pop("_id", None)
#     return StockResponseModel(**doc)


# @router.get("/warehouses", response_model=List[WarehouseResponse])
# async def get_item_names(
#     page: int = Query(1, ge=1),
#     limit: int = Query(30, le=50),
#     search: str | None = None,
# ):
#     collection = warehouse_collection()

#     query = {}
#     if search:
#         query = {"warehouseName": {"$regex": search, "$options": "i"}, "status": 1}

#     cursor = (
#         collection.find(
#             query,
#             {
#                 "_id": 0,
#                 "aliasName": 1,
#                 "warehouseName": 1,
#                 "warehouseId": 1,
#             },
#         )
#         .sort("warehouseId", 1)
#         .skip((page - 1) * limit)
#         .limit(limit)
#     )

#     items = []
#     async for doc in cursor:
#         items.append(
#             {
#                 "aliasName": doc["aliasName"],
#                 "locationName": doc["warehouseName"],
#                 "locationId": doc["warehouseId"],
#             }
#         )

#     return items


# # @router.get("/", response_model=SearchResponse)
# # async def search_raw_materials(
# #     page: int = Query(1, ge=1),
# #     limit: int = Query(10, ge=1, le=100),
# #     locationId: str = Query(...),
# #     purchasecategoryName: Optional[str] = None,
# #     purchasesubcategoryName: Optional[str] = None,
# #     itemName: Optional[str] = None,
# #     varianceName: Optional[str] = None,
# #     category_page: int = Query(1, alias="categoryPage"),
# #     category_limit: int = Query(10, alias="categoryLimit"),
# #     category_search: Optional[str] = Query(None, alias="categorySearch"),
# #     subcategory_page: int = Query(1, alias="subCategoryPage"),
# #     subcategory_limit: int = Query(10, alias="subCategoryLimit"),
# #     subcategory_search: Optional[str] = Query(None, alias="subCategorySearch"),
# #     item_page: int = Query(1, alias="itemNamePage"),
# #     item_limit: int = Query(10, alias="itemNameLimit"),
# #     item_search: Optional[str] = Query(None, alias="itemNameSearch"),
# #     variance_page: int = Query(1, alias="varianceNamePage"),
# #     variance_limit: int = Query(10, alias="varianceNameLimit"),
# #     variance_search: Optional[str] = Query(None, alias="varianceNameSearch"),
# #     includeDropdowns: bool = Query(True),
# # ):

# #     purchase = purchaseitem_collection()
# #     inventory = inventory_stock_collection()

# #     try:
# #         # 1. Fetch UOM Precision Map
# #         uom_precision_map = await get_uom_precision_map()

# #         def to_list(s: Optional[str]) -> List[str]:
# #             return [v.strip() for v in (s or "").split(",") if v.strip()]

# #         or_conditions = []
# #         if cats := to_list(purchasecategoryName):
# #             or_conditions.append({"purchasecategoryName": {"$in": cats}})
# #         if subs := to_list(purchasesubcategoryName):
# #             or_conditions.append({"purchasesubcategoryName": {"$in": subs}})
# #         if items := to_list(itemName):
# #             or_conditions.append({"itemgroupName": {"$in": items}})
# #         if vars_ := to_list(varianceName):
# #             or_conditions.append({"itemName": {"$in": vars_}})

# #         grid_query = {}
# #         if or_conditions:
# #             grid_query = {"$and": or_conditions}

# #         total = await purchase.count_documents(grid_query)

# #         cursor = purchase.find(
# #             grid_query,
# #             {
# #                 "_id": 1,
# #                 "randomId": 1,
# #                 "purchasecategoryName": 1,
# #                 "purchasesubcategoryName": 1,
# #                 "itemgroupName": 1,
# #                 "itemName": 1,
# #                 "itemCode": 1,
# #                 "itemType": 1,
# #                 "uom": 1,  # Fetch UOM
# #             },
# #         )

# #         paginated = (
# #             await cursor.skip((page - 1) * limit).limit(limit).to_list(length=limit)
# #         )

# #         random_ids = [d["randomId"] for d in paginated if d.get("randomId")]

# #         inv_docs = await inventory.find(
# #             {"locationId": locationId, "randomId": {"$in": random_ids}},
# #             {
# #                 "randomId": 1,
# #                 "systemStock": 1,
# #                 "previousSystemStock": 1,
# #                 "physicalStock": 1,
# #                 "systemStockSo": 1,
# #                 "variance": 1,
# #                 "status": 1,
# #                 "updatedAt": 1,
# #             },
# #         ).to_list(length=None)

# #         inv_map = {d["randomId"]: d for d in inv_docs}

# #         results = []
# #         for d in paginated:
# #             rid = d.get("randomId")
# #             inv = inv_map.get(rid)

# #             # Get precision for this item
# #             uom_name = d.get("uom", "")
# #             precision = uom_precision_map.get(uom_name, 0)

# #             system_stock = (
# #                 round_by_precision(inv.get("systemStock", 0), precision) if inv else 0
# #             )
# #             physical_stock = (
# #                 round_by_precision(inv.get("physicalStock", 0), precision) if inv else 0
# #             )

# #             # Calculate variance if not present, otherwise use stored value
# #             if inv and "variance" in inv:
# #                 variance = round_by_precision(inv.get("variance", 0), precision)
# #             else:
# #                 variance = round_by_precision(
# #                     calculate_variance(system_stock, physical_stock), precision
# #                 )

# #             systemStockSo = (
# #                 round_by_precision(inv.get("systemStockSo", 0), precision) if inv else 0
# #             )
# #             prev = (
# #                 float(
# #                     round_by_precision(
# #                         inv.get("previousSystemStock", 0) or 0, precision
# #                     )
# #                 )
# #                 if invd
# #                 else 0
# #             )
# #             status = inv.get("status", "approved") if inv else "approved"
# #             updated_at = (
# #                 inv.get("updatedAt", datetime.utcnow()) if inv else datetime.utcnow()
# #             )

# #             results.append(
# #                 RawMaterialResponse(
# #                     randomId=d.get("randomId"),
# #                     category=(d.get("purchasecategoryName") or "").upper(),
# #                     subcategory=(d.get("purchasesubcategoryName") or "").upper(),
# #                     itemName=(d.get("itemgroupName") or "").upper(),
# #                     varianceName=(d.get("itemName") or "").upper(),
# #                     itemCode=d.get("randomId"),
# #                     systemStockSo=systemStockSo,
# #                     stockQuantity=system_stock,
# #                     physicalStock=physical_stock,
# #                     previousSystemStock=prev,
# #                     variance=variance,
# #                     status=status,
# #                     updatedAt=updated_at,
# #                 )
# #             )

# #         dropdowns = None
# #         if includeDropdowns:
# #             active = {
# #                 "purchasecategoryName": purchasecategoryName or "",
# #                 "purchasesubcategoryName": purchasesubcategoryName or "",
# #                 "itemgroupName": itemName or "",
# #                 "itemName": varianceName or "",
# #             }

# #             dropdowns = {
# #                 "categories": await get_filter_options(
# #                     purchase,
# #                     "purchasecategoryName",
# #                     category_page,
# #                     category_limit,
# #                     category_search,
# #                     purchasecategoryName,
# #                     active,
# #                 ),
# #                 "subcategories": await get_filter_options(
# #                     purchase,
# #                     "purchasesubcategoryName",
# #                     subcategory_page,
# #                     subcategory_limit,
# #                     subcategory_search,
# #                     purchasesubcategoryName,
# #                     active,
# #                 ),
# #                 "itemNames": await get_filter_options(
# #                     purchase,
# #                     "itemgroupName",
# #                     item_page,
# #                     item_limit,
# #                     item_search,
# #                     itemName,
# #                     active,
# #                 ),
# #                 "varianceNames": await get_filter_options(
# #                     purchase,
# #                     "itemName",
# #                     variance_page,
# #                     variance_limit,
# #                     variance_search,
# #                     varianceName,
# #                     active,
# #                 ),
# #             }

# #         return SearchResponse(
# #             results=results,
# #             total=total,
# #             page=page,
# #             limit=limit,
# #             dropdown_values=dropdowns,
# #         )


# #     except Exception as e:
# #         raise HTTPException(status_code=500, detail=str(e))


# @router.get("/", response_model=SearchResponse)
# async def search_raw_materials(
#     page: int = Query(1, ge=1),
#     limit: int = Query(10, ge=1, le=100),
#     locationId: str = Query(...),
#     purchasecategoryName: Optional[str] = None,
#     purchasesubcategoryName: Optional[str] = None,
#     itemName: Optional[str] = None,
#     varianceName: Optional[str] = None,
#     category_page: int = Query(1, alias="categoryPage"),
#     category_limit: int = Query(10, alias="categoryLimit"),
#     category_search: Optional[str] = Query(None, alias="categorySearch"),
#     subcategory_page: int = Query(1, alias="subCategoryPage"),
#     subcategory_limit: int = Query(10, alias="subCategoryLimit"),
#     subcategory_search: Optional[str] = Query(None, alias="subCategorySearch"),
#     item_page: int = Query(1, alias="itemNamePage"),
#     item_limit: int = Query(10, alias="itemNameLimit"),
#     item_search: Optional[str] = Query(None, alias="itemNameSearch"),
#     variance_page: int = Query(1, alias="varianceNamePage"),
#     variance_limit: int = Query(10, alias="varianceNameLimit"),
#     variance_search: Optional[str] = Query(None, alias="varianceNameSearch"),
#     includeDropdowns: bool = Query(True),
# ):

#     purchase = purchaseitem_collection()
#     inventory = inventory_stock_collection()

#     try:
#         uom_precision_map = await get_uom_precision_map()

#         def to_list(s: Optional[str]) -> List[str]:
#             return [v.strip() for v in (s or "").split(",") if v.strip()]

#         or_conditions = []
#         if cats := to_list(purchasecategoryName):
#             or_conditions.append({"purchasecategoryName": {"$in": cats}})
#         if subs := to_list(purchasesubcategoryName):
#             or_conditions.append({"purchasesubcategoryName": {"$in": subs}})
#         if items := to_list(itemName):
#             or_conditions.append({"itemgroupName": {"$in": items}})
#         if vars_ := to_list(varianceName):
#             or_conditions.append({"itemName": {"$in": vars_}})

#         grid_query = {"$and": or_conditions} if or_conditions else {}

#         total = await purchase.count_documents(grid_query)

#         cursor = purchase.find(
#             grid_query,
#             {
#                 "_id": 1,
#                 "randomId": 1,
#                 "purchasecategoryName": 1,
#                 "purchasesubcategoryName": 1,
#                 "itemgroupName": 1,
#                 "itemName": 1,
#                 "itemCode": 1,
#                 "itemType": 1,
#                 "uom": 1,
#                 "stockQuantity": 1,  # ✅ Always use this
#             },
#         )

#         paginated = (
#             await cursor.skip((page - 1) * limit).limit(limit).to_list(length=limit)
#         )

#         random_ids = [d["randomId"] for d in paginated if d.get("randomId")]

#         inv_docs = await inventory.find(
#             {"locationId": locationId, "randomId": {"$in": random_ids}},
#             {
#                 "randomId": 1,
#                 "previousSystemStock": 1,
#                 "systemStockSo": 1,
#                 "variance": 1,
#                 "status": 1,
#                 "updatedAt": 1,
#             },
#         ).to_list(length=None)

#         inv_map = {d["randomId"]: d for d in inv_docs}

#         results = []

#         for d in paginated:
#             rid = d.get("randomId")
#             inv = inv_map.get(rid)

#             uom_name = d.get("uom", "")
#             precision = uom_precision_map.get(uom_name, 0)

#             # ✅ ALWAYS USE PURCHASE STOCK
#             purchase_stock = d.get("stockQuantity", 0)

#             system_stock = round_by_precision(purchase_stock, precision)
#             physical_stock = round_by_precision(purchase_stock, precision)

#             # Inventory used only for extra info
#             if inv:
#                 prev = round_by_precision(inv.get("previousSystemStock", 0), precision)
#                 variance = round_by_precision(inv.get("variance", 0), precision)
#                 systemStockSo = round_by_precision(
#                     inv.get("systemStockSo", 0), precision
#                 )
#                 status = inv.get("status", "approved")
#                 updated_at = inv.get("updatedAt", datetime.utcnow())
#             else:
#                 prev = 0
#                 variance = 0
#                 systemStockSo = 0
#                 status = "approved"
#                 updated_at = datetime.utcnow()

#             results.append(
#                 RawMaterialResponse(
#                     randomId=d.get("randomId"),
#                     category=(d.get("purchasecategoryName") or "").upper(),
#                     subcategory=(d.get("purchasesubcategoryName") or "").upper(),
#                     itemName=(d.get("itemgroupName") or "").upper(),
#                     varianceName=(d.get("itemName") or "").upper(),
#                     itemCode=d.get("randomId"),
#                     systemStockSo=systemStockSo,
#                     stockQuantity=system_stock,  # ✅ From Purchase
#                     physicalStock=physical_stock,  # ✅ From Purchase
#                     previousSystemStock=prev,
#                     variance=variance,
#                     status=status,
#                     updatedAt=updated_at,
#                 )
#             )

#         dropdowns = None
#         if includeDropdowns:
#             active = {
#                 "purchasecategoryName": purchasecategoryName or "",
#                 "purchasesubcategoryName": purchasesubcategoryName or "",
#                 "itemgroupName": itemName or "",
#                 "itemName": varianceName or "",
#             }

#             dropdowns = {
#                 "categories": await get_filter_options(
#                     purchase,
#                     "purchasecategoryName",
#                     category_page,
#                     category_limit,
#                     category_search,
#                     purchasecategoryName,
#                     active,
#                 ),
#                 "subcategories": await get_filter_options(
#                     purchase,
#                     "purchasesubcategoryName",
#                     subcategory_page,
#                     subcategory_limit,
#                     subcategory_search,
#                     purchasesubcategoryName,
#                     active,
#                 ),
#                 "itemNames": await get_filter_options(
#                     purchase,
#                     "itemgroupName",
#                     item_page,
#                     item_limit,
#                     item_search,
#                     itemName,
#                     active,
#                 ),
#                 "varianceNames": await get_filter_options(
#                     purchase,
#                     "itemName",
#                     variance_page,
#                     variance_limit,
#                     variance_search,
#                     varianceName,
#                     active,
#                 ),
#             }

#         return SearchResponse(
#             results=results,
#             total=total,
#             page=page,
#             limit=limit,
#             dropdown_values=dropdowns,
#         )

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# # @router.patch("/inventory", response_model=StockResponseModel)
# # async def update_inventory_stock(
# #     payload: StockUpdateModel,
# #     updated_by: str = Query(""),
# #     description: str = Query(""),
# #     status: str = Query("approved", description="Stock status - default: approved"),
# # ):

# #     purchase = purchaseitem_collection()
# #     inventory = inventory_stock_collection()
# #     history = stock_updates_collection()

# #     item = await purchase.find_one({"randomId": payload.randomId})
# #     if not item:
# #         raise HTTPException(404, "Item not found in purchase")

# #     # Precision
# #     uom_map = await get_uom_precision_map()
# #     precision = uom_map.get(item.get("uom", ""), 0)

# #     now = ist_now()
# #     incoming_stock = round_by_precision(float(payload.physicalStock), precision)

# #     doc = await inventory.find_one(
# #         {
# #             "randomId": payload.randomId,
# #             "locationId": payload.warehouseId,
# #         }
# #     )

# #     if doc and is_duplicate_stock(doc, incoming_stock):
# #         raise HTTPException(409, "Stock unchanged. Update skipped.")

# #     before_stock = float(doc.get("systemStock", 0)) if doc else 0
# #     after_stock = incoming_stock
# #     variance = round_by_precision(
# #         calculate_variance(after_stock, after_stock), precision
# #     )

# #     if doc:
# #         await inventory.update_one(
# #             {"_id": doc["_id"]},
# #             {
# #                 "$set": {
# #                     "previousSystemStock": before_stock,
# #                     "systemStock": after_stock,
# #                     "physicalStock": after_stock,
# #                     "variance": variance,
# #                     "status": status,
# #                     "updatedAt": now,
# #                     "lastUpdatedBy": updated_by,
# #                 }
# #             },
# #         )
# #         action = "MANUAL_UPDATE"
# #     else:
# #         doc = {
# #             "randomId": payload.randomId,
# #             "locationId": payload.warehouseId,
# #             "itemType": item.get("itemType", ""),
# #             "systemStock": after_stock,
# #             "physicalStock": after_stock,
# #             "systemStockSo": 0,
# #             "physicalStockSo": 0,
# #             "previousSystemStock": 0,
# #             "variance": variance,
# #             "status": status,
# #             "createdAt": now,
# #             "updatedAt": now,
# #             "createdBy": updated_by,
# #             "lastUpdatedBy": updated_by,
# #         }
# #         await inventory.insert_one(doc)
# #         action = "PATCH_CREATE"

# #     await history.insert_one(
# #         {
# #             "randomId": payload.randomId,
# #             "locationId": payload.warehouseId,
# #             "itemType": item.get("itemType", ""),
# #             "beforeStock": before_stock,
# #             "afterStock": after_stock,
# #             "variance": variance,
# #             "status": status,
# #             "systemStockSo": 0,
# #             "physicalStockSo": 0,
# #             "updatedAt": now,
# #             "action": action,
# #             "updatedBy": updated_by,
# #             "description": description,
# #         }
# #     )

# #     doc.pop("_id", None)
# #     return StockResponseModel(**doc)


# # @router.patch("/inventory/bulk")
# # async def update_inventory_stock_bulk(
# #     payload: StockBulkUpdateModel,
# #     updated_by: str = Query(""),
# #     description: str = Query(""),
# #     status: str = Query("approved", description="Stock status - default: approved"),
# # ):

# #     inventory = inventory_stock_collection()
# #     history = stock_updates_collection()
# #     purchase = purchaseitem_collection()

# #     # Get UOM Map
# #     uom_map = await get_uom_precision_map()

# #     now = ist_now()
# #     skipped = updated = created = 0

# #     # Pre-fetch items to get UOM
# #     random_ids = [u.randomId for u in payload.updates]
# #     purchase_items = await purchase.find(
# #         {"randomId": {"$in": random_ids}}, {"randomId": 1, "uom": 1}
# #     ).to_list(None)
# #     purchase_map = {p["randomId"]: p for p in purchase_items}

# #     for u in payload.updates:
# #         doc = await inventory.find_one(
# #             {
# #                 "randomId": u.randomId,
# #                 "locationId": u.warehouseId,
# #             }
# #         )

# #         # Determine precision
# #         p_item = purchase_map.get(u.randomId)
# #         precision = uom_map.get(p_item.get("uom", ""), 0) if p_item else 0

# #         incoming = round_by_precision(float(u.physicalStock), precision)

# #         if doc and is_duplicate_stock(doc, incoming):
# #             skipped += 1
# #             continue

# #         before_stock = float(doc.get("systemStock", 0)) if doc else 0
# #         after_stock = incoming
# #         variance = round_by_precision(
# #             calculate_variance(after_stock, after_stock), precision
# #         )

# #         if doc:
# #             await inventory.update_one(
# #                 {"_id": doc["_id"]},
# #                 {
# #                     "$set": {
# #                         "previousSystemStock": before_stock,
# #                         "systemStock": after_stock,
# #                         "physicalStock": after_stock,
# #                         "variance": variance,
# #                         "status": status,
# #                         "updatedAt": now,
# #                         "lastUpdatedBy": updated_by,
# #                     }
# #                 },
# #             )
# #             updated += 1
# #             action = "MANUAL_UPDATE"
# #         else:
# #             await inventory.insert_one(
# #                 {
# #                     "randomId": u.randomId,
# #                     "locationId": u.warehouseId,
# #                     "systemStock": after_stock,
# #                     "physicalStock": after_stock,
# #                     "systemStockSo": 0,
# #                     "physicalStockSo": 0,
# #                     "previousSystemStock": 0,
# #                     "variance": variance,
# #                     "status": status,
# #                     "createdAt": now,
# #                     "updatedAt": now,
# #                     "createdBy": updated_by,
# #                     "lastUpdatedBy": updated_by,
# #                 }
# #             )
# #             created += 1
# #             action = "PATCH_CREATE"

# #         await history.insert_one(
# #             {
# #                 "randomId": u.randomId,
# #                 "locationId": u.warehouseId,
# #                 "beforeStock": before_stock,
# #                 "afterStock": after_stock,
# #                 "variance": variance,
# #                 "status": status,
# #                 "updatedAt": now,
# #                 "action": action,
# #                 "updatedBy": updated_by,
# #                 "description": description,
# #             }
# #         )

# #     return {
# #         "updated": updated,
# #         "created": created,
# #         "skipped": skipped,
# #     }


# @router.patch("/inventory", response_model=StockResponseModel)
# async def update_inventory_stock(
#     payload: StockUpdateModel,
#     updated_by: str = Query(""),
#     description: str = Query(""),
#     status: str = Query("approved", description="Stock status - default: approved"),
# ):

#     purchase = purchaseitem_collection()
#     inventory = inventory_stock_collection()
#     history = stock_updates_collection()

#     # Fetch item from purchase collection
#     item = await purchase.find_one({"randomId": payload.randomId})
#     if not item:
#         raise HTTPException(404, "Item not found in purchase")

#     # Get UOM precision
#     uom_map = await get_uom_precision_map()
#     precision = uom_map.get(item.get("uom", ""), 0)

#     now = ist_now()
#     incoming_stock = round_by_precision(float(payload.physicalStock), precision)

#     # Fetch inventory document
#     doc = await inventory.find_one(
#         {"randomId": payload.randomId, "locationId": payload.warehouseId}
#     )

#     if doc and is_duplicate_stock(doc, incoming_stock):
#         raise HTTPException(409, "Stock unchanged. Update skipped.")

#     before_stock = float(doc.get("systemStock", 0)) if doc else 0
#     after_stock = incoming_stock
#     variance = round_by_precision(
#         calculate_variance(after_stock, before_stock), precision
#     )

#     if doc:
#         await inventory.update_one(
#             {"_id": doc["_id"]},
#             {
#                 "$set": {
#                     "previousSystemStock": before_stock,
#                     "systemStock": after_stock,
#                     "physicalStock": after_stock,
#                     "variance": variance,
#                     "status": status,
#                     "updatedAt": now,
#                     "lastUpdatedBy": updated_by,
#                 }
#             },
#         )
#         action = "MANUAL_UPDATE"
#     else:
#         doc = {
#             "randomId": payload.randomId,
#             "locationId": payload.warehouseId,
#             "itemType": item.get("itemType", ""),
#             "systemStock": after_stock,
#             "physicalStock": after_stock,
#             "systemStockSo": 0,
#             "physicalStockSo": 0,
#             "previousSystemStock": 0,
#             "variance": variance,
#             "status": status,
#             "createdAt": now,
#             "updatedAt": now,
#             "createdBy": updated_by,
#             "lastUpdatedBy": updated_by,
#         }
#         await inventory.insert_one(doc)
#         action = "PATCH_CREATE"

#     # Update purchase collection stockQuantity
#     await purchase.update_one(
#         {"randomId": payload.randomId},
#         {
#             "$set": {
#                 "stockQuantity": after_stock,
#                 "lastUpdatedDate": now,
#                 "updatedBy": updated_by,
#             }
#         },
#     )

#     # Insert history record
#     await history.insert_one(
#         {
#             "randomId": payload.randomId,
#             "locationId": payload.warehouseId,
#             "itemType": item.get("itemType", ""),
#             "beforeStock": before_stock,
#             "afterStock": after_stock,
#             "variance": variance,
#             "status": status,
#             "systemStockSo": 0,
#             "physicalStockSo": 0,
#             "updatedAt": now,
#             "action": action,
#             "updatedBy": updated_by,
#             "description": description,
#         }
#     )

#     doc.pop("_id", None)
#     return StockResponseModel(**doc)


# @router.patch("/inventory/bulk")
# async def update_inventory_stock_bulk(
#     payload: StockBulkUpdateModel,
#     updated_by: str = Query(""),
#     description: str = Query(""),
#     status: str = Query("approved", description="Stock status - default: approved"),
# ):

#     inventory = inventory_stock_collection()
#     history = stock_updates_collection()
#     purchase = purchaseitem_collection()

#     # Get UOM Map
#     uom_map = await get_uom_precision_map()
#     now = ist_now()
#     skipped = updated = created = 0

#     # Pre-fetch purchase items for UOM and existing stock
#     random_ids = [u.randomId for u in payload.updates]
#     purchase_items = await purchase.find(
#         {"randomId": {"$in": random_ids}}, {"randomId": 1, "uom": 1}
#     ).to_list(None)
#     purchase_map = {p["randomId"]: p for p in purchase_items}

#     for u in payload.updates:
#         doc = await inventory.find_one(
#             {"randomId": u.randomId, "locationId": u.warehouseId}
#         )

#         p_item = purchase_map.get(u.randomId)
#         precision = uom_map.get(p_item.get("uom", ""), 0) if p_item else 0

#         incoming = round_by_precision(float(u.physicalStock), precision)

#         if doc and is_duplicate_stock(doc, incoming):
#             skipped += 1
#             continue

#         before_stock = float(doc.get("systemStock", 0)) if doc else 0
#         after_stock = incoming
#         variance = round_by_precision(
#             calculate_variance(after_stock, before_stock), precision
#         )

#         if doc:
#             await inventory.update_one(
#                 {"_id": doc["_id"]},
#                 {
#                     "$set": {
#                         "previousSystemStock": before_stock,
#                         "systemStock": after_stock,
#                         "physicalStock": after_stock,
#                         "variance": variance,
#                         "status": status,
#                         "updatedAt": now,
#                         "lastUpdatedBy": updated_by,
#                     }
#                 },
#             )
#             updated += 1
#             action = "MANUAL_UPDATE"
#         else:
#             await inventory.insert_one(
#                 {
#                     "randomId": u.randomId,
#                     "locationId": u.warehouseId,
#                     "systemStock": after_stock,
#                     "physicalStock": after_stock,
#                     "systemStockSo": 0,
#                     "physicalStockSo": 0,
#                     "previousSystemStock": 0,
#                     "variance": variance,
#                     "status": status,
#                     "createdAt": now,
#                     "updatedAt": now,
#                     "createdBy": updated_by,
#                     "lastUpdatedBy": updated_by,
#                 }
#             )
#             created += 1
#             action = "PATCH_CREATE"

#         # Update purchase collection stockQuantity
#         await purchase.update_one(
#             {"randomId": u.randomId},
#             {
#                 "$set": {
#                     "stockQuantity": after_stock,
#                     "lastUpdatedDate": now,
#                     "updatedBy": updated_by,
#                 }
#             },
#         )

#         # Insert history record
#         await history.insert_one(
#             {
#                 "randomId": u.randomId,
#                 "locationId": u.warehouseId,
#                 "beforeStock": before_stock,
#                 "afterStock": after_stock,
#                 "variance": variance,
#                 "status": status,
#                 "updatedAt": now,
#                 "action": action,
#                 "updatedBy": updated_by,
#                 "description": description,
#             }
#         )

#     return {
#         "updated": updated,
#         "created": created,
#         "skipped": skipped,
#     }


# # EXPORT CSV
# @router.get("/export")
# async def export_all_items_with_inventory_stock(
#     locationId: str = Query(...),
#     purchasecategoryName: Optional[str] = None,
#     purchasesubcategoryName: Optional[str] = None,
#     itemName: Optional[str] = None,
#     varianceName: Optional[str] = None,
# ):
#     purchase = purchaseitem_collection()
#     inventory = inventory_stock_collection()

#     try:
#         # Get UOM Map
#         uom_map = await get_uom_precision_map()

#         def to_list(s):
#             return [v.strip() for v in (s or "").split(",") if v.strip()]

#         pur_query = {"status": "active"}

#         if c := to_list(purchasecategoryName):
#             pur_query["purchasecategoryName"] = {"$in": c}
#         if s := to_list(purchasesubcategoryName):
#             pur_query["purchasesubcategoryName"] = {"$in": s}
#         if i := to_list(itemName):
#             pur_query["itemgroupName"] = {"$in": i}
#         if v := to_list(varianceName):
#             pur_query["itemName"] = {"$in": v}

#         pur_docs = await purchase.find(
#             pur_query,
#             {
#                 "randomId": 1,
#                 "itemCode": 1,
#                 "purchasecategoryName": 1,
#                 "purchasesubcategoryName": 1,
#                 "itemgroupName": 1,
#                 "itemName": 1,
#                 "uom": 1,  # Include UOM
#             },
#         ).to_list(length=None)

#         if not pur_docs:
#             raise HTTPException(404, "No purchase items found")

#         random_ids = [d["randomId"] for d in pur_docs if d.get("randomId")]

#         inv_docs = await inventory.find(
#             {
#                 "locationId": locationId,
#                 "randomId": {"$in": random_ids},
#             },
#             {
#                 "randomId": 1,
#                 "systemStock": 1,
#                 "physicalStock": 1,
#                 "variance": 1,
#                 "status": 1,
#                 "updatedAt": 1,
#             },
#         ).to_list(length=None)

#         inv_map = {d["randomId"]: d for d in inv_docs}

#         output = io.StringIO()
#         writer = csv.writer(output)

#         writer.writerow(
#             [
#                 "S.No",
#                 "RandomId",
#                 "Item Code",
#                 "Category",
#                 "Subcategory",
#                 "Item Name",
#                 "Variance Name",
#                 "System Stock",
#                 "PhysicalStock",
#             ]
#         )

#         for idx, p in enumerate(pur_docs, 1):
#             rid = p["randomId"]
#             inv = inv_map.get(rid, {})

#             # Apply precision
#             uom_name = p.get("uom", "")
#             precision = uom_map.get(uom_name, 0)

#             system_stock = round_by_precision(inv.get("systemStock", 0), precision)
#             physical_stock = round_by_precision(inv.get("physicalStock", 0), precision)

#             variance = round_by_precision(
#                 inv.get("variance", calculate_variance(system_stock, physical_stock)),
#                 precision,
#             )

#             writer.writerow(
#                 [
#                     idx,
#                     rid,
#                     p.get("itemCode", ""),
#                     p.get("purchasecategoryName", ""),
#                     p.get("purchasesubcategoryName", ""),
#                     p.get("itemgroupName", ""),
#                     p.get("itemName", ""),
#                     system_stock,
#                     physical_stock,  # Fixed export to show physical stock
#                 ]
#             )

#         output.seek(0)

#         filename = (
#             f"inventory_all_items_{locationId}_{datetime.utcnow():%Y%m%d_%H%M%S}.csv"
#         )

#         return StreamingResponse(
#             output,
#             media_type="text/csv",
#             headers={"Content-Disposition": f'attachment; filename="{filename}"'},
#         )

#     except Exception as e:
#         raise HTTPException(500, str(e))


# # @router.post("/importstocks")
# # async def import_inventory_onhand(
# #     file: UploadFile = File(...),
# #     locationId: str = Query(...),
# #     updated_by: str = Query(""),
# #     status: str = Query("approved", description="Stock status - default: approved"),
# # ):

# #     purchase = purchaseitem_collection()
# #     inventory = inventory_stock_collection()
# #     history = stock_updates_collection()

# #     try:
# #         content = await file.read()

# #         try:
# #             df = pd.read_csv(io.BytesIO(content))
# #         except Exception:
# #             data = json.loads(content.decode())
# #             df = pd.DataFrame(data if isinstance(data, list) else [data])

# #         df.columns = df.columns.str.strip()

# #         if "RandomId" not in df.columns or "PhysicalStock" not in df.columns:
# #             raise HTTPException(
# #                 400, "File must contain RandomId and PhysicalStock columns"
# #             )

# #         df["RandomId"] = df["RandomId"].astype(str).str.strip()
# #         df = df[df["RandomId"] != ""]

# #         if df.empty:
# #             raise HTTPException(400, "No valid RandomId found")

# #         now = ist_now()

# #         random_ids = df["RandomId"].unique().tolist()

# #         purchase_items = await purchase.find(
# #             {"randomId": {"$in": random_ids}},
# #             {"randomId": 1, "itemType": 1, "status": 1, "uom": 1}, # Fetch UOM
# #         ).to_list(length=None)

# #         purchase_map = {p["randomId"]: p for p in purchase_items}

# #         # Get UOM Map
# #         uom_map = await get_uom_precision_map()

# #         missing = []
# #         inactive = []

# #         for rid in random_ids:
# #             item = purchase_map.get(rid)
# #             if not item:
# #                 missing.append(rid)
# #             elif item.get("status") != "active":
# #                 inactive.append(rid)

# #         if missing or inactive:
# #             raise HTTPException(
# #                 400,
# #                 {
# #                     "message": "Import failed",
# #                     "missingInPurchase": missing,
# #                     "inactiveItems": inactive,
# #                 },
# #             )

# #         inv_docs = await inventory.find(
# #             {
# #                 "locationId": locationId,
# #                 "randomId": {"$in": random_ids},
# #             }
# #         ).to_list(length=None)

# #         inv_map = {d["randomId"]: d for d in inv_docs}

# #         updates: list[UpdateOne] = []
# #         history_docs = []

# #         updated = created = skipped = 0

# #         for row in df.itertuples(index=False):
# #             random_id = row.RandomId

# #             try:
# #                 raw_physical = float(str(row.PhysicalStock).replace(",", ""))
# #             except Exception:
# #                 raise HTTPException(
# #                     400, f"Invalid PhysicalStock for RandomId: {random_id}"
# #                 )

# #             doc = inv_map.get(random_id)
# #             purchase_item = purchase_map[random_id]

# #             # Precision logic
# #             uom_name = purchase_item.get("uom", "")
# #             precision = uom_map.get(uom_name, 0)
# #             physical_qty = round_by_precision(raw_physical, precision)

# #             if doc and float(doc.get("systemStock", 0)) == physical_qty:
# #                 skipped += 1
# #                 continue

# #             if doc:
# #                 before_stock = float(doc.get("systemStock", 0))
# #                 prev_so = doc.get("systemStockSo", 0)
# #                 prev_phy_so = doc.get("physicalStockSo", 0)
# #                 variance = round_by_precision(calculate_variance(physical_qty, physical_qty), precision)

# #                 updates.append(
# #                     UpdateOne(
# #                         {"randomId": random_id, "locationId": locationId},
# #                         {
# #                             "$set": {
# #                                 "systemStock": physical_qty,
# #                                 "physicalStock": physical_qty,
# #                                 "previousSystemStock": before_stock,
# #                                 "systemStockSo": prev_so,
# #                                 "physicalStockSo": prev_phy_so,
# #                                 "variance": variance,
# #                                 "status": status,
# #                                 "updatedAt": now,
# #                                 "lastUpdatedBy": updated_by,
# #                             }
# #                         },
# #                     )
# #                 )

# #                 history_docs.append(
# #                     {
# #                         "randomId": random_id,
# #                         "locationId": locationId,
# #                         "itemType": purchase_item.get("itemType", ""),
# #                         "beforeStock": before_stock,
# #                         "afterStock": physical_qty,
# #                         "variance": variance,
# #                         "status": status,
# #                         "updatedAt": now,
# #                         "action": "CSV_IMPORT",
# #                         "updatedBy": updated_by,
# #                         "description": "",
# #                     }
# #                 )

# #                 updated += 1

# #             else:
# #                 variance = round_by_precision(calculate_variance(physical_qty, physical_qty), precision)
# #                 new_doc = {
# #                     "randomId": random_id,
# #                     "locationId": locationId,
# #                     "itemType": purchase_item.get("itemType", ""),
# #                     "systemStock": physical_qty,
# #                     "physicalStock": physical_qty,
# #                     "systemStockSo": 0,
# #                     "physicalStockSo": 0,
# #                     "previousSystemStock": 0,
# #                     "variance": variance,
# #                     "status": status,
# #                     "createdAt": now,
# #                     "updatedAt": now,
# #                     "createdBy": updated_by,
# #                     "lastUpdatedBy": updated_by,
# #                 }

# #                 updates.append(
# #                     UpdateOne(
# #                         {"randomId": random_id, "locationId": locationId},
# #                         {"$set": new_doc},
# #                         upsert=True,
# #                     )
# #                 )

# #                 history_docs.append(
# #                     {
# #                         "randomId": random_id,
# #                         "locationId": locationId,
# #                         "itemType": new_doc["itemType"],
# #                         "beforeStock": 0,
# #                         "afterStock": physical_qty,
# #                         "variance": variance,
# #                         "status": status,
# #                         "updatedAt": now,
# #                         "action": "CSV_IMPORT",
# #                         "updatedBy": updated_by,
# #                         "description": "",
# #                     }
# #                 )

# #                 created += 1

# #         if updates:
# #             await inventory.bulk_write(updates, ordered=False)

# #         if history_docs:
# #             await history.insert_many(history_docs)

# #         return {
# #             "message": "Inventory import completed successfully",
# #             "locationId": locationId,
# #             "totalRows": len(df),
# #             "updated": updated,
# #             "created": created,
# #             "skipped": skipped,
# #         }

# #     except Exception as e:
# #         raise HTTPException(500, f"Import failed: {e}")


# @router.post("/importstocks")
# async def import_inventory_onhand(
#     file: UploadFile = File(...),
#     locationId: str = Query(...),
#     updated_by: str = Query(""),
#     status: str = Query("approved", description="Stock status - default: approved"),
# ):
#     purchase = purchaseitem_collection()
#     inventory = inventory_stock_collection()
#     history = stock_updates_collection()

#     import math
#     import pandas as pd
#     import io
#     import json
#     from pymongo import UpdateOne

#     # ---------------- SAFE NUMBER ---------------- #
#     def sanitize_number(val, default=0):
#         if val is None:
#             return default
#         if isinstance(val, str):
#             val = val.replace(",", "").strip()  # remove commas
#         try:
#             num = float(val)
#             if math.isnan(num) or math.isinf(num):
#                 return default
#             return num
#         except:
#             return default

#     # ---------------- CLEAN RESPONSE ---------------- #
#     def clean_response(d):
#         for k, v in d.items():
#             if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
#                 d[k] = 0
#             elif isinstance(v, dict):
#                 clean_response(v)
#             elif isinstance(v, list):
#                 for item in v:
#                     if isinstance(item, dict):
#                         clean_response(item)
#         return d

#     try:
#         content = await file.read()
#         if not content or content.strip() == b"":
#             raise HTTPException(400, "Uploaded file is empty")

#         # ---------------- READ FILE ---------------- #
#         df = None
#         try:
#             df = pd.read_csv(io.BytesIO(content), encoding="utf-8")
#         except UnicodeDecodeError:
#             try:
#                 df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
#             except UnicodeDecodeError:
#                 df = pd.read_csv(io.BytesIO(content), encoding="latin1")
#         except Exception:
#             try:
#                 data = json.loads(content.decode("utf-8", errors="ignore"))
#                 df = pd.DataFrame(data if isinstance(data, list) else [data])
#             except Exception:
#                 raise HTTPException(400, "Uploaded file is not valid CSV or JSON")

#         if df is None or df.empty:
#             raise HTTPException(400, "No data found in file")

#         # ---------------- COLUMN MAP ---------------- #
#         df.columns = df.columns.str.strip()
#         df.rename(
#             columns={
#                 "ItemName": "itemName",
#                 "Qty": "PhysicalStock",
#                 "UOM": "uom",
#             },
#             inplace=True,
#         )

#         if "itemName" not in df.columns or "PhysicalStock" not in df.columns:
#             raise HTTPException(400, "Required columns missing (ItemName, Qty)")

#         df["itemName"] = df["itemName"].astype(str).str.strip().str.upper()  # normalize
#         df = df[df["itemName"] != ""]
#         if df.empty:
#             raise HTTPException(400, "No valid ItemName found")

#         now = ist_now()
#         keys = df["itemName"].unique().tolist()

#         # ---------------- FETCH PURCHASE ITEMS ---------------- #
#         purchase_items = await purchase.find(
#             {
#                 "$or": [
#                     {"randomId": {"$in": keys}},
#                     {"itemCode": {"$in": keys}},
#                     {"itemName": {"$in": keys}},
#                 ]
#             },
#             {
#                 "randomId": 1,
#                 "itemCode": 1,
#                 "itemName": 1,
#                 "itemType": 1,
#                 "status": 1,
#                 "uom": 1,
#                 "stockQuantity": 1,
#             },
#         ).to_list(length=None)

#         # ---------------- NORMALIZE PURCHASE MAP ---------------- #
#         purchase_map = {}
#         for p in purchase_items:
#             if p.get("randomId"):
#                 purchase_map[str(p["randomId"]).strip().upper()] = p
#             if p.get("itemCode"):
#                 purchase_map[str(p["itemCode"]).strip().upper()] = p
#             if p.get("itemName"):
#                 purchase_map[str(p["itemName"]).strip().upper()] = p

#         # ---------------- UOM PRECISION ---------------- #
#         uom_map = await get_uom_precision_map()

#         # ---------------- RESPONSE TRACKERS ---------------- #
#         updated = created = skipped = 0
#         updatedList = []
#         createdList = []
#         skippedList = []
#         notUpdatedList = []
#         updates = []
#         history_docs = []

#         # ================= MAIN LOOP ================= #
#         for row in df.itertuples(index=False):
#             key = str(row.itemName).strip().upper()
#             purchase_item = purchase_map.get(key)

#             if not purchase_item:
#                 notUpdatedList.append({"itemName": key, "reason": "Item not found"})
#                 continue

#             if purchase_item.get("status") != "active":
#                 notUpdatedList.append({"itemName": key, "reason": "Item inactive"})
#                 continue

#             physical_qty = sanitize_number(row.PhysicalStock)
#             uom_name = purchase_item.get("uom", "")
#             precision = uom_map.get(uom_name, 0)
#             physical_qty = round(physical_qty, precision)

#             before_stock = sanitize_number(purchase_item.get("stockQuantity", 0))
#             after_stock = physical_qty
#             variance = round(after_stock - before_stock, precision)

#             if before_stock == after_stock:
#                 skipped += 1
#                 skippedList.append(
#                     {"itemName": key, "stock": after_stock, "reason": "No stock change"}
#                 )
#                 continue

#             # -------- Update Purchase -------- #
#             await purchase.update_one(
#                 {"_id": purchase_item["_id"]},
#                 {
#                     "$set": {
#                         "stockQuantity": after_stock,
#                         "lastUpdatedDate": now,
#                         "updatedBy": updated_by,
#                         "previousSystemStock": before_stock,
#                     }
#                 },
#             )

#             # -------- Update Inventory -------- #
#             doc = await inventory.find_one(
#                 {"locationId": locationId, "randomId": purchase_item.get("randomId")}
#             )

#             inv_doc = {
#                 "randomId": purchase_item.get("randomId"),
#                 "locationId": locationId,
#                 "itemType": purchase_item.get("itemType", ""),
#                 "systemStock": after_stock,
#                 "physicalStock": after_stock,
#                 "previousSystemStock": before_stock,
#                 "variance": variance,
#                 "status": status,
#                 "updatedAt": now,
#                 "lastUpdatedBy": updated_by,
#             }

#             if doc:
#                 updates.append(
#                     UpdateOne(
#                         {"randomId": doc["randomId"], "locationId": locationId},
#                         {"$set": inv_doc},
#                     )
#                 )
#                 updated += 1
#                 updatedList.append(inv_doc)
#             else:
#                 inv_doc["createdAt"] = now
#                 inv_doc["createdBy"] = updated_by
#                 updates.append(
#                     UpdateOne(
#                         {"randomId": inv_doc["randomId"], "locationId": locationId},
#                         {"$set": inv_doc},
#                         upsert=True,
#                     )
#                 )
#                 created += 1
#                 createdList.append(inv_doc)

#             # -------- History -------- #
#             history_docs.append(
#                 {
#                     "randomId": purchase_item.get("randomId"),
#                     "locationId": locationId,
#                     "itemType": purchase_item.get("itemType", ""),
#                     "beforeStock": before_stock,
#                     "afterStock": after_stock,
#                     "variance": variance,
#                     "status": status,
#                     "updatedAt": now,
#                     "action": "CSV_IMPORT",
#                     "updatedBy": updated_by,
#                     "description": "",
#                 }
#             )

#         # ---------------- BULK WRITE ---------------- #
#         if updates:
#             await inventory.bulk_write(updates, ordered=False)
#         if history_docs:
#             await history.insert_many(history_docs)

#         # ---------------- RESPONSE ---------------- #
#         response = {
#             "message": "Inventory import completed",
#             "locationId": locationId,
#             "totalRows": len(df),
#             "summary": {
#                 "updatedCount": updated,
#                 "createdCount": created,
#                 "skippedCount": skipped,
#                 "notUpdatedCount": len(notUpdatedList),
#             },
#             "updatedList": updatedList,
#             "createdList": createdList,
#             "skippedList": skippedList,
#             "notUpdatedList": notUpdatedList,
#         }

#         # Clean all NaN/inf before returning
#         return clean_response(response)

#     except Exception as e:
#         raise HTTPException(500, f"Import failed: {str(e)}")


# @router.post("/bulk-inventory")
# async def bulk_create_update_stock(
#     items: List[StockUpdateModel],
#     updated_by: str = Query("System"),
#     description: str = Query(""),
#     status: str = Query("approved", description="Stock status - default: approved"),
# ):

#     purchase = purchaseitem_collection()
#     inventory = inventory_stock_collection()
#     history = stock_updates_collection()

#     if not items:
#         raise HTTPException(400, "No items provided")

#     now = ist_now()
#     updates = []
#     history_docs = []
#     results = []

#     random_ids = [item.randomId for item in items]
#     purchase_items = await purchase.find(
#         {"randomId": {"$in": random_ids}},
#         {"randomId": 1, "itemType": 1, "uom": 1},  # Get UOM
#     ).to_list(length=None)

#     purchase_map = {item["randomId"]: item for item in purchase_items}

#     # Get UOM Map
#     uom_map = await get_uom_precision_map()

#     inv_docs = await inventory.find(
#         {
#             "locationId": items[0].warehouseId,
#             "randomId": {"$in": random_ids},
#         }
#     ).to_list(length=None)

#     inv_map = {d["randomId"]: d for d in inv_docs}

#     for item in items:
#         random_id = item.randomId
#         warehouse_id = item.warehouseId

#         if random_id not in purchase_map:
#             results.append(
#                 {
#                     "randomId": random_id,
#                     "status": "error",
#                     "message": "Item not found in purchase",
#                 }
#             )
#             continue

#         purchase_item = purchase_map[random_id]
#         item_type = purchase_item.get("itemType", "")

#         # Precision
#         uom_name = purchase_item.get("uom", "")
#         precision = uom_map.get(uom_name, 0)
#         physical_qty = round_by_precision(item.physicalStock, precision)
#         variance = round_by_precision(
#             calculate_variance(physical_qty, physical_qty), precision
#         )

#         existing_stock = inv_map.get(random_id)

#         if existing_stock:
#             prev_stock = existing_stock.get("systemStock", 0)
#             prev_so = existing_stock.get("systemStockSo", prev_stock)
#             prev_phy_so = existing_stock.get("physicalStockSo", prev_stock)

#             updates.append(
#                 UpdateOne(
#                     {"_id": existing_stock["_id"]},
#                     {
#                         "$set": {
#                             "systemStock": physical_qty,
#                             "physicalStock": physical_qty,
#                             "previousSystemStock": prev_stock,
#                             "variance": variance,
#                             "status": status,
#                             "updatedAt": now,
#                             "lastUpdatedBy": updated_by,
#                         }
#                     },
#                 )
#             )

#             history_docs.append(
#                 {
#                     "randomId": random_id,
#                     "locationId": warehouse_id,
#                     "itemType": item_type,
#                     "systemStock": physical_qty,
#                     "physicalStock": physical_qty,
#                     "previousSystemStock": prev_stock,
#                     "variance": variance,
#                     "status": status,
#                     "systemStockSo": prev_so,
#                     "physicalStockSo": prev_phy_so,
#                     "updatedAt": now,
#                     "action": "MANUAL_UPDATE",
#                     "updatedBy": updated_by,
#                     "description": description,
#                 }
#             )

#             action = "updated"
#         else:
#             new_doc = {
#                 "randomId": random_id,
#                 "locationId": warehouse_id,
#                 "itemType": item_type,
#                 "systemStock": physical_qty,
#                 "physicalStock": physical_qty,
#                 "systemStockSo": 0,
#                 "physicalStockSo": 0,
#                 "previousSystemStock": 0,
#                 "variance": variance,
#                 "status": status,
#                 "createdAt": now,
#                 "updatedAt": now,
#                 "createdBy": updated_by,
#                 "lastUpdatedBy": updated_by,
#             }

#             updates.append(
#                 UpdateOne(
#                     {"randomId": random_id, "locationId": warehouse_id},
#                     {"$set": new_doc},
#                     upsert=True,
#                 )
#             )

#             history_docs.append(
#                 {
#                     **new_doc,
#                     "action": "BULK_CREATE",
#                     "description": description,
#                 }
#             )

#             action = "created"

#         results.append(
#             {
#                 "randomId": random_id,
#                 "status": "success",
#                 "action": action,
#                 "stock": physical_qty,
#                 "variance": variance,
#             }
#         )

#     if updates:
#         await inventory.bulk_write(updates, ordered=False)

#     if history_docs:
#         await history.insert_many(history_docs)

#     return {
#         "message": "Bulk operation completed",
#         "results": results,
#         "timestamp": now.isoformat(),
#     }


# @router.get("/export/sample")
# async def export_sample_onhand():
#     output = io.StringIO()
#     writer = csv.writer(output)

#     writer.writerow(["RandomId", "PhysicalStock"])
#     writer.writerow(["1757", "10"])
#     writer.writerow(["1758", "0"])
#     writer.writerow(["1759", "25"])

#     output.seek(0)
#     filename = f"sample_rmstock{datetime.utcnow():%Y%m%d_%H%M%S}.csv"

#     return StreamingResponse(
#         output,
#         media_type="text/csv",
#         headers={"Content-Disposition": f'attachment; filename="{filename}"'},
#     )
