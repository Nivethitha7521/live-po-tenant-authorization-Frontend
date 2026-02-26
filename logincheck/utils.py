from datetime import datetime
import bcrypt
from jose import jwt, JWTError
from typing import Dict, Optional, List
from fastapi import Request, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import secrets
import uuid
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB setup
client = AsyncIOMotorClient("mongodb://purchasetestuser:qv8D%25%3AWZG%7DRmW%3B%5Du@194.233.78.90:27017/purchasetest?authSource=purchasetest&authMechanism=SCRAM-SHA-256&replicaSet=yenerp-cluster")
db = client["purchasetest"]
purchaseusers_collection = db['logincheck']

# JWT settings
SECRET_KEY = "492e0b54a3130055fe6c0b698127ffa904069f189b467ab6564471b2d4840550"
ALGORITHM = "HS256"

# Timeout settings (in seconds)
INACTIVITY_TIMEOUT_SECONDS = 3600  # 1 hour = 3600 seconds
ACTIVITY_CHECK_INTERVAL = 300  # Check every 5 minutes

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def authenticate_user(username: str, password: str) -> Optional[Dict]:
    try:
        user = await purchaseusers_collection.find_one({"username": username})
        if user and verify_password(password, user["hashed_password"]):
            return user
        return None
    except Exception as e:
        logger.error(f"Database error in authenticate_user: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

async def get_user(username: str) -> Optional[Dict]:
    """Retrieve a user from the database with safe sessions handling"""
    try:
        user = await purchaseusers_collection.find_one({"username": username})
        if user:
            # Ensure sessions is never None - convert to empty dict if null
            if user.get('sessions') is None:
                user['sessions'] = {}
            return user
        return None
    except Exception as e:
        logger.error(f"Error getting user {username}: {str(e)}")
        return None

def get_client_fingerprint(request: Request) -> Dict:
    """Generate a client fingerprint from request headers"""
    return {
        "user_agent": request.headers.get("user-agent", ""),
        "screen_resolution": request.headers.get("screen-resolution", ""),
        "timezone": request.headers.get("timezone", ""),
        "language": request.headers.get("accept-language", ""),
        "ip": request.client.host
    }

def is_same_device(stored_fingerprint: Dict, client_fingerprint: Dict) -> bool:
    """Check if two device fingerprints match - strict check for same device"""
    if not stored_fingerprint or not client_fingerprint:
        return False
    
    # Strict check - must match on key identifiers
    return (
        stored_fingerprint.get("user_agent") == client_fingerprint.get("user_agent") and
        stored_fingerprint.get("screen_resolution") == client_fingerprint.get("screen_resolution") and
        stored_fingerprint.get("timezone") == client_fingerprint.get("timezone")
    )

def is_same_browser(stored_session_id: str, current_session_id: str) -> bool:
    """Check if it's the same browser session"""
    return stored_session_id == current_session_id

async def create_user_session(username: str, browser_session_id: str, client_fingerprint: Dict, tab_id: str) -> Dict:
    """Create a new user session for a specific tab"""
    session_id = secrets.token_hex(16)
    
    session_data = {
        "session_id": session_id,
        "browser_session_id": browser_session_id,
        "login_time": datetime.utcnow(),
        "device_fingerprint": client_fingerprint,
        "login_ip": client_fingerprint.get("ip", "unknown"),
        "tabs": {
            tab_id: {
                "tab_id": tab_id,
                "login_time": datetime.utcnow(),
                "is_active": True,
                "last_activity": datetime.utcnow()
            }
        }
    }
    
    # First ensure sessions field exists and is a dict
    await purchaseusers_collection.update_one(
        {"username": username, "sessions": None},
        {"$set": {"sessions": {}}}
    )
    
    # Then set the session data
    await purchaseusers_collection.update_one(
        {"username": username},
        {"$set": {f"sessions.{browser_session_id}": session_data}}
    )
    
    return {"session_id": session_id}

async def add_tab_to_session(username: str, browser_session_id: str, tab_id: str) -> bool:
    """Add a new tab to existing browser session"""
    try:
        user_data = await get_user(username)
        if not user_data:
            return False
        
        sessions = user_data.get("sessions", {})
        browser_session = sessions.get(browser_session_id)
        
        if not browser_session:
            return False
        
        # Add new tab
        await purchaseusers_collection.update_one(
            {"username": username},
            {"$set": {
                f"sessions.{browser_session_id}.tabs.{tab_id}": {
                    "tab_id": tab_id,
                    "login_time": datetime.utcnow(),
                    "is_active": True,
                    "last_activity": datetime.utcnow()
                }
            }}
        )
        return True
    except Exception as e:
        logger.error(f"Error adding tab to session: {str(e)}")
        return False
async def remove_session_aggressive(username: str, browser_session_id: str, tab_id: str) -> bool:
    """Aggressive session removal - ensures cleanup"""
    try:
        # First, get current user data
        user_data = await get_user(username)
        if not user_data:
            return False
        
        sessions = user_data.get("sessions", {}) or {}
        
        # If browser session doesn't exist, nothing to do
        if browser_session_id not in sessions:
            return False
        
        browser_session = sessions[browser_session_id]
        tabs = browser_session.get("tabs", {})
        
        # If tab doesn't exist, nothing to do
        if tab_id not in tabs:
            return False
        
        # Remove the specific tab
        update_operation = {
            "$unset": {f"sessions.{browser_session_id}.tabs.{tab_id}": ""}
        }
        
        result = await purchaseusers_collection.update_one(
            {"username": username},
            update_operation
        )
        
        # Now check if we need to remove the entire browser session
        user_data_after = await get_user(username)
        if user_data_after:
            sessions_after = user_data_after.get("sessions", {}) or {}
            browser_session_after = sessions_after.get(browser_session_id, {})
            tabs_after = browser_session_after.get("tabs", {})
            
            # If no tabs left, remove entire browser session
            if not tabs_after:
                await purchaseusers_collection.update_one(
                    {"username": username},
                    {"$unset": {f"sessions.{browser_session_id}": ""}}
                )
                logger.info(f"Removed entire browser session (no tabs left) for {username}")
        
        logger.info(f"Aggressive session removal completed for {username}, tab: {tab_id}")
        return True
        
    except Exception as e:
        logger.error(f"Aggressive session removal failed: {str(e)}")
        # Last resort: clear all sessions for this user
        try:
            await purchaseusers_collection.update_one(
                {"username": username},
                {"$set": {"sessions": {}}}
            )
            logger.warning(f"Used nuclear option: cleared all sessions for {username}")
            return True
        except:
            return False
async def update_last_activity(username: str, browser_session_id: str, tab_id: str):
    """Update last activity timestamp for a tab - THIS IS CRITICAL"""
    try:
        now = datetime.utcnow()
        await purchaseusers_collection.update_one(
            {"username": username},
            {"$set": {f"sessions.{browser_session_id}.tabs.{tab_id}.last_activity": now}}
        )
        logger.debug(f"Updated activity for {username}, browser: {browser_session_id}, tab: {tab_id}")
    except Exception as e:
        logger.error(f"Error updating last activity: {str(e)}")

async def check_user_activity(username: str, browser_session_id: str, tab_id: str) -> Dict:
    """
    Check if user is active or should be logged out due to inactivity
    Returns: {
        "is_active": bool,
        "last_activity_minutes_ago": float,
        "should_logout": bool,
        "reason": str
    }
    """
    try:
        user_data = await get_user(username)
        if not user_data:
            return {
                "is_active": False,
                "last_activity_minutes_ago": 0,
                "should_logout": True,
                "reason": "User not found"
            }
        
        sessions = user_data.get("sessions", {}) or {}
        browser_session = sessions.get(browser_session_id)
        
        if not browser_session:
            return {
                "is_active": False,
                "last_activity_minutes_ago": 0,
                "should_logout": True,
                "reason": "Session not found"
            }
        
        tabs = browser_session.get("tabs", {})
        tab_session = tabs.get(tab_id)
        
        if not tab_session:
            return {
                "is_active": False,
                "last_activity_minutes_ago": 0,
                "should_logout": True,
                "reason": "Tab not found"
            }
        
        last_activity = tab_session.get("last_activity")
        if not last_activity:
            # If no last_activity, use login_time
            last_activity = tab_session.get("login_time", datetime.utcnow())
        
        now = datetime.utcnow()
        time_since_last_activity = now - last_activity
        minutes_inactive = time_since_last_activity.total_seconds() / 60
        
        # Check if inactive for more than 1 hour
        should_logout = time_since_last_activity.total_seconds() > INACTIVITY_TIMEOUT_SECONDS
        
        if should_logout:
            logger.info(f"User inactive for {minutes_inactive:.1f} minutes. Logging out {username}")
            await remove_session_aggressive(username, browser_session_id, tab_id)
        
        return {
            "is_active": not should_logout,
            "last_activity_minutes_ago": minutes_inactive,
            "should_logout": should_logout,
            "reason": "Inactive for 1 hour" if should_logout else "Active"
        }
        
    except Exception as e:
        logger.error(f"Error checking user activity: {str(e)}")
        return {
            "is_active": False,
            "last_activity_minutes_ago": 0,
            "should_logout": True,
            "reason": f"Error: {str(e)}"
        }

async def validate_session(user_data: Dict, session_id: str, browser_session_id: str, 
                          tab_id: str, client_fingerprint: Dict) -> bool:
    """Validate a user session - MAIN ENTRY POINT FOR ALL REQUESTS"""
    try:
        # Safely get sessions
        sessions = user_data.get("sessions", {}) or {}
        browser_session = sessions.get(browser_session_id, {})
        
        if not browser_session or browser_session.get("session_id") != session_id:
            return False
        
        tabs = browser_session.get("tabs", {})
        tab_session = tabs.get(tab_id, {})
        
        if not tab_session or not tab_session.get("is_active", False):
            return False
        
        # Strict device validation
        if not is_same_device(browser_session.get("device_fingerprint"), client_fingerprint):
            return False
        
        # Check user activity (1-hour inactivity check)
        username = user_data["username"]
        activity_check = await check_user_activity(username, browser_session_id, tab_id)
        
        if activity_check["should_logout"]:
            logger.info(f"Auto-logout due to inactivity for {username}")
            return False
        
        # IMPORTANT: Update last activity for this request
        await update_last_activity(username, browser_session_id, tab_id)
        
        return True
        
    except Exception as e:
        logger.error(f"Error validating session: {str(e)}")
        return False
async def force_logout_user(username: str, browser_session_id: str, reason: str) -> bool:
    """Force logout a user from specific browser session"""
    try:
        result = await purchaseusers_collection.update_one(
            {"username": username},
            {"$unset": {f"sessions.{browser_session_id}": ""}}
        )
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Failed to force logout for {username}: {str(e)}")
        return False

async def force_logout_other_browsers(username: str, current_browser_session_id: str) -> bool:
    """Force logout all other browser sessions except current one"""
    try:
        user_data = await get_user(username)
        if not user_data:
            return False
        
        sessions = user_data.get("sessions", {}) or {}
        
        # Remove all sessions except current one
        for browser_id in list(sessions.keys()):
            if browser_id != current_browser_session_id:
                await purchaseusers_collection.update_one(
                    {"username": username},
                    {"$unset": {f"sessions.{browser_id}": ""}}
                )
        
        return True
    except Exception as e:
        logger.error(f"Failed to logout other browsers for {username}: {str(e)}")
        return False

async def get_active_sessions_count(username: str) -> Dict:
    """Get count of active browser sessions and tabs"""
    try:
        user_data = await get_user(username)
        if not user_data:
            return {"browser_sessions": 0, "tabs": 0}
        
        sessions = user_data.get("sessions", {}) or {}
        browser_count = len(sessions)
        tab_count = sum(len(session.get("tabs", {})) for session in sessions.values())
        
        return {"browser_sessions": browser_count, "tabs": tab_count}
    except Exception as e:
        logger.error(f"Error getting active sessions count: {str(e)}")
        return {"browser_sessions": 0, "tabs": 0}

def create_access_token(data: Dict, session_id: str, browser_session_id: str, tab_id: str) -> str:
    """Create a JWT access token without expiration"""
    to_encode = data.copy()
    to_encode.update({
        "session_id": session_id,
        "browser_session_id": browser_session_id,
        "tab_id": tab_id
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Dict:
    """Decode a JWT access token without expiration check"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def fix_all_users_sessions():
    """Fix all users with null sessions field"""
    try:
        result = await purchaseusers_collection.update_many(
            {"sessions": None},
            {"$set": {"sessions": {}}}
        )
        logger.info(f"Fixed {result.modified_count} users with null sessions")
        return result.modified_count
    except Exception as e:
        logger.error(f"Error fixing all users: {str(e)}")
        return 0
    
# Add this function to your utils.py
async def refresh_session(username: str, browser_session_id: str, tab_id: str):
    """Refresh session activity without requiring re-login"""
    try:
        user_data = await get_user(username)
        if not user_data:
            return False
        
        sessions = user_data.get("sessions", {}) or {}
        browser_session = sessions.get(browser_session_id)
        
        if not browser_session:
            return False
        
        tabs = browser_session.get("tabs", {})
        if tab_id not in tabs:
            return False
        
        # Update last activity to keep session alive
        await update_last_activity(username, browser_session_id, tab_id)
        return True
        
    except Exception as e:
        logger.error(f"Error refreshing session: {str(e)}")
        return False
    
async def debug_user_sessions(username: str):
    """Debug function to check user session state"""
    try:
        user_data = await get_user(username)
        if not user_data:
            return {"error": "User not found"}
        
        sessions = user_data.get("sessions", {}) or {}
        
        debug_info = {
            "username": username,
            "sessions_count": len(sessions),
            "sessions": {}
        }
        
        for browser_id, browser_session in sessions.items():
            tabs = browser_session.get("tabs", {})
            debug_info["sessions"][browser_id] = {
                "session_id": browser_session.get("session_id"),
                "tabs_count": len(tabs),
                "tabs": list(tabs.keys()),
                "device_fingerprint": browser_session.get("device_fingerprint", {}).get("user_agent", "Unknown")[:50] + "..."
            }
        
        return debug_info
    except Exception as e:
        return {"error": str(e)}