import sys
import time
from paynow_client import get_paynow_client

def test_payment(method_name, number):
    try:
        paynow = get_paynow_client()
        payment = paynow.create_payment(f"Test-{method_name}-0.20c", "test@gangsterbarber.com")
        payment.add(f"Barber Test {method_name} 20c", 0.20)
        
        print(f"Initiating .20 {method_name} transaction to {number}...")
        response = paynow.send_mobile(payment, number, method_name)
        
        if response.success:
            print(f"Success: {method_name} successfully initiated!")
            print(f"Poll URL: {response.poll_url}")
            print(f"Instructions: {response.instructions}\n")
        else:
            print(f"Failed: {method_name} failed!")
            print(f"Error: {response.error}\n")
    except Exception as e:
        print(f"Error running {method_name} test: {e}\n")

test_payment("omari", "0773772047")
time.sleep(2) # brief pause
test_payment("innbucks", "0773772047")
