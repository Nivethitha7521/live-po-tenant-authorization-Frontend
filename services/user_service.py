import random
from datetime import datetime, timedelta
from fastapi import HTTPException
from bcrypt import hashpw, gensalt
from database import db
from services.email_service import EmailService
import re



PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
)
def hash_password(password: str) -> str:
    return hashpw(password.encode("utf-8"), gensalt()).decode("utf-8")


class UserService:

    @staticmethod
    async def forgot_password(username: str):
        email_service = EmailService()
        user = await db["users"].find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.get("email"):
            raise HTTPException(status_code=400, detail="Email not registered")

        otp = str(random.randint(100000, 999999))
        expiry = datetime.utcnow() + timedelta(minutes=2)

        await db["otp_requests"].update_one(
            {"username": username},
            {
                "$set": {
                    "otp": otp,
                    "expires_at": expiry,
                    "verified": False
                }
            },
            upsert=True
        )

        await email_service.send_otp(username, otp)

    @staticmethod
    async def verify_otp(username: str, otp: str):
        record = await db["otp_requests"].find_one({"username": username})

        if not record:
            raise HTTPException(status_code=400, detail="OTP not found")

        if record["otp"] != otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        if record["expires_at"] < datetime.utcnow():

           await db["otp_requests"].delete_one({"username": username})
           raise HTTPException(status_code=400, detail="OTP expired")


        await db["otp_requests"].update_one(
            {"username": username},
            {"$set": {"verified": True}}
        )

    @staticmethod
    async def reset_password(username: str, new_password: str):
        record = await db["otp_requests"].find_one(
        {"username": username, "verified": True}
    )

        if not record:
         raise HTTPException(
            status_code=403,
            detail="OTP verification required"
        )
 # 🔥 EXTRA SAFETY: Check expiry again
        if record["expires_at"] < datetime.utcnow():
         await db["otp_requests"].delete_one({"username": username})
         raise HTTPException(
            status_code=400,
            detail="OTP expired"
        )
    # ✅ PASSWORD STRENGTH VALIDATION
        if not PASSWORD_REGEX.match(new_password):
         raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least 8 characters and include "
                "uppercase, lowercase, number and special character"
            )
        )

        hashed = hash_password(new_password)

        await db["users"].update_one(
        {"username": username},
        {"$set": {"password": hashed}}
    )

        await db["otp_requests"].delete_one({"username": username})


    @staticmethod
    async def resend_otp(username: str):
        email_service = EmailService()
        user = await db["users"].find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        otp = str(random.randint(100000, 999999))
        expiry = datetime.utcnow() + timedelta(minutes=2)

        await db["otp_requests"].update_one(
            {"username": username},
            {
                "$set": {
                    "otp": otp,
                    "expires_at": expiry,
                    "verified": False
                }
            },
            upsert=True
        )

        await email_service.send_otp(username, otp)
