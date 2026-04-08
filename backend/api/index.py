import os
import sys

# Append the parent directory to sys.path so 'app.main' resolves correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from mangum import Mangum

handler = Mangum(app)
