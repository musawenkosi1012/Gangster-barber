import requests
import time
BASE_URL = "http://localhost:8003/api/payments"
payload = {"booking_id": 9992, "customer_name": "Musa", "customer_email": "gangsterbarbermobilebarber@gmail.com", "service": "Taper Fade", "amount": 5.0, "payment_method": "mobile", "phone_number": "0771111111"}
print("Sending request...")
try:
    r = requests.post(f"{BASE_URL}/initiate", json=payload, timeout=30)
    print("STATUS:", r.status_code)
    print("RESPONSE:", r.json())
except Exception as e:
    print("ERROR:", e)
