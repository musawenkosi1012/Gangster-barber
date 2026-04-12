import sys
import os
sys.path.append(os.getcwd())

from app.db.base import engine
from sqlalchemy import text

def check():
    with engine.connect() as conn:
        print("Connected!")
        res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        for row in res:
            print(f"Table: {row[0]}")
            # Check columns
            cols = conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{row[0]}' AND table_schema = 'public'"))
            for c in cols:
                print(f"  - {c[0]} ({c[1]})")

if __name__ == "__main__":
    check()
