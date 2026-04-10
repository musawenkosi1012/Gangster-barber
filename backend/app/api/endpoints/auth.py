from fastapi import APIRouter, Depends
from typing import Dict, Any
from ..deps import get_current_user

router = APIRouter(prefix="/api/v1/auth")

@router.get("/me")
def get_admin_identity(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Hydrates the 'Admin Identity Badge' using the Clerk JWT metadata.
    Returns the authenticated user's profile and role.
    """
    return {
        "id": current_user.get("sub"),
        "role": current_user.get("metadata", {}).get("role", "customer"),
        "email": current_user.get("email"),
        "full_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip()
    }
