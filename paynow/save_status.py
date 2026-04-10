import requests
import json
BASE_URL = "http://localhost:8001/api/payments"
payload = {"booking_id": 999, "customer_name": "Musa", "customer_email": "gansterbarbermobilebarber@gmail.com", "service": "Taper Fade", "amount": 5.0, "payment_method": "mobile", "phone_number": "0771111111"}
r = requests.post(f"{BASE_URL}/initiate", json=payload)
with open('final_status.json', 'w') as f:
    json.dump(r.json(), f)
