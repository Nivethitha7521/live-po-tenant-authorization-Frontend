from datetime import datetime
import logging
from typing import Any, List, Optional, Dict
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request
import pytz
from fastapi.middleware.cors import CORSMiddleware
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission

from Vendor.models import Vendor
from utils.database import get_counter_collection, get_vendor_collection
from outgoingPayment.advance_models import AdvancePayment, AdvancePaymentCreate, PaymentHistory
from utils.database import get_advancepayment_collection
from utils.financial_year import get_business_alias, get_financial_year, get_legacy_counter_value, get_next_counter_value

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

IST = pytz.timezone('Asia/Kolkata')
router = APIRouter()

async def generate_unique_random_id(collection, tenant_id: str) -> str:
    """
    Generate random ID for advance payments with transition logic
    Format before April 1, 2026: AD001, AD002, AD003...
    Format after April 1, 2026: BM/26-27/AD001, BM/26-27/AD002...
    """
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    counters_collection = get_counter_collection(tenant_id)
    
    # ===== BEFORE APRIL 1, 2026 =====
    if current_date < TRANSITION_DATE:
        # Use find with sort instead of aggregation (faster)
        latest_doc = collection.find(
            {"randomId": {"$regex": "^AD\\d+$"}}
        ).sort("randomId", -1).limit(1).next() if collection.count_documents({"randomId": {"$regex": "^AD\\d+$"}}) > 0 else None
        
        if latest_doc and latest_doc.get("randomId"):
            latest_number = int(latest_doc["randomId"].replace("AD", ""))
            next_number = latest_number + 1
        else:
            counter_value = get_legacy_counter_value(counters_collection, "advancePaymentId")
            next_number = counter_value
        
        return f"AD{next_number:03d}"
    
    # ===== AFTER APRIL 1, 2026 =====
    else:
        financial_year = get_financial_year(current_date)
        business_alias = await get_business_alias(tenant_id)
        
        counter_id = f"advancePaymentId_{financial_year}"
        counter_value = get_next_counter_value(counters_collection, counter_id)
        
        return f"{business_alias}/{financial_year}/AD{counter_value:03d}"


@router.post("/advance", response_model=AdvancePayment)
async def create_advance_payment(request: Request, payment: AdvancePaymentCreate):
    # Validate paymentMode and paymentMethod
    tenant_id = request.state.tenant_id
    if payment.paymentMode and payment.paymentMode not in ["Cash", "Bank"]:
        raise HTTPException(status_code=400, detail="paymentMode must be 'Cash' or 'Bank'")
    
    if payment.paymentMode == "Bank":
        if not payment.paymentMethod:
            raise HTTPException(status_code=400, detail="paymentMethod required for Bank payment")
        if payment.paymentMethod not in ["upi", "neft", "rtgs", "imps"]:
            raise HTTPException(status_code=400, detail="paymentMethod must be 'upi', 'neft', 'rtgs', or 'imps'")
        if payment.paymentMethod == "upi" and not payment.upi:
            raise HTTPException(status_code=400, detail="UPI ID required for UPI payment")
        if payment.paymentMethod == "neft" and not payment.neftNo:
            raise HTTPException(status_code=400, detail="NEFT number required for NEFT payment")
        if payment.paymentMethod == "rtgs" and not payment.rtgsNo:
            raise HTTPException(status_code=400, detail="RTGS number required for RTGS payment")
        if payment.paymentMethod == "imps" and not payment.impsNo:
            raise HTTPException(status_code=400, detail="IMPS number required for IMPS payment")
    
    # Validate vendor
    vendor_collection = get_vendor_collection(tenant_id)
    try:
        vendor = vendor_collection.find_one({"_id": ObjectId(payment.vendorId)})
    except Exception as e:
        logger.error(f"Invalid vendorId: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid vendorId")
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor_name = vendor["vendorName"]
    logger.info(f"Creating advance payment for vendor: {vendor_name}")
    
    collection = get_advancepayment_collection(tenant_id)
    
    # Prepare payment dictionary
    payment_dict = payment.dict(exclude_unset=True)
    payment_dict["randomId"] = await generate_unique_random_id(collection, tenant_id)
    payment_dict["vendorName"] = vendor_name
    payment_dict["paymentHistory"] = []
    
    utc_now = datetime.now(pytz.UTC)
    current_time = utc_now.astimezone(IST)
    
    paid_amount = payment.amount
    if paid_amount <= 0:
        raise HTTPException(status_code=400, detail="Paid amount must be greater than zero")
    
    if not payment.paymentMode:
        raise HTTPException(status_code=400, detail="paymentMode required when making a payment")
    
    payment_dict["amount"] = paid_amount
    payment_dict["pendingAmount"] = paid_amount
    payment_dict["status"] = "Pending"
    payment_dict["createdDate"] = current_time
    payment_dict["lastUpdatedDate"] = current_time
    
    payment_dict["paymentMode"] = payment.paymentMode
    payment_dict["paymentMethod"] = payment.paymentMethod if payment.paymentMode == "Bank" else None
    payment_dict["bankName"] = payment.bankName if payment.paymentMode == "Bank" else None
    payment_dict["neftNo"] = payment.neftNo if payment.paymentMethod == "neft" else None
    payment_dict["rtgsNo"] = payment.rtgsNo if payment.paymentMethod == "rtgs" else None
    payment_dict["impsNo"] = payment.impsNo if payment.paymentMethod == "imps" else None
    payment_dict["upi"] = payment.upi if payment.paymentMethod == "upi" else None
    payment_dict["remarks"] = payment.remarks or "Advance payment"
    
    try:
        result = collection.insert_one(payment_dict)
        payment_dict["_id"] = result.inserted_id
        payment_dict["advanceId"] = str(result.inserted_id)
        return AdvancePayment(**payment_dict)
    except Exception as e:
        logger.error(f"Error creating advance payment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating advance payment: {str(e)}")


@router.get("/vendorwise/advance", response_model=dict)
async def get_all_advance_payments(
    request: Request,
    vendorId: Optional[str] = None,
    vendorName: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "createdDate",
    sort_order: str = "desc",
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "advancepayment", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_advancepayment_collection(tenant_id)
    
    # Ensure indexes exist (run this once during app startup)
    await ensure_indexes(collection)
    
    logger.info(f"Fetching advance payments, vendorId: {vendorId}, vendorName: {vendorName}, status: {status}")
    
    query = {}
    if vendorId:
        query["vendorId"] = vendorId
    if vendorName:
        # Use exact match with index instead of regex
        query["vendorName"] = vendorName
    if status:
        allowed_statuses = ["partially cleared", "pending"]
        if status.lower() in allowed_statuses:
            status_mapping = {
                "partially cleared": "Partially Cleared",
                "pending": "Pending"
            }
            query["status"] = status_mapping[status.lower()]
        else:
            logger.warning(f"Invalid status provided: {status}. Allowed statuses: {allowed_statuses}")
            return {"data": [], "totalItems": 0, "page": page, "limit": limit, "totalPages": 0}
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Determine sort direction
    sort_direction = -1 if sort_order.lower() == "desc" else 1
    
    # Get total count efficiently
    total_items = collection.count_documents(query)
    
    # Get paginated and sorted results
    cursor = collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
    advance_payments = list(cursor)
    
    if not advance_payments:
        logger.warning("No advance payments found")
        return {"data": [], "totalItems": 0, "page": page, "limit": limit, "totalPages": 0}
    
    transformed_payments = []
    for payment in advance_payments:
        payment["advanceId"] = str(payment["_id"])
        del payment["_id"]
        if "paymentHistory" in payment:
            payment["paymentHistory"].sort(key=lambda x: x["paymentDate"])
        transformed_payments.append(payment)
    
    total_pages = (total_items + limit - 1) // limit
    
    try:
        return {
            "data": [AdvancePayment(**payment) for payment in transformed_payments],
            "totalItems": total_items,
            "page": page,
            "limit": limit,
            "totalPages": total_pages
        }
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")


@router.get("/vendors", response_model=List[Vendor])
async def get_vendors(
    request: Request,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "advancepayment", "read"))
):
    tenant_id = request.state.tenant_id
    vendor_collection = get_vendor_collection(tenant_id)
    
    # Ensure indexes exist
    await ensure_vendor_indexes(vendor_collection)
    
    logger.info(f"Fetching vendors, status: {status}")
    
    query = {"status": status} if status else {}
    
    # Add pagination and sorting
    skip = (page - 1) * limit
    vendors = list(vendor_collection.find(query).sort("vendorName", 1).skip(skip).limit(limit))
    
    if not vendors:
        logger.warning("No vendors found")
        return []  # Return empty list instead of 404 for better frontend handling
    
    transformed_vendors = []
    for vendor in vendors:
        vendor["vendorId"] = str(vendor["_id"])
        del vendor["_id"]
        transformed_vendors.append(vendor)
    
    try:
        return [Vendor(**vendor) for vendor in transformed_vendors]
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")


@router.get("/vendor/{vendor_id}/advance-payments")
async def get_vendor_advance_payments(
    request: Request,
    vendor_id: str,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "createdDate",
    sort_order: str = "desc",
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "advancepayment", "read"))
):
    tenant_id = request.state.tenant_id
    advance_collection = get_advancepayment_collection(tenant_id)
    
    logger.info(f"Fetching advance payments for vendor_id: {vendor_id}")
    
    if not ObjectId.is_valid(vendor_id):
        logger.error(f"Invalid ObjectId format: {vendor_id}")
        raise HTTPException(status_code=400, detail="Invalid vendor ID format")
    
    if advance_collection is None:
        logger.error("Advance payment collection is None")
        raise HTTPException(status_code=500, detail="Database connection error")
    
    try:
        # Build query
        query = {"vendorId": vendor_id}
        
        if status:
            if status.lower() == "active":
                query["status"] = {"$in": ["Pending", "Partially Cleared"]}
            else:
                query["status"] = status
        
        # Calculate pagination
        skip = (page - 1) * limit
        sort_direction = -1 if sort_order.lower() == "desc" else 1
        
        # Get total count
        total_items = advance_collection.count_documents(query)
        
        # Get paginated results with sorting
        cursor = advance_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
        advance_payments = list(cursor)
        
        if not advance_payments:
            logger.warning(f"No advance payments found for vendor_id: {vendor_id}")
            return {"data": [], "totalItems": 0, "page": page, "limit": limit, "totalPages": 0}
        
        transformed_payments = []
        for payment in advance_payments:
            payment["advanceId"] = str(payment["_id"])
            del payment["_id"]
            if "paymentHistory" in payment:
                payment["paymentHistory"].sort(key=lambda x: x["paymentDate"])
            transformed_payments.append(payment)
        
        total_pages = (total_items + limit - 1) // limit
        
        return {
            "data": transformed_payments,
            "totalItems": total_items,
            "page": page,
            "limit": limit,
            "totalPages": total_pages
        }
    except Exception as e:
        logger.error(f"Error fetching advance payments for vendor {vendor_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vendorname/{vendor_name}/advance-payments")
async def get_vendor_advance_payments_by_name(
    request: Request,
    vendor_name: str,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "createdDate",
    sort_order: str = "desc",
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "advancepayment", "read"))
):
    tenant_id = request.state.tenant_id
    advance_collection = get_advancepayment_collection(tenant_id)
    
    logger.info(f"Fetching advance payments for vendor_name: {vendor_name}")
    
    if advance_collection is None:
        logger.error("Advance payment collection is None")
        raise HTTPException(status_code=500, detail="Database connection error")
    
    try:
        # Use exact match for vendor name (faster with index)
        query = {"vendorName": vendor_name}
        
        if status:
            if status.lower() == "active":
                query["status"] = {"$in": ["Pending", "Partially Cleared"]}
            else:
                query["status"] = status
        else:
            # Default to active if no status specified
            query["status"] = {"$in": ["Pending", "Partially Cleared"]}
        
        # Calculate pagination
        skip = (page - 1) * limit
        sort_direction = -1 if sort_order.lower() == "desc" else 1
        
        # Get total count
        total_items = advance_collection.count_documents(query)
        
        # Get paginated results with sorting
        cursor = advance_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
        advance_payments = list(cursor)
        
        if not advance_payments:
            logger.warning(f"No advance payments found for vendor_name: {vendor_name}")
            return {"data": [], "totalItems": 0, "page": page, "limit": limit, "totalPages": 0}
        
        transformed_payments = []
        for payment in advance_payments:
            payment["advanceId"] = str(payment["_id"])
            del payment["_id"]
            if "paymentHistory" in payment:
                payment["paymentHistory"].sort(key=lambda x: x["paymentDate"])
            transformed_payments.append(payment)
        
        total_pages = (total_items + limit - 1) // limit
        
        return {
            "data": transformed_payments,
            "totalItems": total_items,
            "page": page,
            "limit": limit,
            "totalPages": total_pages
        }
    except Exception as e:
        logger.error(f"Error fetching advance payments for vendor {vendor_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vendors/active-advances", response_model=Dict[str, Any])
async def get_active_advances_multiple_vendors_get(
    request: Request,
    vendorNames: str,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "vendorName",
    sort_order: str = "asc",
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "advancepayment", "read"))
):
    tenant_id = request.state.tenant_id
    advance_collection = get_advancepayment_collection(tenant_id)
    
    """
    Get active advance payments for multiple vendors (GET version)
    Query parameter: vendorNames=comma,separated,names
    """
    if not vendorNames:
        logger.warning("No vendor names provided")
        raise HTTPException(status_code=400, detail="vendorNames parameter is required")
    
    # Split comma-separated vendor names
    vendor_names = [name.strip() for name in vendorNames.split(",") if name.strip()]
    
    if not vendor_names:
        logger.warning("No valid vendor names provided")
        raise HTTPException(status_code=400, detail="No valid vendor names provided")
    
    logger.info(f"Fetching active advance payments for vendors: {vendor_names}")
    
    if advance_collection is None:
        logger.error("Advance payment collection is None")
        raise HTTPException(status_code=500, detail="Database connection error")
    
    try:
        # Use $in operator with exact matches (faster than regex)
        query = {
            "vendorName": {"$in": vendor_names},
            "status": {"$in": ["Pending", "Partially Cleared"]},
            "pendingAmount": {"$gt": 0}
        }
        
        # Calculate pagination
        skip = (page - 1) * limit
        sort_direction = -1 if sort_order.lower() == "desc" else 1
        
        # Get total count
        total_items = advance_collection.count_documents(query)
        
        # Get paginated results with sorting
        cursor = advance_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
        advance_payments = list(cursor)
        
        if not advance_payments:
            logger.warning(f"No active advance payments found for vendors: {vendor_names}")
            return {"advances": [], "totalItems": 0, "page": page, "limit": limit, "totalPages": 0}
        
        # Transform the payments
        transformed_payments = []
        for payment in advance_payments:
            payment["advanceId"] = str(payment["_id"])
            del payment["_id"]
            
            if "paymentHistory" in payment:
                payment["paymentHistory"].sort(key=lambda x: x.get("paymentDate", ""))
            
            transformed_payments.append(AdvancePayment(**payment))
        
        total_pages = (total_items + limit - 1) // limit
        
        logger.info(f"Found {len(transformed_payments)} active advance payments")
        
        return {
            "advances": transformed_payments,
            "totalItems": total_items,
            "page": page,
            "limit": limit,
            "totalPages": total_pages
        }
        
    except Exception as e:
        logger.error(f"Error fetching active advance payments for vendors {vendor_names}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper function to ensure indexes exist
async def ensure_indexes(collection):
    """Create necessary indexes for advance payments collection"""
    try:
        # Create indexes for frequently queried fields
        collection.create_index([("vendorId", 1)])
        collection.create_index([("vendorName", 1)])
        collection.create_index([("status", 1)])
        collection.create_index([("createdDate", -1)])  # Descending index for sorting
        collection.create_index([("randomId", 1)])
        collection.create_index([("pendingAmount", 1)])
        # Compound indexes for common queries
        collection.create_index([("vendorId", 1), ("status", 1), ("createdDate", -1)])
        collection.create_index([("vendorName", 1), ("status", 1), ("createdDate", -1)])
        logger.info("Indexes created/verified for advance payments collection")
    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}")


async def ensure_vendor_indexes(collection):
    """Create necessary indexes for vendors collection"""
    try:
        collection.create_index([("vendorName", 1)])
        collection.create_index([("status", 1)])
        logger.info("Indexes created/verified for vendors collection")
    except Exception as e:
        logger.error(f"Error creating vendor indexes: {str(e)}")