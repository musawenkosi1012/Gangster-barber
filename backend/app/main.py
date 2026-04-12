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
from .db.base import init_db
import traceback
import sys

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on first real request, not at import time
    try:
        init_db()
        print("init_db completed successfully")
    except Exception as e:
        print(f"WARNING: init_db failed: {e}")
    yield

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

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
        # Implementation Note: In a production environment, we would use 
        # a BackgroundTask here to write to the 'audit_logs' table 
        # without impacting the response latency.
        print(f"AUDIT LOG: {method} {path} - Status: {response.status_code}")
        
    return response

@app.get("/")
def read_root():
    return {"status": "online", "system": f"{settings.APP_NAME} v2"}
