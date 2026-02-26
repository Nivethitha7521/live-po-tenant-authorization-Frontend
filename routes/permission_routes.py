from fastapi import APIRouter, HTTPException
from database import db
from models.permission_model import Permission, PartialPermissionUpdate
from bson import ObjectId

router = APIRouter()

@router.get("/permissions")
async def get_permissions():
    permissions = await db["permissions"].find().to_list(None)
    for p in permissions:
        p["_id"] = str(p["_id"])
    return permissions

@router.get("/permissions/{role_name}")
async def get_permission_by_role(role_name: str):
    permission = await db["permissions"].find_one({"role_name": role_name})
    if not permission:
        raise HTTPException(status_code=404, detail="Role not found")
    permission["_id"] = str(permission["_id"])
    return permission

@router.post("/permissions")
async def create_permission(permission: Permission):
    # Check if permission already exists for this role
    existing = await db["permissions"].find_one({"role_name": permission.role_name})
    if existing:
        raise HTTPException(status_code=400, detail="Permission already exists for this role")
    
    result = await db["permissions"].insert_one(permission.dict())
    return {"_id": str(result.inserted_id), **permission.dict()}

@router.patch("/permissions/{role_name}")
async def patch_permission(role_name: str, updated_fields: PartialPermissionUpdate):
    existing_permission = await db["permissions"].find_one({"role_name": role_name})
    if not existing_permission:
        raise HTTPException(status_code=404, detail="Role not found")

    data = updated_fields.dict(exclude_unset=True)
    update_query = {}
    
    # Build flat update query for nested permissions
    for app, submodules in data.get("permissions", {}).items():
        for submodule, actions in submodules.items():
            for action, value in actions.items():
                path = f"permissions.{app}.{submodule}.{action}"
                update_query[path] = value

    if not update_query:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    await db["permissions"].update_one({"role_name": role_name}, {"$set": update_query})
    return {"message": "Permission updated successfully"}

