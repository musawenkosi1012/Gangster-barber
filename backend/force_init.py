from app.db.base import init_db, engine
print("Starting init_db()...")
try:
    init_db()
    print("init_db() completed.")
except Exception as e:
    print(f"Error during init_db(): {e}")
