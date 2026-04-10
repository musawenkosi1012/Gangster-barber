import requests
BASE_URL = "http://localhost:8003/api/payments"
payload = {
    "booking_id": 9995,
    "customer_name": "Musa",
    "customer_email": "gangsterbarbermobilebarber@gmail.com",
    "service": "Taper Fade",
    "amount": 2.0, # Updated Booking Fee
    "payment_method": "mobile",
    "phone_number": "0771111111"
}
print("Initiating $2.00 Mobile Payment...")
r = requests.post(f"{BASE_URL}/initiate", json=payload, timeout=30)
print("RESPONSE:", r.json())
