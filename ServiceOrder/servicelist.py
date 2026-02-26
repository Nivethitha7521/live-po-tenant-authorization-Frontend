from datetime import date, datetime, time
import json
import logging
import re
from typing import Any, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query,Request
import pytz
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from ServiceOrder.models import ServiceState, parse_datetime_to_utc_date_only
from ServiceOrder.utils import get_serviceworkorder_collection


router = APIRouter()
logger = logging.getLogger(__name__)

def parse_date_only(date_input: Optional[Any]) -> Optional[date]:
    """Parse date string/object to date object. Handles ISO, YYYY-MM-DD, datetime/date. Raises ValueError on invalid."""
    if date_input is None:
        return None
    try:
        # Use model's parser for consistency (handles ISO, str, datetime, date)
        dt = parse_datetime_to_utc_date_only(date_input)
        return dt.date()
    except ValueError as e:
        raise ValueError(f"Invalid date format: {date_input}. Use YYYY-MM-DD or ISO 8601 (e.g., 2025-12-09T00:00:00.000Z)")

def extract_service_number(service_id: str) -> int:
    """Extract numeric part from service ID (e.g., SR0001 -> 1, SR0006 -> 6)"""
    if not service_id:
        return 0
    # Extract digits from the string
    match = re.search(r'\d+', service_id)
    if match:
        return int(match.group())
    return 0

@router.get("/getServices/", response_model=List[ServiceState])
async def get_services( request: Request,
    status: Optional[str] = Query(None, description="Filter by status: Pending, Rejected, Approved, or empty for all"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=5000),
    vendorName: Optional[str] = Query(None),
    serviceId: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    workOrderFrom: Optional[str] = Query(None),
    workOrderTo: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("serviceId", description="Sort field: serviceId, createdDate, etc."),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_pending","read")
    )
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    """Get services with filtering options. SINGLE ENDPOINT for all statuses."""
    try:
        # Start with empty query - MongoDB will optimize
        query = {}
        
        # OPTIMIZATION: Always filter by status if provided
        if status and status.lower() != "all":
            query["status"] = {"$regex": f"^{status}$", "$options": "i"}
        
        # Build query with MongoDB operators for performance
        filter_conditions = []
        
        if vendorName:
            filter_conditions.append({"vendorName": {"$regex": f"^{vendorName}", "$options": "i"}})
        
        if serviceId:
            filter_conditions.append({"serviceId": {"$regex": f"^{serviceId}", "$options": "i"}})
        
        # Date range filtering - OPTIMIZED for indexes
        date_filters = []
        if fromDate:
            try:
                from_date_obj = parse_date_only(fromDate)
                from_dt_parsed = datetime.combine(from_date_obj, time.min).replace(tzinfo=pytz.UTC)
                date_filters.append({"createdDate": {"$gte": from_dt_parsed}})
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid fromDate format")
        
        if toDate:
            try:
                to_date_obj = parse_date_only(toDate)
                to_dt_parsed = datetime.combine(to_date_obj, time(23, 59, 59, 999999)).replace(tzinfo=pytz.UTC)
                date_filters.append({"createdDate": {"$lte": to_dt_parsed}})
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid toDate format")
        
        # Work order date filtering
        work_order_filters = []
        if workOrderFrom:
            try:
                from_date_obj = parse_date_only(workOrderFrom)
                from_dt_parsed = datetime.combine(from_date_obj, time.min).replace(tzinfo=pytz.UTC)
                work_order_filters.append({"workOrderDate": {"$gte": from_dt_parsed}})
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid workOrderFrom format")
        
        if workOrderTo:
            try:
                to_date_obj = parse_date_only(workOrderTo)
                to_dt_parsed = datetime.combine(to_date_obj, time(23, 59, 59, 999999)).replace(tzinfo=pytz.UTC)
                work_order_filters.append({"workOrderDate": {"$lte": to_dt_parsed}})
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid workOrderTo format")
        
        # COMBINE ALL FILTERS with $and for optimal query execution
        if filter_conditions or date_filters or work_order_filters:
            all_filters = []
            
            if query.get("status"):
                all_filters.append({"status": query["status"]})
            
            if filter_conditions:
                all_filters.extend(filter_conditions)
            
            if date_filters:
                if len(date_filters) > 1:
                    # Both fromDate and toDate
                    all_filters.append({
                        "$and": [
                            {"createdDate": {"$gte": date_filters[0]["createdDate"]["$gte"]}},
                            {"createdDate": {"$lte": date_filters[1]["createdDate"]["$lte"]}}
                        ]
                    })
                else:
                    all_filters.extend(date_filters)
            
            if work_order_filters:
                if len(work_order_filters) > 1:
                    # Both workOrderFrom and workOrderTo
                    all_filters.append({
                        "$and": [
                            {"workOrderDate": {"$gte": work_order_filters[0]["workOrderDate"]["$gte"]}},
                            {"workOrderDate": {"$lte": work_order_filters[1]["workOrderDate"]["$lte"]}}
                        ]
                    })
                else:
                    all_filters.extend(work_order_filters)
            
            # Final query with $and for better index usage
            if len(all_filters) == 1:
                query = all_filters[0]
            else:
                query = {"$and": all_filters}
        
        # DEBUG: Log the query for optimization
        logger.debug(f"🔍 MongoDB Query: {json.dumps(query, default=str)}")
        
        # Fetch services with projection for minimal data transfer
        projection = {
            "_id": 1,
            "serviceId": 1,
            "vendorId": 1,
            "vendorName": 1,
            "vendorContact": 1,
            "status": 1,
            "createdDate": 1,
            "workOrderDate": 1,
            "approvedDate": 1,
            "rejectedDate": 1,
            "invoiceDate": 1,
            "invoiceNo": 1,
            "notificationDate": 1,
            "totalAmount": 1,
            "paymentTerms": 1,
            "shippingAddress": 1,
            "billingAddress": 1,
            "comments": 1,
            "contactpersonEmail": 1,
            "address": 1,
            "country": 1,
            "state": 1,
            "city": 1,
            "locationName": 1,
            "freights": 1,
            "totalFreightAmount": 1,
            "totalFreightTaxAmount": 1,
            "totalTax": 1,
            # Array fields
            "descriptions": 1,
            "sacCode": 1,
            "desc_ids": 1,
            "from_dates": 1,
            "to_dates": 1,
            "fees": 1,
            "remarks": 1,
            "quantity": 1,
            "desc_tax_types": 1,
            "desc_tax_pers": 1,
            "desc_sgst": 1,
            "desc_cgst": 1,
            "desc_igst": 1,
            "desc_tax_amounts": 1,
            "desc_totals": 1,
            "desc_total_fees": 1,
            "totalDiscount": 1,
            "desc_discount_amounts": 1,
            "desc_overall_discounts": 1,
            "desc_discount_percentages": 1,
            "base_amounts": 1,
            "include_tax": 1,
            "desc_individual_discount_amounts": 1,
            "desc_individual_discount_percentages": 1,
        }
        
        # Determine sort order
        if sort_by == "serviceId" and sort_order == "desc":
            # For serviceId descending, we need to sort by the numeric part
            # First get all matching documents
            cursor = collection.find(query, projection)
            services = []
            async for doc in cursor:
                doc["mongoId"] = str(doc["_id"])
                
                # Format dates only if needed
                date_fields = ['workOrderDate', 'approvedDate', 'rejectedDate', 'invoiceDate']
                for field in date_fields:
                    if doc.get(field) and isinstance(doc[field], datetime):
                        doc[field] = doc[field].strftime('%Y-%m-%d')
                
                # Add default values for any missing required fields
                required_fields_with_defaults = {
                    'vendorId': '',
                    'vendorContact': '',
                    'invoiceNo': '',
                    'paymentTerms': '',
                    'shippingAddress': '',
                    'billingAddress': '',
                    'comments': '',
                    'contactpersonEmail': '',
                    'address': '',
                    'country': '',
                    'state': '',
                    'city': '',
                    'locationName': '',
                    'sacCode': [],
                    'desc_ids': [],
                    'from_dates': [],
                    'to_dates': [],
                    'fees': [],
                    'remarks': [],
                    'quantity': [],
                    'desc_tax_types': [],
                    'desc_tax_pers': [],
                    'desc_sgst': [],
                    'desc_cgst': [],
                    'desc_igst': [],
                    'desc_tax_amounts': [],
                    'desc_totals': [],
                    'desc_total_fees': [],
                    'desc_discount_amounts': [],
                    'desc_overall_discounts': [],
                    'desc_discount_percentages': [],
                    'freights': [],
                    'termsandConditions': [],
                    'totalFreightAmount': 0,
                    'totalFreightTaxAmount': 0,
                    'roundOffValue': 0,
                    'overallDiscountValue': 0,
                    'overallDiscountType': 'percentage',
                    'overallDiscountAppliedOn': 'after_tax',
                    'totalTax': 0,
                    'serviceCreatedPerson': None,
                    'serviceApprovedPerson': None,
                    'serviceRejectedPerson': None,
                    'imageUrl': '',
                    'createdTime': None,
                    'lastUpdatedDate': None,
                    'lastUpdatedTime': None,
                    'creditLimit': 0,
                    'include_tax': [],
                    'desc_individual_discount_amounts': [],
                    'desc_individual_discount_percentages': [],
                }
                
                for field, default_value in required_fields_with_defaults.items():
                    if field not in doc:
                        doc[field] = default_value
                
                # Add numeric value for sorting
                doc["_serviceNumber"] = extract_service_number(doc.get("serviceId", ""))
                services.append(doc)
            
            # Sort by service number in descending order
            services.sort(key=lambda x: x["_serviceNumber"], reverse=True)
            
            # Apply skip and limit
            paginated_services = services[skip:skip + limit]
            
            # Convert to ServiceState objects
            result_services = []
            for doc in paginated_services:
                # Remove temporary sorting field
                if "_serviceNumber" in doc:
                    del doc["_serviceNumber"]
                try:
                    service_obj = ServiceState(**doc)
                    result_services.append(service_obj)
                except Exception as model_error:
                    logger.error(f"🔥 Pydantic error creating ServiceState: {str(model_error)}")
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Data validation error: {str(model_error)}"
                    )
            
            total_count = len(services)
            logger.info(f"✅ Retrieved {len(result_services)}/{total_count} service orders with status={status} (sorted by serviceId DESC - highest number first)")
            return result_services
            
        else:
            # Default sorting (by createdDate DESC)
            sort_direction = -1 if sort_order.lower() == "desc" else 1
            sort_field = sort_by if sort_by != "serviceId" else "createdDate"  # Default to createdDate for other cases
            
            cursor = (
                collection
                .find(query, projection)
                .sort(sort_field, sort_direction)
                .skip(skip)
                .limit(limit)
            )
            
            # Use batch processing for large datasets
            services = []
            async for doc in cursor:
                # Minimal processing in the loop
                doc["mongoId"] = str(doc["_id"])
                
                # Format dates only if needed
                date_fields = ['workOrderDate', 'approvedDate', 'rejectedDate', 'invoiceDate']
                for field in date_fields:
                    if doc.get(field) and isinstance(doc[field], datetime):
                        doc[field] = doc[field].strftime('%Y-%m-%d')
                
                # Add default values for any missing required fields
                required_fields_with_defaults = {
                    'vendorId': '',
                    'vendorContact': '',
                    'invoiceNo': '',
                    'paymentTerms': '',
                    'shippingAddress': '',
                    'billingAddress': '',
                    'comments': '',
                    'contactpersonEmail': '',
                    'address': '',
                    'country': '',
                    'state': '',
                    'city': '',
                    'locationName': '',
                    'sacCode': [],
                    'desc_ids': [],
                    'from_dates': [],
                    'to_dates': [],
                    'fees': [],
                    'remarks': [],
                    'quantity': [],
                    'desc_tax_types': [],
                    'desc_tax_pers': [],
                    'desc_sgst': [],
                    'desc_cgst': [],
                    'desc_igst': [],
                    'desc_tax_amounts': [],
                    'desc_totals': [],
                    'desc_total_fees': [],
                    'desc_discount_amounts': [],
                    'desc_overall_discounts': [],
                    'desc_discount_percentages': [],
                    'freights': [],
                    'termsandConditions': [],
                    'totalFreightAmount': 0,
                    'totalFreightTaxAmount': 0,
                    'roundOffValue': 0,
                    'overallDiscountValue': 0,
                    'overallDiscountType': 'percentage',
                    'overallDiscountAppliedOn': 'after_tax',
                    'totalTax': 0,
                    'serviceCreatedPerson': None,
                    'serviceApprovedPerson': None,
                    'serviceRejectedPerson': None,
                    'imageUrl': '',
                    'createdTime': None,
                    'lastUpdatedDate': None,
                    'lastUpdatedTime': None,
                    'creditLimit': 0,
                    'include_tax': [],
                    'desc_individual_discount_amounts': [],
                    'desc_individual_discount_percentages': [],
                }
                
                for field, default_value in required_fields_with_defaults.items():
                    if field not in doc:
                        doc[field] = default_value
                
                try:
                    service_obj = ServiceState(**doc)
                    services.append(service_obj)
                except Exception as model_error:
                    logger.error(f"🔥 Pydantic error creating ServiceState: {str(model_error)}")
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Data validation error: {str(model_error)}"
                    )
            
            # Get total count for pagination
            total_count = await collection.count_documents(query)
            
            logger.info(f"✅ Retrieved {len(services)}/{total_count} service orders with status={status} (sorted by {sort_field} {sort_order})")
            
            return services
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"🔥 Error fetching services: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/getOutgoing/{identifier}", response_model=ServiceState)
async def get_service_by_identifier(
    identifier: str,
    request: Request,
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    """
    Fetch a single service order by either serviceId (e.g., SR0001) or MongoDB _id.
    Used for the Service Dialog in frontend when user clicks on a service row.
    """
    try:
        service = None

        # First try by serviceId (human-readable ID like SR0001)
        service = await collection.find_one({"serviceId": identifier})

        # If not found, try by MongoDB ObjectId
        if not service:
            try:
                obj_id = ObjectId(identifier)
                service = await collection.find_one({"_id": obj_id})
            except Exception:
                pass  # Invalid ObjectId format, ignore

        if not service:
            raise HTTPException(status_code=404, detail=f"Service with ID {identifier} not found")

        # Convert _id to string for frontend
        service["_id"] = str(service["_id"])
        service["mongoId"] = str(service["_id"])  # Optional: keep both if needed

        # Format datetime fields to ISO string for consistent frontend handling
        date_fields = [
            'createdDate', 'lastUpdatedDate', 'workOrderDate',
            'approvedDate', 'rejectedDate', 'invoiceDate'
        ]
        for field in date_fields:
            if service.get(field) and isinstance(service[field], datetime):
                service[field] = service[field].isoformat()

        # Handle from_dates and to_dates arrays
        if service.get("from_dates"):
            service["from_dates"] = [
                d.isoformat() if isinstance(d, datetime) else None
                for d in service["from_dates"]
            ]
        if service.get("to_dates"):
            service["to_dates"] = [
                d.isoformat() if isinstance(d, datetime) else None
                for d in service["to_dates"]
            ]

        logger.info(f"Service fetched successfully: {service.get('serviceId')}")

        return ServiceState(**service)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching service {identifier}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")