from paynow import Paynow
import os
import logging

logger = logging.getLogger("paynow")

def get_paynow_client() -> Paynow:
    """Returns a configured Paynow client using environment variables directly.
    Lazy initialisation — no module-level validation that could crash the import.
    """
    integration_id = os.getenv("PAYNOW_INTEGRATION_ID", "")
    integration_key = os.getenv("PAYNOW_INTEGRATION_KEY", "")
    return_url = os.getenv("PAYNOW_RETURN_URL", "")
    result_url = os.getenv("PAYNOW_RESULT_URL", "")

    if not integration_id or not integration_key:
        logger.error("PAYNOW_INTEGRATION_ID / PAYNOW_INTEGRATION_KEY env vars are not set.")

    return Paynow(integration_id, integration_key, return_url, result_url)
