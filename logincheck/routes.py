from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials, OAuth2PasswordBearer
from pydantic import BaseModel
import jwt
from .utils import (
    ALGORITHM, SECRET_KEY, create_user_session, debug_user_sessions, decode_access_token, 
    create_access_token, authenticate_user, hash_password, get_user, is_same_device, 
    purchaseusers_collection, refresh_session, remove_session_aggressive, update_last_activity, validate_session, get_client_fingerprint,
    force_logout_user, get_active_sessions_count, 
    add_tab_to_session
)
from .models import User, Token
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
security = HTTPBasic()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="logincheck/login")
router = APIRouter()

class LoginRequest(BaseModel):
    browser_session_id: str
    device_fingerprint: dict | None = None
    tab_id: str | None = None

class LogoutRequest(BaseModel):
    logout_reason: str = "manual"
    tab_id: str | None = None
    browser_session_id: str | None = None

@router.post("/create_user")
async def create_user(user: User):
    """Create a new user account"""
    hashed_password = hash_password(user.password)
    if await purchaseusers_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    
    await purchaseusers_collection.insert_one({
        "username": user.username,
        "hashed_password": hashed_password,
        "sessions": {},  # Initialize with empty dict
        "created_at": datetime.utcnow()
    })
    logger.info(f"User created successfully: {user.username}")
    return {"message": "User created successfully"}

@router.post("/login", response_model=Token)
async def login_for_access_token(
    login_data: LoginRequest,
    credentials: HTTPBasicCredentials = Depends(security),
    request: Request = None
):
    """Authenticate user - allow only one browser per device"""
    client_fingerprint = get_client_fingerprint(request)
    logger.info(f"Login attempt: {credentials.username}")
    
    user = await authenticate_user(credentials.username, credentials.password)
    if not user:
        logger.error("Authentication failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    try:
        username = user.get("username")
        browser_session_id = login_data.browser_session_id
        tab_id = login_data.tab_id or "default"
        
        # Check if user already has active sessions
        user_data = await get_user(username)
        # Safely get sessions with default empty dict
        sessions = user_data.get("sessions", {}) or {}
        
        # Check if this is the same browser (same browser_session_id)
        existing_browser_session = sessions.get(browser_session_id)
        
        if existing_browser_session and is_same_device(existing_browser_session.get("device_fingerprint"), client_fingerprint):
            # Same browser - allow login and reuse session
            session_id = existing_browser_session["session_id"]
            logger.info(f"Same browser login allowed for {username}, browser: {browser_session_id}")
            
        else:
            # Different browser or device - check if we should allow
            active_sessions = await get_active_sessions_count(username)
            
            if active_sessions["browser_sessions"] > 0:
                # Already has active session in another browser - block login
                logger.warning(f"Login blocked: User {username} already has active session in another browser")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="You already have an active session in another browser. Please logout from other browser first."
                )
            
            # No active sessions or same browser - create new session
            session_result = await create_user_session(username, browser_session_id, client_fingerprint, tab_id)
            session_id = session_result["session_id"]
            logger.info(f"New session created for {username}, browser: {browser_session_id}")
        
        # Add new tab to existing browser session
        await add_tab_to_session(username, browser_session_id, tab_id)
        
        access_token = create_access_token(
            data={"username": username},
            session_id=session_id,
            browser_session_id=browser_session_id,
            tab_id=tab_id
        )
        
        logger.info(f"Login successful for {username}, browser: {browser_session_id}, tab: {tab_id}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "username": username,
            "browser_session_id": browser_session_id,
            "tab_id": tab_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")

@router.get("/validate-token")
async def validate_token(token: str = Depends(oauth2_scheme), request: Request = None):
    """Validate JWT token and session for specific tab"""
    try:
        token_data = decode_access_token(token)
        username = token_data["username"]
        session_id = token_data["session_id"]
        browser_session_id = token_data.get("browser_session_id")
        tab_id = token_data.get("tab_id")
        
        logger.debug(f"Validating token for user: {username}, session: {session_id}, tab: {tab_id}")
        
        client_fingerprint = get_client_fingerprint(request)
        user_data = await get_user(username)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not validate_session(user_data, session_id, browser_session_id, tab_id, client_fingerprint):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session invalid"
            )
        
        logger.debug(f"Token validation successful for user: {username}, tab: {tab_id}")
        return {
            "valid": True, 
            "username": username,
            "browser_session_id": browser_session_id,
            "tab_id": tab_id
        }
        
    except HTTPException as e:
        logger.error(f"Token validation failed: {str(e.detail)}")
        raise e
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed"
        )

@router.get("/check-existing-session")
async def check_existing_session(
    username: str,
    browser_session_id: str,
    request: Request = None
):
    """Check if user has existing valid session for this browser"""
    try:
        client_fingerprint = get_client_fingerprint(request)
        user_data = await get_user(username)
        
        if not user_data:
            return {"has_valid_session": False}
        
        # Safely get sessions with default empty dict
        sessions = user_data.get("sessions", {}) or {}
        browser_session = sessions.get(browser_session_id)
        
        if not browser_session:
            return {"has_valid_session": False}
        
        # Check if same device and browser
        if not is_same_device(browser_session.get("device_fingerprint"), client_fingerprint):
            return {"has_valid_session": False}
        
        # Check if has active tabs
        tabs = browser_session.get("tabs", {})
        active_tabs = {tab_id: tab_data for tab_id, tab_data in tabs.items() if tab_data.get("is_active", False)}
        
        return {
            "has_valid_session": len(active_tabs) > 0,
            "browser_session_id": browser_session_id,
            "session_id": browser_session.get("session_id"),
            "active_tabs_count": len(active_tabs)
        }
        
    except Exception as e:
        logger.error(f"Error checking existing session: {str(e)}", exc_info=True)
        return {"has_valid_session": False}

@router.post("/add-tab")
async def add_new_tab(
    tab_data: dict,
    token: str = Depends(oauth2_scheme)
):
    """Add new tab to existing browser session"""
    try:
        token_data = decode_access_token(token)
        username = token_data["username"]
        browser_session_id = token_data.get("browser_session_id")
        new_tab_id = tab_data.get("tab_id")
        
        if not new_tab_id:
            raise HTTPException(status_code=400, detail="Tab ID required")
        
        result = await add_tab_to_session(username, browser_session_id, new_tab_id)
        
        if result:
            # Create new token for the new tab
            access_token = create_access_token(
                data={"username": username},
                session_id=token_data["session_id"],
                browser_session_id=browser_session_id,
                tab_id=new_tab_id
            )
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "username": username,
                "browser_session_id": browser_session_id,
                "tab_id": new_tab_id
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to add tab")
            
    except Exception as e:
        logger.error(f"Error adding tab: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to add tab")
@router.post("/logout")
async def logout(logout_data: LogoutRequest, token: str = Depends(oauth2_scheme)):
    """Logout user from specific tab or entire browser session"""
    logout_reason = logout_data.logout_reason
    tab_id = logout_data.tab_id
    browser_session_id = logout_data.browser_session_id
    
    try:
        token_data = decode_access_token(token)
        username = token_data["username"]
        current_browser_session_id = token_data.get("browser_session_id")
        current_tab_id = token_data.get("tab_id")
        
        # Use provided IDs or fall back to token IDs
        target_browser_session_id = browser_session_id or current_browser_session_id
        target_tab_id = tab_id or current_tab_id
        
        logger.info(f"Logout request - User: {username}, Browser: {target_browser_session_id}, Tab: {target_tab_id}, Reason: {logout_reason}")
        
        # Debug: Log current session state before logout
        debug_before = await debug_user_sessions(username)
        logger.info(f"Session state BEFORE logout: {debug_before}")
        
        result = False
        
        if logout_reason == "manual" and target_tab_id:
            # Manual logout from specific tab - USE AGGRESSIVE VERSION
            result = await remove_session_aggressive(username, target_browser_session_id, target_tab_id)
            if result:
                logger.info(f"Manual tab logout successful for {username}, browser: {target_browser_session_id}, tab: {target_tab_id}")
            else:
                logger.warning(f"No session found to logout for {username}, tab: {target_tab_id}")
        
        elif logout_reason == "browser_closed" and target_browser_session_id:
            # Browser closed - remove entire browser session
            result = await force_logout_user(username, target_browser_session_id, "browser_closed")
            if result:
                logger.info(f"Browser session logout successful for {username}, browser: {target_browser_session_id}")
            else:
                logger.warning(f"No browser session found to logout for {username}, browser: {target_browser_session_id}")
        
        else:
            # Default: logout current tab only - USE AGGRESSIVE VERSION
            result = await remove_session_aggressive(username, target_browser_session_id, target_tab_id)
            if result:
                logger.info(f"Default tab logout successful for {username}, browser: {target_browser_session_id}, tab: {target_tab_id}")
        
        # Debug: Log current session state after logout
        debug_after = await debug_user_sessions(username)
        logger.info(f"Session state AFTER logout: {debug_after}")
        
        return {
            "message": "Logged out successfully", 
            "logout_reason": logout_reason,
            "debug_before": debug_before,
            "debug_after": debug_after
        }
        
    except Exception as e:
        logger.error(f"Unexpected error during logout: {str(e)}", exc_info=True)
        # Even if there's an error, try to force logout using aggressive method
        try:
            if 'username' in locals() and 'target_browser_session_id' in locals() and 'target_tab_id' in locals():
                await remove_session_aggressive(username, target_browser_session_id, target_tab_id)
        except:
            pass
        
        return {"message": "Logged out successfully"}
@router.get("/check-sessions/{username}")
async def check_active_sessions(username: str):
    """Check active sessions for a user"""
    user_data = await get_user(username)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    sessions = user_data.get("sessions", {}) or {}
    active_browsers = len(sessions)
    active_tabs = sum(len(browser_session.get("tabs", {})) for browser_session in sessions.values())
    
    return {
        "username": username,
        "active_browser_sessions": active_browsers,
        "active_tabs": active_tabs,
        "sessions": sessions
    }

@router.post("/fix-user-sessions")
async def fix_user_sessions(username: str):
    """Fix user sessions field if it's null"""
    try:
        result = await purchaseusers_collection.update_one(
            {"username": username, "sessions": None},
            {"$set": {"sessions": {}}}
        )
        
        if result.modified_count > 0:
            return {"message": f"Fixed sessions field for user {username}"}
        else:
            return {"message": f"No fix needed for user {username}"}
            
    except Exception as e:
        logger.error(f"Error fixing user sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fix user sessions")  
    
@router.post("/refresh-session")
async def refresh_session_endpoint(
    refresh_data: dict,
    token: str = Depends(oauth2_scheme)
):
    """Refresh session on page reload"""
    try:
        token_data = decode_access_token(token)
        username = token_data["username"]
        browser_session_id = token_data.get("browser_session_id")
        tab_id = token_data.get("tab_id")
        
        result = await refresh_session(username, browser_session_id, tab_id)
        
        if result:
            return {"message": "Session refreshed successfully"}
        else:
            raise HTTPException(status_code=401, detail="Session refresh failed")
            
    except Exception as e:
        logger.error(f"Session refresh error: {str(e)}")
        raise HTTPException(status_code=401, detail="Session refresh failed")
@router.get("/debug-sessions/{username}")
async def debug_sessions(username: str):
    """Debug endpoint to check session state"""
    return await debug_user_sessions(username)

@router.get("/check-activity")
async def check_user_activity_endpoint(
    token: str = Depends(oauth2_scheme),
    request: Request = None
):
    """Check user activity status"""
    try:
        token_data = decode_access_token(token)
        username = token_data["username"]
        browser_session_id = token_data.get("browser_session_id")
        tab_id = token_data.get("tab_id")
        
        client_fingerprint = get_client_fingerprint(request)
        user_data = await get_user(username)
        
        if not user_data:
            return {
                "is_active": False,
                "message": "User not found",
                "should_logout": True
            }
        
        # Check activity using the main validation
        is_valid = await validate_session(
            user_data, 
            token_data["session_id"], 
            browser_session_id, 
            tab_id, 
            client_fingerprint
        )
        
        if not is_valid:
            return {
                "is_active": False,
                "message": "Session invalid or inactive",
                "should_logout": True
            }
        
        # Get detailed activity info
        sessions = user_data.get("sessions", {}) or {}
        browser_session = sessions.get(browser_session_id, {})
        tabs = browser_session.get("tabs", {})
        tab_session = tabs.get(tab_id, {})
        
        last_activity = tab_session.get("last_activity")
        if last_activity:
            time_diff = datetime.utcnow() - last_activity
            minutes_ago = time_diff.total_seconds() / 60
        else:
            minutes_ago = 0
        
        return {
            "is_active": True,
            "last_activity_minutes_ago": minutes_ago,
            "inactive_minutes_left": max(0, 60 - minutes_ago),
            "message": "User is active",
            "should_logout": False
        }
        
    except Exception as e:
        logger.error(f"Error checking activity: {str(e)}")
        return {
            "is_active": False,
            "message": "Error checking activity",
            "should_logout": True
        }

@router.post("/ping")
async def ping_activity(
    token: str = Depends(oauth2_scheme)
):
    """Simple endpoint to update activity - can be called periodically"""
    try:
        token_data = decode_access_token(token)
        username = token_data["username"]
        browser_session_id = token_data.get("browser_session_id")
        tab_id = token_data.get("tab_id")
        
        await update_last_activity(username, browser_session_id, tab_id)
        
        return {
            "success": True,
            "message": "Activity updated",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in ping: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )