from sqlalchemy import text
from app.db.base import engine

with engine.connect() as conn:
    result = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
    print("Tables in public schema:")
    for row in result:
        print(f" - {row[0]}")
