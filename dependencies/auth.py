from fastapi import Header, HTTPException
from jose import jwt, JWTError
from database import db_global
from datetime import datetime

SECRET_KEY = "492e0b54a3130055fe6c0b698127ffa904069f189b467ab6564471b2d4840550"
ALGORITHM = "HS256"

async def validate_token(Authorization: str = Header(None)):
    """Validate JWT + ensure DB session is active"""

    if Authorization is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = Authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        username = payload.get("username")
        tenant_id = payload.get("tenant_id")

        if not username or not tenant_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # ⭐ STRICT SESSION CHECK
        session = await db_global["sessions"].find_one({
            "username": username,
            "tenant_id": tenant_id,
            "access_token": token,
            "is_active": True
        })

        if not session:
            raise HTTPException(status_code=401, detail="SESSION_EXPIRED")

        # ⭐ update last active (optional but recommended)
        await db_global["sessions"].update_one(
            {"_id": session["_id"]},
            {"$set": {"last_active": datetime.utcnow()}}
        )

        return payload

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")