from datetime import datetime
from typing import List, Optional, Any, Literal

from fastapi import APIRouter, Query, HTTPException,Request
from pydantic import BaseModel, Field
import pytz  # For timezone; pip install pytz if not installed

from purchaseOrder.models import Freight
from utils.database import get_purchaseorder_collection  # Assuming this is correct

router = APIRouter()

# Single Item model (unchanged, but fixed imports)
class Item(BaseModel):
    itemId: Optional[str] = None
    itemCode: Optional[str] = None
    itemName: Optional[str] = None
    quantity: Optional[float] = None
    poQuantity: Optional[float] = None
    purchasecategoryName: Optional[str] = None
    purchasesubcategoryName: Optional[Any] = None
    uom: Optional[str] = None
    taxPercentage: Optional[float] = Field(None, ge=0, description="Tax percentage (e.g., 18 for 18%)")
    newPrice: Optional[float] = Field(None, ge=0, description="New price of the item")
    befTaxDiscount: Optional[float] = Field(None, ge=0, le=100, description="Before-tax discount percentage (0-100)")
    afTaxDiscount: Optional[float] = Field(None, ge=0, le=100, description="After-tax discount percentage (0-100)")
    discountAmount: Optional[float] = Field(None, ge=0, description="Total discount amount applied")
    taxAmount: Optional[float] = Field(None, ge=0, description="Total tax amount")
    barcode: Optional[str] = None
    pendingCount: Optional[float] = Field(None, ge=0)
    pendingQuantity: Optional[float] = Field(None, ge=0)
    pendingTotalQuantity: Optional[float] = Field(None, ge=0)
    pendingTaxAmount: Optional[float] = Field(None, ge=0)
    pendingDiscountAmount: Optional[float] = Field(None, ge=0)
    pendingSgst: Optional[float] = Field(None, ge=0)
    pendingCgst: Optional[float] = Field(None, ge=0)
    pendingIgst: Optional[float] = Field(None, ge=0)
    pendingTotalPrice: Optional[float] = Field(None, ge=0)
    pendingFinalPrice: Optional[float] = Field(None, ge=0)
    pendingBefTaxDiscountAmount: Optional[float] = Field(None, ge=0, description="Pending before-tax discount amount")
    pendingAfTaxDiscountAmount: Optional[float] = Field(None, ge=0, description="Pending after-tax discount amount")
    totalPrice: Optional[float] = Field(None, ge=0, description="Total price before discounts")
    finalPrice: Optional[float] = Field(None, ge=0, description="Final price after discounts and taxes")
    expiryDate: Optional[datetime] = None
    hsnCode: Optional[str] = None
    poPhoto: Optional[str] = None
    status: Optional[str] = None
    randomId: Optional[str] = None

# Single Purchase Order model (moved fields here)
class PurchaseOrderState(BaseModel):
    purchaseOrderId: Optional[str] = None
    vendorName: Optional[str] = None
    vendorContact: Optional[str] = None
    orderDate: Optional[datetime] = None
    poStatus: Optional[str] = None
    items: Optional[List[Item]] = None
    shippingAddress: Optional[str] = None
    billingAddress: Optional[str] = None
    attachments: Optional[str] = None
    createdDate: Optional[datetime] = None
    creditLimit: Optional[int] = None  # Removed duplicate
    randomId: Optional[str] = None
    imageUrl: Optional[str] = None
    contactpersonEmail: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    termsandConditions: Optional[List[str]] = None
    postalCode: Optional[int] = None
    gstNumber: Optional[str] = None
    itemStatus: Optional[str] = None
    pendingOrderAmount: Optional[float] = None
    pendingDiscountAmount: Optional[float] = None
    pendingTaxAmount: Optional[float] = None
    roundOffValue: Optional[float] = 0
    totalFreightAmount: Optional[float] = 0
    totalFreightTaxAmount: Optional[float] = 0
    freights: Optional[List[Freight]] = None

# Response wrapper model (correct structure)
class PurchaseOrderResponse(BaseModel):
    purchaseOrders: List[PurchaseOrderState]
    totalItems: int

@router.get("/pending/purchase", response_model=PurchaseOrderResponse)
async def get_purchaseorders(request:Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=5000),
    status: Optional[str] = Query(None),
    vendorName: Optional[str] = Query(None),
    itemName: Optional[str] = Query(None),
    randomId: Optional[str] = Query(None),
    fromDate: Optional[datetime] = Query(None),
    toDate: Optional[datetime] = Query(None),
):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)

    """
    Get purchase orders with optional filtering. Automatically restricts to only the three pending statuses: 
    'CreditLimit for Approve', 'Pending for Approve', 'Pending' AND excludes ['Approved', 'Rejected', 'PartiallyReceived'] 
    AND items have pendingTotalQuantity > 0. No need to pass filterBy, pendingOnly, or excludePendingStatuses—hardcoded for pending.
    
    Defaults: If no fromDate/toDate provided, defaults to current month (1st of month to today in IST).
    Always filters by "orderDate" (no other date fields supported/needed).
    status defaults to None (no manual filtering unless explicitly passed). No aggregation used—direct find() query.
    """
    query = {}
    IST = pytz.timezone('Asia/Kolkata')  # For date handling

    try:
        # Default date range to current month if not provided (for this screen's data fetch)
        if fromDate is None and toDate is None:
            now = datetime.now(IST)  # Aware datetime
            fromDate = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)  # Start of month, aware
            toDate = now.replace(hour=23, minute=59, second=59, microsecond=999999)  # End of today, aware

        # Hardcoded: Always filter for only the three pending statuses (no param needed)
        query["poStatus"] = {
            "$in": ["CreditLimit for Approve", "Pending for Approve", "Pending"],
            "$nin": ["Approved", "Rejected", "PartiallyReceived"]
        }
        # Require at least one item with pendingTotalQuantity > 0
        query["items"] = {"$elemMatch": {"pendingTotalQuantity": {"$gt": 0}}}

        # Hardcoded: Always use "orderDate" for filtering (no other fields, no param needed)
        date_field = "orderDate"

        # Normalize dates to IST full days (handle naive vs aware)
        def normalize_start(dt):
            if dt.tzinfo is None:
                # Naive: combine date and localize to start of day
                return IST.localize(datetime.combine(dt.date(), datetime.min.time()))
            else:
                # Aware: replace to start of its local day
                return dt.replace(hour=0, minute=0, second=0, microsecond=0)

        def normalize_end(dt):
            if dt.tzinfo is None:
                # Naive: combine date and localize to end of day
                return IST.localize(datetime.combine(dt.date(), datetime.max.time()))
            else:
                # Aware: replace to end of its local day
                return dt.replace(hour=23, minute=59, second=59, microsecond=999999)

        if fromDate:
            fromDate = normalize_start(fromDate)
        if toDate:
            toDate = normalize_end(toDate)

        # Add date range filter (always applied if dates are set, including defaults)
        if fromDate and toDate:
            query[date_field] = {"$gte": fromDate, "$lte": toDate}
        elif fromDate:
            query[date_field] = {"$gte": fromDate}
        elif toDate:
            query[date_field] = {"$lte": toDate}

        # Handle status (override only if explicitly passed—rare, but possible)
        if status:
            status_list = [s.strip() for s in status.split(",")]
            if len(status_list) == 1:
                query["poStatus"] = {"$regex": f"^{status_list[0]}$", "$options": "i"}
            else:
                query["poStatus"] = {"$in": status_list}

        # Other filters
        if vendorName:
            query["vendorName"] = {"$regex": f"^{vendorName}", "$options": "i"}
        if itemName:
            if "items" in query and "$elemMatch" in query["items"]:
                query["items"]["$elemMatch"]["itemName"] = {"$regex": f"^{itemName}", "$options": "i"}
            else:
                query["items"] = {"$elemMatch": {"itemName": {"$regex": f"^{itemName}", "$options": "i"}}}
        if randomId:
            query["randomId"] = {"$regex": f"^{randomId}", "$options": "i"}

        print(f"Filter query: {query}")  # Debug

      
        total = collection.count_documents(query)

        # Fetch with sort (descending by date_field) - no aggregation used
        cursor = collection.find(query).sort(date_field, -1).skip(skip).limit(limit)
        purchases = list(cursor)

        formatted_purchaseorders = []
        for purchase in purchases:
            purchase["purchaseOrderId"] = str(purchase.pop("_id", None))  # Convert and remove _id
            formatted_purchaseorders.append(PurchaseOrderState(**purchase))

        return PurchaseOrderResponse(
            purchaseOrders=formatted_purchaseorders,
            totalItems=total
        )
    except Exception as e:
        print(f"Error in get_purchaseorders: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")