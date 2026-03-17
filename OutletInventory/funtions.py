from typing import Optional, Dict
from datetime import datetime, timedelta

from db.collections import category_collection, subcategory_collection


def build_mongo_filter_from_params(
    category: Optional[str] = None,
    subCategory: Optional[str] = None,
    itemName: Optional[str] = None,
    varianceName: Optional[str] = None,
    exclude_field: Optional[str] = None,
) -> Dict:
    filters = {}

    def add_filter(field: str, value: Optional[str]):
        if not value:
            return

        vals = [v.strip() for v in value.split(",") if v.strip()]
        if not vals:
            return

        # 🎯 varianceName → itemCode
        if field == "varianceName":
            filters["itemCode"] = {"$in": vals}

        # 🎯 itemName → subCategory
        elif field == "itemName":
            filters["subCategory"] = {"$in": vals}

        else:
            filters[field] = {"$in": vals}

    if exclude_field != "category":
        add_filter("category", category)

    if exclude_field != "subCategory":
        add_filter("subCategory", subCategory)

    if exclude_field != "itemName":
        add_filter("itemName", itemName)

    if exclude_field != "varianceName":
        add_filter("varianceName", varianceName)

    return filters


async def get_filter_field_options(
    collection,
    field: str,
    page: int,
    limit: int,
    category: Optional[str] = None,
    subCategory: Optional[str] = None,
    itemName: Optional[str] = None,
    varianceName: Optional[str] = None,
    search_filter: Optional[str] = None,
    category_map: Optional[Dict[str, str]] = None,
    subcategory_map: Optional[Dict[str, str]] = None,
) -> Dict:
    filter_query = build_mongo_filter_from_params(
        category=category,
        subCategory=subCategory,
        itemName=itemName,
        varianceName=varianceName,
        exclude_field=field,
    )

    values = []

    category_map = category_map or {}
    subcategory_map = subcategory_map or {}

    # 🔹 CATEGORY
    if field == "category":
        raw = await collection.distinct("category", filter=filter_query)
        for v in raw:
            if v:
                values.append(
                    {
                        "id": v,
                        "name": category_map.get(v),
                    }
                )

    # 🔹 SUBCATEGORY
    elif field == "subCategory":
        raw = await collection.distinct("subCategory", filter=filter_query)
        for v in raw:
            if v:
                values.append(
                    {
                        "id": v,
                        "name": subcategory_map.get(v),
                    }
                )

    # 🔹 ITEM NAME (COPY OF SUBCATEGORY)
    elif field == "itemName":
        raw = await collection.distinct("subCategory", filter=filter_query)
        for v in raw:
            if v:
                values.append(
                    {
                        "id": v,
                        "name": subcategory_map.get(v),
                    }
                )

    # 🔹 VARIANCE NAME
    elif field == "varianceName":
        cursor = collection.find(filter_query, {"itemCode": 1, "varianceName": 1})
        seen = set()
        async for doc in cursor:
            key = (doc.get("itemCode"), doc.get("varianceName"))
            if key in seen:
                continue
            seen.add(key)

            if key[0] and key[1]:
                values.append(
                    {
                        "id": key[0],  # itemCode
                        "name": key[1],  # varianceName
                    }
                )

    # 🔍 SEARCH ON NAME
    if search_filter and search_filter.strip():
        term = search_filter.lower()
        values = [v for v in values if v.get("name") and term in v["name"].lower()]

    total = len(values)
    start = (page - 1) * limit
    paginated = values[start : start + limit]

    return {
        "values": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "count": len(paginated),
        "searchFilter": search_filter,
        "hasMore": total > start + limit,
    }


def ist_now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


def ist_yesterday():
    return ist_now() - timedelta(days=1)


async def build_category_map():
    cursor = category_collection().find({"status": "active"})
    return {
        c["categoryId"]: c["categoryName"] async for c in cursor if c.get("categoryId")
    }


async def build_subcategory_map():
    cursor = subcategory_collection().find({"status": "active"})
    return {
        s["subCategoryId"]: s["subCategoryName"]
        async for s in cursor
        if s.get("subCategoryId")
    }
