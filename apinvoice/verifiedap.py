from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request, Depends
from bson import ObjectId
from datetime import datetime
import pytz

from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from purchaseOrder.routes import get_user_id_by_username
from utils.datetime_function import get_current_date_and_time
from utils.database import get_apinvoice_collection, get_outgoingpayment_collection

router = APIRouter()

# Add this model for bulk verification request
class BulkVerifyRequest(BaseModel):
    invoice_ids: List[str]

# IMPORTANT: Bulk route MUST come BEFORE the single route
@router.patch("/verify-bulk/verification", response_model=dict)
async def verify_apinvoices_bulk(
    request: Request,
    verify_request: BulkVerifyRequest,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "edit"))
):
    """Verify multiple AP invoices and update corresponding outgoing records"""
    try:
        tenant_id = request.state.tenant_id
        ap_collection = get_apinvoice_collection(tenant_id)
        outgoing_collection = get_outgoingpayment_collection(tenant_id)
        
        invoice_ids = verify_request.invoice_ids
        
        if not invoice_ids:
            raise HTTPException(status_code=400, detail="No invoice IDs provided")
        
        # Validate all IDs first
        object_ids = []
        valid_invoice_ids = []
        
        for id_str in invoice_ids:
            try:
                object_ids.append(ObjectId(id_str))
                valid_invoice_ids.append(id_str)
            except:
                print(f"Invalid ObjectId: {id_str}")
                continue
        
        if not object_ids:
            raise HTTPException(status_code=400, detail="No valid invoice IDs provided")
        
        current_time = get_current_date_and_time()['datetime']
        
        # Get username from user object (same as purchase order)
        username = user.get("username")
        
        # Get user ID from database (same as purchase order)
        user_id = await get_user_id_by_username(username)
        
        print(f"Bulk verification - Username: {username}, User ID: {user_id}")
        
        # Update AP invoices with verification details - store USER ID (like poCreatedPerson)
        ap_result = ap_collection.update_many(
            {"_id": {"$in": object_ids}},
            {
                "$set": {
                    "status": "Verified",
                    "verifiedBy": user_id,  # Store user ID (like poCreatedPerson)
                    "verifiedDate": current_time
                }
            }
        )
        
        # Update outgoing payment records - only set isVerified flag
        outgoing_result = outgoing_collection.update_many(
            {"invoiceId": {"$in": valid_invoice_ids}},
            {
                "$set": {
                    "isVerified": True,
                    "status": "Pending"
                }
            }
        )
        
        return {
            "success": True,
            "message": f"{ap_result.modified_count} AP Invoices verified successfully",
            "modifiedCount": ap_result.modified_count,
            "matchedCount": ap_result.matched_count,
            "outgoingModifiedCount": outgoing_result.modified_count,
            "verifiedBy": user_id,  # Return user ID
            "verifiedDate": current_time.isoformat() if current_time else None,
            "verifiedIds": valid_invoice_ids
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in bulk verification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bulk verification failed: {str(e)}")

# Single verification route - MUST come AFTER bulk route
@router.patch("/verify/{apinvoice_id}", response_model=dict)
async def verify_apinvoice(
    request: Request,
    apinvoice_id: str,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "edit"))
):
    """Verify a single AP invoice and update outgoing payment record"""
    try:
        tenant_id = request.state.tenant_id
        ap_collection = get_apinvoice_collection(tenant_id)
        outgoing_collection = get_outgoingpayment_collection(tenant_id)
        
        # Validate ObjectId
        try:
            object_id = ObjectId(apinvoice_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid invoice ID format")
        
        # Find the invoice
        apinvoice = ap_collection.find_one({"_id": object_id})
        if not apinvoice:
            raise HTTPException(status_code=404, detail="AP Invoice not found")
        
        current_time = get_current_date_and_time()['datetime']
        
        # Get username from user object (same as purchase order)
        username = user.get("username")
        
        # Get user ID from database (same as purchase order)
        user_id = await get_user_id_by_username(username)
        
        print(f"Single verification - Username: {username}, User ID: {user_id}")
        
        # Update AP invoice with verification details - store USER ID (like poCreatedPerson)
        ap_result = ap_collection.update_one(
            {"_id": object_id},
            {
                "$set": {
                    "status": "Verified",
                    "verifiedBy": user_id,  # Store user ID (like poCreatedPerson)
                    "verifiedDate": current_time
                }
            }
        )
        
        # Update outgoing payment record - only set isVerified flag
        outgoing_result = outgoing_collection.update_one(
            {"invoiceId": apinvoice_id},
            {
                "$set": {
                    "isVerified": True,
                    "status": "Pending"
                }
            }
        )
        
        if ap_result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to verify AP Invoice")
        
        return {
            "success": True,
            "message": "AP Invoice verified successfully",
            "invoiceId": apinvoice_id,
            "verifiedBy": user_id,  # Return user ID
            "verifiedDate": current_time.isoformat() if current_time else None,
            "outgoingUpdated": outgoing_result.modified_count > 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in single verification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")