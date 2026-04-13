from paynow import Paynow
from pydantic_settings import BaseSettings
from typing import Optional

class PaynowSettings(BaseSettings):
    PAYNOW_INTEGRATION_ID: str
    PAYNOW_INTEGRATION_KEY: str
    PAYNOW_RETURN_URL: str = ""
    PAYNOW_RESULT_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

paynow_settings = PaynowSettings()

def get_paynow_client() -> Paynow:
    """Returns a configured Paynow client using Pydantic settings."""
    return Paynow(
        paynow_settings.PAYNOW_INTEGRATION_ID,
        paynow_settings.PAYNOW_INTEGRATION_KEY,
        paynow_settings.PAYNOW_RETURN_URL,
        paynow_settings.PAYNOW_RESULT_URL,
    )
