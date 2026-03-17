from db.collections import uom_collection


async def get_uom_precision(uom_id: str) -> int:
    """
    Fetch the precision for a UOM (decimal places).
    Default: 0 if not found.
    """
    # Replace this with your actual UOM collection lookup
    uom_doc = await uom_collection().find_one({"uomId": uom_id})
    if uom_doc and "precision" in uom_doc:
        return int(uom_doc["precision"])
    return 0


def apply_precision(value: float, precision: int) -> float:
    """Round value according to UOM precision"""
    return round(value, precision)