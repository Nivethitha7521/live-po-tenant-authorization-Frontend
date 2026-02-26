from fastapi import Header, HTTPException
from jose import jwt, JWTError
from database import db_global   # 👈 import your global session DB

SECRET_KEY = "492e0b54a3130055fe6c0b698127ffa904069f189b467ab6564471b2d4840550"
ALGORITHM = "HS256"

async def validate_token(Authorization: str = Header(None)):
    """Extract and validate JWT token from Authorization header"""

    if Authorization is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = Authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("username")

        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")

        # ✅ SESSION CHECK (IMPORTANT)
        session = await db_global["sessions"].find_one({
            "username": username,
            "is_active": True
        })

        if not session:
            raise HTTPException(status_code=401, detail="Session expired. Please login again.")

        return payload   # contains username, role_name etc.

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
