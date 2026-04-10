import requests
import time
BASE_URL = "http://localhost:8003/api/payments"
MERCHANT_EMAIL = "gangsterbarbermobilebarber@gmail.com"

def run_mobile_test(name, phone, wait_time):
    print(f"\n--- Running: {name} ({phone}) ---")
    payload = {
        "booking_id": int(time.time()),
        "customer_name": "Test User",
        "customer_email": MERCHANT_EMAIL,
        "service": "Taper Fade",
        "amount": 5.0,
        "payment_method": "mobile",
        "phone_number": phone
    }
    r = requests.post(f"{BASE_URL}/initiate", json=payload, timeout=30)
    data = r.json()
    if not data.get('success'):
        print(f"FAILED: {data.get('error')}")
        return

    print(f"Initiated. Poll URL: {data['poll_url']}")
    print(f"Waiting {wait_time}s for scenario to trigger...")
    time.sleep(wait_time)
    
    r_status = requests.post(f"{BASE_URL}/check-status", json={"poll_url": data['poll_url']}, timeout=30)
    print("FINAL STATUS:", r_status.json())

# Delayed Success (0772222222)
run_mobile_test("Mobile Delayed Success", "0772222222", 35)

# User Cancelled (0773333333)
run_mobile_test("Mobile User Cancelled", "0773333333", 35)

# Insufficient Balance (0774444444) - Immediate failure
run_mobile_test("Mobile Insufficient Balance", "0774444444", 0)
