import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import urllib.parse

load_dotenv()

class Settings(BaseSettings):
    # App Config
    APP_NAME: str = "Gangster Barber API"
    
    # Database Config (Supabase)
    DB_USER: str = os.getenv("user", "postgres")
    DB_PASS: str = os.getenv("password", "")
    DB_HOST: str = os.getenv("host", "localhost")
    DB_PORT: str = os.getenv("port", "5432")
    DB_NAME: str = os.getenv("dbname", "postgres")
    APP_PORT: int = int(os.getenv("APP_PORT", "8005"))
    
    # Clerk Auth
    CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "sk_test_IvQdOmFD7fqhoD7ual7B3KAVt8lKc9FUkTmSIikc6R")
    CLERK_JWT_ISSUER: str = os.getenv("CLERK_JWT_ISSUER", "https://adapted-tahr-3.clerk.accounts.dev")
    
    
    @property
    def DATABASE_URL(self) -> str:
        # Priority 1: Use full DATABASE_URL if provided
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            # Ensure SQLAlchemy uses psycopg2 driver
            if env_url.startswith("postgresql://"):
                return env_url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return env_url

        # Priority 2: Construct from individual parts
        user = urllib.parse.quote_plus(self.DB_USER)
        password = urllib.parse.quote_plus(self.DB_PASS)
        return f"postgresql+psycopg2://{user}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode=require"

    # CORS Config
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3005")

settings = Settings()
