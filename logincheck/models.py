from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class User(BaseModel):
    username: str
    password: str

class TabSession(BaseModel):
    tab_id: str
    login_time: datetime
    is_active: bool
    last_activity: datetime

class BrowserSession(BaseModel):
    session_id: str
    browser_session_id: str
    login_time: datetime
    device_fingerprint: Dict[str, Any]
    login_ip: str
    tabs: Dict[str, TabSession]

class UserInDB(BaseModel):
    _id: str
    username: str
    hashed_password: str
    sessions: Dict[str, BrowserSession] = {}
    created_at: Optional[datetime]

class Token(BaseModel):
    access_token: str
    token_type: str
    username: Optional[str] = None
    browser_session_id: Optional[str] = None
    tab_id: Optional[str] = None