import requests
import time
import uuid

BASE_URL = "http://localhost:8003/api/payments"
MERCHANT_EMAIL = "gangsterbarbermobilebarber@gmail.com" # Should be the merchant's login email

SCENARIOS = [
    # Mobile Money
    {"name": "Mobile Success", "method": "mobile", "phone": "0771111111", "wait": 10},
    {"name": "Mobile Delayed", "method": "mobile", "phone": "0772222222", "wait": 35},
    {"name": "Mobile Cancelled", "method": "mobile", "phone": "0773333333", "wait": 35},
    {"name": "Mobile Insufficient", "method": "mobile", "phone": "0774444444", "wait": 0},
    
    # VMC (Visa/Mastercard)
    {"name": "VMC Success", "method": "vmc", "token": "{11111111-1111-1111-1111-111111111111}", "wait": 10},
    {"name": "VMC Pending", "method": "vmc", "token": "{22222222-2222-2222-2222-222222222222}", "wait": 35},
    {"name": "VMC Cancelled", "method": "vmc", "token": "{33333333-3333-3333-3333-333333333333}", "wait": 35},
    {"name": "VMC Insufficient", "method": "vmc", "token": "{44444444-4444-4444-4444-444444444444}", "wait": 0},

    # Zimswitch
    {"name": "Zimswitch Success", "method": "zimswitch", "token": "11111111111111111111111111111111", "wait": 10},
    {"name": "Zimswitch Pending", "method": "zimswitch", "token": "22222222222222222222222222222222", "wait": 35},
    {"name": "Zimswitch Cancelled", "method": "zimswitch", "token": "33333333333333333333333333333333", "wait": 35},
    {"name": "Zimswitch Insufficient", "method": "zimswitch", "token": "44444444444444444444444444444444", "wait": 0},
]

def log(msg):
    print(msg)
    with open("test_run.log", "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def run_test(scenario):
    log(f"\n--- Running: {scenario['name']} ---")
    payload = {
        "booking_id": int(time.time()),
        "customer_name": "Test User",
        "customer_email": MERCHANT_EMAIL,
        "service": "Taper Fade",
        "amount": 5.00,
        "payment_method": scenario["method"],
        "phone_number": scenario.get("phone"),
        "token": scenario.get("token")
    }
    
    try:
        res = requests.post(f"{BASE_URL}/initiate", json=payload, timeout=20)
        data = res.json()
        
        if not data.get("success"):
            error_msg = data.get("error", "Unknown error")
            log(f"Initiation Failed: {error_msg}")
            if "Insufficient" in scenario["name"] and "Insufficient balance" in str(error_msg):
                log("PASSED (Expected failure)")
            else:
                log(f"FAILED (Full Response: {data})")
            return

        log(f"Initiated successfully. Poll URL: {data.get('poll_url')}")
        
        if scenario["wait"] > 0:
            log(f"Waiting {scenario['wait']}s for Paynow to process...")
            time.sleep(scenario["wait"])
            
            status_res = requests.post(f"{BASE_URL}/check-status", json={"poll_url": data["poll_url"]}, timeout=20)
            status_data = status_res.json()
            log(f"Current Status: {status_data['status']} (Paid: {status_data['paid']})")
            
            if "Success" in scenario["name"] or "Pending" in scenario["name"]:
                if status_data["paid"] or status_data["status"] in ["paid", "awaiting delivery"]:
                    log("PASSED")
                else:
                    log("FAILED (Status unexpected)")
            elif "Cancelled" in scenario["name"]:
                if status_data["status"] in ["cancelled", "failed"]:
                    log("PASSED")
                else:
                    log("FAILED (Status unexpected)")
        else:
            log("PASSED (No wait required)")

    except Exception as e:
        log(f"Error: {e}")

if __name__ == "__main__":
    with open("test_run.log", "w", encoding="utf-8") as f:
        f.write(f"--- STARTING PAYNOW TESTS AT {time.ctime()} ---\n")
    
    for s in SCENARIOS:
        run_test(s)
        time.sleep(2)
