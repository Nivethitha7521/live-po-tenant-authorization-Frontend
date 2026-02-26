from fastapi import HTTPException, Header, Depends
from jose import jwt, JWTError
from database import db
from typing import Dict
import logging
from dependencies.auth import validate_token

logger = logging.getLogger(__name__)

SECRET_KEY = "492e0b54a3130055fe6c0b698127ffa904069f189b467ab6564471b2d4840550"
ALGORITHM = "HS256"

# -----------------------------------------------------------
# 1. Decode JWT + extract username + role_name
# -----------------------------------------------------------
# ❌ Remove OAuth2PasswordBearer import and oauth2_scheme lines

async def get_current_user(user_data = Depends(validate_token)):
    return {
        "username": user_data.get("username"),
        "role_name": user_data.get("role_name"),
        "permissions": user_data.get("permissions", {})
    }
   

# -----------------------------------------------------------
# 2. Generic Permission Checker
# -----------------------------------------------------------
def check_permission(app: str, module: str, action: str):
    async def permission_checker(user_data = Depends(get_current_user)):
        permissions = user_data["permissions"]

        # Fetch module permissions
        app_perms = permissions.get(app, {})
        module_perms = app_perms.get(module, {})

        # Hidden module check
        if module_perms.get("hide", False):
            raise HTTPException(status_code=404, detail="Module not available")

        # Action level permission check
        if not module_perms.get(action, False):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: Cannot {action} {module}"
            )

        return True

    return permission_checker

def check_any_permission(app: str, modules: list, action: str):
    def checker(user=Depends(validate_token)):
        permissions = user.get("permissions", {}).get(app, {})

        for module in modules:
            module_perms = permissions.get(module, {})
            if module_perms.get(action) in [True, 1]:
                return permissions  # ✅ allowed if ANY ONE matches

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access Purchase Return"
        )
    return checker