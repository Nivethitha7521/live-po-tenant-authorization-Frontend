import importlib
import logging
from fastapi import FastAPI, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from bson import ObjectId
from fastapi import HTTPException
from fastapi.security import HTTPBasic,HTTPBasicCredentials
from logincheck.utils import fix_all_users_sessions
from logincheck.clean_service import inactivity_cleanup
from bcrypt import hashpw, gensalt, checkpw
from jose import jwt, JWTError
from motor.motor_asyncio import AsyncIOMotorClient
from uuid import uuid4
from datetime import datetime
from fastapi import Request
from fastapi import Depends
from dependencies.auth import validate_token
from fastapi.openapi.utils import get_openapi
from routes.role_routes import router as role_router
from routes.permission_routes import router as permission_router
from routes.user_routes import router as user_router
from dotenv import load_dotenv
from middleware.tenant_middleware import TenantMiddleware

load_dotenv()   # <-- THIS LINE IS CRITICAL
import os


# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting app with inactivity cleanup")

    # Fix null sessions
    await fix_all_users_sessions()

    # Start cleanup
    cleanup_task = asyncio.create_task(inactivity_cleanup.start())

    yield

    print("🛑 Shutting down cleanup")
    inactivity_cleanup.stop()
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
# Create the FastAPI app
app = FastAPI(
    title="Combined Role Management + YEN ERP API",
    docs_url="/purchasetestapi/docs",
    redoc_url="/purchasetestapi/redoc",
    openapi_url="/purchasetestapi/openapi.json",
    lifespan=lifespan
) 
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="Combined Role Management + YEN ERP purchasetestapi",
        routes=app.routes,
    )

    # ✅ Ensure components exist
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}

    # ✅ Ensure securitySchemes exist
    if "securitySchemes" not in openapi_schema["components"]:
        openapi_schema["components"]["securitySchemes"] = {}

    # ✅ Add HTTP Bearer JWT Scheme
    openapi_schema["components"]["securitySchemes"]["HTTPBearer"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
    openapi_schema["components"]["securitySchemes"].pop("HTTPBasic", None)
    # ✅ Apply globally to all endpoints
    openapi_schema["security"] = [{"HTTPBearer": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema
app.openapi = custom_openapi
app.add_middleware(TenantMiddleware)
@app.middleware("http")
async def update_last_active(request: Request, call_next):
    response = await call_next(request)

    auth_header = request.headers.get("Authorization")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

        try:
            token_data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

            await db_global["sessions"].update_one(
                {
                    "username": token_data["username"],
                    "tenant_id": token_data.get("tenant_id"),
                    "is_active": True
                },
                {"$set": {"last_active": datetime.utcnow()}}
            )
        except:
            pass

    return response
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(role_router, prefix="/purchasetestapi", tags=["Roles"])
app.include_router(permission_router, prefix="/purchasetestapi", tags=["Permissions"])
app.include_router(user_router, prefix="/purchasetestapi", tags=["Users"])

# =============================================
# PART 2: YEN ERP PURCHASE ROUTES
# =============================================
# ✅ ADD THIS: Debug function to check module imports
def debug_module_import(module_name: str):
    """Debug function to check if module can be imported"""
    try:
        logger.info(f"🟡 Attempting to import: {module_name}")
        module = importlib.import_module(module_name)
        logger.info(f"✅ Successfully imported: {module_name}")
        
        # Check if router exists
        if hasattr(module, 'router'):
            logger.info(f"✅ Router found in: {module_name}")
            return module.router
        else:
            logger.error(f"❌ No router found in: {module_name}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Failed to import {module_name}: {str(e)}")
        return None
# List of route configuration dictionaries.
# Each dictionary contains the module path (where your router is defined),
# the prefix for the routes, and tags for the OpenAPI docs.
routes_info = [
    # Purchase-related routes
    {"module": "Tenant.routes", "prefix": "/purchasetestapi/tenants", "tags": ["Tenants"]},
    {"module": "settings.settings_routes", "prefix": "/purchasetestapi/purchasesettings", "tags": ["purchasesetting"]},
    {"module": "Tenant.tenant_image_upload", "prefix": "/purchasetestapi/tenants-images", "tags": ["Tenants-images"]},
    {"module": "vendortype.routes", "prefix": "/purchasetestapi/vendortypes", "tags": ["vendortypes"]},
    {"module": "purchasecategory.routes", "prefix": "/purchasetestapi/purchasecategories", "tags": ["purchasecategories"]},
    {"module": "purchasesubcategory.routes", "prefix": "/purchasetestapi/purchasesubcategories", "tags": ["purchasesubcategories"]},
    {"module": "purchaseuom.routes", "prefix": "/purchasetestapi/purchaseuoms", "tags": ["purchaseuoms"]},
    {"module": "purchaseitem.routes", "prefix": "/purchasetestapi/rawMaterials", "tags": ["rawMaterials"]},
    {"module": "purchasetax.routes", "prefix": "/purchasetestapi/purchasetaxes", "tags": ["purchasetaxes"]},
    {"module": "StorageLocation.routes", "prefix": "/purchasetestapi/storagelocations", "tags": ["storagelocations"]},
    {"module": "Vendor.routes", "prefix": "/purchasetestapi/vendors", "tags": ["vendors"]},
    {"module": "itemtype.routes", "prefix": "/purchasetestapi/itemtypes", "tags": ["itemtypes"]},
    {"module": "Service.routes", "prefix": "/purchasetestapi/services", "tags": ["service"]},
    {"module": "purchaseOrder.routes", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
    {"module": "purchaseOrder.photo_routes", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
    {"module":"purchaseOrder.overall_discount", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
    {"module":"purchaseOrder.grnOverallDis", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
    {"module": "purchaseOrder.po_to_grn", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
    {"module": "purchaseOrder.grnConverted", 
 "prefix": "/purchasetestapi/purchaseorders",
 "tags": ["purchaseorders"]},
    {"module": "purchaseOrder.poedit", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
     {"module": "purchaseOrder.freightfunction", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
      {"module": "purchaseOrder.pending", "prefix": "/purchasetestapi/purchaseorders", "tags": ["purchaseorders"]},
    {"module": "grn.routes", "prefix": "/purchasetestapi/grns", "tags": ["grns"]},
    {"module": "grn.return", "prefix": "/purchasetestapi/grns", "tags": ["grns"]},
    {"module": "grn.grn_to_ap", "prefix": "/purchasetestapi/grns", "tags": ["grns"]},
    {"module": "grn.debitnote", "prefix": "/purchasetestapi/debitnote", "tags": ["debitnote"]},
    {"module": "grn.grn_to_ap_outgoing", "prefix": "/purchasetestapi/grns", "tags": ["grns"]}, 
    {"module": "grn.grn_to_po", "prefix": "/purchasetestapi/grns", "tags": ["grns"]},
    {"module": "apinvoice.routes", "prefix": "/purchasetestapi/apinvoices", "tags": ["apinvoices"]},
    {"module": "apinvoice.ap_to_outgoing", "prefix": "/purchasetestapi/apinvoices", "tags": ["apinvoices"]},
    {"module": "apinvoice.apReturned", "prefix": "/purchasetestapi/apinvoices", "tags": ["apinvoices"]},
    {"module": "outgoingPayment.routes", "prefix": "/purchasetestapi/outgoingpayments", "tags": ["outgoingpayments"]},
    {"module": "outgoingPayment.bulk_payment", "prefix": "/purchasetestapi/outgoingpayments", "tags": ["outgoingpayments"]},
    {"module": "outgoingPayment.vendor_ledger", "prefix": "/purchasetestapi/outgoingpayments", "tags": ["outgoingpayments"]},
    {"module": "outgoingPayment.single_payment", "prefix": "/purchasetestapi/outgoingpayments", "tags": ["outgoingpayments"]},
    {"module": "outgoingPayment.payment_history", "prefix": "/purchasetestapi/outgoingpayments", "tags": ["outgoingpayments"]},
    {"module": "outgoingPayment.advance_routes", "prefix": "/purchasetestapi/advancevendor", "tags": ["advancevendor"]},
    {"module": "Business.routes", "prefix": "/purchasetestapi/pobusiness", "tags": ["business"]},
    {"module": "Personal.routes", "prefix": "/purchasetestapi/popersonals", "tags": ["popersonals"]},
    {"module": "shippingaddress.routes", "prefix": "/purchasetestapi/poshippingaddress", "tags": ["shippingaddress"]},
    {"module" :"ItemGroup.routes","prefix" : "/purchasetestapi/itemgroups","tags" :["itemgroups"]},
    {"module" :"FreightMaster.routes","prefix" : "/purchasetestapi/freights","tags" :["freights"]},
	{"module" :"purchaseOrder.poimport","prefix" : "/purchasetestapi/poimport","tags" :["poimport"]},
    {"module" :"ServiceOrder.routes","prefix" : "/purchasetestapi/servicepo","tags" :["servicepo"]},
    {"module" :"Service.serviceSummary","prefix":"/purchasetestapi/services","tags":["service"]},
    {"module" :"ServiceOrder.servicelist","prefix":"/purchasetestapi/servicepo","tags":["servicepo"]},
    {"module" :"ServiceOrder.filterpatch","prefix":"/purchasetestapi/servicepo","tags":["servicepo"]},
    {"module" :"ServiceOrder.service_ap_outgoing","prefix":"/purchasetestapi/servicepo","tags":["servicepo"]},
]
# ✅ Include YEN ERP routers
for route in routes_info:
    try:
        router = debug_module_import(route["module"])
        if router:
            app.include_router(router, prefix=route["prefix"], tags=route["tags"])
            logger.info(f"✅ Included YEN ERP: {route['module']}")
    except Exception as e:
        logger.error(f"❌ Failed to include {route['module']}: {e}")

# =============================================
# COMMON ENDPOINTS
# =============================================

@app.get("/purchasetestapi/health")
async def health_check():
    return {"status": "healthy", "services": ["role-management", "yenerp-purchase"]}

# =============================================
# IMPORTANT: Update database.py
# =============================================
# Create a new database.py that works for both:
"""
from motor.motor_asyncio import AsyncIOMotorClient

# Same MongoDB connection for both
MONGO_URL = "mongodb://purchasetestuser:qv8D%25%3AWZG%7DRmW%3B%5Du@194.233.78.90:27017/purchasetest?authSource=purchasetest&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster"
DB_NAME = "purchasetest"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Optional: Create separate references for different collections
role_db = db  # uses 'roles', 'permissions', 'users' collections
purchase_db = db  # uses other collections like 'vendors', 'purchaseorders', etc.
"""


security = HTTPBasic()
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )
def create_access_token(data: dict) -> str:
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

# JWT settings
SECRET_KEY = "492e0b54a3130055fe6c0b698127ffa904069f189b467ab6564471b2d4840550"
ALGORITHM = "HS256"
# Central Mongo connection
MONGO_URL = "mongodb://purchasetestuser:qv8D%25%3AWZG%7DRmW%3B%5Du@194.233.78.90:27017/purchasetest?authSource=purchasetest&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster"
client_global = AsyncIOMotorClient(MONGO_URL)
db_global = client_global["purchasetest"]




@app.post("/purchasetestapi/login")
async def login_user(
    credentials: HTTPBasicCredentials = Depends(security),
    tenant_id: str = Header(...),
    x_browser_session_id: str = Header(...),
    request: Request = None
):
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client["purchasetest"]

        # 🔍 Validate user
        user = await db["users"].find_one({"username": credentials.username})
        if not user or not verify_password(credentials.password, user["password"]):
            raise HTTPException(status_code=401, detail="Incorrect username or password")

        if user.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Your account is deactivated")

        # 🔍 Validate tenant
        tenant = await db["tenants"].find_one({"_id": ObjectId(tenant_id)})
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        if tenant.get("status") != "active":
            raise HTTPException(status_code=403, detail="Tenant inactive")

        existing_session = await db_global["sessions"].find_one({
            "username": user["username"],
            "tenant_id": tenant_id,
            "is_active": True
        })

        # ⭐ IF ACTIVE SESSION EXISTS
        if existing_session:
            stored_browser = existing_session.get("browser_session_id")

            # ✅ SAME BROWSER → UPDATE TOKEN ONLY
            if stored_browser == x_browser_session_id:
                permission = await db["permissions"].find_one({"role_name": user["role_name"]})

                access_token = create_access_token({
                    "username": user["username"],
                    "role_name": user["role_name"],
                    "permissions": permission["permissions"] if permission else {},
                    "tenant_id": tenant_id
                })

                await db_global["sessions"].update_one(
                    {"_id": existing_session["_id"]},
                    {
                        "$set": {
                            "access_token": access_token,
                            "last_active": datetime.utcnow()
                        }
                    }
                )

                return {
                    "access_token": access_token,
                    "token_type": "bearer",
                    "username": user["username"],
                    "role_name": user["role_name"],
                    "permissions": permission["permissions"] if permission else {}
                }

            # ❌ DIFFERENT BROWSER → BLOCK
            else:
                raise HTTPException(status_code=403, detail="User already logged in another browser")

        # ⭐ NO ACTIVE SESSION → CREATE OR REACTIVATE
        permission = await db["permissions"].find_one({"role_name": user["role_name"]})

        access_token = create_access_token({
            "username": user["username"],
            "role_name": user["role_name"],
            "permissions": permission["permissions"] if permission else {},
            "tenant_id": tenant_id
        })

        device = request.headers.get("user-agent", "unknown")
        ip = request.client.host if request else "unknown"

        # 👉 UPSERT by username + tenant
        await db_global["sessions"].update_one(
            {"username": user["username"], "tenant_id": tenant_id},
            {
                "$set": {
                    "browser_session_id": x_browser_session_id,
                    "access_token": access_token,
                    "device": device,
                    "ip": ip,
                    "last_active": datetime.utcnow(),
                    "is_active": True
                },
                "$setOnInsert": {
                    "session_id": str(uuid4()),
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "username": user["username"],
            "role_name": user["role_name"],
            "permissions": permission["permissions"] if permission else {}
        }

    except HTTPException as e:
        raise e

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")


@app.post("/purchasetestapi/logout")
async def logout(request: Request, x_browser_session_id: str = Header(None)):
    try:
        auth_header = request.headers.get("Authorization")

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

            try:
                token_data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

                await db_global["sessions"].update_one(
                    {
                        "username": token_data["username"],
                        "tenant_id": token_data.get("tenant_id"),
                        "browser_session_id": x_browser_session_id,
                        "is_active": True
                    },
                    {"$set": {"is_active": False, "last_active": datetime.utcnow()}}
                )

            except Exception as e:
                logger.error(f"Logout decode error: {e}")

        return {"message": "Logged out successfully"}

    except Exception as e:
        logger.error(f"Logout error: {e}")
        return {"message": "Logged out"}


@app.get("/purchasetestapi/validate-token")
async def validate_token_api(token: str):
    """Validate JWT token"""
    try:
        # Decode token
        token_data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = token_data["username"]
        tenant_id = token_data.get("tenant_id") 
        # Connect to database
        client = AsyncIOMotorClient("mongodb://purchasetestuser:qv8D%25%3AWZG%7DRmW%3B%5Du@194.233.78.90:27017/purchasetest?authSource=purchasetest&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster")
        db = client["purchasetest"]
        
        # Get user and permissions
        user = await db["users"].find_one({"username": username})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        permission = await db["permissions"].find_one({"role_name": user["role_name"]})
        
        client.close()
        
        return {
            "valid": True,
            "username": username,
            "role_name": user["role_name"],
            "permissions": permission["permissions"] if permission else {},
            "tenant_id": tenant_id
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
   



    
# A simple root endpoint
@app.get("/")
def read_root():
    return {"message": "YEN ERP"}




