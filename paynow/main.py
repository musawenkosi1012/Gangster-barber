from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import logging

from routers import payments

load_dotenv()

logger = logging.getLogger("paynow")

# Rate limiter — graceful import in case slowapi API changes
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _slowapi_available = True
except ImportError:
    _slowapi_available = False
    logger.warning("slowapi not available — rate limiting disabled")

app = FastAPI(
    title="Gangster Barber — PayNow Payment Service",
    description="Payment microservice handling Paynow Zimbabwe transactions for barber bookings.",
    version="1.0.0",
)

if _slowapi_available:
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3005,https://gangsterbarber.com,https://www.gangsterbarber.com,https://gangster-barber-frontend.vercel.app,https://gangster-barber.vercel.app").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])


@app.get("/")
@app.get("/api/payments/health")
def health():
    return {"status": "online", "service": "Gangster Barber PayNow Service v1"}
