import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import HTTPException
from database import db


class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", 465))
        self.sender_email = os.getenv("SENDER_EMAIL")
        self.sender_password = os.getenv("SENDER_PASSWORD")

        if not self.sender_email or not self.sender_password:
            raise ValueError("SENDER_EMAIL or SENDER_PASSWORD not set in environment")

    async def get_user_email(self, username: str) -> str:
        user = await db["users"].find_one({"username": username})
        if not user or not user.get("email"):
            raise HTTPException(
                status_code=404,
                detail="User email not found"
            )
        return user["email"]

    async def send_otp(self, username: str, otp: str):
        user_email = await self.get_user_email(username)

        subject = "Password Reset OTP"
        body = f"""
Dear {username},

You requested a password reset.

Your One-Time Password (OTP) is: {otp}

This OTP is valid for 15 minutes.
Please do not share this OTP with anyone.

Regards,
YEN ERP Team
"""

        msg = MIMEMultipart()
        msg["From"] = self.sender_email
        msg["To"] = user_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        try:
            with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port) as server:
                server.login(self.sender_email, self.sender_password)
                server.send_message(msg)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send OTP email: {str(e)}"
            )
