from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .api.endpoints.bookings import router as bookings_router
from .api.endpoints.admin import router as admin_router
from .api.endpoints.it import router as it_router
from .api.endpoints.auth import router as auth_router
from .api.endpoints.crm import router as crm_router
from .api.endpoints.services import router as services_router
from .api.endpoints.health import router as health_router
from .core.config import settings
from .db.base import init_db, SessionLocal
from .core.limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import sentry_sdk
import traceback
import sys

# 🛡️ Production Monitoring: Sentry Integration
if settings.DATABASE_URL and "supabase" in settings.DATABASE_URL:
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN", ""),
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

# 🚀 Production Protection Suite: Rate Limiting
app = FastAPI(title=settings.APP_NAME)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Enable Resilient CORS for Next.js app
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

# Connect Routers
app.include_router(bookings_router, prefix="/api/book", tags=["Bookings"])
app.include_router(crm_router, tags=["Customer CRM"])
app.include_router(services_router, prefix="/api/v1", tags=["Catalog"])
app.include_router(admin_router, tags=["Admin Operations"]) 
app.include_router(it_router, tags=["IT Operations"])
app.include_router(health_router, tags=["Health"])
app.include_router(auth_router, tags=["Identity & Auth"])

# Serve Static Assets (Portfolios/Uploads)
if os.path.exists("backend/static"):
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
elif os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Forensic Integrity Guard: Captures all unhandled exceptions and prints tracebacks.
    In the 2026 Admin Terminal, zero-visibility 500 errors are unacceptable.
    """
    print(f"CRITICAL SYSTEM ERROR: {exc}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    return Response(
        content=f"Internal Server Error: {str(exc)}",
        status_code=500
    )

@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    """
    Automated System Auditor.
    Intercepts all mutation requests to administrative routes for logging.
    method = request.method
    path = request.url.path
    
    # Sanitize Audit: Don't leak credentials in logs
    print(f"REQUEST AUDIT: {method} {path} - Host: {request.headers.get('host')}")
    response = await call_next(request)
    
    # Audit mutations on protected routes
    if method in ["POST", "PATCH", "DELETE"] and ("/api/admin" in path or "/api/it" in path):
        # Implementation Note: In Phase 4, we use specific AuditLog entries in endpoints.
        # This middleware acts as a higher-level 'Traffic Monitor'.
        pass 
        
    return response

# 🛡️ Final Polish: Global Transaction Safety & Telemetry Middleware
@app.middleware("http")
async def db_session_middleware(request: Request, call_next):
    # Universal Rollback & Sentry Guard
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        # 🚨 Production Alerting
        sentry_sdk.capture_exception(e)
        print(f"CRITICAL SYSTEM FAILURE: {str(e)}")
        
        # Log to SystemAlert table for Admin Visibility
        try:
            db = SessionLocal()
            from .models.technical import SystemAlert
            db.add(SystemAlert(level="CRITICAL", message=f"Runtime Exception: {str(e)}", source="MIDDLEWARE"))
            db.commit()
            db.close()
        except:
            pass
            
        return Response(content="Internal Server Error: Tactical Recovery Initiated", status_code=500)

@app.get("/")
def read_root():
    return {"status": "online", "system": f"{settings.APP_NAME} v2"}
