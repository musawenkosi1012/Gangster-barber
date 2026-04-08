from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from ..core.config import settings

# 1. Create the database engine
# We use NullPool for compatibility with Supabase's transaction mode/pooling
engine = create_engine(settings.DATABASE_URL, poolclass=NullPool)

# 2. Create the Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Create the Base class for all models to inherit from
Base = declarative_base()

# 4. Dependency to get the DB session for FastAPI endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper for migrations or initial setup
def init_db():
    from ..models import Booking
    Base.metadata.create_all(bind=engine)
