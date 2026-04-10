import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("APP_PORT", 8005))
    print(f"Starting backend on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
