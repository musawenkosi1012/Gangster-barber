import sys
import traceback

app = None  # defined at top-level for @vercel/python validator

try:
    from app.main import app
except Exception:
    _err = traceback.format_exc()
    print(f"STARTUP IMPORT ERROR:\n{_err}", file=sys.stderr)

    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    app = FastAPI()
    _captured = _err

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    async def crash_report(request: Request, path: str = ""):
        return JSONResponse(status_code=503, content={"startup_error": _captured})
