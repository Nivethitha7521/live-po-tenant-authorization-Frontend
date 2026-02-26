# middleware/tenant_middleware.py
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, Dict, Any
import logging
from bson import ObjectId
import re
from jose import jwt
from utils.database import SECRET_KEY, ALGORITHM

from utils.database import get_tenant_collection 

logger = logging.getLogger(__name__)

class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle tenant-specific routing and database access.
    Extracts tenant_id from request headers or path parameters.
    """
    
    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc", 
            "/openapi.json",
            "/purchasetestapi/login",
            "/purchasetestapi/tenants/"
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Check if path should be excluded from tenant processing
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        tenant_id = None
        tenant_database = None
        
        try:
           # 🔥 Extract tenant_id from JWT
         auth_header = request.headers.get("authorization")

         if auth_header and auth_header.startswith("Bearer "):
           token = auth_header.split(" ")[1]
           try:
              payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
              tenant_id = payload.get("tenant_id")
           except Exception:
              raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

            
         if tenant_id:
                # Validate tenant_id format
                if not ObjectId.is_valid(tenant_id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid tenant ID format"
                    )
                
                # Verify tenant exists and get database name
                tenant = get_tenant_collection().find_one({"_id": ObjectId(tenant_id)})
                if not tenant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Tenant not found"
                    )
                
                tenant_database = tenant.get("databaseName")
                if not tenant_database:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Tenant database not configured"
                    )
                
                # Store tenant info in request state for use in routes
                request.state.tenant_id = tenant_id
                request.state.tenant_database = tenant_database
                request.state.tenant_name = tenant.get("tenantName")
                
                logger.info(f"Tenant context set: {tenant_id} -> {tenant_database}")
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in tenant middleware: {str(e)}")
            # Don't block the request, just log the error
            # Some routes might not need tenant context
        
        # Continue with the request
        response = await call_next(request)
        return response
    
    async def _extract_tenant_from_path(self, request: Request) -> Optional[str]:
        """
        Extract tenant_id from URL path patterns
        """
        path = request.url.path
        
        # Pattern: /purchaseapi/tenants/{tenant_id}/...
        if path.startswith("/purchasetestapi/tenants/"):
            parts = path.split("/")
            if len(parts) > 3:
                tenant_part = parts[3]
                # Check if it looks like an ObjectId (24 hex chars)
                if re.match(r'^[0-9a-fA-F]{24}$', tenant_part):
                    return tenant_part
        
        # Add more patterns as needed for other routes
        # For example: /purchaseapi/vendors?tenant_id={tenant_id}
        # Would be handled by query parameters
        
        return None