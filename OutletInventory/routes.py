import csv
import io
from typing import List, Optional
from datetime import datetime, date

from requests import request
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import APIRouter, HTTPException, Query, UploadFile,Depends
from fastapi.responses import StreamingResponse
from pymongo import UpdateOne
from fastapi import Request
from OutletInventory.funtions import (
    build_category_map,
    build_mongo_filter_from_params,
    build_subcategory_map,
    get_filter_field_options,
    ist_now,
)
from OutletInventory.models import (
    BranchStockBulkUpdateModel,
    GetItemsResponseModel,
    StockResponseModel,
    StockUpdateModel,
    branchResponse,
    locationResponse,
)

from db.collections import (
    inventory_stock_collection,
    item_master_collection,
  
    stock_history_collection,
    location_collection,
    warehouse_collection,
)
from funtions import format_stock_for_response, normalize_stock

router = APIRouter()


def calculate_variance(system_stock: float, physical_stock: float) -> float:
    return physical_stock - system_stock


def master_collection():
    return item_master_collection()


@router.post("/stock", response_model=StockResponseModel)
async def post_stock(
    stock: StockUpdateModel,request:Request,
    status: str = Query("approved", description="Stock status - default: approved"),
    updated_by: str = Query("System"),
    description: str = Query(""),
):
    now = ist_now()
    tenant_id = request.state.tenant_id
    item = await master_collection().find_one({"itemCode": stock.itemCode})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    itemType = item.get("itemType", "")
    collection = inventory_stock_collection(tenant_id)
    history_collection = stock_history_collection(tenant_id)
    existing_stock = await collection.find_one(
        {"itemCode": stock.itemCode, "locationId": stock.locationId}
    )

    before_stock = existing_stock.get("systemStock", 0) if existing_stock else 0
    prev_so = existing_stock.get("systemStockSo", 0) if existing_stock else 0
    prev_physical_so = existing_stock.get("physicalStockSo", 0) if existing_stock else 0

    after_stock = await normalize_stock(item, stock.physicalStock)
    variance = calculate_variance(
        after_stock, after_stock
    )  # Zero variance when both are same

    await collection.update_one(
        {"itemCode": stock.itemCode, "locationId": stock.locationId},
        {
            "$set": {
                "itemType": itemType,
                "systemStock": after_stock,
                "physicalStock": after_stock,
                "previousSystemStock": before_stock,
                "systemStockSo": prev_so,
                "physicalStockSo": prev_physical_so,
                "variance": variance,
                "status": status,
                "updatedAt": now,
                "lastUpdatedBy": updated_by,
            },
            "$setOnInsert": {
                "createdAt": now,
                "itemCode": stock.itemCode,
                "locationId": stock.locationId,
                "createdBy": updated_by,
            },
        },
        upsert=True,
    )

    await history_collection().insert_one(
        {
            "itemCode": stock.itemCode,
            "locationId": stock.locationId,
            "itemType": itemType,
            "beforeStock": before_stock,
            "afterStock": after_stock,
            "variance": variance,
            "status": status,
            "action": "POST_CREATE",
            "updatedBy": updated_by,
            "description": description,
            "updatedAt": now,
        }
    )

    # RETURN ONLY MODEL FIELDS
    return {
        "itemCode": stock.itemCode,
        "locationId": stock.locationId,
        "itemType": itemType,
        "systemStock": after_stock,
        "physicalStock": after_stock,
        "systemStockSo": prev_so,
        "physicalStockSo": prev_physical_so,
        "previousSystemStock": before_stock,
        "variance": variance,
        "status": status,
        "createdAt": existing_stock.get("createdAt") if existing_stock else now,
        "updatedAt": now,
    }


@router.get("/", response_model=GetItemsResponseModel)
async def get_items( request:Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    branch: str = Query(...),
    category: Optional[str] = Query(None),
    subCategory: Optional[str] = Query(None),
    itemName: Optional[str] = Query(None),
    varianceName: Optional[str] = Query(None),
    include_filter_options: bool = Query(False),
    only_filter_options: bool = Query(False),
    categoryPage: int = Query(1, ge=1),
    categoryLimit: int = Query(20, ge=1, le=100),
    categorySearch: Optional[str] = Query(None),
    subCategoryPage: int = Query(1, ge=1),
    subCategoryLimit: int = Query(20, ge=1, le=100),
    subCategorySearch: Optional[str] = Query(None),
    itemNamePage: int = Query(1, ge=1),
    itemNameLimit: int = Query(20, ge=1, le=100),
    itemNameSearch: Optional[str] = Query(None),
    varianceNamePage: int = Query(1, ge=1),
    varianceNameLimit: int = Query(20, ge=1, le=100),
    varianceNameSearch: Optional[str] = Query(None),
    date: Optional[date] = Query(None),
   
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "physicalstockmodification", "read"))
):
    tenant_id = request.state.tenant_id
    collection = inventory_stock_collection(tenant_id)
    fetch_items = True

    if only_filter_options:
        fetch_items = False

    if include_filter_options and page > 1:
        fetch_items = False

    response = {}

    if fetch_items:
        filters = build_mongo_filter_from_params(
            category, subCategory, itemName, varianceName
        )

        skip = (page - 1) * limit
        total = await master_collection().count_documents(filters)
        cursor = master_collection().find(filters).skip(skip).limit(limit)
        raw_items = [item async for item in cursor]

        item_codes = [
            item.get("itemCode") for item in raw_items if item.get("itemCode")
        ]

        stock_cursor = collection.find(
            {"locationId": branch, "itemCode": {"$in": item_codes}}
        )

        stock_map = {}
        async for s in stock_cursor:
            stock_map[s.get("itemCode")] = s

        category_map = await build_category_map() or {}
        subcategory_map = await build_subcategory_map() or {}

        items = []
        for item in raw_items:
            item_code = item.get("itemCode")
            if not item_code:
                continue
            stock_doc = stock_map.get(item_code, {})
            category_id = item.get("category")
            subcategory_id = item.get("subCategory")

            system_stock_raw = stock_doc.get("systemStock", 0)
            physical_stock_raw = stock_doc.get("physicalStock", 0)
            system_stock = await format_stock_for_response(item, system_stock_raw)
            physical_stock = await format_stock_for_response(item, physical_stock_raw)

            # Calculate variance
            if "variance" in stock_doc:
                variance = stock_doc.get("variance", 0)
            else:
                variance_raw = calculate_variance(system_stock_raw, physical_stock_raw)
                variance = await format_stock_for_response(item, variance_raw)

            items.append(
                {
                    "id": str(item["_id"]),
                    "itemCode": item.get("itemCode"),
                    "category": {
                        "id": category_id,
                        "name": category_map.get(category_id),
                    },
                    "subCategory": {
                        "id": subcategory_id,
                        "name": subcategory_map.get(subcategory_id),
                    },
                    "itemName": {
                        "id": subcategory_id,
                        "name": subcategory_map.get(subcategory_id),
                    },
                    "varianceName": {
                        "id": item.get("itemCode"),
                        "name": item.get("varianceName"),
                    },
                    "systemStock": system_stock,
                    "systemStockSo": stock_doc.get("systemStockSo", 0),
                    "physicalStock": physical_stock,
                    "previousSystemStock": stock_doc.get("previousSystemStock", 0),
                    "variance": variance,
                    "status": stock_doc.get("status", "approved"),
                    "updatedAt": stock_doc.get("updatedAt", datetime.utcnow()),
                }
            )

        response["filteredItems"] = {
            "total": total,
            "page": page,
            "limit": limit,
            "count": len(items),
            "items": items,
            "message": f"Items retrieved for {date or datetime.utcnow().date()}",
        }

    if include_filter_options:
        category_map = await build_category_map() or {}
        subcategory_map = await build_subcategory_map() or {}

        response["filterOptions"] = {
            "category": await get_filter_field_options(
                master_collection(),
                "category",
                categoryPage,
                categoryLimit,
                category=category,
                subCategory=subCategory,
                itemName=itemName,
                varianceName=varianceName,
                search_filter=categorySearch,
                category_map=category_map,
                subcategory_map=subcategory_map,
            ),
            "subCategory": await get_filter_field_options(
                master_collection(),
                "subCategory",
                subCategoryPage,
                subCategoryLimit,
                category=category,
                subCategory=subCategory,
                itemName=itemName,
                varianceName=varianceName,
                search_filter=subCategorySearch,
                category_map=category_map,
                subcategory_map=subcategory_map,
            ),
            "itemName": await get_filter_field_options(
                master_collection(),
                "itemName",
                itemNamePage,
                itemNameLimit,
                category=category,
                subCategory=subCategory,
                itemName=itemName,
                varianceName=varianceName,
                search_filter=itemNameSearch,
                subcategory_map=subcategory_map,
            ),
            "varianceName": await get_filter_field_options(
                master_collection(),
                "varianceName",
                varianceNamePage,
                varianceNameLimit,
                category=category,
                subCategory=subCategory,
                itemName=itemName,
                varianceName=varianceName,
                search_filter=varianceNameSearch,
            ),
        }
    return response


@router.patch("/{itemCode}/update-stock")
async def update_system_stock(request:Request,
    itemCode: str,
    locationId: str = Query(...),
    physical_stock: float = Query(..., ge=0),
    status: str = Query("approved", description="Stock status - default: approved"),
    updated_by: Optional[str] = Query("Inventory"),
    description: str = Query(""),
    user = Depends(validate_token),permissions: dict = Depends(check_permission("yenerp", "physicalstockmodification", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = inventory_stock_collection(tenant_id)
    history_collection = stock_history_collection(tenant_id)
    now = ist_now()

    item = await master_collection().find_one({"itemCode": itemCode}, {"itemType": 1})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    itemType = item.get("itemType", "")

    existing_stock = await collection.find_one(
        {"itemCode": itemCode, "locationId": locationId}
    )

    before_stock = existing_stock.get("systemStock", 0) if existing_stock else 0
    prev_so = existing_stock.get("systemStockSo", 0) if existing_stock else 0
    prev_physical_so = existing_stock.get("physicalStockSo", 0) if existing_stock else 0

    after_stock = physical_stock
    variance = calculate_variance(
        after_stock, after_stock
    )  # Zero variance when both are same

    await inventory_stock_collection(tenant_id).update_one(
        {"itemCode": itemCode, "locationId": locationId},
        {
            "$set": {
                "itemType": itemType,
                "systemStock": after_stock,
                "physicalStock": after_stock,
                "previousSystemStock": before_stock,
                "systemStockSo": prev_so,
                "physicalStockSo": prev_physical_so,
                "variance": variance,
                "status": status,
                "updatedAt": now,
                "lastUpdatedBy": updated_by,
            },
            "$setOnInsert": {
                "createdAt": now,
                "itemCode": itemCode,
                "locationId": locationId,
                "createdBy": updated_by,
            },
        },
        upsert=True,
    )

    await stock_history_collection().insert_one(
        {
            "itemCode": itemCode,
            "locationId": locationId,
            "itemType": itemType,
            "beforeStock": before_stock,
            "afterStock": after_stock,
            "variance": variance,
            "status": status,
            "action": "MANUAL_UPDATE",
            "updatedBy": updated_by,
            "description": description,
            "updatedAt": now,
        }
    )

    return {
        "message": "Stock updated successfully",
        "itemCode": itemCode,
        "locationId": locationId,
        "previousSystemStock": before_stock,
        "updatedSystemStock": after_stock,
        "variance": variance,
        "status": status,
        "updatedAt": now,
    }


@router.patch("/update-stock/bulk")
async def update_branch_stock_bulk(request:Request,
    payload: BranchStockBulkUpdateModel,
    status: str = Query("approved", description="Stock status - default: approved"),
    updated_by: str = Query("Inventory"),
    description: str = Query(""),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "physicalstockmodification", "edit"))
):
    tenant_id = request.state.tenant_id
    now = ist_now()

    item_codes = [u.itemCode for u in payload.updates]

    items = (
        await master_collection()
        .find({"itemCode": {"$in": item_codes}}, {"itemCode": 1, "itemType": 1})
        .to_list(length=len(item_codes))
    )

    item_map = {item["itemCode"]: item for item in items}

    results = []

    for u in payload.updates:
        itemType = item_map[u.itemCode].get("itemType", "UNKNOWN")

        existing_stock = await inventory_stock_collection(tenant_id).find_one(
            {"itemCode": u.itemCode, "locationId": u.locationId}
        )

        before_stock = existing_stock.get("systemStock", 0) if existing_stock else 0
        prev_so = existing_stock.get("systemStockSo", 0) if existing_stock else 0
        prev_physical_so = (
            existing_stock.get("physicalStockSo", 0) if existing_stock else 0
        )

        after_stock = await normalize_stock(item_map[u.itemCode], u.physical_stock)
        variance = calculate_variance(
            after_stock, after_stock
        )  # Zero variance when both are same

        await inventory_stock_collection(tenant_id).update_one(
            {"itemCode": u.itemCode, "locationId": u.locationId},
            {
                "$set": {
                    "itemType": itemType,
                    "systemStock": after_stock,
                    "physicalStock": after_stock,
                    "previousSystemStock": before_stock,
                    "systemStockSo": prev_so,
                    "physicalStockSo": prev_physical_so,
                    "variance": variance,
                    "status": status,
                    "updatedAt": now,
                    "lastUpdatedBy": updated_by,
                },
                "$setOnInsert": {
                    "createdAt": now,
                    "itemCode": u.itemCode,
                    "locationId": u.locationId,
                    "createdBy": updated_by,
                },
            },
            upsert=True,
        )

        await stock_history_collection(tenant_id).insert_one(
            {
                "itemCode": u.itemCode,
                "locationId": u.locationId,
                "itemType": itemType,
                "beforeStock": before_stock,
                "afterStock": after_stock,
                "variance": variance,
                "status": status,
                "action": "MANUAL_UPDATE",
                "updatedBy": updated_by,
                "description": description,
                "updatedAt": now,
            }
        )

        results.append(
            {
                "itemCode": u.itemCode,
                "locationId": u.locationId,
                "previousSystemStock": before_stock,
                "updatedSystemStock": after_stock,
                "variance": variance,
                "status": status,
                "updatedAt": now,
            }
        )

    return {"updated": len(results), "data": results}


@router.get("/exportstock-csv")
async def export_items_csv(request:Request,
    branch: str = Query(...),
    category: Optional[str] = Query(None),
    subCategory: Optional[str] = Query(None),
    itemName: Optional[str] = Query(None),
    varianceName: Optional[str] = Query(None),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "physicalstockmodification", "read"))
):
    tenant_id = request.state.tenant_id
    try:
        filters = build_mongo_filter_from_params(
            category, subCategory, itemName, varianceName
        )

        category_map = await build_category_map() or {}
        subcategory_map = await build_subcategory_map() or {}

        stock_map = {}
        stock_cursor = inventory_stock_collection(tenant_id).find(
            {"locationId": branch},
            {
                "itemCode": 1,
                "systemStock": 1,
                "physicalStock": 1,
                "variance": 1,
                "status": 1,
                "updatedAt": 1,
            },
        )

        async for s in stock_cursor:
            item_code = s.get("itemCode")
            if item_code:
                stock_map[item_code] = {
                    "systemStock": s.get("systemStock", 0),
                    "physicalStock": s.get("physicalStock", 0),
                    "variance": s.get("variance", 0),
                    "status": s.get("status", "approved"),
                    "updatedAt": s.get("updatedAt", datetime.utcnow()),
                }

        cursor = master_collection().find(filters)
        raw_items = [item async for item in cursor]

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "S.No",
                "ItemCode",
                "Category",
                "SubCategory",
                "ItemName",
                "VarianceName",
                "SystemStock",
                "PhysicalStock",
            ]
        )

        for idx, item in enumerate(raw_items, 1):
            item_code = item.get("itemCode")
            stock = stock_map.get(item_code, {})

            system_stock_raw = stock.get("systemStock", 0)
            system_stock = await format_stock_for_response(item, system_stock_raw)
            physical_stock = stock.get("physicalStock", 0)

            # Calculate variance if not present
            if "variance" in stock:
                variance = stock.get("variance", 0)
            else:
                variance = calculate_variance(system_stock, physical_stock)

            category_id = item.get("category")
            subcategory_id = item.get("subCategory")

            writer.writerow(
                [
                    idx,
                    item_code,
                    category_map.get(category_id, ""),
                    subcategory_map.get(subcategory_id, ""),
                    item.get("itemName", ""),
                    item.get("varianceName", ""),
                    system_stock,
                    0,
                ]
            )

        output.seek(0)
        filename = f"{branch}_OutletStock_{datetime.utcnow():%d-%m-%Y}.csv"

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV export failed: {str(e)}")


@router.post("/importstock")
async def import_stock_file(
    locationId: str,request:Request,
    file: UploadFile,
    status: str = Query("approved", description="Stock status - default: approved"),
    updated_by: Optional[str] = Query("Inventory"),
    description: str = Query(""),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "physicalstockmodification", "add"))
):
    tenant_id = request.state.tenant_id
    try:
        content = await file.read()
        text = content.decode("utf-8-sig")

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        if not rows:
            raise HTTPException(status_code=400, detail="Empty or invalid CSV file")

        now = ist_now()

        normalized_rows = []
        for row in rows:
            normalized_row = {k.strip().lower(): v for k, v in row.items()}
            normalized_rows.append(normalized_row)

        csv_map = {}
        for idx, row in enumerate(normalized_rows, start=1):
            item_code = str(row.get("itemcode", "")).strip()
            if not item_code:
                raise HTTPException(
                    status_code=400, detail=f"Missing itemCode in row {idx}"
                )

            try:
                stock = float(row.get("physicalstock", 0))
            except:
                stock = 0

            csv_map[item_code] = stock

        item_master_cursor = master_collection().find(
            {"itemCode": {"$in": list(csv_map.keys())}},
            {"itemCode": 1, "itemType": 1},
        )

        item_type_map = {}
        async for item in item_master_cursor:
            item_type_map[item["itemCode"]] = item.get("itemType", "UNKNOWN")

        missing_items = set(csv_map.keys()) - set(item_type_map.keys())
        if missing_items:
            raise HTTPException(
                status_code=400,
                detail=f"ItemCode(s) not found in ItemMaster: {list(missing_items)}",
            )

        cursor = inventory_stock_collection(tenant_id).find(
            {"locationId": locationId, "itemCode": {"$in": list(csv_map.keys())}}
        )

        bulk_updates = []
        history_docs = []
        updated_items = 0
        existing_keys = set()

        async for item in cursor:
            item_code = item["itemCode"]
            existing_keys.add(item_code)

            before_stock = item.get("systemStock", 0)
            # after_stock = csv_map.get(item_code)
            item_doc = await master_collection().find_one({"itemCode": item_code})
            after_stock = await normalize_stock(item_doc, csv_map.get(item_code))
            variance = calculate_variance(after_stock, after_stock)

            system_stock_so = item.get("systemStockSo", 0)
            physical_stock_so = item.get("physicalStockSo", 0)

            item_type = item_type_map.get(item_code, "UNKNOWN")

            bulk_updates.append(
                UpdateOne(
                    {"_id": item["_id"]},
                    {
                        "$set": {
                            "itemType": item_type,
                            "systemStock": after_stock,
                            "physicalStock": after_stock,
                            "previousSystemStock": before_stock,
                            "systemStockSo": system_stock_so,
                            "physicalStockSo": physical_stock_so,
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
                    "itemCode": item_code,
                    "locationId": locationId,
                    "itemType": item_type,
                    "beforeStock": before_stock,
                    "afterStock": after_stock,
                    "variance": variance,
                    "status": status,
                    "action": "CSV_IMPORT",
                    "updatedBy": updated_by,
                    "description": description,
                    "importedAt": now,
                    "updatedAt": now,
                }
            )

            updated_items += 1

        for item_code, stock in csv_map.items():
            if item_code in existing_keys:
                continue

            item_type = item_type_map.get(item_code, "UNKNOWN")
            variance = calculate_variance(stock, stock)

            bulk_updates.append(
                UpdateOne(
                    {"itemCode": item_code, "locationId": locationId},
                    {
                        "$set": {
                            "itemCode": item_code,
                            "locationId": locationId,
                            "itemType": item_type,
                            "systemStock": stock,
                            "physicalStock": stock,
                            "previousSystemStock": 0,
                            "systemStockSo": 0,
                            "physicalStockSo": 0,
                            "variance": variance,
                            "status": status,
                            "createdAt": now,
                            "updatedAt": now,
                            "createdBy": updated_by,
                            "lastUpdatedBy": updated_by,
                        }
                    },
                    upsert=True,
                )
            )

            history_docs.append(
                {
                    "itemCode": item_code,
                    "locationId": locationId,
                    "itemType": item_type,
                    "beforeStock": 0,
                    "afterStock": stock,
                    "variance": variance,
                    "status": status,
                    "systemStockSo": 0,
                    "physicalStockSo": 0,
                    "action": "CSV_IMPORT",
                    "updatedBy": updated_by,
                    "description": f"CSV Import ({file.filename}) - {description}",
                    "importedAt": now,
                    "updatedAt": now,
                }
            )

            updated_items += 1

        if bulk_updates:
            await inventory_stock_collection(tenant_id).bulk_write(bulk_updates)

        if history_docs:
            await stock_history_collection(tenant_id).insert_many(history_docs, ordered=False)

        return {
            "message": "Stock import completed",
            "locationId": locationId,
            "file": file.filename,
            "updated_items": updated_items,
            "csv_rows": len(rows),
            "imported_at": now.isoformat(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk import failed: {str(e)}")


@router.get("/locations", response_model=List[branchResponse])
async def get_item_names(
    page: int = Query(1, ge=1),
    limit: int = Query(30, le=50),
    search: str | None = None,
):
    collection = location_collection()

    query = {}
    if search:
        query = {"branchName": {"$regex": search, "$options": "i"}, "status": 1}

    cursor = (
        collection.find(
            query,
            {
                "_id": 0,
                "aliasName": 1,
                "branchName": 1,
                "locationId": 1,
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
                "locationName": doc["branchName"],
                "locationId": doc["locationId"],
            }
        )

    return items


@router.get("/locations/all", response_model=List[locationResponse])
async def get_item_names(
    page: int = Query(1, ge=1),
    limit: int = Query(30, le=50),
    search: str | None = None,
   
):
    collection = location_collection()
    warehouse = warehouse_collection()

    query = {}
    if search:
        query = {"branchName": {"$regex": search, "$options": "i"}, "status": 1}

    cursor = (
        collection.find(
            query,
            {
                "_id": 0,
                "aliasName": 1,
                "branchName": 1,
                "locationId": 1,
            },
        )
        .sort("warehouseId", 1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    if search:
        query = {"warehouseName": {"$regex": search, "$options": "i"}, "status": 1}

    Warehouse = warehouse.find(
        query,
        {
            "_id": 0,
            "aliasName": 1,
            "warehouseName": 1,
            "warehouseId": 1,
        },
    )

    items = []

    async for doc in cursor:
        items.append(
            {
                "aliasName": doc["aliasName"],
                "locationName": doc["branchName"],
                "locationId": doc["locationId"],
            }
        )
    async for doc2 in Warehouse:
        items.append(
            {
                "aliasName": doc2["aliasName"],
                "locationName": doc2["warehouseName"],
                "locationId": doc2["warehouseId"],
            }
        )

    return items


@router.get("/export/sample")
async def export_sample_onhand(request:Request, user = Depends(validate_token),permissions: dict = Depends(check_permission("yenerp", "physicalstockmodification", "read"))):
    tenant_id = request.state.tenant_id
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["ItemCode", "PhysicalStock"])
    writer.writerow(["BMFG0001", "BABIES BUN", "50"])

    output.seek(0)
    filename = f"sample_outletstock_{datetime.utcnow():%Y%m%d_%H%M%S}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
