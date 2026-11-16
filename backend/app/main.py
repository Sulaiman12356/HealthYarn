"""HealthYarn FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import public

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings.static_audio_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="HealthYarn API",
    description="Voice-first multilingual Nigerian health information API (ITDC 2026)",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "media-src 'self' blob:; "
        "img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self';"
    )
    return response


settings.static_audio_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(Path(settings.static_audio_dir).parent)), name="static")

app.include_router(public.router)


@app.get("/health")
def health_check():
    return JSONResponse({"status": "ok", "service": "healthyarn"})
