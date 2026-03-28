from datetime import datetime, time, timedelta
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query,Request
from bson import ObjectId
import pytz
from utils.datetime_function import get_current_date_and_time
from utils.financial_year import get_business_alias, get_financial_year
from .models import ApRandomId, Apinvoice, ApinvoicePost, FrontendApInvoiceResponse, FrontendItemDetail,PaginatedApInvoices
from utils.database import get_apinvoice_collection,get_grn_collection
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from middlewares.permission_middleware import get_current_user
from database import db
router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Define FrontendApInvoiceResponse for AP Invoice
       
# Helper function to safely get values from dictionary
def get_safe_value(data, key, default=0.0):
    """Safely get a value from a dictionary with a default if None."""
    value = data.get(key)
    return default if value is None else value

def get_next_counter_value(tenant_id: str) -> int:
    """Get and increment the counter value atomically"""
    counter_collection = get_apinvoice_collection(tenant_id).database["counters"]
    try:
        # First ensure the counter exists with a proper value
        initialize_ap_counter_if_needed(tenant_id)
        
        # Now safely increment
        counter = counter_collection.find_one_and_update(
            {"_id": "invoiceId"},
            {"$inc": {"sequence_value": 1}},
            return_document=True
        )
        return counter["sequence_value"]
    except Exception as e:
        print(f"Error getting next counter value: {e}")
        # Fallback - reset counter and try again
        reset_counter(tenant_id)
        return 1

def reset_counter(tenant_id: str):
    """Reset the counter to 0"""
    counter_collection = get_apinvoice_collection(tenant_id).database["counters"]
    try:
        counter_collection.replace_one(
            {"_id": "invoiceId"},
            {"_id": "invoiceId", "sequence_value": 0},
            upsert=True
        )
    except Exception as e:
        print(f"Error resetting counter: {e}")

def initialize_ap_counter_if_needed(tenant_id: str,force_reset=False):
    """Initialize counter properly, handling empty database cases"""
    counter_collection = get_apinvoice_collection(tenant_id).database["counters"]
    apinvoice_collection = get_apinvoice_collection(tenant_id)
    
    if force_reset:
        reset_counter(tenant_id)
        return

    # Check if counter exists and has a valid value
    existing_counter = counter_collection.find_one({"_id": "invoiceId"})
    if existing_counter and isinstance(existing_counter.get("sequence_value"), int):
        return  # Counter is already properly initialized
    
    # If no counter exists or it's invalid, initialize it properly
    # Find the highest AP invoice by randomId
    highest_ap = apinvoice_collection.find_one(
        {"randomId": {"$regex": "^AP\\d+$"}},
        sort=[("randomId", -1)]
    )
     
    if highest_ap and "randomId" in highest_ap:
        try:
            # Extract the numeric part from the highest AP ID
            last_number = int(highest_ap["randomId"][2:])
            # Set counter to this value (next ID will be +1)
            counter_collection.update_one(
                {"_id": "invoiceId"},
                {"$set": {"sequence_value": last_number}},
                upsert=True
            )
            print(f"Initialized counter from existing AP IDs: {last_number}")
        except (ValueError, IndexError) as e:
            print(f"Error parsing existing AP ID: {e}. Starting from 0.")
            reset_counter(tenant_id)
    else:
        # No existing records, start fresh from 0
        print("No existing AP invoices found. Initializing counter to 0")
        reset_counter(tenant_id)

def generate_ap_id(tenant_id: str):
    """
    Generates AP ID with TRANSITION LOGIC - SYNC VERSION
    """
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    # Get sync collections
    ap_collection = get_apinvoice_collection(tenant_id)
    counter_collection = ap_collection.database["counters"]
    
    if current_date < TRANSITION_DATE:
        # Check if collection is empty
        if ap_collection.count_documents({}) == 0:
            counter_collection.update_one(
                {"_id": "invoiceId"},
                {"$set": {"sequence_value": 0}},
                upsert=True
            )
        
        counter = counter_collection.find_one_and_update(
            {"_id": "invoiceId"},
            {"$inc": {"sequence_value": 1}},
            upsert=True,
            return_document=True
        )
        counter_value = counter["sequence_value"]
        ap_id = f"AP{counter_value:04d}"
        
        logger.info(f"Generated AP ID: {ap_id}")
        return ap_id
    else:
        financial_year = get_financial_year(current_date)
        business_alias = get_business_alias(tenant_id)  # You need a sync version of this
        
        counter_id = f"invoiceId_{financial_year}"
        
        counter = counter_collection.find_one_and_update(
            {"_id": counter_id},
            {"$inc": {"sequence_value": 1}},
            upsert=True,
            return_document=True
        )
        counter_value = counter["sequence_value"]
        ap_id = f"{business_alias}/{financial_year}/AP{counter_value:04d}"
        
        return ap_id
@router.post("/force-reset-counter")
async def force_reset_counter(request: Request):
    """Force reset the counter to 0 regardless of database state"""
    tenant_id = request.state.tenant_id
    reset_counter(tenant_id)
    return {"message": "Counter forcibly reset to 0. Next ID will be AP0001"}

@router.get("/counter-state")
async def get_counter_state( request: Request):
    tenant_id = request.state.tenant_id
    """Get current counter state"""
    counter_collection = get_apinvoice_collection(tenant_id).database["counters"]
    counter = counter_collection.find_one({"_id": "invoiceId"})
    db_count = get_apinvoice_collection(tenant_id).count_documents({})
    return {
        "counter_value": counter.get("sequence_value") if counter else None,
        "database_document_count": db_count
    }

@router.post("/", response_model=str)
async def create_apinvoice(request: Request,apinvoice: ApinvoicePost,
user = Depends(validate_token),
permissions: dict = Depends(check_permission("yenerp", "apinvoices", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)

    if collection.count_documents({}) == 0:
        reset_counter(tenant_id)
    
    random_id = generate_ap_id(tenant_id)
    apinvoice_data = apinvoice.dict()
    current_date_and_time = get_current_date_and_time()

    apinvoice_data['randomId'] = random_id
    apinvoice_data['createdDate'] = current_date_and_time['datetime']  # Add created date
    apinvoice_data['apinvoiceDate'] = current_date_and_time['datetime']  # Add created time
    result = collection.insert_one(apinvoice_data)
    return str(result.inserted_id)

@router.get("/getAll", response_model=List[Apinvoice])
async def get_all_apinvoices(request: Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)
    # Fetch all APInvoice documents from the collection
    apinvoice_list = list(collection.find())
    
    # Optionally, convert MongoDB ObjectId to string if needed
    for apinvoice in apinvoice_list:
        apinvoice["invoiceId"] = str(apinvoice["_id"])

    return apinvoice_list


@router.get("/getInvoiceIds", response_model=List[ApRandomId])
async def get_invoice_ids(request: Request):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)
    try:
        # Fetch only the invoiceId and randomId fields from the collection
        apinvoice_list = list(collection.find({}, {"_id": 1, "randomId": 1}))
        
        # Optionally, convert MongoDB ObjectId (_id) to string for the invoiceId
        formatted_invoices = []
        for apinvoice in apinvoice_list:
            formatted_invoices.append({
                "invoiceId": str(apinvoice["_id"]),
                "randomId": apinvoice.get("randomId", "")
            })
        
        if not formatted_invoices:
            raise HTTPException(status_code=404, detail="No invoices found")
        
        return formatted_invoices
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    
@router.get("/statuses", response_model=List[str])
async def get_apinvoice_statuses(request: Request,
    search: Optional[str] = Query(None, description="Search term to filter statuses (case-insensitive)"),
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of statuses to return")
):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)
    """
    Returns a paginated list of distinct statuses present in the AP Invoice collection.
    Supports search filtering for type-ahead in dropdowns, optimized for scalability.
    """

    try:
        # Build match query
        match_query = {"status": {"$exists": True, "$ne": None, "$ne": ""}}
        
        if search and search.strip():
            match_query["status"] = {"$regex": f".*{search.strip()}.*", "$options": "i"}
        
        # Use distinct() method which is simpler and more efficient for getting unique values
        statuses = collection.distinct("status", match_query)
        
        # Apply pagination manually
        statuses = sorted(statuses)  # Sort alphabetically
        paginated_statuses = statuses[skip:skip + limit]
        
        return paginated_statuses
    except Exception as e:
        logger.error(f"Error fetching statuses: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching statuses: {str(e)}")
@router.get("/", response_model=PaginatedApInvoices)
async def get_apinvoices(request: Request,
    skip: int = Query(0, ge=0, description="Number of records to skip (offset)"),
    limit: int = Query(50, ge=1, le=1000, description="Number of records to return per page"),
    order_by: Optional[str] = Query("-_id", description="Field to sort by (prefix with '-' for descending)"),
    fromDate: Optional[datetime] = Query(None, description="Filter from this date (inclusive)"),
    toDate: Optional[datetime] = Query(None, description="Filter up to this date (inclusive)"),
    vendorName: Optional[str] = Query(None, description="Filter by vendor name (starts with, case-insensitive)"),
    date_filter_field: Optional[str] = Query("apinvoiceDate", description="Date field to filter on"),
    invoiceType: Optional[str] = Query(None, description="Filter by invoice type: 'goods' or 'service'"),
    search: Optional[str] = Query(None, description="Search across PO/AP/GRN/Service ID/Invoice No/Vendor"),
    status: Optional[str] = Query(None, description="Filter by exact status (Verified, Returned, etc.)"),
    user = Depends(validate_token),
    user_data = Depends(get_current_user)
):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)
    """
    Paginated list of ALL AP Invoices with flexible filtering and sorting.
    By default, shows ALL invoices in descending order by _id (newest inserted first).
    """
    valid_date_fields = {"apinvoiceDate", "apReturnedDate", "invoiceDate", "dueDate"}

    if date_filter_field not in valid_date_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date filter field. Allowed values: {', '.join(valid_date_fields)}"
        )

    try:
       
        # ───────────────────────────────────────────────
        # 1. Build the common match stage
        # ───────────────────────────────────────────────
        match_stage: dict = {}

        # Date range filter - ONLY if dates are provided
        if fromDate or toDate:
            date_filter = {}
            if fromDate:
                # Start of day
                date_filter["$gte"] = fromDate.replace(hour=0, minute=0, second=0, microsecond=0)
            if toDate:
                # End of day
                date_filter["$lte"] = toDate.replace(hour=23, minute=59, second=59, microsecond=999999)
            match_stage[date_filter_field] = date_filter

        # Vendor name (starts-with, case-insensitive)
        if vendorName and (clean_vendor := vendorName.strip()):
            match_stage["vendorName"] = {"$regex": f"^{clean_vendor}", "$options": "i"}

        # Invoice type
        if invoiceType and invoiceType in {"goods", "service"}:
            match_stage["invoiceType"] = invoiceType

        # Status (exact match)
        if status and (clean_status := status.strip()):
            match_stage["status"] = clean_status

        # Free-text search across important identifier fields
        if search and (search_term := search.strip()):
            match_stage["$or"] = [
                {"poRandomId":    {"$regex": search_term, "$options": "i"}},
                {"serviceId":     {"$regex": search_term, "$options": "i"}},
                {"randomId":      {"$regex": search_term, "$options": "i"}},
                {"grnRandomId":   {"$regex": search_term, "$options": "i"}},
                {"invoiceNo":     {"$regex": search_term, "$options": "i"}},
                {"vendorName":    {"$regex": search_term, "$options": "i"}},
            ]

        # ───────────────────────────────────────────────
        # 2. Get total count
        # ───────────────────────────────────────────────
        count_pipeline = []
        if match_stage:  # Only add match if filters exist
            count_pipeline.append({"$match": match_stage})
        count_pipeline.append({"$count": "total"})

        count_result = list(collection.aggregate(count_pipeline))
        total = count_result[0]["total"] if count_result else 0

        # ───────────────────────────────────────────────
        # 3. Build main data pipeline with PROPER sorting
        # ───────────────────────────────────────────────
        pipeline = []
        if match_stage:  # Only add match if filters exist
            pipeline.append({"$match": match_stage})

        # FIXED: Sort by _id (ObjectId) which has timestamp embedded
        # This ensures newest inserted documents come first
        sort_direction = -1 if order_by.startswith("-") else 1
        sort_field = order_by.lstrip("-")
        
        # Default sorting: newest first by _id (ObjectId)
        if not sort_field or sort_field == "_id":
            sort_field = "_id"
            sort_direction = -1  # Always descending for _id to get newest first
        
        pipeline.append({"$sort": {sort_field: sort_direction}})

        # Pagination
        pipeline.extend([
            {"$skip": skip},
            {"$limit": limit},
        ])

        # Execute query
        cursor = collection.aggregate(pipeline)
        raw_docs = list(cursor)

        # ========== NEW: Fetch usernames for verifiedBy IDs ==========
        # Collect all unique verifiedBy user IDs (only ObjectId format)
        user_ids = set()
        for doc in raw_docs:
            verified_by = doc.get("verifiedBy")
            if verified_by and isinstance(verified_by, str) and len(verified_by) == 24 and all(c in '0123456789abcdefABCDEF' for c in verified_by):
                user_ids.add(verified_by)
        
        # Fetch users from database
        user_map = {}
        if user_ids:
            # Convert string IDs to ObjectIds
            object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
            if object_ids:
                users_cursor = await db["users"].find({"_id": {"$in": object_ids}}).to_list(None)
                user_map = {str(user["_id"]): user.get("username", "Unknown") for user in users_cursor}
        # ========== END NEW CODE ==========

        # ───────────────────────────────────────────────
        # 4. Format documents for response
        # ───────────────────────────────────────────────
        formatted_apinvoices = []

        for doc in raw_docs:
            # Convert ObjectId → string
            doc["invoiceId"] = str(doc["_id"])
            
            # ========== NEW: Add verifiedByName ==========
            verified_by = doc.get("verifiedBy")
            if verified_by and verified_by in user_map:
                doc["verifiedByName"] = user_map[verified_by]
            else:
                doc["verifiedByName"] = verified_by  # Fallback to ID if not found
            # ========== END NEW CODE ==========
            
            # IMPORTANT: Keep _id for reference but don't delete it
            # The frontend might need the original _id for sorting reference

            # Ensure required fields exist
            if doc.get("invoiceType") == "service":
                for field in [
                    "sacCode", "descriptions", "from_dates", "to_dates", "fees",
                    "remarks", "quantity", "desc_tax_types", "desc_tax_pers",
                    "desc_sgst", "desc_cgst", "desc_igst", "desc_tax_amounts",
                    "desc_totals", "desc_total_fees"
                ]:
                    if field not in doc:
                        doc[field] = []

                doc.setdefault("totalServiceFees", 0)
                doc.setdefault("totalServiceTax", 0)
                doc.setdefault("totalServiceDiscount", 0)

            else:  # goods
                if "itemDetails" not in doc:
                    doc["itemDetails"] = []

            try:
                formatted_apinvoices.append(Apinvoice(**doc))
            except Exception as validation_error:
                logger.warning(f"Validation failed for document {doc.get('invoiceId')}: {validation_error}")

        # ───────────────────────────────────────────────
        # 5. Build response
        # ───────────────────────────────────────────────
        page = (skip // limit) + 1 if limit > 0 else 1
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return PaginatedApInvoices(
            data=formatted_apinvoices,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            has_more=(skip + len(formatted_apinvoices)) < total
        )

    except Exception as e:
        logger.exception("Critical error in get_apinvoices endpoint")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
            
@router.get("/status", response_model=List[Apinvoice])
async def get_apinvoices_by_status( request: Request,status: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)

    apinvoices = list(collection.find({"status": status}))
    
    if not apinvoices:
        raise HTTPException(status_code=404, detail=f"No AP Invoices found with status '{status}'")
    
    formatted_apinvoices = []
    for apinvoice in apinvoices:
        apinvoice["invoiceId"] = str(apinvoice["_id"])  # Convert ObjectId to string for response
        formatted_apinvoices.append(Apinvoice(**apinvoice))
    
    return formatted_apinvoices

@router.get("/{apinvoice_id}", response_model=Apinvoice)
async def get_apinvoice_by_id( request: Request,apinvoice_id: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)
    apinvoice = collection.find_one({"_id": ObjectId(apinvoice_id)})
    if apinvoice:
        apinvoice["invoiceId"] = str(apinvoice["_id"])
        return Apinvoice(**apinvoice)
    else:
        raise HTTPException(status_code=404, detail="Apinvoice not found")

@router.put("/{apinvoice_id}/check", response_model=dict)
async def update_apinvoice(request:Request,apinvoice_id: str, apinvoice: ApinvoicePost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)

    updated_apinvoice = apinvoice.dict(exclude_unset=True)
    result = collection.update_one({"_id": ObjectId(apinvoice_id)}, {"$set": updated_apinvoice})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Apinvoice not found")
    return {"message": "Apinvoice updated successfully"}
@router.patch("/{apinvoice_id}", response_model=dict)
async def patch_apinvoice(request:Request,apinvoice_id: str, apinvoice_patch: ApinvoicePost,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_apinvoice_collection(tenant_id)

    existing_apinvoice = collection.find_one({"_id": ObjectId(apinvoice_id)})
    if not existing_apinvoice:
        raise HTTPException(status_code=404, detail="Apinvoice not found")

    updated_fields = {key: value for key, value in apinvoice_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']
        result = collection.update_one({"_id": ObjectId(apinvoice_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Apinvoice")

    updated_apinvoice = collection.find_one({"_id": ObjectId(apinvoice_id)})
    updated_apinvoice["_id"] = str(updated_apinvoice["_id"])
    return updated_apinvoice

@router.get("/getOutgoing/apinvoice", response_model=List[FrontendApInvoiceResponse])
async def get_ap_invoices(request:Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "read"))):
    tenant_id = request.state.tenant_id
    ap_collection = get_apinvoice_collection(tenant_id)
    grn_collection = get_grn_collection(tenant_id)

    def format_date(date_input):
        """Convert datetime to 'dd-MM-yyyy' string or return None"""
        if not date_input:
            return None
        if isinstance(date_input, str):
            try:
                cleaned = date_input.replace('Z', '+00:00')
                dt = datetime.fromisoformat(cleaned)
                return dt.strftime('%d-%m-%Y')
            except:
                return str(date_input)
        elif hasattr(date_input, 'strftime'):
            return date_input.strftime('%d-%m-%Y')
        return str(date_input)

    try:
        ap_invoices = list(ap_collection.find({}, {
            "_id": 1, "randomId": 1, "grnId": 1, "grnRandomId": 1,
            "vendorName": 1, "apinvoiceDate": 1, "invoiceNo": 1,
            "itemDetails": 1, "invoiceAmount": 1, "paymentStatus": 1,
            "invoiceType": 1,
            # Service-specific fields
            "descriptions": 1, "sacCode": 1, "from_dates": 1, "to_dates": 1,
            "fees": 1, "quantity": 1, "desc_tax_pers": 1,
            "desc_tax_amounts": 1, "desc_totals": 1, "remarks": 1,
        }))

        if not ap_invoices:
            raise HTTPException(status_code=404, detail="No AP Invoices found")

        formatted_ap_invoices = []

        for ap in ap_invoices:
            try:
                invoice_type = (ap.get("invoiceType") or "goods").lower()

                # Shared data
                invoice_id = str(ap["_id"])

                # Initialize service arrays
                service_descriptions = []
                service_sac_codes = []
                service_from_dates = []   # Will keep raw datetime for frontend parsing
                service_to_dates = []
                service_fees = []
                service_quantities = []
                service_tax_pers = []
                service_tax_amounts = []
                service_totals = []
                service_remarks = []

                formatted_item_details = []

                # === GOODS INVOICE ===
                if invoice_type == "goods":
                    item_details = ap.get("itemDetails", [])
                    if not item_details and ap.get("grnId"):
                        grn = grn_collection.find_one({"_id": ObjectId(ap["grnId"])})
                        if grn and grn.get("itemDetails"):
                            item_details = grn["itemDetails"]

                    for item in item_details:
                        tax_rate = float(item.get("purchasetaxName") or 0.0)
                        formatted_item_details.append(FrontendItemDetail(
                            itemId=str(item.get("itemId", "N/A")),
                            itemName=item.get("itemName", "Unknown Item"),
                            stockQuantity=float(item.get("stockQuantity", 0.0)),
                            unitPrice=float(item.get("unitPrice", 0.0)),
                            totalPrice=float(item.get("totalPrice", 0.0)),
                            purchasetaxName=tax_rate,
                            taxAmount=float(item.get("taxAmount", 0.0)),
                            discountAmount=float(item.get("discountAmount", 0.0)),
                            finalPrice=float(item.get("finalPrice", 0.0)),
                        ).dict())

                # === SERVICE INVOICE ===
                elif invoice_type == "service":
                    descriptions = ap.get("descriptions", [])
                    fees = ap.get("fees", [])
                    quantities = ap.get("quantity", [])
                    tax_pers = ap.get("desc_tax_pers", [])
                    tax_amounts = ap.get("desc_tax_amounts", [])
                    totals = ap.get("desc_totals", [])
                    sac_codes = ap.get("sacCode", [])
                    from_dates_raw = ap.get("from_dates", [])   # datetime objects
                    to_dates_raw = ap.get("to_dates", [])
                    remarks = ap.get("remarks", [])

                    # Determine max length for iteration
                    max_len = max(
                        len(descriptions), len(fees), len(quantities),
                        len(tax_pers), len(tax_amounts), len(totals),
                        len(sac_codes), len(from_dates_raw), len(to_dates_raw),
                        len(remarks), 1
                    )

                    for i in range(max_len):
                        desc = descriptions[i] if i < len(descriptions) else f"Service Item {i+1}"
                        fee = float(fees[i]) if i < len(fees) else 0.0
                        qty = float(quantities[i]) if i < len(quantities) and quantities[i] is not None else 1.0
                        tax_perc = float(tax_pers[i]) if i < len(tax_pers) else 0.0
                        tax_amt = float(tax_amounts[i]) if i < len(tax_amounts) else round(fee * tax_perc / 100, 2)
                        total = float(totals[i]) if i < len(totals) else round(fee + tax_amt, 2)
                        unit_price = round(fee / qty, 2) if qty > 0 else fee
                        remark = remarks[i] if i < len(remarks) else None

                        # Populate service arrays
                        service_descriptions.append(desc.strip() or "Service Charge")
                        service_sac_codes.append(sac_codes[i] if i < len(sac_codes) else "")
                        service_from_dates.append(from_dates_raw[i] if i < len(from_dates_raw) else None)
                        service_to_dates.append(to_dates_raw[i] if i < len(to_dates_raw) else None)
                        service_fees.append(fee)
                        service_quantities.append(qty)
                        service_tax_pers.append(tax_perc)
                        service_tax_amounts.append(tax_amt)
                        service_totals.append(total)
                        service_remarks.append(remark or "")

                        # Also populate itemDetails for backward compatibility (optional)
                        formatted_item_details.append(FrontendItemDetail(
                            itemId=f"service_{invoice_id}_{i}",
                            itemName=desc.strip() or "Service Charge",
                            stockQuantity=qty,
                            unitPrice=unit_price,
                            totalPrice=fee,
                            purchasetaxName=tax_perc,
                            taxAmount=tax_amt,
                            discountAmount=0.0,
                            finalPrice=total,
                        ).dict())

                # === Build Final Response ===
                formatted_ap = FrontendApInvoiceResponse(
                    invoiceId=invoice_id,
                    randomId=ap.get("randomId"),
                    grnId=str(ap.get("grnId")) if ap.get("grnId") else None,
                    grnRandomId=ap.get("grnRandomId"),
                    vendorName=ap.get("vendorName"),
                    apInvoiceDate=ap.get("apinvoiceDate"),
                    invoiceNo=ap.get("invoiceNo"),
                    invoiceAmount=float(ap.get("invoiceAmount", 0.0)),
                    paymentStatus=ap.get("paymentStatus"),
                    invoiceType=invoice_type,

                    # Shared
                    itemDetails=formatted_item_details,

                    # Service-specific arrays (now properly filled!)
                    sacCode=service_sac_codes,
                    from_dates=service_from_dates,      # Raw datetime → frontend will format
                    to_dates=service_to_dates,
                    fees=service_fees,
                    quantity=service_quantities,
                    desc_tax_pers=service_tax_pers,
                    desc_tax_amounts=service_tax_amounts,
                    desc_totals=service_totals,
                    remarks=service_remarks,
                )

                formatted_ap_invoices.append(formatted_ap.dict())  # Use .dict() for clean output

            except Exception as e:
                logger.error(f"Error processing AP invoice {ap.get('_id')}: {str(e)}")
                continue

        if not formatted_ap_invoices:
            raise HTTPException(status_code=404, detail="No valid AP Invoices found")

        return formatted_ap_invoices

    except Exception as e:
        logger.error(f"Server error in get_ap_invoices: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")    
# @router.get("/", response_model=List[Apinvoice])
# async def get_apinvoices(
#     skip: int = Query(0, description="Number of records to skip"),
#     limit: int = Query(50, description="Number of records to return"),
#     order_by: Optional[str] = Query("apinvoiceDate", description="Field to order by"),  # Optional order field
#     fromDate: Optional[datetime] = Query(None, description="From date"),
#     toDate: Optional[datetime] = Query(None, description="To date"),
#     vendorName: Optional[str] = Query(None, description="Vendor name to filter by"),
#     date_filter_field: Optional[str] = Query("apinvoiceDate", description="Field to filter by (e.g., 'apinvoiceDate', 'apReturnedDate')"),
#     status: Optional[str] = Query(None, description="Status to filter by (e.g., 'Returned')"),  # New parameter for status filter
# ):
#     """
#     Get AP Invoices with optional filters: date range, vendor name, status, pagination, and sorting.
#     Filters can be applied on specific date fields (apinvoiceDate or apReturnedDate).
#     For Returned invoices page, pass status='Returned' to fetch only returned invoices.
#     """
#     valid_date_fields = ["apinvoiceDate", "apReturnedDate"]
    
#     if date_filter_field not in valid_date_fields:
#         raise HTTPException(status_code=400, detail=f"Invalid date filter field. Choose from {valid_date_fields}.")

#     try:
#         query = {}

#         # Handle date range based on selected date field (apinvoiceDate or apReturnedDate)
#         if fromDate and toDate:
#             fromDate = fromDate.replace(hour=0, minute=0, second=0, microsecond=0)
#             toDate = toDate.replace(hour=23, minute=59, second=59, microsecond=999999)
#             if fromDate > toDate:
#                 raise HTTPException(status_code=400, detail="fromDate cannot be after toDate.")
#             query[date_filter_field] = {"$gte": fromDate, "$lte": toDate}

#         elif fromDate:
#             fromDate = fromDate.replace(hour=0, minute=0, second=0, microsecond=0)
#             query[date_filter_field] = {"$eq": fromDate}

#         # Vendor name filtering
#         if vendorName:
#             query["vendorName"] = {"$regex": f"^{vendorName}", "$options": "i"}

#         # Status filtering (for Returned page, this will be 'Returned')
#         if status:
#             query["status"] = status

#         # Get the MongoDB collection
#         collection = get_apinvoice_collection()

#         # Check total number of records that match the query
#         total_records = collection.count_documents(query)

#         # If no records match the query, return an empty list
#         if total_records == 0:
#             return []

#         # Fetch paginated data and sort in descending order
#         apinvoices = list(
#             collection.find(query)
#             .sort(order_by, -1)  # Sort by the chosen field in descending order (-1)
#             .skip(skip)
#             .limit(limit)
#         )

#         # Format the response
#         formatted_apinvoices = []
#         for apinvoice in apinvoices:
#             apinvoice["invoiceId"] = str(apinvoice["_id"])
#             formatted_apinvoices.append(Apinvoice(**apinvoice))

#         return formatted_apinvoices

#     except Exception as e:
#         raise HTTPException(status_code=500, detail="Internal Server Error")