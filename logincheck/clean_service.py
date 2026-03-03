import asyncio
from datetime import datetime
from database import db_global

class InactivityCleanupService:
    def __init__(self, timeout_minutes=60, check_interval_minutes=1):
        self.timeout_seconds = timeout_minutes * 60
        self.check_interval_seconds = check_interval_minutes * 60
        self.is_running = False

    async def cleanup_inactive_sessions(self):
        now = datetime.utcnow()
        cleaned = 0

        cursor = db_global["sessions"].find({"is_active": True})

        async for session in cursor:
            last_active = session.get("last_active")
            if not last_active:
                continue

            inactive_seconds = (now - last_active).total_seconds()

            if inactive_seconds > self.timeout_seconds:
                await db_global["sessions"].update_one(
                    {"_id": session["_id"]},
                    {"$set": {"is_active": False}}
                )
                cleaned += 1

        if cleaned > 0:
            print(f"Cleanup removed {cleaned} sessions")

    async def start(self):
        self.is_running = True
        while self.is_running:
            await self.cleanup_inactive_sessions()
            await asyncio.sleep(self.check_interval_seconds)

    def stop(self):
        self.is_running = False


inactivity_cleanup = InactivityCleanupService(
    timeout_minutes=60,      # 🔥 1 hour inactivity
    check_interval_minutes=1
)
