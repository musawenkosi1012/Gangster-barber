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

# Initialize Database Tables
print(f"DATABASE_URL being used: {settings.DATABASE_URL}")
init_db()
print("init_db done")

app = FastAPI(title=settings.APP_NAME)

# Enable Resilient CORS for Next.js app
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect Routers
app.include_router(bookings_router, prefix="/api/book", tags=["Bookings"])
app.include_router(crm_router, tags=["Customer CRM"])
app.include_router(services_router, prefix="/api/v1", tags=["Catalog"])
app.include_router(admin_router, tags=["Admin Operations"]) 
app.include_router(it_router, tags=["IT Operations"])
app.include_router(health_router, tags=["Health"])
app.include_router(auth_router, tags=["Identity & Auth"])

@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    """
    Automated System Auditor.
    Intercepts all mutation requests to administrative routes for logging.
    """
    method = request.method
    path = request.url.path
    
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
