import time
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from ..models import SystemHealthLog, PaymentTransaction

class HealthService:
    def __init__(self):
        self.CLERK_JWKS_URL = "https://clerk.gangsterbarber.com/.well-known/jwks.json" # Placeholder

    def classify_status(self, latency_ms: int, failure_count: int = 0) -> str:
        """Categorizes system health based on tri-state logic."""
        if latency_ms < 0 or failure_count > 3:
            return "DOWN"
        if latency_ms > 300 or failure_count > 0:
            return "DEGRADED"
        return "OPERATIONAL"

    async def probe_database(self, db: Session) -> dict:
        start = time.perf_counter()
        try:
            db.execute(text("SELECT 1"))
            latency = int((time.perf_counter() - start) * 1000)
            status = self.classify_status(latency)
            return {"status": status, "latency": latency}
        except Exception as e:
            return {"status": "DOWN", "latency": -1, "error": str(e)}

    async def probe_auth(self) -> dict:
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                # We check the JWKS endpoint as a heartbeat for the Auth cluster
                # Note: In a real zim environment, we handle network flickering
                resp = await client.get("https://clerk.com/.well-known/jwks.json")
                latency = int((time.perf_counter() - start) * 1000)
                status = self.classify_status(latency) if resp.status_code == 200 else "DOWN"
                return {"status": status, "latency": latency}
        except Exception as e:
            return {"status": "DOWN", "latency": -1, "error": str(e)}

    async def probe_gateway(self, db: Session) -> dict:
        """Analyzes the success rate of the last 10 payment callbacks."""
        last_payments = db.query(PaymentTransaction).order_by(PaymentTransaction.created_at.desc()).limit(10).all()
        if not last_payments:
            return {"status": "OPERATIONAL", "latency": 0} # No data yet
            
        failures = len([p for p in last_payments if p.status == "failed"])
        # We simulate a latency check for the gateway ping
        latency = 42 # Tactical average
        status = "DEGRADED" if failures > 2 else "OPERATIONAL"
        if failures > 5: status = "DOWN"
        
        return {"status": status, "latency": latency, "failures": failures}

    def calculate_uptime(self, db: Session, days: int = 30) -> float:
        """Computes the ratio of operational intervals over a rolling window."""
        cutoff = datetime.now() - timedelta(days=days)
        total = db.query(SystemHealthLog).filter(SystemHealthLog.timestamp >= cutoff).count()
        if total == 0: return 100.0
        
        down_states = db.query(SystemHealthLog).filter(
            SystemHealthLog.timestamp >= cutoff,
            SystemHealthLog.status == "DOWN"
        ).count()
        
        uptime = ((total - down_states) / total) * 100
        return round(uptime, 2)

    async def record_heartbeat(self, db: Session):
        """Executes full system probes in parallel to minimize latency."""
        import asyncio
        
        # Dispatch all heartbeats simultaneously (The Parallel Pulse)
        results = await asyncio.gather(
            self.probe_database(db),
            self.probe_auth(),
            self.probe_gateway(db),
            return_exceptions=True
        )
        
        # Unpack with safety (isolation logic)
        db_health = results[0] if not isinstance(results[0], Exception) else {"status": "DOWN", "latency": -1}
        auth_health = results[1] if not isinstance(results[1], Exception) else {"status": "DOWN", "latency": -1}
        gateway_health = results[2] if not isinstance(results[2], Exception) else {"status": "DOWN", "latency": -1}

        # Persist logs
        db.add(SystemHealthLog(service="DATABASE", status=db_health["status"], latency_ms=db_health.get("latency", 0)))
        db.add(SystemHealthLog(service="AUTH", status=auth_health["status"], latency_ms=auth_health.get("latency", 0)))
        db.add(SystemHealthLog(service="GATEWAY", status=gateway_health["status"], latency_ms=gateway_health.get("latency", 0)))
        db.commit()
        
        return {
            "database": db_health,
            "auth": auth_health,
            "gateway": gateway_health,
            "uptime": self.calculate_uptime(db),
            "cluster": "8005-A"
        }

health_service = HealthService()
