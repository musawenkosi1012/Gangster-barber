import requests
import time

def check_docs():
    url = "http://localhost:8005/docs"
    print(f"Checking {url}...")
    try:
        start = time.time()
        response = requests.get(url, timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Headers: {response.headers.get('Content-Type')}")
        print(f"Time taken: {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_docs()
