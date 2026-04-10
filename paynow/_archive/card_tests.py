import requests
import time
BASE_URL = "http://localhost:8003/api/payments"

def run_scenario(name, method, token=None, phone=None):
    print(f"\n--- {name} ---")
    payload = {
        "booking_id": int(time.time()),
        "customer_name": "Test User",
        "customer_email": "gangsterbarbermobilebarber@gmail.com",
        "service": "Taper Fade",
        "amount": 5.0,
        "payment_method": method,
        "phone_number": phone,
        "token": token
    }
    r = requests.post(f"{BASE_URL}/initiate", json=payload, timeout=30)
    data = r.json()
    print("INITIATE:", data)
    if data.get('success'):
        print("Waiting 10s...")
        time.sleep(10)
        r2 = requests.post(f"{BASE_URL}/check-status", json={"poll_url": data['poll_url']}, timeout=30)
        print("STATUS:", r2.json())
    else:
        print("ERROR:", data.get('error'))

run_scenario("VMC Success", "vmc", token="{11111111-1111-1111-1111-111111111111}")
run_scenario("Zimswitch Success", "zimswitch", token="11111111111111111111111111111111")
