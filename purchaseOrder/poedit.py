from bson import ObjectId
from fastapi import APIRouter, HTTPException,Depends,Request
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from purchaseOrder.models import PurchaseOrderPatch, PurchaseOrderState
from utils.database import get_purchaseorder_collection,get_purchaseitem_collection
from purchaseitem.utils import get_current_date_and_time


router = APIRouter()

@router.patch("/{purchaseorder_id}")
async def patch_purchaseorder(request:Request,
    purchaseorder_id: str,
    purchaseorder_patch: PurchaseOrderPatch,user = Depends(validate_token),
      permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "edit")) # Use a model with all Optional fields for partial updates
):
    tenant_id = request.state.tenant_id

    # ✅ GET TENANT COLLECTION
    collection = get_purchaseorder_collection(tenant_id)
    # Fetch existing to check existence
    existing_purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    if not existing_purchaseorder:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    # Get only set (non-None) fields for partial update
    updated_fields = {
        key: value 
        for key, value in purchaseorder_patch.dict(exclude_unset=True, exclude={"items"}).items()  # Exclude items for PO-level patch
        if value is not None
    }

    if not updated_fields:
        raise HTTPException(status_code=400, detail="No valid fields provided for update")

    # Always add/update lastUpdatedDate
    current_date_and_time = get_current_date_and_time()
    updated_fields['lastUpdatedDate'] = current_date_and_time['datetime']

    # Apply update
    result = collection.update_one(
        {"_id": ObjectId(purchaseorder_id)}, 
        {"$set": updated_fields}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update PurchaseOrder")

    # Fetch and return updated PO for confirmation
    updated_purchaseorder = collection.find_one({"_id": ObjectId(purchaseorder_id)})
    updated_purchaseorder["purchaseOrderId"] = str(updated_purchaseorder["_id"])

    return {
        "message": "PurchaseOrder updated successfully",
        "updatedPurchaseOrder": PurchaseOrderState(**updated_purchaseorder)
    }