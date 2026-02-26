from bson import ObjectId
from fastapi import APIRouter, HTTPException,Request

from apinvoice.routes import get_current_date_and_time
from utils.database import get_apinvoice_collection,get_grn_collection,get_outgoingpayment_collection

from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from database import db
async def get_user_id_by_username(username: str):
    user = await db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found in database")
    return str(user["_id"])

router = APIRouter()

@router.patch("/convert-to-grn-from-returned/{apinvoice_id}", response_model=dict)
async def convert_ap_returned_to_grn(request: Request,apinvoice_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "edit"))):
    tenant_id = request.state.tenant_id
    ap_collection = get_apinvoice_collection(tenant_id)
    grn_collection = get_grn_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    """
    Single endpoint to handle AP Returned to GRN conversion
    Updates all three collections: AP Invoice, GRN, and Outgoing Payments
    """
    try:
        username = user.get("username")
        user_id = await get_user_id_by_username(username)
        # Get current date for consistent timing
        current_datetime = get_current_date_and_time()['datetime']
        
        # Step 1: Fetch and validate AP Invoice
        existing_apinvoice = ap_collection.find_one({"_id": ObjectId(apinvoice_id)})
        if not existing_apinvoice:
            raise HTTPException(status_code=404, detail="AP Invoice not found")
        
        if not existing_apinvoice.get('grnId'):
            raise HTTPException(status_code=400, detail="GRN ID is missing in AP invoice data")
        
        grn_id = existing_apinvoice['grnId']
        
        # Step 2: Update GRN status to 'active'
        grn_update_fields = {
            'status': 'active',
            'lastUpdatedDate': current_datetime
        }
        
        grn_update_result = grn_collection.update_one(
            {"_id": ObjectId(grn_id)}, 
            {"$set": grn_update_fields}
        )
        
        if grn_update_result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update GRN")
        
        # Step 3: Update AP Invoice status to 'Returned'
        ap_update_fields = {
            'status': 'Returned',
            'apReturnedPersonId': user_id,
            'apReturnedDate': current_datetime,
            'lastUpdatedDate': current_datetime
        }
        
        ap_update_result = ap_collection.update_one(
            {"_id": ObjectId(apinvoice_id)}, 
            {"$set": ap_update_fields}
        )
        
        if ap_update_result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update AP Invoice")
        
        # Step 4: Update all Outgoing Payments with the same invoiceId
        outgoing_update_result = outgoing_collection.update_many(
            {"invoiceId": apinvoice_id},
            {"$set": {
                "status": "Returned",
                "lastUpdatedDate": current_datetime
            }}
        )
        
        # Step 5: Fetch updated documents for response
        updated_grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
        updated_apinvoice = ap_collection.find_one({"_id": ObjectId(apinvoice_id)})
        updated_outgoing_payments = list(outgoing_collection.find({"invoiceId": apinvoice_id}))
        
        # Convert ObjectId to string for JSON serialization
        if updated_grn:
            updated_grn["_id"] = str(updated_grn["_id"])
        if updated_apinvoice:
            updated_apinvoice["_id"] = str(updated_apinvoice["_id"])
        for payment in updated_outgoing_payments:
            payment["_id"] = str(payment["_id"])
        
        return {
            "message": "Successfully converted AP Returned to GRN",
            "apInvoice": updated_apinvoice,
            "grn": updated_grn,
            "outgoingPayments": updated_outgoing_payments,
            "summary": {
                "apInvoiceUpdated": ap_update_result.modified_count,
                "grnUpdated": grn_update_result.modified_count,
                "outgoingPaymentsUpdated": outgoing_update_result.modified_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")