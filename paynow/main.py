from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from routers import payments

load_dotenv()

app = FastAPI(
    title="Gangster Barber — PayNow Payment Service",
    description="Payment microservice handling Paynow Zimbabwe transactions for barber bookings.",
    version="1.0.0",
)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])


@app.get("/")
def health():
    return {"status": "online", "service": "Gangster Barber PayNow Service v1"}
