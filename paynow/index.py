import traceback

try:
    from main import app
except Exception as _import_err:
    # Fallback diagnostic app — shows the real startup error as JSON
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()
    _err_detail = traceback.format_exc()

    @app.get("/{path:path}")
    @app.post("/{path:path}")
    async def _startup_error(path: str = ""):
        return JSONResponse(
            status_code=503,
            content={"error": "startup_failure", "detail": _err_detail},
        )
