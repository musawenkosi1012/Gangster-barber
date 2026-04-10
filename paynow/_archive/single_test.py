import requests
BASE_URL = "http://localhost:8001/api/payments"
payload = {
    "booking_id": 999,
    "customer_name": "Musa",
    "customer_email": "gansterbarbermobilebarber@gmail.com",
    "service": "Taper Fade",
    "amount": 5.0,
    "payment_method": "mobile",
    "phone_number": "0771111111"
}
try:
    r = requests.post(f"{BASE_URL}/initiate", json=payload)
    print("STATUS:", r.status_code)
    data = r.json()
    print("SUCCESS:", data.get('success'))
    print("ERROR:", data.get('error'))
    print("FULL:", data)
except Exception as e:
    print("EXCEPTION:", e)
