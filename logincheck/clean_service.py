import asyncio
from datetime import datetime
from database import db_global

class InactivityCleanupService:
    def __init__(self, check_interval_minutes=1):
        self.check_interval_minutes = check_interval_minutes
        self.is_running = False

    async def cleanup_inactive_sessions(self):
        now = datetime.utcnow()
        cleaned = 0

        cursor = db_global["sessions"].find({"is_active": True})

        async for session in cursor:
            last_active = session.get("last_active")

            if not last_active:
                continue

            if isinstance(last_active, str):
                last_active = datetime.fromisoformat(last_active)

            inactive_seconds = (now - last_active).total_seconds()

            if inactive_seconds > 3600:   # 10 sec test
                await db_global["sessions"].update_one(
                    {"_id": session["_id"]},
                    {"$set": {"is_active": False}}
                )
                cleaned += 1

        print(f"Cleanup removed {cleaned} sessions")

    async def start(self):
        self.is_running = True
        while self.is_running:
            await self.cleanup_inactive_sessions()
            await asyncio.sleep(self.check_interval_minutes * 60)

    def stop(self):
        self.is_running = False

# ✅ THIS LINE IS IMPORTANT
inactivity_cleanup = InactivityCleanupService(check_interval_minutes=5)
