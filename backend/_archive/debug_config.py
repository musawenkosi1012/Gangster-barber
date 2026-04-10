from app.core.config import settings
print(f"ALLOWED_ORIGINS: {settings.ALLOWED_ORIGINS}")
print(f"Origins list: {settings.ALLOWED_ORIGINS.split(',')}")
print(f"DATABASE_URL: {settings.DATABASE_URL}")
