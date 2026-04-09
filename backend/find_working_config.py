from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

load_dotenv()

USER = os.getenv("user")
PASSWORD = os.getenv("password")
DBNAME = os.getenv("dbname")

if not all([USER, PASSWORD, DBNAME]):
    print("Error: Missing database credentials in environment variables.")
    exit(1)

test_configs = [
    {"host": "aws-0-eu-west-1.pooler.supabase.com", "port": 5432},
    {"host": "aws-0-eu-west-1.pooler.supabase.com", "port": 6543},
    {"host": "aws-0-us-east-1.pooler.supabase.com", "port": 5432},
    {"host": "aws-0-us-east-1.pooler.supabase.com", "port": 6543},
]

for config in test_configs:
    host = config["host"]
    port = config["port"]
    print(f"\n--- Testing {host}:{port} ---")
    url = f"postgresql+psycopg2://{USER}:{PASSWORD}@{host}:{port}/{DBNAME}?sslmode=require"
    try:
        engine = create_engine(url)
        with engine.connect() as conn:
            print(f"SUCCESS on {host}:{port}!")
            # If successful, we should probably use this one
            break
    except Exception as e:
        print(f"FAILED on {host}:{port}: {str(e).splitlines()[0]}")
