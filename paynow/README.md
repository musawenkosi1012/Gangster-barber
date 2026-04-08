# Gangster Barber — PayNow Payment Service

A standalone FastAPI microservice handling PayNow Zimbabwe payments for barber bookings.
Runs on port **8001**, separate from the main booking backend (port 8000).

## Setup

### 1. Create a virtual environment
```bash
cd paynow
python -m venv venv
venv\Scripts\activate      # Windows
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure `.env`
Copy `.env.example` to `.env` and fill in your PayNow credentials:
```bash
copy .env.example .env
```

### 4. Run the server
```bash
uvicorn main:app --reload --port 8001
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/payments/initiate` | Start a payment (web or EcoCash) |
| `POST` | `/api/payments/check-status` | Poll payment status |
| `POST` | `/api/payments/webhook` | PayNow result URL callback |
| `GET`  | `/api/payments/services` | List services & prices |

---

## Payment Flow

### Web (Browser redirect)
1. `POST /api/payments/initiate` with no `phone_number`
2. Redirect user to `redirect_url` from response
3. User pays on PayNow
4. Poll `/api/payments/check-status` with `poll_url`

### Mobile (EcoCash)
1. `POST /api/payments/initiate` with `phone_number` (e.g. `0771234567`)
2. Show `instructions` from response to user
3. User approves on phone
4. Poll `/api/payments/check-status` with `poll_url`

---

## Getting PayNow Credentials
1. Register at [paynow.co.zw](https://www.paynow.co.zw)
2. Go to **Settings → Integrations**
3. Create a new integration and copy the **Integration ID** and **Integration Key**
