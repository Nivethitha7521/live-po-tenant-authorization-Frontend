async def get_item_full_details(
    item_code: str,
    item_cache: dict,
    category_cache: dict,
    subcategory_cache: dict,
    ItemMaster,
    ItemCategory,
    ItemSubCategory,
):
    # -------------------------
    # ITEM FETCH
    # -------------------------
    if item_code not in item_cache:
        item_cache[item_code] = await ItemMaster.find_one(
            {"itemCode": {"$regex": f"^{item_code}$", "$options": "i"}}
        )

    item_doc = item_cache.get(item_code)

    category_name = None
    subcategory_name = None
    hsn_code = None

    if item_doc:
        category_id = item_doc.get("category")
        subcategory_id = item_doc.get("subCategory")

        # -------------------------
        # HSN CODE
        # -------------------------
        hsn_code = item_doc.get("hsnCode")

        # -------------------------
        # CATEGORY FETCH
        # -------------------------
        if category_id:
            if category_id not in category_cache:
                category_doc = await ItemCategory.find_one(
                    {"categoryId": category_id}
                )
                category_cache[category_id] = (
                    category_doc.get("categoryName") if category_doc else None
                )
            category_name = category_cache[category_id]

        # -------------------------
        # SUBCATEGORY FETCH
        # -------------------------
        if subcategory_id:
            if subcategory_id not in subcategory_cache:
                sub_doc = await ItemSubCategory.find_one(
                    {"subCategoryId": subcategory_id}
                )
                subcategory_cache[subcategory_id] = (
                    sub_doc.get("subCategoryName") if sub_doc else None
                )
            subcategory_name = subcategory_cache[subcategory_id]

    return {
        "item_doc": item_doc,
        "category_name": category_name,
        "subcategory_name": subcategory_name,
        "hsn_code": hsn_code,
    }


def get_qty_by_uom(doc: dict, idx: int):

    def safe(field):
        arr = doc.get(field, [])
        return arr[idx] if isinstance(arr, list) and idx < len(arr) else None

    uom = safe("uom")
    qty = safe("qty")

    if uom and isinstance(uom, str) and uom.lower() != "pcs":
        qty = safe("weight")

    return qty, uom


def to_int(value, default: int = 0) -> int:
    """
    Safely converts value to int.
    Returns default if conversion fails.
    """
    try:
        if value is None:
            return default

        # Convert to string and clean it
        cleaned = str(value).strip().replace(",", "")

        # If it is empty string after strip
        if cleaned == "":
            return default

        return int(float(cleaned))
    except (ValueError, TypeError):
        return default


def to_float(value, default: float = 0.0) -> float:
    """
    Safely converts value to float.
    Returns default if conversion fails.
    """
    try:
        if value is None:
            return default

        cleaned = str(value).strip().replace(",", "")

        if cleaned == "":
            return default

        return float(cleaned)
    except (ValueError, TypeError):
        return default


def int_to_str(value, default=""):
    """
    Safely convert a value to string.
    Returns default if conversion fails.
    """
    try:
        if value is None:
            return default
        return str(value)
    except Exception:
        return default


def round2(val):
    try:
        return round(float(val or 0), 2)
    except:
        return 0.0
    