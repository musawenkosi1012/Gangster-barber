import os
import urllib.parse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def test_conn():
    user = urllib.parse.quote_plus(os.getenv("user", "postgres"))
    password = urllib.parse.quote_plus(os.getenv("password", ""))
    host = os.getenv("host", "localhost")
    port = os.getenv("port", "5432")
    dbname = os.getenv("dbname", "postgres")
    
    url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}?sslmode=require"
    print(f"Testing connection to {host}...")
    
    try:
        engine = create_engine(url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            print("Executing 'SELECT 1'...")
            res = conn.execute(text("SELECT 1")).scalar()
            print(f"Result: {res}")
            print("Connection Successful!")
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    test_conn()
