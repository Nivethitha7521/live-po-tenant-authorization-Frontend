from fastapi import APIRouter, HTTPException, status
from database import db
from models.role_model import Role
from bson import ObjectId
router = APIRouter()

def convert_objectid(data):
    for item in data:
        item["_id"] = str(item["_id"])
    return data

@router.get("/roles")
async def get_roles():
    roles = await db["roles"].find().to_list(None)

    for r in roles:
        r["_id"] = str(r["_id"])
        r["active"] = r.get("is_active", True)   # 🔥 map DB → frontend
    
    return roles


@router.post("/roles")
async def create_role(role: Role):

    # ✅ STEP 1: Duplicate role name check (case-insensitive)
    existing_role = await db["roles"].find_one({
        "name": {"$regex": f"^{role.name}$", "$options": "i"}
    })

    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role already exists"
        )

    # ✅ STEP 2: Insert only if not duplicate
    data = role.dict()
    data["is_active"] = True     # default active
    result = await db["roles"].insert_one(data)

    return {
        "_id": str(result.inserted_id),
        **role.dict()
    }

@router.put("/roles/{role_id}/deactivate")
async def deactivate_role(role_id: str):

    role_obj = ObjectId(role_id)

    # 🔹 deactivate role
    result = await db["roles"].update_one(
        {"_id": role_obj},
        {"$set": {"is_active": False}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")

    # 🔹 get role name
    role = await db["roles"].find_one({"_id": role_obj})
    role_name = role["name"]

    # 🔹 deactivate all users having this role
    await db["users"].update_many(
        {"role_name": role_name},
        {"$set": {"is_active": False}}
    )

    return {"message": "Role and related users deactivated"}

@router.put("/roles/{role_id}/restore")
async def restore_role(role_id: str):

    role_obj = ObjectId(role_id)

    # 🔹 restore role
    result = await db["roles"].update_one(
        {"_id": role_obj},
        {"$set": {"is_active": True}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")

    # 🔹 get role name
    role = await db["roles"].find_one({"_id": role_obj})
    role_name = role["name"]

    # 🔹 restore all users having this role
    await db["users"].update_many(
        {"role_name": role_name},
        {"$set": {"is_active": True}}
    )

    return {"message": "Role and related users restored"}

