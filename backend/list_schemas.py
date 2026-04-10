from sqlalchemy import text
from app.db.base import engine

with engine.connect() as conn:
    result = conn.execute(text("SELECT schema_name FROM information_schema.schemata"))
    print("Schemas in database:")
    for row in result:
        print(f" - {row[0]}")
