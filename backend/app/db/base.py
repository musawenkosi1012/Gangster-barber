import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

load_dotenv()

# SUPABASE CONFIG (Loaded from .env)
_USER = os.getenv("user")
_PASS = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

# Syndicate Credential Escaping (Elite-grade URI handling)
USER = urllib.parse.quote_plus(_USER) if _USER else ""
PASSWORD = urllib.parse.quote_plus(_PASS) if _PASS else ""

# Construct the SQLAlchemy connection string with escaped characters
DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

class SupabaseDatabase:
    def __init__(self, url: str):
        # We use NullPool for Supabase transaction mode compatibility if needed
        self.engine = create_engine(url, poolclass=NullPool)
        self._init_db()

    def _init_db(self):
        """Create the bookings table if it doesn't exist."""
        with self.engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS bookings (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    service TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    slot_time TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()

    def load(self):
        """Load all bookings."""
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM bookings ORDER BY created_at DESC;"))
            return [dict(row._mapping) for row in result]

    def get_by_user_id(self, user_id: str):
        """Filter bookings by user_id."""
        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT * FROM bookings WHERE user_id = :user_id ORDER BY created_at DESC;"),
                {"user_id": user_id}
            )
            return [dict(row._mapping) for row in result]

    def save(self, data):
        """Save the latest booking to the database."""
        if not data:
            return
        last_booking = data[-1]
        
        with self.engine.connect() as conn:
            conn.execute(
                text("INSERT INTO bookings (name, service, user_id, slot_time) VALUES (:name, :service, :user_id, :slot_time)"),
                {
                    "name": last_booking['name'],
                    "service": last_booking['service'],
                    "user_id": last_booking['user_id'],
                    "slot_time": last_booking['slot_time']
                }
            )
            conn.commit()

db = SupabaseDatabase(DATABASE_URL)
