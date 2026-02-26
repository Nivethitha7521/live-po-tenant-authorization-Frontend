# New endpoint for summary view (limited fields, initial small pagination)
from typing import Optional
from fastapi import APIRouter, Query
from Service.models import PaginatedServiceSummary, ServiceSummary
from utils.database import get_service_collection
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from fastapi import Request

router = APIRouter()

@router.get("/summary/paginatedsummary", response_model=PaginatedServiceSummary)
async def get_service_summary(request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(5, ge=1, le=50, description="Items per page (initially 5, max 50 for pagination)"),
    status: Optional[str] = Query("active", description="Filter by status (active, deactivated, or all)"),
    search: Optional[str] = Query(None, description="Search term for saccode (prefix search)"),
    user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "service", "read"))
):
    
    
    """
    Get paginated service summary with prefix search on saccode.
    
    Search examples:
    - Search "9" → returns all saccodes starting with 9 (900909, 98899, 999999, 9997877)
    - Search "99" → returns all saccodes starting with 99 (999999, 9997877)
    - Search "999" → returns all saccodes starting with 999 (999999, 9997877)
    - Search "9997" → returns saccodes starting with 9997 (9997877)
    """
    tenant_id = request.state.tenant_id
    collection = get_service_collection(tenant_id)
    skip = (page - 1) * limit
    
    # Build match filter
    match_filter = {}
    
    # Status filter
    if status != "all":
        match_filter["status"] = status
    
    # Search filter for saccode prefix
    if search and search.strip():
        search_term = search.strip()
        
        # Convert search term to string for regex matching
        search_str = str(search_term)
        
        # Create regex for prefix search (starts with)
        # '^' means start of string
        # We need to handle saccode as string for regex to work properly
        
        # Method 1: Using $expr to convert saccode to string and apply regex
        # This works whether saccode is stored as number or string
        match_filter["$expr"] = {
            "$regexMatch": {
                "input": {"$toString": "$saccode"},  # Convert to string
                "regex": f"^{search_str}",  # Prefix match
                "options": "i"  # Case-insensitive
            }
        }
        
        # Alternative: If saccode is stored as string in DB
        # match_filter["saccode"] = {
        #     "$regex": f"^{search_str}",
        #     "$options": "i"
        # }
    
    # Create aggregation pipeline
    pipeline = [
        {"$match": match_filter},
        {"$sort": {"serviceId": 1}},  # Sort by serviceId ascending
        {"$project": {
            "serviceId": 1,
            "saccode": 1,
            "serviceName":1,
            "_id": 1  # Keep _id for mongoId conversion
        }},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    # Execute aggregation
    services_cursor = collection.aggregate(pipeline)
    services = [item async for item in services_cursor]
    
    # Get total count with the same filter
    total = await collection.count_documents(match_filter)
    
    # Format services: convert _id to mongoId string
    formatted_services = []
    for service in services:
        service_copy = service.copy()
        # Convert ObjectId to string
        service_copy["mongoId"] = str(service["_id"])
        # Remove _id to avoid Pydantic validation issues
        del service_copy["_id"]
        # Validate with ServiceSummary model
        formatted_services.append(ServiceSummary.model_validate(service_copy))
    
    # Calculate total pages
    total_pages = (total + limit - 1) // limit if limit > 0 else 0
    
    # Return paginated response
    return PaginatedServiceSummary(
        data=formatted_services,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )