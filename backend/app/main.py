from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.endpoints.bookings import router as bookings_router

app = FastAPI(title="Gangster Barber API")

# Enable CORS for Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3005",
        "https://gangster-barber.vercel.app", # Future Vercel domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect Routers
app.include_router(bookings_router, prefix="/api/book", tags=["Bookings"])

@app.get("/")
def read_root():
    return {"status": "online", "system": "Gangster Barber API v2"}
