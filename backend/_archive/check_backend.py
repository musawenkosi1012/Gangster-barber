import requests
import time

def check_backend():
    url = "http://localhost:8005/"
    print(f"Checking {url}...")
    try:
        start = time.time()
        response = requests.get(url, timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        print(f"Time taken: {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_backend()
