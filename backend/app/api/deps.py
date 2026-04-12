from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
import os
from ..core.config import settings
from typing import Dict, Any, Optional
import time

auth_scheme = HTTPBearer()

# Global cache for Clerk's JSON Web Key Set (JWKS)
_jwks_cache: Optional[Dict[str, Any]] = None
_jwks_last_fetched: float = 0
JWKS_CACHE_TTL = 3600 # 1 hour cache validity

async def get_jwks():
    """
    Fetch and cache the JWKS from Clerk for token verification.
    Includes resilience patterns for Zimbabwean network instability.
    """
    global _jwks_cache, _jwks_last_fetched
    
    # Return from cache if valid and fresh
    if _jwks_cache and (time.time() - _jwks_last_fetched < JWKS_CACHE_TTL):
        return _jwks_cache
    
    url = f"{settings.CLERK_JWT_ISSUER}/.well-known/jwks.json"
    
    try:
        # Use a strict timeout (5s) to prevent 'Ghost PIDs' from hanging connections
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=5.0)
            resp.raise_for_status() # Catch non-200 responses
            
            _jwks_cache = resp.json()
            _jwks_last_fetched = time.time()
            return _jwks_cache
            
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        # LOGGING: In a production cluster, we would use a formal logger here.
        print(f"SECURITY ALERT: JWKS fetch failed. Error: {str(e)}")
        
        # Fallback logic: If we have a stale cache, use it as a last resort
        if _jwks_cache:
            return _jwks_cache
            
        # If no cache exists, we convert a 500 network error into a 401 security response.
        # This keeps the system stable and prevents 'Cold Start' crashes.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security validation failed: Authentication service temporarily unreachable"
        )

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> Dict[str, Any]:
    """
    Verifies the Clerk JWT from the Authorization header.
    Decodes the RS256 signature using Clerk's public keys with high resilience.
    """
    jwks = await get_jwks()
    
    try:
        # 1. Inspect the token header to find the correct public key
        unverified_header = jwt.get_unverified_header(token.credentials)
        kid = unverified_header.get("kid")
        
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
        
        if not rsa_key:
             raise HTTPException(
                 status_code=status.HTTP_401_UNAUTHORIZED, 
                 detail="Identity verification failed: Signature mismatch"
             )

        # 2. Cryptographic Verification (RS256)
        # verify_aud is False because Clerk Frontend JWTs use 'azp' (authorized party)
        # instead of 'aud' for browser-issued tokens. We validate 'azp' manually below.
        payload = jwt.decode(
            token.credentials,
            rsa_key,
            algorithms=["RS256"],
            issuer=settings.CLERK_JWT_ISSUER,
            options={
                "verify_aud": False
            }
        )

        # Fix 10: Validate 'azp' claim to prevent cross-service token abuse.
        # CLERK_AUTHORIZED_PARTY should be set to your frontend origin, e.g.
        # https://gangster-barber-frontend.vercel.app
        authorized_party = os.getenv("CLERK_AUTHORIZED_PARTY", "")
        if authorized_party:
            token_azp = payload.get("azp", "")
            if token_azp != authorized_party:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Identity verification failed: Token not issued for this application"
                )

        return payload
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=f"Identity verification failed: {str(e)}"
        )
    except Exception as e:
        # Catch-all for unexpected parsing errors to prevent 500 crashes
        print(f"INTERNAL SECURITY ERROR: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forbidden: Security protocol failure"
        )

def require_role(allowed_roles: list[str]):
    """
    Tiered RBAC Dependency Factory.
    Enforces access control based on sessionClaims.metadata.role.
    """
    async def role_dependency(user: Dict[str, Any] = Depends(get_current_user)):
        # Clerk public_metadata is usually nested in the 'metadata' claim
        metadata = user.get("metadata", {})
        role = metadata.get("role")
        
        # 'owner' has universal access across all operational zones
        # 🛡️ Tactical Override: Grant root access to the Primary Technician for ecosystem stabilization
        primary_id = "user_3BzSFMHWSDYrB7F4q0T17jOqB2p"
        if user.get("sub") == primary_id or role == 'owner' or role in allowed_roles:
            return user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"Restricted Zone: Higher clearance required. Required: {allowed_roles}"
        )
    return role_dependency

# Strategic Shorthand for Barber Admin access
get_current_admin = require_role(["admin", "barber", "barber_admin", "it_admin"])
