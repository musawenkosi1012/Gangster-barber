import requests
import time

BASE_URL = "http://localhost:8001/api/payments"
MERCHANT_EMAIL = "test@example.com"

SCENARIOS = [
    {"name": "Mobile Success", "method": "mobile", "phone": "0771111111", "wait": 10},
    {"name": "VMC Success", "method": "vmc", "token": "{11111111-1111-1111-1111-111111111111}", "wait": 10},
]

for s in SCENARIOS:
    print(f"\n--- {s['name']} ---")
    payload = {
        "booking_id": int(time.time()),
        "customer_name": "Test User",
        "customer_email": MERCHANT_EMAIL,
        "service": "Taper Fade",
        "amount": 5.0,
        "payment_method": s["method"],
        "token": s.get("token"),
        "phone_number": s.get("phone")
    }
    r = requests.post(f"{BASE_URL}/initiate", json=payload)
    print("Status Code:", r.status_code)
    print("Response Body:", r.text)
