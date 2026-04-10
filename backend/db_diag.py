import os
import urllib.parse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env from the backend directory
load_dotenv()

def test_connection():
    # These should match what settings.DATABASE_URL constructs
    user = os.getenv("user")
    password = os.getenv("password")
    host = os.getenv("host")
    port = os.getenv("port", "5432")
    dbname = os.getenv("dbname", "postgres")
    
    # Construction logic from app/core/config.py
    encoded_user = urllib.parse.quote_plus(user) if user else "postgres"
    encoded_password = urllib.parse.quote_plus(password) if password else ""
    
    url = f"postgresql+psycopg2://{encoded_user}:{encoded_password}@{host}:{port}/{dbname}"
    
    print(f"--- DB DIAGNOSTIC ---")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"DB Name: {dbname}")
    print(f"User: {user}")
    
    engine = create_engine(url)
    
    try:
        with engine.connect() as conn:
            print("\n[SUCCESS] Engine connection established.")
            
            # Check current database and user
            print(f"Connected to Database: {conn.execute(text('SELECT current_database()')).scalar()}")
            print(f"Current User: {conn.execute(text('SELECT current_user')).scalar()}")
            print(f"Search Path: {conn.execute(text('SHOW search_path')).scalar()}")

            # List tables in public schema
            print("\nListing tables in 'public' schema:")
            result = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
            tables = [row[0] for row in result]
            for t in tables:
                print(f" - {t}")
            
            if "bookings" in tables:
                print("\n[FOUND] 'bookings' table exists.")
                # Try simple count
                try:
                    count = conn.execute(text("SELECT count(*) FROM bookings")).scalar()
                    print(f"Row count: {count}")
                except Exception as e:
                    print(f"[ERROR] Failed to SELECT from bookings even though it exists: {e}")
            else:
                print("\n[MISSING] 'bookings' table NOT found in public schema.")
                
    except Exception as e:
        print(f"\n[FATAL] Connection failed completely: {e}")

if __name__ == "__main__":
    test_connection()
