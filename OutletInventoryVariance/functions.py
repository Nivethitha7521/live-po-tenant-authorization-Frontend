from typing import Any, Optional, Dict
from datetime import datetime, timedelta, date, timezone
from pymongo.errors import PyMongoError


from db.collections import (
    dispatch_collection,
    get_salesreturn_collection,
    invoices_collection,
    stock_transfer_collection,
    warehouse_return_collection,
    wastage_entry_collection,
)


def daterange(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def has_movement(*values):
    return any(v and float(v) != 0 for v in values)


def safe_float(value, default: float = 0.0) -> float:
    """Safely convert value to float"""
    try:
        if value is None or str(value).strip() == "":
            return float(default)

        val_str = str(value).strip()
        if val_str.startswith("."):
            val_str = "0" + val_str

        return float(val_str)

    except (ValueError, TypeError):
        return float(default)


def normalize_key(value: Any) -> str:
    """Normalize text for matching (supports string or {id, name})"""
    if not value:
        return ""

    # 🔹 NEW: handle object { id, name }
    if isinstance(value, dict):
        value = value.get("name")

    if not isinstance(value, str):
        return ""

    return value.strip().upper()


# NEW FUNCTION: Calculate approve button visibility
def should_show_approve_button(
    inventory_doc: Dict[str, Any], query_date: Optional[date] = None
) -> bool:

    if not inventory_doc:
        return False

    status = inventory_doc.get("status", "").lower()
    variance = safe_float(inventory_doc.get("variance", 0))
    physical_stock = inventory_doc.get("physicalStock")

    # If already approved, no approve button
    if status == "approved":
        return False

    # If no variance, no approve button
    if variance == 0:
        return False
    if physical_stock is None or str(physical_stock).strip() == "":
        return False

    # Check if updated today if query_date is provided
    if query_date:
        updated_at = inventory_doc.get("updatedAt")
        if updated_at:
            try:
                if isinstance(updated_at, datetime):
                    updated_date = updated_at.date()
                elif isinstance(updated_at, str):
                    updated_date = datetime.fromisoformat(
                        updated_at.replace("Z", "+00:00")
                    ).date()
                else:
                    return False

                if updated_date != query_date:
                    return False
            except:
                return False

    return True


# NEW FUNCTION: Get inventory display values
def get_inventory_display_values(
    inventory_doc: Dict[str, Any], query_date: Optional[date] = None
) -> Dict[str, Any]:

    if not inventory_doc:
        return {
            "system_stock": 0,
            "physical_stock": "-",
            "variance_display": "-",
            "status_display": "Not Available",
            "show_approve_button": False,
            "last_updated": "-",
            "is_updated_today": False,
        }

    system_stock = safe_float(inventory_doc.get("systemStock", 0))
    physical_stock = safe_float(inventory_doc.get("physicalStock", 0))
    stored_variance = safe_float(inventory_doc.get("variance", 0))
    status = inventory_doc.get("status", "pending")
    updated_at = inventory_doc.get("updatedAt")

    # Format status for display
    status_display = status.capitalize() if status else "Pending"

    # Check if updated today
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
                is_updated_today = updated_date == query_date
        except:
            pass

    # Determine variance display
    if not is_updated_today and query_date:
        variance_display = "-"
        physical_stock_display = "-"
    else:
        variance_display = stored_variance
        physical_stock_display = physical_stock

    # Determine approve button visibility
    show_approve_button = should_show_approve_button(inventory_doc, query_date)

    return {
        "system_stock": system_stock,
        "physical_stock": physical_stock_display,
        "variance_display": variance_display,
        "status_display": status_display,
        "show_approve_button": show_approve_button,
        "last_updated": last_updated,
        "is_updated_today": is_updated_today,
    }


async def get_dispatch_mapping_agg(
    branch: str, query_date: Optional[date] = None
) -> Dict[str, Any]:
    """
    Fetch dispatched quantities for a branch on a specific date.
    Keys the mapping by `itemCode` for easy lookup.
    Returns: {itemCode: {"dispatchedQty": ..., "lastUpdate": ...}}
    """
    try:
        dispatch_coll = dispatch_collection()  # your MongoDB collection
        target_date = query_date or date.today()

        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())

        pipeline = [
            # 1️⃣ Match branch, status, and date
            {
                "$match": {
                    "locationId": branch,
                    "status": "received",
                    "date": {"$gte": day_start, "$lte": day_end},
                }
            },
            # 2️⃣ Zip arrays together for alignment
            {
                "$project": {
                    "date": 1,
                    "items": {
                        "$zip": {
                            "inputs": [
                                {"$ifNull": ["$varianceName", []]},
                                {"$ifNull": ["$qty", []]},
                                {"$ifNull": ["$weight", []]},
                                {"$ifNull": ["$uom", []]},
                                {"$ifNull": ["$itemCode", []]},  # include itemCode
                            ]
                        }
                    },
                }
            },
            # 3️⃣ Unwind combined items
            {"$unwind": "$items"},
            # 4️⃣ Project individual fields
            {
                "$project": {
                    "date": 1,
                    "varianceName": {"$arrayElemAt": ["$items", 0]},
                    "qty": {"$arrayElemAt": ["$items", 1]},
                    "weight": {"$arrayElemAt": ["$items", 2]},
                    "uom": {"$arrayElemAt": ["$items", 3]},
                    "itemCode": {"$arrayElemAt": ["$items", 4]},  # extract itemCode
                }
            },
            # 5️⃣ Calculate finalQty based on UOM
            {
                "$addFields": {
                    "finalQty": {
                        "$cond": [
                            {
                                "$in": [
                                    {"$toLower": "$uom"},
                                    ["kg", "kgs", "kilogram", "kilograms"],
                                ]
                            },
                            {"$toDouble": {"$ifNull": ["$weight", 0]}},
                            {"$toDouble": {"$ifNull": ["$qty", 0]}},
                        ]
                    }
                }
            },
            # 6️⃣ Group by itemCode
            {
                "$group": {
                    "_id": "$itemCode",
                    "dispatchedQty": {"$sum": "$finalQty"},
                    "lastUpdate": {"$max": "$date"},
                }
            },
        ]

        cursor = dispatch_coll.aggregate(pipeline)
        results = await cursor.to_list(length=None)

        # Build dispatch mapping dictionary keyed by itemCode
        dispatch_map: Dict[str, Dict[str, Any]] = {
            doc["_id"]: {
                "dispatchedQty": float(doc.get("dispatchedQty", 0.0)),
                "lastUpdate": doc["lastUpdate"],
            }
            for doc in results
        }

        return dispatch_map

    except Exception as e:
        return {}


def match_dispatch(
    item: Dict[str, Any], dispatch_map: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Apply dispatched quantity to the item using itemCode as key.
    """
    item_code = item.get("itemCode")

    if item_code and item_code in dispatch_map:
        item["dispatchedQty"] = safe_float(dispatch_map[item_code]["dispatchedQty"])
    else:
        item["dispatchedQty"] = 0.0

    return item


async def get_sales_mapping_agg(
    branch: str, query_date: Optional[date] = None
) -> Dict[str, Any]:

    try:
        sales_coll = invoices_collection()

        match_query = {"locationId": branch}
        if query_date:
            start = datetime.combine(query_date, datetime.min.time())
            end = datetime.combine(query_date, datetime.max.time())
            match_query["invoiceDateTime"] = {"$gte": start, "$lte": end}

        pipeline = [
            {"$match": match_query},
            {
                "$project": {
                    "items": {
                        "$zip": {
                            "inputs": [
                                {
                                    "$ifNull": ["$varianceitemCode", []]
                                },  # ✅ use itemCode
                                {"$ifNull": ["$varianceName", []]},
                                {"$ifNull": ["$qty", []]},
                                {"$ifNull": ["$weight", []]},
                                {"$ifNull": ["$uom", []]},
                            ]
                        }
                    }
                }
            },
            {"$unwind": "$items"},
            {
                "$project": {
                    "itemCode": {"$arrayElemAt": ["$items", 0]},  # itemCode
                    "varianceName": {"$arrayElemAt": ["$items", 1]},
                    "qty": {"$arrayElemAt": ["$items", 2]},
                    "weight": {"$arrayElemAt": ["$items", 3]},
                    "uom": {"$arrayElemAt": ["$items", 4]},
                }
            },
            {
                "$addFields": {
                    "finalQty": {
                        "$cond": [
                            {
                                "$in": [
                                    {"$toLower": "$uom"},
                                    ["kg", "kgs", "kilogram", "kilograms"],
                                ]
                            },
                            {"$toDouble": {"$ifNull": ["$weight", 0]}},
                            {"$toDouble": {"$ifNull": ["$qty", 0]}},
                        ]
                    }
                }
            },
            {
                "$group": {
                    "_id": "$itemCode",  # ✅ key by itemCode
                    "salesQty": {"$sum": "$finalQty"},
                    "varianceName": {"$first": "$varianceName"},
                }
            },
        ]

        docs = await sales_coll.aggregate(pipeline).to_list(length=None)

        sales_map = {
            doc["_id"]: {
                "salesQty": doc["salesQty"],
                "varianceName": doc["varianceName"],
            }
            for doc in docs
        }

        return {"full_map": sales_map}

    except Exception as e:
        print(f"Error in get_sales_mapping_agg: {e}")
        return {"full_map": {}}


def match_sales(item: Dict, sales_map: Dict) -> Dict:
    item_code = item.get("itemCode")
    if item_code and item_code in sales_map:
        item["salesQty"] = safe_float(sales_map[item_code]["salesQty"])
    else:
        item["salesQty"] = 0.0
    return item


async def get_stock_transfer_mapping_agg(
    branch_id: str, query_date: Optional[date] = None
) -> Dict[str, Any]:
    try:
        transfer_coll = stock_transfer_collection()
        target_date = query_date or date.today()

        start = datetime.combine(target_date, datetime.min.time())
        end = datetime.combine(target_date, datetime.max.time())

        pipeline = [
            # 1️⃣ Filter relevant documents using branch IDs
            {
                "$match": {
                    "status": "Received",
                    "receiveDateTime": {"$gte": start, "$lte": end},
                    "$or": [
                        {"toBranchId": branch_id},
                        {"fromBranchId": branch_id},
                    ],
                }
            },
            # 2️⃣ Zip parallel arrays
            {
                "$project": {
                    "fromBranchId": 1,
                    "toBranchId": 1,
                    "items": {
                        "$zip": {
                            "inputs": [
                                {"$ifNull": ["$itemCode", []]},
                                {"$ifNull": ["$receivedQty", []]},
                                {"$ifNull": ["$sendQty", []]},
                            ]
                        }
                    },
                }
            },
            # 3️⃣ Unwind items
            {"$unwind": "$items"},
            # 4️⃣ Extract individual fields
            {
                "$project": {
                    "itemCode": {"$arrayElemAt": ["$items", 0]},
                    "receivedQty": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 1]}, 0]}
                    },
                    "sendQty": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 2]}, 0]}
                    },
                    "fromBranchId": 1,
                    "toBranchId": 1,
                }
            },
            # 5️⃣ Calculate IN / OUT based on branchId
            {
                "$addFields": {
                    "transferInQty": {
                        "$cond": [
                            {"$eq": ["$toBranchId", branch_id]},
                            "$receivedQty",
                            0,
                        ]
                    },
                    "transferOutQty": {
                        "$cond": [
                            {"$eq": ["$fromBranchId", branch_id]},
                            "$sendQty",
                            0,
                        ]
                    },
                }
            },
            # 6️⃣ Group by itemCode
            {
                "$group": {
                    "_id": "$itemCode",
                    "transferInQty": {"$sum": "$transferInQty"},
                    "transferOutQty": {"$sum": "$transferOutQty"},
                }
            },
        ]

        docs = await transfer_coll.aggregate(pipeline).to_list(length=None)

        if not docs:
            return {"full_map": {}, "variance_qty_map": {}}

        transfer_map = {
            doc["_id"]: {
                "transferInQty": doc["transferInQty"],
                "transferOutQty": doc["transferOutQty"],
            }
            for doc in docs
        }

        variance_qty_map = {
            k: {
                "inQuantity": v["transferInQty"],
                "outQuantity": v["transferOutQty"],
            }
            for k, v in transfer_map.items()
        }

        return {"full_map": transfer_map, "variance_qty_map": variance_qty_map}

    except Exception as e:
        print(f"Error in get_stock_transfer_mapping_agg: {e}")
        return {"full_map": {}, "variance_qty_map": {}}


def match_stock_transfer(item: Dict, transfer_map: Dict) -> Dict:
    item_code = item.get("itemCode", "").strip()

    if item_code and item_code in transfer_map:
        item["stockTransferInQty"] = transfer_map[item_code]["transferInQty"]
        item["stockTransferOutQty"] = transfer_map[item_code]["transferOutQty"]
    else:
        item["stockTransferInQty"] = 0.0
        item["stockTransferOutQty"] = 0.0

    return item


async def get_warehousereturn_mapping_agg(
    branch: str, query_date: Optional[date] = None
) -> Dict[str, Any]:

    try:
        warehouse_coll = warehouse_return_collection()
        target_date = query_date or date.today()

        start_dt = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            0,
            0,
            0,
            tzinfo=timezone.utc,
        )
        end_dt = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            23,
            59,
            59,
            999000,
            tzinfo=timezone.utc,
        )

        pipeline = [
            # 1️⃣ Match
            {
                "$match": {
                    "date": {"$gte": start_dt, "$lte": end_dt},
                    "status": {"$regex": "^received$", "$options": "i"},
                    "locationId": branch,
                }
            },
            # 2️⃣ Zip arrays
            {
                "$project": {
                    "locationId": 1,
                    "items": {
                        "$zip": {
                            "inputs": [
                                {"$ifNull": ["$itemCode", []]},
                                {"$ifNull": ["$uom", []]},
                                {"$ifNull": ["$receivedqty", []]},
                                {"$ifNull": ["$receivedweight", []]},
                            ]
                        }
                    },
                }
            },
            # 3️⃣ Unwind per item
            {"$unwind": "$items"},
            # 4️⃣ Extract values
            {
                "$project": {
                    "locationId": 1,
                    "itemCode": {
                        "$toUpper": {
                            "$trim": {
                                "input": {
                                    "$ifNull": [{"$arrayElemAt": ["$items", 0]}, ""]
                                }
                            }
                        }
                    },
                    "uom": {
                        "$toLower": {"$ifNull": [{"$arrayElemAt": ["$items", 1]}, ""]}
                    },
                    "receivedQty": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 2]}, 0]}
                    },
                    "receivedWeight": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 3]}, 0]}
                    },
                }
            },
            # 5️⃣ Remove empty itemCode
            {"$match": {"itemCode": {"$ne": ""}}},
            # 6️⃣ UOM logic (KG → weight, others → qty)
            {
                "$addFields": {
                    "finalQty": {
                        "$cond": [
                            {
                                "$in": [
                                    "$uom",
                                    ["kg", "kgs", "kilogram", "kilograms"],
                                ]
                            },
                            "$receivedWeight",
                            "$receivedQty",
                        ]
                    }
                }
            },
            # 7️⃣ Group by itemCode
            {
                "$group": {
                    "_id": "$itemCode",
                    "warehouseReturnQty": {"$sum": "$finalQty"},
                }
            },
        ]

        docs = await warehouse_coll.aggregate(pipeline).to_list(length=None)

        if not docs:
            return {"full_map": {}, "variance_qty_map": {}}

        warehouse_map = {
            doc["_id"]: {"warehouseReturnQty": float(doc["warehouseReturnQty"])}
            for doc in docs
        }

        return {
            "full_map": warehouse_map,
            "variance_qty_map": warehouse_map,
        }

    except Exception as e:
        print("WAREHOUSE RETURN AGG ERROR →", e)
        return {"full_map": {}, "variance_qty_map": {}}


def match_warehouseReturn(item: Dict, warehouse_map: Dict) -> Dict:
    if not item:
        return {"warehouseReturnQty": 0.0}

    item_codes = item.get("itemCode")

    if not item_codes:
        item["warehouseReturnQty"] = 0.0
        return item

    if not isinstance(item_codes, list):
        item_codes = [item_codes]

    total_qty = 0.0

    for code in item_codes:
        key = code.strip().upper()
        total_qty += warehouse_map.get(key, {}).get("warehouseReturnQty", 0.0)

    item["warehouseReturnQty"] = total_qty
    return item


async def get_wastagereturn_mapping_agg(
    branch_id: str, query_date: Optional[date] = None
) -> Dict[str, Any]:
    try:
        wastage_coll = wastage_entry_collection()
        target_date = query_date or date.today()

        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())

        pipeline = [
            # 1️⃣ Match by branch + received status + date
            {
                "$match": {
                    "status": {"$regex": "^received$", "$options": "i"},
                    "locationId": branch_id,
                    "date": {"$gte": start_dt, "$lte": end_dt},
                }
            },
            # 2️⃣ Keep locationId and zip arrays
            {
                "$project": {
                    "locationId": 1,
                    "items": {
                        "$zip": {
                            "inputs": [
                                {"$ifNull": ["$itemCode", []]},
                                {"$ifNull": ["$receivedqty", []]},
                                {"$ifNull": ["$receivedweight", []]},
                                {"$ifNull": ["$uom", []]},
                            ]
                        }
                    },
                }
            },
            # 3️⃣ One document per item
            {"$unwind": "$items"},
            # 4️⃣ Extract fields
            {
                "$project": {
                    "locationId": 1,
                    "itemCode": {"$arrayElemAt": ["$items", 0]},
                    "receivedQty": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 1]}, 0]}
                    },
                    "receivedWeight": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 2]}, 0]}
                    },
                    "uom": {
                        "$toLower": {"$ifNull": [{"$arrayElemAt": ["$items", 3]}, ""]}
                    },
                }
            },
            # 5️⃣ Apply UOM logic (kg uses weight, others use qty)
            {
                "$addFields": {
                    "finalQty": {
                        "$cond": [
                            {
                                "$in": [
                                    "$uom",
                                    ["kg", "kgs", "kilogram", "kilograms"],
                                ]
                            },
                            "$receivedWeight",
                            "$receivedQty",
                        ]
                    }
                }
            },
            # 6️⃣ Remove empty itemCodes
            {"$match": {"itemCode": {"$ne": None}}},
            # 7️⃣ Group by itemCode (location already filtered)
            {
                "$group": {
                    "_id": "$itemCode",
                    "wastageReturnQty": {"$sum": "$finalQty"},
                }
            },
        ]

        docs = await wastage_coll.aggregate(pipeline).to_list(length=None)

        if not docs:
            return {"full_map": {}, "variance_qty_map": {}}

        wastage_map = {
            normalize_key(doc["_id"]): {
                "wastageReturnQty": float(doc.get("wastageReturnQty", 0))
            }
            for doc in docs
        }

        return {
            "full_map": wastage_map,
            "variance_qty_map": wastage_map,
        }

    except PyMongoError as e:
        print(f"Mongo Error in get_wastagereturn_mapping_agg: {e}")
    except Exception as e:
        print(f"Unexpected Error in get_wastagereturn_mapping_agg: {e}")

    return {"full_map": {}, "variance_qty_map": {}}


# ✅ Correct Matching Using itemCode (NOT varianceName)


def match_wastage(item: Optional[Dict], wastage_map: Dict) -> Dict:
    if not item:
        return {"wastageReturnQty": 0.0}

    item_codes = item.get("itemCode")

    if not item_codes:
        item["wastageReturnQty"] = 0.0
        return item

    # Ensure list
    if not isinstance(item_codes, list):
        item_codes = [item_codes]

    total_qty = 0.0

    for code in item_codes:
        key = normalize_key(str(code))
        total_qty += wastage_map.get(key, {}).get("wastageReturnQty", 0.0)

    item["wastageReturnQty"] = total_qty

    return item


async def get_sales_return_mapping_agg(
    alias_name: str, query_date: Optional[date] = None
) -> Dict[str, Any]:

    try:
        sales_return_coll = get_salesreturn_collection()

        match_query = {"locationId": alias_name}

        if query_date:
            # Convert date to string prefix
            date_prefix = query_date.isoformat()
            match_query["returnDateTime"] = {"$regex": f"^{date_prefix}"}

        pipeline = [
            {"$match": match_query},
            # Zip parallel arrays into one
            {
                "$project": {
                    "items": {
                        "$zip": {
                            "inputs": [
                                {"$ifNull": ["$varianceName", []]},
                                {"$ifNull": ["$qty", []]},
                                {"$ifNull": ["$weight", []]},
                                {"$ifNull": ["$uom", []]},
                            ]
                        }
                    }
                }
            },
            # Unwind to separate documents
            {"$unwind": "$items"},
            # Extract values
            {
                "$project": {
                    "varianceName": {"$arrayElemAt": ["$items", 0]},
                    "qty": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 1]}, 0]}
                    },
                    "weight": {
                        "$toDouble": {"$ifNull": [{"$arrayElemAt": ["$items", 2]}, 0]}
                    },
                    "uom": {"$arrayElemAt": ["$items", 3]},
                }
            },
            # UOM logic
            {
                "$addFields": {
                    "finalQty": {
                        "$cond": [
                            {
                                "$in": [
                                    {"$toLower": "$uom"},
                                    ["kg", "kgs", "kilogram", "kilograms"],
                                ]
                            },
                            "$weight",
                            "$qty",
                        ]
                    }
                }
            },
            # Group by normalized variance name
            {
                "$group": {
                    "_id": {"$toLower": "$varianceName"},
                    "returnQty": {"$sum": "$finalQty"},
                    "originalVarianceName": {"$first": "$varianceName"},
                }
            },
        ]

        docs = await sales_return_coll.aggregate(pipeline).to_list(length=None)

        if not docs:
            return {"full_map": {}, "variance_qty_map": {}}

        return_map = {
            doc["_id"]: {
                "returnQty": doc["returnQty"],
                "originalVarianceName": doc["originalVarianceName"],
            }
            for doc in docs
        }

        variance_qty_map = {
            doc["originalVarianceName"]: {"quantity": doc["returnQty"]} for doc in docs
        }

        return {"full_map": return_map, "variance_qty_map": variance_qty_map}

    except Exception:
        return {"full_map": {}, "variance_qty_map": {}}


def match_sales_return(item: Dict, sales_return_map: Dict) -> Dict:
    variance_name = normalize_key(item.get("varianceName", ""))

    key = None

    if variance_name in sales_return_map:
        key = variance_name
    else:
        for k in sales_return_map.keys():
            if variance_name.replace("_", "") in k.replace("_", ""):
                key = k
                break

    item["salesReturnQty"] = float(sales_return_map.get(key, {}).get("returnQty", 0.0))
    return item


def calculate_quantities(item: Dict) -> Dict:
    try:
        opening = safe_float(item.get("openingStockQty", 0))
        received = safe_float(item.get("dispatchedQty", 0))
        transfer_in = safe_float(item.get("stockTransferInQty", 0))
        transfer_out = safe_float(item.get("stockTransferOutQty", 0))
        sales = safe_float(item.get("salesQty", 0))
        sales_return = safe_float(item.get("salesReturnQty", 0))
        warehouse = safe_float(item.get("wastageReceivedQty", 0))
        wastage = safe_float(item.get("wastageReturnQty", 0))

        current_system = (
            opening
            + received
            + transfer_in
            - transfer_out
            - sales
            + sales_return
            - warehouse
            - wastage
        )

        item["currentSystemQty"] = float(current_system)

    except Exception:
        item["currentSystemQty"] = 0.0

    return item
