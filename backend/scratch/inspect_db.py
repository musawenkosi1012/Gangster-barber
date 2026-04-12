import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from app.db.base import engine
from sqlalchemy import inspect

def check_tables():
    inspector = inspect(engine)
    for table_name in inspector.get_table_names(schema="public"):
        print(f"Table: {table_name}")
        for column in inspector.get_columns(table_name, schema="public"):
            print(f"  - {column['name']} ({column['type']})")

if __name__ == "__main__":
    try:
        check_tables()
    except Exception as e:
        print(f"Error: {e}")
