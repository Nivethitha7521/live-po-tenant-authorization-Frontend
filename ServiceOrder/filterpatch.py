import logging
import re
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends,Request
from ServiceOrder.models import ServiceInvoiceNo, ServiceServiceId, ServiceState
from ServiceOrder.routes import get_current_date_only
from ServiceOrder.utils import get_serviceworkorder_collection

# Define router with proper configuration
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Service Purchase Orders API"}

@router.get("/debug/routes")
async def debug_routes():
    """Debug endpoint to see all routes"""
    routes = []
    for route in router.routes:
        routes.append({
            "path": route.path,
            "name": route.name,
            "methods": route.methods
        })
    return {
        "router_prefix": router.prefix,
        "routes": routes
    }

@router.get("/getServiceIds/", response_model=List[ServiceServiceId])
async def get_service_ids(request:Request,
    query: Optional[str] = Query(None, description="Search query for serviceId"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return")
):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    """Get ALL service IDs without status filtering"""
    try:
        logger.info(f"Fetching ALL service IDs with query='{query}', skip={skip}, limit={limit}")
      
        
        # Build query - NO STATUS FILTER
        mongo_query = {}
        
        if query and query.strip():
            cleaned_query = query.strip().upper()
            
            # Handle different input patterns
            if cleaned_query.startswith('SR'):
                # User typed SR0, SR00, SR000, etc.
                # Search for service IDs starting with exactly what user typed
                search_pattern = f"^{re.escape(cleaned_query)}.*"
            elif cleaned_query.isdigit():
                # User typed just numbers (0, 00, 000, 0001, etc.)
                # Search for service IDs starting with SR followed by those numbers
                search_pattern = f"^SR.*{re.escape(cleaned_query)}.*"
            else:
                # Any other pattern (mixed letters/numbers)
                # Try to find service IDs containing the pattern
                search_pattern = f".*{re.escape(cleaned_query)}.*"
            
            # Search pattern - use case-insensitive search
            mongo_query["serviceId"] = {
                "$regex": search_pattern,
                "$options": "i"
            }
        
        # Debug logging
        logger.info(f"Search query: '{query}', MongoDB query: {mongo_query}")
        
        # Execute query
        cursor = collection.find(
            mongo_query,
            {"_id": 1, "serviceId": 1}
        ).sort("serviceId", 1).skip(skip).limit(limit)
        
        results = await cursor.to_list(length=limit)
        
        # Format response
        service_ids = []
        for item in results:
            try:
                mongo_id = str(item.get("_id", ""))
                service_id = item.get("serviceId", "")
                
                # Include ALL records, even if serviceId is empty
                service_ids.append({
                    "mongoId": mongo_id,
                    "serviceId": service_id or ""  # Empty string if missing
                })
            except Exception as e:
                logger.warning(f"Error processing item: {e}")
                continue
        
        logger.info(f"Successfully retrieved {len(service_ids)} service IDs")
        return service_ids
        
    except Exception as e:
        logger.error(f"Error fetching service IDs: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal Server Error: {str(e)}"
        )
    


@router.patch("/deactivated/{mongo_id}")
async def deactivate_service(mongo_id: str,request:Request,
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_rejected","delete")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)
    """Force set status to Deactivated for ANY service order"""
    try:
        logger.info(f"Deactivating service order with mongo_id: {mongo_id}")
        
        # Validate MongoDB ID format
        try:
            obj_id = ObjectId(mongo_id)
        except Exception:
            logger.error(f"Invalid mongoId format: {mongo_id}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid mongoId format. Must be a valid ObjectId."
            )

     
        # Check if ANY document exists with this ID
        existing_doc = await collection.find_one({"_id": obj_id})
        if not existing_doc:
            logger.error(f"No document found with ID: {mongo_id}")
            raise HTTPException(
                status_code=404, 
                detail=f"No service order found with ID: {mongo_id}"
            )

        # Get current service info for logging
        service_id = existing_doc.get("serviceId", "Unknown")
        current_status = existing_doc.get("status", "Unknown")
        logger.info(f"Deactivating Service Order: {service_id} (current status: {current_status})")

        # Get current date
        current_date = get_current_date_only()
        
        # Prepare update - set status to Deactivated
        update_data = {
            "status": "Deactivated",
            "deactivatedDate": current_date,
            "lastUpdatedDate": current_date,
            "lastUpdatedTime": datetime.now().strftime("%H:%M:%S"),
        }

        # Perform update
        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": update_data},
            return_document=True
        )

        if not result:
            logger.error(f"Failed to update service order: {mongo_id}")
            raise HTTPException(
                status_code=500, 
                detail="Failed to update service order"
            )

        # Convert ObjectId to string for response
        result["_id"] = str(result["_id"])
        
        logger.info(f"Successfully deactivated service order: {result.get('serviceId', 'Unknown')}")
        
        return {
            "success": True,
            "message": "Service order set to Deactivated",
            "updated_document": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating service order: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )

@router.patch("/pending/{mongo_id}")
async def pending_service(mongo_id: str,request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_approved","edit")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)
    """Force set status to Pending for ANY service order"""
    try:
        logger.info(f"Setting service order to pending with mongo_id: {mongo_id}")
        
        # Validate MongoDB ID format
        try:
            obj_id = ObjectId(mongo_id)
        except Exception:
            logger.error(f"Invalid mongoId format: {mongo_id}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid mongoId format. Must be a valid ObjectId."
            )

    
        # Check if document exists
        existing_doc = await collection.find_one({"_id": obj_id})
        if not existing_doc:
            logger.error(f"No document found with ID: {mongo_id}")
            raise HTTPException(
                status_code=404, 
                detail=f"No service order found with ID: {mongo_id}"
            )

        # Get current info for logging
        service_id = existing_doc.get("serviceId", "Unknown")
        current_status = existing_doc.get("status", "Unknown")
        logger.info(f"Setting to Pending: {service_id} (current status: {current_status})")

        # Get current date
        current_date = get_current_date_only()
        
        # Prepare update - set status to Pending
        update_data = {
            "status": "Pending",
            "lastUpdatedDate": current_date,
            "lastUpdatedTime": datetime.now().strftime("%H:%M:%S"),
            "deactivatedDate": None,  # Clear deactivation date
        }

        # Perform update
        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": update_data},
            return_document=True
        )

        if not result:
            logger.error(f"Failed to update service order: {mongo_id}")
            raise HTTPException(
                status_code=500, 
                detail="Failed to update service order"
            )

        # Convert ObjectId to string
        result["_id"] = str(result["_id"])
        
        logger.info(f"Successfully set service order to pending: {result.get('serviceId', 'Unknown')}")
        
        return {
            "success": True,
            "message": "Service order set to Pending",
            "updated_document": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting service order to Pending: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )