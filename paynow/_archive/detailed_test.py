import requests
import time
BASE_URL = "http://localhost:8003/api/payments"
payload = {"booking_id": 9993, "customer_name": "Musa", "customer_email": "gangsterbarbermobilebarber@gmail.com", "service": "Taper Fade", "amount": 5.0, "payment_method": "mobile", "phone_number": "0771111111"}
print("Initiating...")
r = requests.post(f"{BASE_URL}/initiate", json=payload, timeout=30)
data = r.json()
print("INITIATE:", data)
if data.get('success'):
    poll_url = data['poll_url']
    print(f"Waiting 10s for status (Success expected)...")
    time.sleep(10)
    r2 = requests.post(f"{BASE_URL}/check-status", json={"poll_url": poll_url}, timeout=30)
    print("STATUS:", r2.json())
