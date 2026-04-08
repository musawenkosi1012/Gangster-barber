from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

load_dotenv()

USER = "postgres.luseceypnzarplfnxekj"
PASSWORD = "Dad@305581."
DBNAME = "postgres"

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
