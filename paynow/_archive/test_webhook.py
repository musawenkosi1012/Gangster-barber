import requests
import hashlib

# Configuration (Use your Paynow integration key)
INTEGRATION_KEY = "1f22448d-db67-471e-a097-704a69ad503c"
WEBHOOK_URL = "http://localhost:8001/api/payments/webhook"

def simulate_paynow_webhook():
    # 1. Prepare simulated data from Paynow
    # The order must match for the hash to be valid
    payload = {
        "reference": "Booking #12345",
        "paynowreference": "42877142",
        "amount": "2.00",
        "status": "Paid",
        "pollurl": "https://www.paynow.co.zw/Interface/CheckPayment/?guid=test",
        "token": "TOK_ABC_123_XYZ",
        "tokenexpiry": "30DEC2026",
        "paymentfrauddecision": "Accept"
    }

    # 2. Generate security hash (values + integration_key)
    # We follow the same logic as the backend: iterate keys and concatenate Key+Value
    verify_string = ""
    for k, v in payload.items():
        verify_string += f"{k}{v}"
    verify_string += INTEGRATION_KEY
    
    security_hash = hashlib.sha512(verify_string.encode('utf-8')).hexdigest().upper()
    payload["Hash"] = security_hash

    # 3. Send the POST request to our webhook endpoint
    print(f"--- Sending Simulated Paynow Webhook to {WEBHOOK_URL} ---")
    try:
        r = requests.post(WEBHOOK_URL, data=payload, timeout=10)
        print(f"Status Code: {r.status_code}")
        print(f"Response Body: {r.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    simulate_paynow_webhook()
