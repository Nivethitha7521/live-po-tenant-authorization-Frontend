from datetime import datetime
from typing import List, Optional, Any

from fastapi import APIRouter, Query, HTTPException,Depends,Request
from pydantic import BaseModel, Field
import pytz
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from purchaseOrder.models import Freight
from utils.database import get_purchaseorder_collection

router = APIRouter()

# Single Item model - ONLY GRN Converted fields
class Item(BaseModel):
    itemId: Optional[str] = None
    itemCode: Optional[str] = None
    itemName: Optional[str] = None
    poQuantity: Optional[float] = None
    poQuantityTaxAmount: Optional[float] = None
    poQuantityDiscountAmount: Optional[float] = None
    poQuantitypendingTotalPrice: Optional[float] = Field(None, ge=0)
    poQuantitypendingFinalPrice: Optional[float] = Field(None, ge=0)
    poQuantitysgst: Optional[float] = Field(None, ge=0, description="PoQuantity SGST amount")
    poQuantitycgst: Optional[float] = Field(None, ge=0, description="PoQuantity CGST amount")
    poQuantityigst: Optional[float] = Field(None, ge=0, description="PoQuantity IGST amount")
    uom: Optional[str] = None
    taxPercentage: Optional[float] = Field(None, ge=0)
    newPrice: Optional[float] = Field(None, ge=0)
    expiryDate: Optional[datetime] = None
    hsnCode: Optional[str] = None
    status: Optional[str] = None
    randomId: Optional[str] = None

# Single Purchase Order model - Only essential fields
class PurchaseOrderState(BaseModel):
    purchaseOrderId: Optional[str] = None
    vendorName: Optional[str] = None
    vendorContact: Optional[str] = None
    orderDate: Optional[datetime] = None
    poStatus: Optional[str] = None
    items: Optional[List[Item]] = None
    randomId: Optional[str] = None
    gstNumber: Optional[str] = None
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    freights: Optional[List[Freight]] = None
    pendingOrderAmount:Optional[float]=None
    pendingDiscountAmount:Optional[float] = None
    pendingTaxAmount:Optional[float] = None
    totalOrderAmount: Optional[float] = None
    totalDiscount: Optional[float] =None
    totalTax: Optional[float] =None
# Response wrapper model
class PurchaseOrderResponse(BaseModel):
    purchaseOrders: List[PurchaseOrderState]
    totalItems: int

@router.get("/grnConverted/purchase", response_model=PurchaseOrderResponse)
async def get_purchaseorders( request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=5000),
    status: Optional[str] = Query(None),
    vendorName: Optional[str] = Query(None),
    itemName: Optional[str] = Query(None),
    randomId: Optional[str] = Query(None),
    fromDate: Optional[datetime] = Query(None),
    toDate: Optional[datetime] = Query(None),user = Depends(validate_token),
      permissions: dict = Depends(check_permission("yenerp", "purchaseorders_grn_converted", "read"))
):
    tenant_id = request.state.tenant_id
    """
    Get GRN Converted purchase orders.
    - ALWAYS returns only orders with poStatus = 'GRN Converted'
    - Shows ALL items from these purchase orders (no quantity filtering)
    - Additional filters work on top of these base filters
    """
    # BASE FILTER - Always applied to ensure we only get GRN Converted orders
    query = {
        "poStatus": "GRNConverted"
    }
    
    IST = pytz.timezone('Asia/Kolkata')

    try:
        # Status filter - if provided, combine with GRN Converted
        if status:
            status_list = [s.strip() for s in status.split(",")]
            # Always include GRN Converted
            if "GRN Converted" not in status_list:
                status_list.append("Converted")
            query["poStatus"] = {"$in": status_list}

        # Vendor name filter
        if vendorName:
            query["vendorName"] = {"$regex": f"^{vendorName}", "$options": "i"}
        
        # Random ID filter
        if randomId:
            query["randomId"] = {"$regex": f"^{randomId}", "$options": "i"}

        # Item name filter - find orders that have this item
        if itemName:
            query["items"] = {
                "$elemMatch": {
                    "itemName": {"$regex": f"^{itemName}", "$options": "i"}
                }
            }

        # Date range filter
        if fromDate or toDate:
            def normalize_start(dt):
                if dt.tzinfo is None:
                    return IST.localize(datetime.combine(dt.date(), datetime.min.time()))
                else:
                    return dt.replace(hour=0, minute=0, second=0, microsecond=0)

            def normalize_end(dt):
                if dt.tzinfo is None:
                    return IST.localize(datetime.combine(dt.date(), datetime.max.time()))
                else:
                    return dt.replace(hour=23, minute=59, second=59, microsecond=999999)

            date_filter = {}
            if fromDate:
                date_filter["$gte"] = normalize_start(fromDate)
            if toDate:
                date_filter["$lte"] = normalize_end(toDate)
            
            if date_filter:
                query["orderDate"] = date_filter

        print(f"Filter query: {query}")

        collection = get_purchaseorder_collection(tenant_id)
        total = collection.count_documents(query)

        # Fetch with sort (descending by orderDate)
        cursor = collection.find(query).sort("orderDate", -1).skip(skip).limit(limit)
        purchases = list(cursor)

        formatted_purchaseorders = []
        for purchase in purchases:
            # NO ITEM FILTERING - Show ALL items from GRN converted purchase orders
            # Remove the item filtering completely
            
            purchase["purchaseOrderId"] = str(purchase.pop("_id", None))
            formatted_purchaseorders.append(PurchaseOrderState(**purchase))

        return PurchaseOrderResponse(
            purchaseOrders=formatted_purchaseorders,
            totalItems=total
        )
    except Exception as e:
        print(f"Error in get_purchaseorders: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

