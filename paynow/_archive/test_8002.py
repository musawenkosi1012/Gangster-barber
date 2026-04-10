import requests
BASE_URL = "http://localhost:8001/api/payments"
payload = {
    "booking_id": 9991,
    "customer_name": "Musa",
    "customer_email": "gangsterbarbermobilebarber@gmail.com",
    "service": "Taper Fade",
    "amount": 5.0,
    "payment_method": "mobile",
    "phone_number": "0771111111"
}
r = requests.post(f"{BASE_URL}/initiate", json=payload)
print("CODE:", r.status_code)
print("TEXT:", r.text)
