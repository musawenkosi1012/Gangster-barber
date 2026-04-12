from slowapi import Limiter
from slowapi.util import get_remote_address

# 🚀 Production Protection Suite: Centralized Rate Limiting
limiter = Limiter(key_func=get_remote_address)
