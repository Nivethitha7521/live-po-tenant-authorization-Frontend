from pydantic import BaseModel
from typing import Dict, Optional

class PermissionAction(BaseModel):
    add: bool = False
    edit: bool = False
    delete: bool = False
    read: bool = False
    hide: bool = False
    approve: bool = False

class Permission(BaseModel):
    role_name: str
    permissions: Dict[str, Dict[str, PermissionAction]]

class PartialPermissionUpdate(BaseModel):
    # Flat structure for updates: app -> submodule -> action -> bool
    permissions: Optional[Dict[str, Dict[str, Dict[str, Optional[bool]]]]] = None