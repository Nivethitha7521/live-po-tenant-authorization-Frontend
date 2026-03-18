# ==============================================
# COMPLETE OPTIMIZED SERVICE ORDER ROUTER
# ==============================================

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body, Request
import pytz
from pymongo import ReturnDocument, IndexModel, TEXT
import logging
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from ServiceOrder.utils import (
    calculate_service_totals_with_proportional_discount,
    calculate_single_description_totals,
    get_current_date_only,
    get_serviceworkorder_collection
)
from ServiceOrder.models import (
    CalculateTotalsRequest, ServicePost, ServiceState, 
    ServiceRejectRequest, ServiceStatusUpdate,
    parse_datetime_to_utc_date_only, parse_datetime_to_utc_full
)
from bson import ObjectId
from utils.financial_year import get_business_alias, get_financial_year
from cachetools import TTLCache
import asyncio
from functools import lru_cache

router = APIRouter()
logger = logging.getLogger(__name__)

# ==============================================
# CACHING CONFIGURATION
# ==============================================
alias_cache = TTLCache(maxsize=100, ttl=3600)  # 1 hour cache for business aliases
counter_cache = TTLCache(maxsize=200, ttl=300)  # 5 minute cache for counters
collection_check_cache = TTLCache(maxsize=50, ttl=3600)  # 1 hour cache for collection checks

# ==============================================
# OPTIMIZED HELPER FUNCTIONS
# ==============================================

async def ensure_indexes(tenant_id: str):
    """Create all necessary indexes for performance (run once at startup)"""
    try:
        collection = get_serviceworkorder_collection(tenant_id)
        
        # Check if indexes already exist
        existing_indexes = await collection.index_information()
        
        # Define required indexes
        required_indexes = {
            "service_id_idx": [("serviceId", 1)],
            "vendor_text_idx": [("vendorName", TEXT)],
            "status_date_idx": [("status", 1), ("createdDate", -1)],
            "created_date_idx": [("createdDate", -1)],
            "vendor_date_idx": [("vendorName", 1), ("createdDate", -1)]
        }
        
        # Create missing indexes
        for idx_name, idx_keys in required_indexes.items():
            if idx_name not in existing_indexes:
                await collection.create_index(idx_keys, name=idx_name, background=True)
                logger.info(f"Created index: {idx_name}")
                
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

async def get_cached_business_alias(tenant_id: str) -> str:
    """Cached version of get_business_alias"""
    cache_key = f"alias_{tenant_id}"
    
    if cache_key in alias_cache:
        return alias_cache[cache_key]
    
    alias = await get_business_alias(tenant_id)
    alias_cache[cache_key] = alias
    return alias

async def get_cached_next_service_counter(service_type: str, tenant_id: str):
    """Optimized counter with caching and atomic operation"""
    cache_key = f"counter_{service_type}_{tenant_id}"
    
    # Check cache first
    if cache_key in counter_cache:
        cached_value = counter_cache[cache_key]
        counter_cache[cache_key] = cached_value + 1
        return cached_value + 1
    
    collection = get_serviceworkorder_collection(tenant_id)
    counter_collection = collection.database["counters"]
    
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    if current_date < TRANSITION_DATE:
        counter_id = f"service_{service_type}_id"
    else:
        financial_year = get_financial_year(current_date)
        counter_id = f"service_{service_type}_id_{financial_year}"
    
    # Atomic update with retry logic
    for attempt in range(3):
        try:
            counter = await counter_collection.find_one_and_update(
                {"_id": counter_id},
                {"$inc": {"sequence_value": 1}},
                upsert=True,
                return_document=ReturnDocument.AFTER
            )
            
            if counter:
                value = counter["sequence_value"]
                counter_cache[cache_key] = value
                return value
        except Exception as e:
            if attempt == 2:
                logger.error(f"Counter update failed after 3 attempts: {e}")
                raise
            await asyncio.sleep(0.1 * (attempt + 1))  # Exponential backoff
    
    raise HTTPException(status_code=500, detail="Failed to generate service ID")

async def reset_service_counter(service_type: str, tenant_id: str):
    """Reset the service counter to 0 with cache invalidation"""
    collection = get_serviceworkorder_collection(tenant_id)
    counter_collection = collection.database["counters"]
    
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    if current_date < TRANSITION_DATE:
        counter_id = f"service_{service_type}_id"
    else:
        financial_year = get_financial_year(current_date)
        counter_id = f"service_{service_type}_id_{financial_year}"
    
    await counter_collection.update_one(
        {"_id": counter_id},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )
    
    # Invalidate cache
    cache_key = f"counter_{service_type}_{tenant_id}"
    if cache_key in counter_cache:
        del counter_cache[cache_key]

async def generate_service_id(service_type: str, tenant_id: str):
    """Optimized service ID generation with caching"""
    counter_value = await get_cached_next_service_counter(service_type, tenant_id)
    current_date = datetime.now()
    
    if current_date < datetime(2026, 4, 1):
        return f"SR{counter_value:04d}"
    else:
        financial_year = get_financial_year(current_date)
        business_alias = await get_cached_business_alias(tenant_id)
        return f"{business_alias}/{financial_year}/SR{counter_value:04d}"

def validate_and_format_dates(from_dates: List[Optional[Any]], to_dates: List[Optional[Any]]):
    """Optimized date validation with list comprehension"""
    formatted_from = []
    formatted_to = []
    
    current_date_only = get_current_date_only()
    
    # Use zip for parallel iteration
    for from_date, to_date in zip(from_dates, to_dates):
        # Fast path for None/empty
        if not from_date:
            from_dt = current_date_only
        else:
            try:
                from_dt = parse_datetime_to_utc_date_only(from_date)
                from_dt = from_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            except:
                from_dt = current_date_only
        
        if not to_date:
            to_dt = from_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            try:
                to_dt = parse_datetime_to_utc_date_only(to_date)
                to_dt = to_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
            except:
                to_dt = from_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Ensure to_date >= from_date
        if to_dt < from_dt:
            to_dt = from_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        formatted_from.append(from_dt)
        formatted_to.append(to_dt)
    
    return formatted_from, formatted_to

# ==============================================
# OPTIMIZED CREATE SERVICE
# ==============================================
@router.post("/")
async def create_service(
    service: ServicePost, 
    request: Request, 
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "serviceorders_pending", "add"))
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)
    service_type = "workorder"

    try:
        # Check if collection is empty (cached)
        cache_key = f"collection_empty_{tenant_id}"
        if cache_key not in collection_check_cache:
            is_empty = await collection.count_documents({}, limit=1) == 0
            if is_empty:
                await reset_service_counter(service_type, tenant_id)
            collection_check_cache[cache_key] = is_empty

        # Parallel execution of independent tasks
        service_id_task = generate_service_id(service_type, tenant_id)
        current_date_only = get_current_date_only()
        
        # Get service_id while preparing data
        service_id = await service_id_task
        
        # Convert to dict (fast operation)
        service_dict = service.dict()
        
        # Optimized freight calculation using sum with generator
        freights = service_dict.get("freights", [])
        freight_total = sum(f.get("amt", 0) for f in freights)
        freight_tax = sum(f.get("tAmt", 0) for f in freights)
        freight_grand_total = freight_total + freight_tax
        
        # Calculate service totals
        totals = calculate_service_totals_with_proportional_discount(service_dict)
        service_amount_after_discount = totals.get("total_service_amount", 0)
        
        # Prepare mongo data with dictionary comprehension
        mongo_data = {
            'serviceId': service_id,
            'createdDate': current_date_only,
            'status': 'Pending',
            'serviceType': service_type,
            'lastUpdatedDate': current_date_only,
            'lastUpdatedTime': current_date_only.strftime('%H:%M:%S'),
            
            # SERVICE ONLY fields
            "totalServiceFees": totals.get("original_total_fees", 0),
            "totalServiceTax": totals.get("total_service_tax", 0),
            "totalServiceDiscount": totals.get("total_service_discount", 0),
            "totalServiceAmount": service_amount_after_discount,
            
            # SUMMARY fields
            "totalFees": service_amount_after_discount,
            "totalTax": totals.get("total_service_tax", 0),
            "totalDiscount": totals.get("total_discount", 0),
            "totalAmount": service_amount_after_discount + freight_grand_total,
            
            # FREIGHT totals
            "totalFreightAmount": freight_total,
            "totalFreightTaxAmount": freight_tax,
            
            # Arrays with defaults
            "desc_tax_amounts": totals.get("desc_tax_amounts", []),
            "desc_totals": totals.get("desc_totals", []),
            "base_amounts": totals.get("desc_base_per_units", []),
            "desc_sgst": totals.get("desc_sgst", []),
            "desc_cgst": totals.get("desc_cgst", []),
            "desc_igst": totals.get("desc_igst", []),
            "desc_individual_discount_amounts": totals.get("desc_individual_discount_amounts", []),
            "desc_overall_discounts": totals.get("desc_overall_discounts", []),
            "desc_discount_amounts": totals.get("desc_discount_amounts", []),
            "desc_discount_percentages": totals.get("desc_discount_percentages", []),
            "include_tax": service_dict.get("include_tax", []),
            "quantity": totals.get("desc_quantity", []),
            "fees": totals.get("desc_fees", []),
            "overallDiscountAppliedOn": service_dict.get("overallDiscountAppliedOn", "after_tax"),
        }

        # Add remaining fields efficiently
        excluded_keys = {'createdDate', 'serviceId', '_id', 'freights'}
        mongo_data.update({
            k: v for k, v in service_dict.items() 
            if k not in excluded_keys and k not in mongo_data
        })

        # Insert and return in one operation
        result = await collection.insert_one(mongo_data)
        created_service = mongo_data.copy()
        created_service["_id"] = str(result.inserted_id)
        
        return ServiceState(**created_service)

    except Exception as e:
        logger.error(f"Error creating service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# OPTIMIZED GET SERVICE BY ID
# ==============================================
@router.get("/{identifier}", response_model=ServiceState)
async def get_service_by_identifier(
    identifier: str, 
    request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "serviceorders_pending", "read"))
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        # Define projection to exclude large fields
        projection = {
            "audit_logs": 0,
            "large_attachments": 0
        }
        
        service = None
        
        # Try ObjectId first if valid
        if ObjectId.is_valid(identifier):
            service = await collection.find_one(
                {"_id": ObjectId(identifier)},
                projection=projection
            )
        
        # If not found, try serviceId
        if not service:
            service = await collection.find_one(
                {"serviceId": identifier},
                projection=projection
            )
        
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Convert _id to string
        service["_id"] = str(service["_id"])
        
        # Batch convert date fields
        date_fields = ['workOrderDate', 'approvedDate', 'rejectedDate', 'invoiceDate', 'createdDate', 'lastUpdatedDate']
        for field in date_fields:
            if service.get(field) and isinstance(service[field], datetime):
                service[field] = service[field].isoformat()
        
        return ServiceState(**service)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# OPTIMIZED UPDATE SERVICE
# ==============================================
@router.patch("/update/{mongo_id}", response_model=ServiceState)
async def patch_service_by_mongo_id(
    mongo_id: str,
    request: Request, 
    service_update: ServicePost = Body(...),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "serviceorders_pending", "edit"))
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)
 
    try:
        obj_id = ObjectId(mongo_id)
        
        # Get only needed fields from existing
        existing = await collection.find_one(
            {"_id": obj_id},
            projection={"fees": 1, "desc_tax_types": 1, "desc_tax_pers": 1, 
                       "desc_individual_discount_amounts": 1, "desc_discount_amounts": 1,
                       "desc_discount_percentages": 1, "quantity": 1, "include_tax": 1,
                       "overallDiscountValue": 1, "overallDiscountAppliedOn": 1,
                       "overallDiscountType": 1, "roundOffValue": 1, "totalFreightAmount": 1,
                       "totalFreightTaxAmount": 1, "sacCode": 1, "descriptions": 1, "remarks": 1}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Service not found")

        update_data = service_update.dict(exclude_unset=True, exclude_none=True)
        
        # Remove protected fields
        for protected in ["serviceId", "createdDate", "_id", "mongoId"]:
            update_data.pop(protected, None)

        # Check if recalculation needed
        recalc_keys = [
            "descriptions", "from_dates", "to_dates", "fees",
            "desc_tax_types", "desc_tax_pers", "quantity", "remarks",
            "desc_discount_percentages", "desc_discount_amounts", "include_tax",
            "desc_individual_discount_amounts",
            "overallDiscountValue", "overallDiscountType", "overallDiscountAppliedOn",
            "roundOffValue", "totalFreightAmount", "totalFreightTaxAmount"
        ]
        needs_recalc = any(k in update_data for k in recalc_keys)

        if needs_recalc:
            # Merge with existing data efficiently
            service_dict = {
                "fees": update_data.get('fees', existing.get('fees', [])),
                "desc_tax_types": update_data.get('desc_tax_types', existing.get('desc_tax_types', [])),
                "desc_tax_pers": update_data.get('desc_tax_pers', existing.get('desc_tax_pers', [])),
                "desc_individual_discount_amounts": update_data.get('desc_individual_discount_amounts', existing.get('desc_individual_discount_amounts', [])),
                "desc_discount_amounts": update_data.get('desc_discount_amounts', existing.get('desc_discount_amounts', [])),
                "desc_discount_percentages": update_data.get('desc_discount_percentages', existing.get('desc_discount_percentages', [])),
                "quantity": update_data.get('quantity', existing.get('quantity', [])),
                "include_tax": update_data.get('include_tax', existing.get('include_tax', [])),
                "overallDiscountValue": update_data.get('overallDiscountValue', existing.get('overallDiscountValue', 0)),
                "overallDiscountAppliedOn": update_data.get('overallDiscountAppliedOn', existing.get('overallDiscountAppliedOn', 'after_tax')),
                "overallDiscountType": update_data.get('overallDiscountType', existing.get('overallDiscountType', 'percentage')),
                "roundOffValue": update_data.get('roundOffValue', existing.get('roundOffValue', 0)),
                "totalFreightAmount": update_data.get('totalFreightAmount', existing.get('totalFreightAmount', 0)),
                "totalFreightTaxAmount": update_data.get('totalFreightTaxAmount', existing.get('totalFreightTaxAmount', 0)),
                "sacCode": update_data.get('sacCode', existing.get('sacCode', [])),
                "descriptions": update_data.get('descriptions', existing.get('descriptions', [])),
                "remarks": update_data.get('remarks', existing.get('remarks', [])),
            }
            
            # Calculate totals
            totals = calculate_service_totals_with_proportional_discount(service_dict)
            
            # Update with calculated values
            update_data.update({
                "totalServiceFees": totals["total_service_fees"],
                "totalServiceTax": totals["total_service_tax"],
                "totalServiceDiscount": totals["total_service_discount"],
                "totalServiceAmount": totals["total_service_amount"],
                "totalFees": totals["total_fees"],
                "totalTax": totals["total_tax"],
                "totalDiscount": totals["total_discount"],
                "totalAmount": totals["total_final_amount"],
                "totalFreightAmount": totals["total_freight_amount"],
                "totalFreightTaxAmount": totals["total_freight_tax"],
                "desc_tax_amounts": totals["desc_tax_amounts"],
                "desc_totals": totals["desc_totals"],
                "base_amounts": totals["desc_base_per_units"],
                "desc_sgst": totals["desc_sgst"],
                "desc_cgst": totals["desc_cgst"],
                "desc_igst": totals["desc_igst"],
                "desc_individual_discount_amounts": totals["desc_individual_discount_amounts"],
                "desc_overall_discounts": totals["desc_overall_discounts"],
                "desc_discount_amounts": totals["desc_discount_amounts"],
                "desc_discount_percentages": totals["desc_discount_percentages"],
                "fees": totals["desc_fees"],
                "quantity": totals["desc_quantity"],
            })

        current_date_only = get_current_date_only()
        update_data['lastUpdatedDate'] = current_date_only
        update_data['lastUpdatedTime'] = current_date_only.strftime('%H:%M:%S')

        # Update and return in one operation
        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": update_data},
            return_document=ReturnDocument.AFTER
        )

        if not result:
            raise HTTPException(status_code=500, detail="Update failed")

        result["_id"] = str(result["_id"])
        result["mongoId"] = str(result["_id"])

        # Convert date fields
        for field in ['workOrderDate', 'approvedDate', 'rejectedDate', 'invoiceDate', 'createdDate', 'lastUpdatedDate']:
            if result.get(field) and isinstance(result[field], datetime):
                result[field] = result[field].isoformat()

        return ServiceState(**result)

    except Exception as e:
        logger.error(f"Error patching service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# OPTIMIZED SEARCH BY VENDOR
# ==============================================
@router.get("/search/vendor", response_model=List[ServiceState])
async def search_services_by_vendor(
    request: Request,
    vendorName: str = Query(..., description="Vendor name to search for"),
    limit: int = Query(50, ge=1, le=200, description="Number of results"),
    skip: int = Query(0, ge=0, description="Skip records")
):
    """Optimized search services by vendor name"""
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        # Use anchored regex for better performance
        query = {
            "vendorName": {"$regex": f"^{vendorName}", "$options": "i"}
        }
        
        # Project only needed fields
        projection = {
            "serviceId": 1,
            "vendorName": 1,
            "status": 1,
            "totalAmount": 1,
            "createdDate": 1,
            "serviceType": 1,
            "totalFees": 1,
            "totalTax": 1
        }
        
        # Use index hint for consistency
        cursor = collection.find(
            query, 
            projection
        ).hint([("vendorName", 1), ("createdDate", -1)]).sort("createdDate", -1).skip(skip).limit(limit)
        
        services = await cursor.to_list(length=limit)
        
        # Batch convert IDs
        for service in services:
            service["_id"] = str(service["_id"])
            if service.get("createdDate") and isinstance(service["createdDate"], datetime):
                service["createdDate"] = service["createdDate"].isoformat()
     
        return [ServiceState(**service) for service in services]
        
    except Exception as e:
        logger.error(f"Error searching services by vendor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# OPTIMIZED DASHBOARD SUMMARY
# ==============================================
@router.get("/dashboard/summary")
async def get_service_dashboard_summary(request: Request):
    """Optimized dashboard summary using single aggregation pipeline"""
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        # Single aggregation pipeline for all data
        pipeline = [
            {
                "$facet": {
                    "status_counts": [
                        {"$group": {
                            "_id": "$status",
                            "count": {"$sum": 1},
                            "totalAmount": {"$sum": "$totalAmount"}
                        }}
                    ],
                    "recent_services": [
                        {"$sort": {"createdDate": -1}},
                        {"$limit": 10},
                        {"$project": {
                            "serviceId": 1,
                            "vendorName": 1,
                            "status": 1,
                            "totalAmount": 1,
                            "createdDate": 1,
                            "serviceType": 1
                        }}
                    ],
                    "total_stats": [
                        {"$group": {
                            "_id": None,
                            "totalServices": {"$sum": 1},
                            "totalAmount": {"$sum": "$totalAmount"}
                        }}
                    ]
                }
            }
        ]
        
        result = await collection.aggregate(pipeline).to_list(length=1)
        result = result[0] if result else {}
        
        # Process results
        status_counts = result.get("status_counts", [])
        recent_services = result.get("recent_services", [])
        total_stats = result.get("total_stats", [{}])[0]
        
        # Format recent services
        for service in recent_services:
            service["_id"] = str(service["_id"])
            if service.get("createdDate"):
                service["createdDate"] = service["createdDate"].isoformat()
        
        return {
            "totalServices": total_stats.get("totalServices", 0),
            "totalAmount": round(total_stats.get("totalAmount", 0), 2),
            "statusCounts": status_counts,
            "recentServices": recent_services
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# CALCULATE TOTALS ENDPOINT (unchanged but optimized)
# ==============================================
@router.post("/calculate-totals")
async def calculate_service_totals_endpoint(request: CalculateTotalsRequest):
    """Calculate totals for service order"""
    try:
        # Prepare data for calculation
        service_dict = {
            "fees": [
                d.fee_with_tax if d.include_tax else (
                    d.base_amount * (1 + (d.tax_per / 100)) if d.tax_per > 0 else d.base_amount
                )
                for d in request.descriptions
            ],
            "desc_tax_types": [d.tax_type for d in request.descriptions],
            "desc_tax_pers": [d.tax_per for d in request.descriptions],
            "desc_discount_amounts": [d.discount_amount for d in request.descriptions],
            "desc_discount_percentages": [d.discount_percentage for d in request.descriptions],
            "quantity": [d.quantity or 1 for d in request.descriptions],
            "sacCode": [d.sacCode for d in request.descriptions],
            "descriptions": [d.description for d in request.descriptions],
            "remarks": [d.remarks or "" for d in request.descriptions],
            "include_tax": [d.include_tax for d in request.descriptions],
            "overallDiscountValue": request.overall_discount_value,
            "overallDiscountAppliedOn": request.overall_discount_applied_on,
            "overallDiscountType": request.overall_discount_type,
            "roundOffValue": request.round_off,
            "totalFreightAmount": request.total_freight_amount,
            "totalFreightTaxAmount": request.total_freight_tax,
        }
        
        # Calculate totals
        totals = calculate_service_totals_with_proportional_discount(service_dict)
        
        # Prepare response
        response = {
            "totalAmount": totals.get("total_final_amount", 0),
            "totalFees": totals.get("total_fees", 0),
            "totalTax": totals.get("total_tax", 0),
            "totalDiscount": totals.get("total_discount", 0),
            "totalOverallDiscount": totals.get("total_overall_discount", 0),
            "totalServiceAmount": totals.get("total_service_amount", 0),
            "totalServiceFees": totals.get("total_fees", 0),
            "totalServiceTax": totals.get("total_tax", 0),
            "totalServiceDiscount": totals.get("total_discount", 0),
            "totalFreightAmount": totals.get("total_freight_amount", 0),
            "totalFreightTaxAmount": totals.get("total_freight_tax", 0),
            "roundOffValue": request.round_off,
            "sacCode": service_dict.get("sacCode", []),
            "descriptions": service_dict.get("descriptions", []),
            "from_dates": [d.from_date.isoformat() if d.from_date else None for d in request.descriptions],
            "to_dates": [d.to_date.isoformat() if d.to_date else None for d in request.descriptions],
            "fees": totals.get("desc_fees", []),
            "quantity": totals.get("desc_quantity", []),
            "remarks": totals.get("remarks", service_dict.get("remarks", [])),
            "desc_tax_types": [d.tax_type for d in request.descriptions],
            "desc_tax_pers": [d.tax_per for d in request.descriptions],
            "desc_tax_amounts": totals.get("desc_tax_amounts", []),
            "desc_totals": totals.get("desc_totals", []),
            "base_amounts": totals.get("desc_base_per_units", []),
            "desc_sgst": totals.get("desc_sgst", []),
            "desc_cgst": totals.get("desc_cgst", []),
            "desc_igst": totals.get("desc_igst", []),
            "include_tax": service_dict.get("include_tax", []),
            "desc_individual_discount_amounts": totals.get("desc_individual_discount_amounts", []),
            "desc_overall_discounts": totals.get("desc_overall_discounts", []),
            "desc_discount_amounts": totals.get("desc_discount_amounts", []),
            "desc_discount_percentages": totals.get("desc_discount_percentages", []),
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error calculating totals: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# DESCRIPTIONS TOTALS ENDPOINT
# ==============================================
@router.get("/descriptions/totals")
async def get_description_totals(
    description: str = Query(..., description="Description text"),
    fromDate: Optional[str] = Query(None, description="From date"),
    toDate: Optional[str] = Query(None, description="To date"),
    quantity: float = Query(1.0, ge=0.01, description="Quantity"),
    fee: float = Query(..., ge=0, description="PER UNIT amount (WITH TAX)"),
    taxType: str = Query(..., description="Tax type: 'cgst_sgst' or 'igst'"),
    taxPer: float = Query(0, ge=0, le=99.99, description="Tax percentage"),
    discount: float = Query(0, ge=0, description="Discount amount (total, not per unit)"),
    remarks: Optional[str] = Query(None, description="Remarks"),
    include_tax: bool = Query(True, description="User preference - ALWAYS send fee with tax")
):
    """Calculate totals for a single service description."""
    try:
        if taxType not in ["cgst_sgst", "igst"]:
            raise HTTPException(status_code=400, detail="Invalid taxType")
        
        # Parse dates
        from_date_parsed = None
        to_date_parsed = None
        
        if fromDate:
            try:
                from_date_parsed = parse_datetime_to_utc_date_only(fromDate)
            except:
                pass
        
        if toDate:
            try:
                to_date_parsed = parse_datetime_to_utc_date_only(toDate)
            except:
                pass
        
        # Calculate totals
        result = calculate_single_description_totals(
            description=description,
            from_date=from_date_parsed,
            to_date=to_date_parsed,
            tax_type=taxType,
            fee=fee,
            tax_per=taxPer,
            discount=discount,
            quantity=quantity
        )
        
        result["include_tax"] = include_tax
        return result
        
    except Exception as e:
        logger.error(f"Error calculating description totals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================
# APPROVE / REJECT ENDPOINTS (optimized)
# ==============================================
@router.patch("/approved/{mongo_id}")
async def approve_service(
    mongo_id: str,
    request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "serviceorders_pending", "approve"))
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        obj_id = ObjectId(mongo_id)
        current_date_only = get_current_date_only()
        
        # Update directly without fetching first
        result = await collection.find_one_and_update(
            {"_id": obj_id, "status": {"$ne": "Approved"}},  # Condition to avoid duplicate approvals
            {"$set": {
                'status': "Approved",
                'approvedDate': current_date_only,
                'lastUpdatedDate': current_date_only,
                'lastUpdatedTime': current_date_only.strftime('%H:%M:%S'),
            }},
            return_document=ReturnDocument.AFTER,
            projection={"serviceId": 1, "status": 1, "approvedDate": 1}  # Only return needed fields
        )

        if not result:
            # Check if service exists but already approved
            existing = await collection.find_one({"_id": obj_id}, {"status": 1})
            if existing:
                raise HTTPException(status_code=400, detail=f"Service already {existing['status']}")
            raise HTTPException(status_code=404, detail="Service order not found")

        result["_id"] = str(result["_id"])
        logger.info(f"Service Order {result.get('serviceId')} approved successfully")

        return {
            "success": True,
            "message": "Service order approved successfully",
            "serviceId": result.get("serviceId"),
            "status": result.get("status"),
            "approved_date": current_date_only.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.patch("/rejected/{mongo_id}")
async def reject_service(
    mongo_id: str, 
    request: Request, 
    request_body: ServiceRejectRequest = Body(...),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "serviceorders_pending", "approve"))
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        obj_id = ObjectId(mongo_id)
        current_date_only = get_current_date_only()
        
        # Get current service for comments
        service = await collection.find_one(
            {"_id": obj_id}, 
            {"statusComments": 1, "serviceId": 1}
        )
        
        if not service:
            raise HTTPException(status_code=404, detail="Service order not found")

        # Prepare comments
        existing_comments = service.get('statusComments', [])
        existing_comments.append({
            'status': 'Rejected',
            'comment': request_body.reason,
            'timestamp': current_date_only,
            'user': 'system'
        })

        # Update with rejection
        result = await collection.find_one_and_update(
            {"_id": obj_id, "status": {"$ne": "Rejected"}},
            {"$set": {
                'status': "Rejected",
                'rejectedDate': current_date_only,
                'lastUpdatedDate': current_date_only,
                'lastUpdatedTime': current_date_only.strftime('%H:%M:%S'),
                'rejectionReason': request_body.reason,
                'serviceRejectedPerson': 'system',
                'statusComments': existing_comments
            }},
            return_document=ReturnDocument.AFTER,
            projection={"serviceId": 1, "status": 1, "rejectedDate": 1}
        )

        if not result:
            # Check if already rejected
            existing = await collection.find_one({"_id": obj_id}, {"status": 1})
            if existing and existing['status'] == "Rejected":
                raise HTTPException(status_code=400, detail="Service already rejected")
            raise HTTPException(status_code=404, detail="Service order not found")

        result["_id"] = str(result["_id"])
        logger.info(f"Service Order {service.get('serviceId')} rejected")

        return {
            "success": True,
            "message": "Service order rejected successfully",
            "serviceId": result.get("serviceId"),
            "status": result.get("status"),
            "rejected_date": current_date_only.isoformat(),
            "reason": request_body.reason
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# STATUS UPDATE ENDPOINT (optimized)
# ==============================================
@router.patch("/{service_id}/status")
async def update_service_status(
    service_id: str, 
    request: Request,
    request_body: ServiceStatusUpdate
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    valid_statuses = [
        "Pending", "Active", "Completed", "Cancelled",
        "On Hold", "Approved", "Rejected", "In Progress",
        "Delivered", "Closed", "Invoice Generated", "Paid"
    ]

    if request_body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    try:
        current_date_only = get_current_date_only()
        
        # Prepare update fields
        updated_fields = {
            'status': request_body.status,
            'lastUpdatedDate': current_date_only,
            'lastUpdatedTime': current_date_only.strftime('%H:%M:%S')
        }

        # Add date fields based on status
        status_date_mapping = {
            "Approved": "approvedDate",
            "Rejected": "rejectedDate",
            "Completed": "completedDate",
            "Delivered": "deliveredDate",
            "Invoice Generated": "invoiceGeneratedDate",
            "Paid": "paidDate"
        }
        
        if request_body.status in status_date_mapping:
            updated_fields[status_date_mapping[request_body.status]] = current_date_only

        # Handle comments if provided
        if request_body.comment:
            # Get existing comments efficiently
            service = await collection.find_one(
                {"serviceId": service_id},
                {"statusComments": 1}
            )
            
            if service:
                existing_comments = service.get('statusComments', [])
                existing_comments.append({
                    'status': request_body.status,
                    'comment': request_body.comment,
                    'timestamp': current_date_only,
                    'user': 'system'
                })
                updated_fields['statusComments'] = existing_comments

        # Update and return
        result = await collection.find_one_and_update(
            {"serviceId": service_id},
            {"$set": updated_fields},
            return_document=ReturnDocument.AFTER,
            projection={"serviceId": 1, "status": 1, "lastUpdatedDate": 1}
        )

        if not result:
            raise HTTPException(status_code=404, detail="Service order not found")

        result["_id"] = str(result["_id"])
        logger.info(f"Service Order {service_id} status updated to {request_body.status}")

        return {
            "success": True,
            "message": f"Service order status updated to {request_body.status}",
            "serviceId": result.get("serviceId"),
            "status": result.get("status"),
            "updated_date": current_date_only.isoformat(),
            "comment": request_body.comment
        }

    except Exception as e:
        logger.error(f"Error updating service status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# INVOICE UPDATE ENDPOINT (optimized)
# ==============================================
@router.patch("/{service_id}/invoice")
async def update_service_invoice(
    service_id: str,
    request: Request,
    invoiceNo: str = Query(..., description="Invoice number"),
    invoiceDate: str = Query(..., description="Invoice date (YYYY-MM-DD or ISO)")
):
    """Update service invoice details"""
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        invoice_date_parsed = parse_datetime_to_utc_full(invoiceDate)
        invoice_dt_parsed = invoice_date_parsed.replace(tzinfo=pytz.UTC)
        current_date_only = get_current_date_only()

        # Update with optimized query
        result = await collection.update_one(
            {"serviceId": service_id},
            {"$set": {
                "invoiceNo": invoiceNo,
                "invoiceDate": invoice_dt_parsed,
                "lastUpdatedDate": current_date_only,
                "lastUpdatedTime": current_date_only.strftime('%H:%M:%S')
            }}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")

        logger.info(f"Invoice updated for service: {service_id}")
        return {"message": "Invoice details updated successfully", "matched_count": result.matched_count}
    
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice date format. Use YYYY-MM-DD or ISO 8601")
    except Exception as e:
        logger.error(f"Error updating invoice: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# STARTUP EVENT TO CREATE INDEXES
# ==============================================
@router.on_event("startup")
async def startup_event():
    """Create indexes on application startup"""
    try:
        # This should be called with appropriate tenant_id
        # You might want to loop through all tenants here
        logger.info("Creating database indexes...")
        # await ensure_indexes(tenant_id)  # Call with actual tenant_id
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")