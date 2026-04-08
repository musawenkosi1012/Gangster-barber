from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.endpoints.bookings import router as bookings_router
from .core.config import settings
from .db.base import init_db

# Initialize Database Tables
init_db()

app = FastAPI(title=settings.APP_NAME)

# Enable CORS for Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect Routers
app.include_router(bookings_router, prefix="/api/book", tags=["Bookings"])

@app.get("/")
def read_root():
    return {"status": "online", "system": f"{settings.APP_NAME} v2"}
