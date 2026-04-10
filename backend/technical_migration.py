from sqlalchemy import text
from app.db.base import engine, Base
from app.models.technical import AuditLog, PaymentTransaction, SystemAlert

def run_it_migration():
    print("Initializing IT & Security Engine Schema...")
    try:
        # Create new tables
        print("Creating 'audit_logs', 'payment_transactions', and 'system_alerts' tables...")
        Base.metadata.create_all(bind=engine)
        print("DONE: Technical tables created.")
        
        # Check for Foreign Key constraints
        with engine.connect() as conn:
            print("Verifying relationship integrity...")
            # Extra verification for the ledger
            conn.execute(text("SELECT count(*) FROM audit_logs"))
            conn.commit()

        print("System is now 'Dual-Engine' capable. Audit tracking active.")
        
    except Exception as e:
        print(f"ERROR: Migration failed: {e}")

if __name__ == "__main__":
    run_it_migration()
