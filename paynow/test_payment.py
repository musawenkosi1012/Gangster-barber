import requests

print("Testing Healthcheck:")
res1 = requests.get("http://localhost:8001/")
print(res1.status_code, res1.json())

print("\nTesting Payment Initiation:")
payload = {
    "booking_id": "test_123",
    "service": "Taper Fade",
    "amount": 5.00,
    "customer_email": "test@example.com"
}
res2 = requests.post("http://localhost:8001/api/payments/initiate", json=payload)
print(res2.status_code, res2.json())
