import sys
from paynow_client import get_paynow_client

try:
    paynow = get_paynow_client()
    payment = paynow.create_payment("Test-0.20c", "test@gangsterbarber.com")
    payment.add("Barber Test 20c", 0.20)
    print("Initiating .20 EcoCash transaction to 0773772047...")
    response = paynow.send_mobile(payment, "0773772047", "ecocash")
    
    if response.success:
        print("Transaction successfully initiated!")
        print(f"Poll URL: {response.poll_url}")
        print(f"Instructions: {response.instructions}")
    else:
        print("Transaction failed!")
        print(f"Error: {response.error}")
except Exception as e:
    print(f"Error running test: {e}")
