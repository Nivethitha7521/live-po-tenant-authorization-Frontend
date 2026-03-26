from datetime import datetime, timedelta, timezone
from bson import ObjectId
from typing import Optional
from bson.regex import Regex
from typing import Dict, Any
import re
import math

from fastapi import HTTPException

from db.collections import (
    closingstocks_rm_collection,
    grn_collection,
    inventory_stock_collection,
    purchaseitem_collection,
    storeDispatch_collection,
    warehouse_return_collection,
    purchase_uom_collection,  # Added UOM collection
)
from WarehouseInventoryVariance.models import PurchaseItem


# ==================== UOM PRECISION HELPER ====================


async def get_uom_precision_map(tenant_id: str) -> Dict[str, int]:
    """
    Fetches all UOMs and calculates precision integer.
    Example: "0.001" -> 3, "1" -> 0, "0.01" -> 2
    """
    cursor = purchase_uom_collection(tenant_id).find({}, {"uom": 1, "precisionValue": 1})
    docs = await cursor.to_list(None)

    uom_map = {}
    for doc in docs:
        uom_name = doc.get("uom")
        prec_val = doc.get("precisionValue", "1")  # Default to "1" (Integer)

        precision_int = 0

        if isinstance(prec_val, (int, float)):
            if prec_val == 0:
                precision_int = 0
            else:
                precision_int = int(round(-math.log10(abs(prec_val))))

        elif isinstance(prec_val, str):
            try:
                float_val = float(prec_val)
                if float_val == 0:
                    precision_int = 0
                else:
                    precision_int = int(round(-math.log10(abs(float_val))))
            except:
                if "." in prec_val:
                    precision_int = len(prec_val.split(".")[1])
                else:
                    precision_int = 0

        if uom_name:
            uom_map[uom_name] = precision_int

    return uom_map


def round_by_precision(value: float, precision: int) -> float:
    """Rounds value to specific decimal places."""
    if value is None:
        return 0.0
    return round(float(value), precision)


# ==================== END UOM HELPER ====================


# ==================== HELPER FUNCTIONS ====================
def create_search_pattern(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"\s+", ".*", text.strip())
    return f".*{cleaned}.*"


def round3(value) -> float:
    try:
        return float(round(float(value), 3))
    except:
        return 0.0


def clean(value: Optional[str]) -> Optional[str]:
    return " ".join(value.strip().split()) if value else None


def convert_object_ids(data):
    """Recursively convert ObjectId to string for JSON responses."""
    if isinstance(data, list):
        return [convert_object_ids(i) for i in data]
    if isinstance(data, dict):
        return {k: convert_object_ids(v) for k, v in data.items()}
    if isinstance(data, ObjectId):
        return str(data)
    return data


def make_regex_list(values: Optional[str]):
    if not values:
        return None
    raw_items = [v.strip() for v in values.split(",") if v.strip()]
    items = [clean(v) for v in raw_items if clean(v)]
    return [Regex(create_search_pattern(v), "i") for v in items]


def safe_float(value, default=0.0) -> float:
    try:
        if value is None or str(value).strip() == "":
            return float(default)
        val_str = str(value).strip()
        if val_str.startswith("."):
            val_str = "0" + val_str
        return float(val_str)
    except (ValueError, TypeError):
        return float(default)


# NEW: Calculate variance between system and physical stock
def calculate_variance(system_stock: float, physical_stock: float) -> float:
    return float(physical_stock) - float(system_stock)


def should_show_approve_button(inventory_doc: Dict[str, Any]) -> bool:

    if not inventory_doc:
        return False  # Not Available case

    status = (inventory_doc.get("status") or "").lower()
    variance = safe_float(inventory_doc.get("variance", 0))

    # If no variance → no approve button
    if variance == 0:
        return False

    # If approved → no approve button
    if status == "approved":
        return False

    # If pending and variance exists → show button
    if status == "pending":
        return True

    return False


def get_inventory_display_values(
    inventory_doc: Dict[str, Any], query_date: Optional[datetime] = None
) -> Dict[str, Any]:

    # Default return when no inventory doc exists
    if not inventory_doc:
        return {
            "system_stock": 0.0,
            "physical_stock": "-",
            "variance_display": "-",
            "status_display": "Not Available",
            "show_approve_button": False,
            "last_updated": "-",
            "is_updated_today": False,
        }

    system_stock = safe_float(inventory_doc.get("systemStock", 0))
    physical_stock = inventory_doc.get("physicalStock")
    stored_variance = inventory_doc.get("variance")
    status = inventory_doc.get("status")
    updated_at = inventory_doc.get("updatedAt")

    # Status display
    status_display = status.capitalize() if status else "Not Available"

    # -----------------------------
    # Check Updated Today
    # -----------------------------
    is_updated_today = False
    last_updated = "-"

    if updated_at:
        try:
            if isinstance(updated_at, datetime):
                updated_date = updated_at.date()
                last_updated = updated_at.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(updated_at, str):
                updated_date = datetime.fromisoformat(
                    updated_at.replace("Z", "+00:00")
                ).date()
                last_updated = updated_at
            else:
                updated_date = None

            if query_date and updated_date:
                is_updated_today = updated_date == query_date.date()
        except:
            pass

    # -----------------------------
    # Display Logic
    # -----------------------------
    if not is_updated_today or physical_stock is None:
        physical_stock_display = "-"
        variance_display = "-"
        status_display = "Not Available"
    else:
        physical_stock_display = safe_float(physical_stock)
        variance_display = safe_float(stored_variance)

    # -----------------------------
    # Approve Button
    # -----------------------------
    show_approve_button = should_show_approve_button(inventory_doc)

    return {
        "system_stock": system_stock,
        "physical_stock": physical_stock_display,
        "variance_display": variance_display,
        "status_display": status_display,
        "show_approve_button": show_approve_button,
        "last_updated": last_updated,
        "is_updated_today": is_updated_today,
    }


def build_filter(
    varianceName: Optional[str],
    category: Optional[str],
    subcategory: Optional[str],
    itemName: Optional[str],
):
    filter_dict = {}

    # ------- VarianceName → EXACT MATCH on itemName -------
    if varianceName:
        raw_vals = [clean(v) for v in varianceName.split(",") if v.strip()]
        filter_dict["itemName"] = {
            "$in": [Regex(f"^{re.escape(v)}$", "i") for v in raw_vals]
        }

    # ------- ItemName → EXACT MATCH on itemgroupName -------
    if itemName:
        raw_vals = [clean(v) for v in itemName.split(",") if v.strip()]
        filter_dict["itemgroupName"] = {
            "$in": [Regex(f"^{re.escape(v)}$", "i") for v in raw_vals]
        }

    # ------- Category → EXACT MATCH -------
    if category:
        raw_vals = [clean(v) for v in category.split(",") if v.strip()]
        filter_dict["purchasecategoryName"] = {
            "$in": [Regex(f"^{re.escape(v)}$", "i") for v in raw_vals]
        }

    # ------- Subcategory → EXACT MATCH + null logic -------
    if subcategory:
        raw_items = [clean(v) for v in subcategory.split(",") if v.strip()]
        has_null = any(v.lower() == "null" for v in raw_items)
        non_null_items = [v for v in raw_items if v.lower() != "null"]

        exact_regex = [Regex(f"^{re.escape(v)}$", "i") for v in non_null_items]

        null_conditions = [
            {"purchasesubcategoryName": None},
            {"purchasesubcategoryName": ""},
            {"purchasesubcategoryName": {"$regex": "^null$", "$options": "i"}},
        ]

        if non_null_items and has_null:
            filter_dict["purchasesubcategoryName"] = {
                "$or": [
                    {"purchasesubcategoryName": {"$in": exact_regex}},
                    *null_conditions,
                ]
            }
        elif non_null_items:
            filter_dict["purchasesubcategoryName"] = {"$in": exact_regex}
        elif has_null:
            filter_dict["purchasesubcategoryName"] = {"$or": null_conditions}

    return filter_dict


# ==================== MAP OPENING STOCK FROM YESTERDAY CLOSING DATA ====================
async def fetch_opening_stock_for_day(locationName: str, date_obj,tenant_id: str):
    closing_col = closingstocks_rm_collection(tenant_id)

    prev_date = (date_obj - timedelta(days=1)).strftime("%Y-%m-%d")

    query = {"date": prev_date}
    if locationName:
        query["locationId"] = locationName

    cursor = closing_col.find(query)

    opening_stock_map = {}
    async for doc in cursor:
        opening_stock_map[str(doc["randomId"]).strip().lower()] = {
            "openingSystem": doc.get("systemStock", 0),
            "openingPhysical": doc.get("physicalStock", 0),
        }

    return opening_stock_map


# ==================== FETCH INVENTORY WITH STATUS AND VARIANCE ====================
async def fetch_inventory_map_for_day(
    location_id: str, date_obj: datetime,tenant_id: str
) -> Dict[str, Dict[str, Any]]:

    col = inventory_stock_collection(tenant_id)

    # Ensure date_obj is timezone aware
    if date_obj.tzinfo is None:
        date_obj = date_obj.replace(tzinfo=timezone.utc)

    # Create start and end of day in UTC
    start_date = datetime(
        date_obj.year, date_obj.month, date_obj.day, 0, 0, 0, 0, tzinfo=timezone.utc
    )
    end_date = start_date + timedelta(days=1)

    try:
        # Get ALL latest records for the location
        all_pipeline = [
            {"$match": {"locationId": location_id}},
            {"$sort": {"updatedAt": -1}},
            {
                "$group": {
                    "_id": "$randomId",
                    "systemStock": {"$first": "$systemStock"},
                    "physicalStock": {"$first": "$physicalStock"},
                    "variance": {"$first": "$variance"},
                    "status": {"$first": "$status"},
                    "updatedAt": {"$first": "$updatedAt"},
                    "lastUpdatedBy": {"$first": "$lastUpdatedBy"},
                }
            },
        ]

        all_items = await col.aggregate(all_pipeline).to_list(None)

        # Get items updated TODAY
        today_pipeline = [
            {
                "$match": {
                    "locationId": location_id,
                    "updatedAt": {"$gte": start_date, "$lt": end_date},
                }
            },
            {"$sort": {"updatedAt": -1}},
            {
                "$group": {
                    "_id": "$randomId",
                    "systemStock": {"$first": "$systemStock"},
                    "physicalStock": {"$first": "$physicalStock"},
                    "variance": {"$first": "$variance"},
                    "status": {"$first": "$status"},
                    "updatedAt": {"$first": "$updatedAt"},
                    "lastUpdatedBy": {"$first": "$lastUpdatedBy"},
                }
            },
        ]

        today_items = await col.aggregate(today_pipeline).to_list(None)

        # Create lookup dictionaries
        today_lookup = {}
        for item in today_items:
            random_id = str(item["_id"]).strip().lower()
            today_lookup[random_id] = {
                "systemStock": safe_float(item.get("systemStock", 0)),
                "physicalStock": safe_float(item.get("physicalStock", 0)),
                "variance": safe_float(item.get("variance", 0)),
                "status": item.get("status", "pending"),
                "updatedAt": item.get("updatedAt"),
                "lastUpdatedBy": item.get("lastUpdatedBy", ""),
                "isUpdatedToday": True,
            }

        # Build final inventory map
        inventory_map = {}

        # Process all items
        for item in all_items:
            random_id = str(item["_id"]).strip().lower()

            if random_id in today_lookup:
                # Use today's data if available
                inventory_map[random_id] = today_lookup[random_id]
            else:
                # Use latest data but mark as not updated today
                inventory_map[random_id] = {
                    "systemStock": safe_float(item.get("systemStock", 0)),
                    "physicalStock": None,  # Not updated today
                    "variance": None,
                    "status": None,
                    "updatedAt": item.get("updatedAt"),
                    "lastUpdatedBy": item.get("lastUpdatedBy", ""),
                    "isUpdatedToday": False,
                }

        return inventory_map

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {}


# ==================== MAP PURCHASE DATA ====================
async def map_purchase_data(tenant_id: str,
    purchase_items,
    grn_data,
    store_map,
    opening_stock_map,
    inventory_map,
    location_name=None,
    warehouse_return_map=None,
    query_date=None,
):

    # Fetch UOM Precision Map
    uom_precision_map = await get_uom_precision_map(tenant_id)

    grn_map = {
        (g.get("_id") or "")
        .strip()
        .lower(): {
            "totalReceivedQuantity": g.get("totalReceivedQuantity", 0),
            "totalReturnedQuantity": g.get("totalReturnedQuantity", 0),
        }
        for g in grn_data
        if g.get("_id")
    }

    formatted_items = []

    for item in purchase_items:
        raw_item_name = (item.get("itemName") or "").strip().upper()
        raw_id_str = str(item.get("randomId") or "").strip().lower()
        variance_key = raw_item_name.lower()

        # Get precision for this item
        uom_name = item.get("uom", "")
        precision = uom_precision_map.get(uom_name, 0)

        grn_info = grn_map.get(variance_key, {})
        received_qty = safe_float(grn_info.get("totalReceivedQuantity", 0))
        returned_qty = safe_float(grn_info.get("totalReturnedQuantity", 0))

        dispatch_qty = safe_float(store_map.get(variance_key, 0))
        warehouse_return = safe_float(warehouse_return_map.get(variance_key, 0))

        opening_stock = safe_float(
            opening_stock_map.get(raw_id_str, {}).get("openingSystem", 0)
        )

        # Calculate current system based on opening stock + transactions
        current_system = (
            opening_stock
            + received_qty
            - returned_qty
            - dispatch_qty
            + warehouse_return
        )

        # Apply precision to calculations
        opening_stock = round_by_precision(opening_stock, precision)
        received_qty = round_by_precision(received_qty, precision)
        returned_qty = round_by_precision(returned_qty, precision)
        dispatch_qty = round_by_precision(dispatch_qty, precision)
        warehouse_return = round_by_precision(warehouse_return, precision)
        current_system = round_by_precision(current_system, precision)

        # Get inventory display values
        inventory_doc = inventory_map.get(raw_id_str, {})
        display_values = get_inventory_display_values(inventory_doc, query_date)

        # If not updated today, use computed current_system
        updated_current_system = (
            display_values["system_stock"] if inventory_doc else current_system
        )

        # Apply precision to display values if they are floats
        if isinstance(display_values["physical_stock"], (int, float)):
            display_values["physical_stock"] = round_by_precision(
                display_values["physical_stock"], precision
            )
        if isinstance(display_values["variance_display"], (int, float)):
            display_values["variance_display"] = round_by_precision(
                display_values["variance_display"], precision
            )

        formatted_items.append(
            PurchaseItem(
                rawmaterialId=raw_id_str,
                randomId=item.get("randomId") or "",
                itemCode=item.get("randomId") or "",
                category=(item.get("purchasecategoryName") or "").upper(),
                subcategory=(item.get("purchasesubcategoryName") or "".upper()),
                itemName=raw_item_name,
                varianceName=(item.get("itemgroupName") or "").upper(),
                openingStock=float(opening_stock),
                receivedQty=float(received_qty),
                returnedQty=float(returned_qty),
                dispatchQty=float(dispatch_qty),
                warehouseReturn=float(warehouse_return),
                currentSystem=float(current_system),
                updatedCurrentSystem=float(
                    round_by_precision(updated_current_system, precision)
                ),
                physicalClosing=display_values["physical_stock"],
                variance=display_values["variance_display"],
                approvalStatus=display_values["status_display"],
                approvalButton=display_values["show_approve_button"],
                locationName=location_name or "",
                lastUpdated=display_values["last_updated"],
            )
        )

    return formatted_items


# ==================== DROPDOWN HELPER ====================
async def get_dropdown_values(
    collection, field, page, limit, search, base_filter: Optional[dict] = None
):
    base_filter = base_filter or {}
    if search:
        pattern = create_search_pattern(search)
        field_filter = {field: Regex(pattern, "i")}
        filter_query = {**base_filter, **field_filter}
    else:
        filter_query = base_filter
    try:
        raw_values = await collection.distinct(field, filter_query)
        cleaned_values = []
        seen = set()
        for v in raw_values:
            if not v:
                continue
            cleaned = clean(v)
            if cleaned and cleaned.lower() not in seen:
                seen.add(cleaned.lower())
                cleaned_values.append(cleaned)
        cleaned_values.sort(key=lambda x: x.lower())
        start = (page - 1) * limit
        paginated = cleaned_values[start : start + limit]
        total = len(cleaned_values)
        return paginated, total
    except Exception as e:
        return [], 0


# helper to fetch inventory by randomId + warehouse + date
async def fetch_inventory_stock(random_id, warehouse_id, date_obj, tenant_id):
    col = closingstocks_rm_collection(tenant_id)

    start = datetime(date_obj.year, date_obj.month, date_obj.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    doc = await col.find_one(
        {
            "randomId": random_id,
            "locationId": warehouse_id,
            "createdAt": {"$gte": start, "$lt": end},
        },
        sort=[("_id", -1)],
    )

    if not doc:
        return {"systemStock": 0.0, "physicalStock": 0.0}

    return {
        "systemStock": safe_float(doc.get("systemStock", 0)),
        "physicalStock": safe_float(doc.get("physicalStock", 0)),
    }


# ==================== FETCH PURCHASE ITEMS ====================
async def fetch_purchase_items(tenant_id: str,
    skip: int,
    limit: int,
    varianceName: Optional[str],
    category: Optional[str],
    subcategory: Optional[str],
    itemName: Optional[str],
):
    collection = purchaseitem_collection(tenant_id)
    filter_dict = build_filter(varianceName, category, subcategory, itemName)
    query = filter_dict if filter_dict else {}
    try:
        total = await collection.count_documents(query)
        data = (
            await collection.find(query)
            .sort("_id", 1)
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )
        return data, total, collection
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch purchase items: {str(e)}"
        )


# ==================== FETCH GRN DATA ====================
async def fetch_grn_data(tenant_id: str, date_obj=None, next_day=None):
    if date_obj is None:
        date_obj = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if next_day is None:
        next_day = date_obj + timedelta(days=1)

    grn_col = grn_collection(tenant_id)

    grn_filter = {"grnDate": {"$gte": date_obj, "$lt": next_day}}
    try:
        grn_data = await grn_col.aggregate(
            [
                {"$match": grn_filter},
                {"$unwind": "$itemDetails"},
                {
                    "$group": {
                        "_id": "$itemDetails.itemName",
                        "totalReceivedQuantity": {
                            "$sum": {"$toDouble": "$itemDetails.receivedQuantity"}
                        },
                        "totalReturnedQuantity": {
                            "$sum": {"$toDouble": "$itemDetails.returnedQuantity"}
                        },
                    }
                },
            ]
        ).to_list(None)
        return grn_data
    except Exception:
        return []


# ==================== FETCH STORE DISPATCH DATA ====================
async def fetch_store_dispatch_data(date_obj):
    store_col = storeDispatch_collection()
    date_str = date_obj.strftime("%Y-%m-%d")

    match = {
        "status": "dispatched",
        "type": "store",
        "date": {"$regex": f"^{date_str}"},
    }

    pipeline = [
        {"$match": match},
        {
            "$unwind": {
                "path": "$varianceName",
                "includeArrayIndex": "idx",
                "preserveNullAndEmptyArrays": True,
            }
        },
        {
            "$addFields": {
                "uomValue": {"$arrayElemAt": ["$uom", "$idx"]},
                "qtyValue": {"$arrayElemAt": ["$qty", "$idx"]},
                "weightValue": {"$arrayElemAt": ["$weight", "$idx"]},
            }
        },
        {
            "$addFields": {
                "finalQty": {
                    "$cond": [
                        {"$eq": ["$uomValue", "Kgs"]},
                        "$weightValue",
                        "$qtyValue",
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": "$varianceName",
                "totalDispatch": {"$sum": {"$toDouble": "$finalQty"}},
            }
        },
    ]

    try:
        store_data = await store_col.aggregate(pipeline).to_list(None)
        return {
            item["_id"].lower(): item["totalDispatch"]
            for item in store_data
            if item["_id"]
        }
    except Exception:
        return {}


# ==================== FETCH WAREHOUSE RETURN DATA ====================
async def fetch_warehouse_return_data(date_obj=None, warehouse=None):
    warehouse_col = warehouse_return_collection()
    if not date_obj:
        date_obj = datetime.now()
    start = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    query = {
        "$and": [
            {
                "$or": [
                    {"date": {"$gte": start, "$lt": end}},
                    {"date": {"$regex": f"^{date_obj.strftime('%Y-%m-%d')}"}},
                ]
            },
            {"status": "Received"},
        ]
    }
    if warehouse:
        query["$and"].append(
            {"warehouseName": {"$regex": f"^{re.escape(warehouse)}$", "$options": "i"}}
        )
    try:
        docs = await warehouse_col.find(query).to_list(None)
        warehouse_map = {}
        for doc in docs:
            item_names = doc.get("varianceName") or doc.get("itemName") or []
            received_qtys = doc.get("receivedqty") or doc.get("receivedQty") or []
            for i, name in enumerate(item_names):
                try:
                    qty = float(received_qtys[i])
                except (ValueError, IndexError, TypeError):
                    qty = 0.0
                key = name.strip().lower()
                warehouse_map[key] = warehouse_map.get(key, 0) + qty
        return warehouse_map
    except Exception:
        return {}
