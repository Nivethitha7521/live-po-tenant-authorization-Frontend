from fastapi import APIRouter, HTTPException, Depends
from database import db
from models.user_model import User, UserLogin
from bcrypt import hashpw, gensalt, checkpw
from bson import ObjectId
from typing import Optional

from services.user_service import UserService
import re
router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
def hash_password(password: str) -> str:
    return hashpw(password.encode('utf-8'), gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# ✅ ADD THIS - GET ALL USERS
@router.get("/users")
async def get_all_users():
    try:
        users = await db["users"].find().to_list(None)
        for user in users:
            user["_id"] = str(user["_id"])
            user.pop("password", None)  # Remove password for security
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.post("/users")
async def create_user(user: User):
    existing_user = await db["users"].find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    # ✅ EMAIL FORMAT VALIDATION
    if user.email:
        if not EMAIL_REGEX.match(user.email):
            raise HTTPException(
            status_code=400,
            detail="Invalid email format"
        )

    # ✅ EMAIL DUPLICATE CHECK
    if user.email:
       email_exists = await db["users"].find_one({"email": user.email})
       if email_exists:
          raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    role = await db["roles"].find_one({"name": user.role_name})
    if not role:
        raise HTTPException(status_code=400, detail="Role does not exist")
    
    user_data = user.dict()
    user_data["password"] = hash_password(user.password)
    # 🔥 CONVERT tenant strings → ObjectId
    if user_data.get("tenants"):
     user_data["tenants"] = [ObjectId(tid) for tid in user_data["tenants"]]
    else:
     user_data["tenants"] = []
    result = await db["users"].insert_one(user_data)
    return {"_id": str(result.inserted_id), "username": user.username, "role_name": user.role_name}

@router.post("/users/login")
async def login_user(login_data: UserLogin):
    user = await db["users"].find_one({"username": login_data.username})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    permission = await db["permissions"].find_one({"role_name": user["role_name"]})
    
    return {
        "username": user["username"],
        "role_name": user["role_name"],
        "permissions": permission["permissions"] if permission else {}
    }

@router.get("/users/{username}")
async def get_user(username: str):
    user = await db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    return user




    # ADD THIS UPDATE ENDPOINT
@router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: dict):
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        
        # Check if user exists
        existing_user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if new username already exists (if username is being changed)
        if "username" in user_update and user_update["username"] != existing_user["username"]:
            username_exists = await db["users"].find_one({
                "username": user_update["username"],
                "_id": {"$ne": ObjectId(user_id)}  # Exclude current user
            })
            if username_exists:
                raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if role exists (if role is being changed)
        if "role_name" in user_update:
            role = await db["roles"].find_one({"name": user_update["role_name"]})
            if not role:
                raise HTTPException(status_code=400, detail="Role does not exist")
        # ✅ EMAIL VALIDATION (FORMAT + DUPLICATE)
      # ✅ EMAIL VALIDATION (FORMAT + DUPLICATE)
        if "email" in user_update and user_update["email"]:

    # Format check
             if not EMAIL_REGEX.match(user_update["email"]):
                 raise HTTPException(
                 status_code=400,
                 detail="Invalid email format"
        )

    # Duplicate check (exclude current user)
        email_exists = await db["users"].find_one({
        "email": user_update["email"],
        "_id": {"$ne": ObjectId(user_id)}
    })

        if email_exists:
          raise HTTPException(
             status_code=400,
            detail="Email already exists"
        )

        # Update user data
        update_data = {}
        
        if "username" in user_update:
            update_data["username"] = user_update["username"]
        # ✅ ADD THIS
        if "email" in user_update:
            update_data["email"] = user_update["email"]

        if "role_name" in user_update:
            update_data["role_name"] = user_update["role_name"]
        
        if "password" in user_update and user_update["password"]:
            # Don't hash if password is masked
            if user_update["password"] != "••••••••":
                update_data["password"] = hash_password(user_update["password"])
        
        # Only update if there are changes
        if update_data:
            await db["users"].update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
        
        # Get updated user
        updated_user = await db["users"].find_one({"_id": ObjectId(user_id)})
        updated_user["_id"] = str(updated_user["_id"])
        updated_user.pop("password", None)
        
        return {
            "id": updated_user["_id"],
            "username": updated_user["username"],
            "role_name": updated_user["role_name"],
            "is_active": updated_user.get("is_active", True)
        }
        
    except HTTPException:
         raise
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Error updating user: {str(e)}")
    












    # ✅ DEACTIVATE USER
@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": False}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deactivated successfully"}


# ✅ ACTIVATE (RESTORE) USER
@router.patch("/users/{user_id}/activate")
async def activate_user(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": True}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User activated successfully"}


@router.post("/users/forgot-password")
async def forgot_password(
    username: Optional[str] = None,
    email: Optional[str] = None
):
    if not username and not email:
        raise HTTPException(
            status_code=400,
            detail="Username or email is required"
        )

    # 🔍 Find user by username or email
    if username:
        user = await db["users"].find_one({"username": username})
    else:
        user = await db["users"].find_one({"email": email})

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not user.get("email"):
        raise HTTPException(
            status_code=400,
            detail="Email not registered for this user"
        )

    # ✅ Always send OTP to registered email
    await UserService.forgot_password(user["username"])

    return {"message": "OTP sent to registered email"}


@router.post("/users/verify-otp")
async def verify_otp(username: str, otp: str):
    await UserService.verify_otp(username, otp)
    return {"message": "OTP verified successfully"}

@router.post("/users/reset-password")
async def reset_password(username: str, new_password: str):
    await UserService.reset_password(username, new_password)
    return {"message": "Password reset successful"}


@router.post("/users/resend-otp")
async def resend_otp(username: str):
    await UserService.resend_otp(username)
    return {"message": "OTP resent successfully"}

@router.get("/users/username/{username}/email")
async def get_email_by_username(username: str):
    user = await db["users"].find_one({"username": username})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.get("email"):
        raise HTTPException(
            status_code=400,
            detail="Email not registered for this user"
        )

    return {
        "email": user["email"]
    }
@router.get("/users/email/{email}/username")
async def get_username_by_email(email: str):
    user = await db["users"].find_one({"email": email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "username": user["username"]
    }
