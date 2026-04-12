import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

user = os.getenv("user")
password = os.getenv("password")
host = os.getenv("host")
port = os.getenv("port")
dbname = os.getenv("dbname")

def migrate():
    print("Starting Asset Pipeline Transition: Dropping legacy 'image_url' column...")
    try:
        conn = psycopg2.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            database=dbname
        )
        cur = conn.cursor()
        
        # Drop the column if it exists
        cur.execute("ALTER TABLE public.services DROP COLUMN IF EXISTS image_url;")
        
        conn.commit()
        cur.close()
        conn.close()
        print("SUCCESS: 'image_url' column decommissioned.")
    except Exception as e:
        print(f"ERROR during migration: {e}")

if __name__ == "__main__":
    migrate()
