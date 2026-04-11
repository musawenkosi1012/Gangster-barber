import os
from paynow import Paynow
from dotenv import load_dotenv

load_dotenv()

PAYNOW_INTEGRATION_ID = os.getenv("PAYNOW_INTEGRATION_ID")
PAYNOW_INTEGRATION_KEY = os.getenv("PAYNOW_INTEGRATION_KEY")
PAYNOW_RETURN_URL = os.getenv("PAYNOW_RETURN_URL", "")
PAYNOW_RESULT_URL = os.getenv("PAYNOW_RESULT_URL", "")


def get_paynow_client() -> Paynow:
    """Returns a configured Paynow client."""
    if not PAYNOW_INTEGRATION_ID or not PAYNOW_INTEGRATION_KEY:
        raise RuntimeError(
            "Paynow credentials missing. Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY in .env"
        )
    return Paynow(
        PAYNOW_INTEGRATION_ID,
        PAYNOW_INTEGRATION_KEY,
        PAYNOW_RETURN_URL,
        PAYNOW_RESULT_URL,
    )
