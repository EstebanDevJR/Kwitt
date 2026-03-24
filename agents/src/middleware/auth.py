import os
import logging
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

API_KEY_HEADER = "x-api-key"
PUBLIC_PATHS = {"/", "/health", "/portfolio/config"}


def get_allowed_origins() -> list[str]:
    """Retorna lista blanca de orígenes CORS"""
    env_origins = os.getenv("ALLOWED_ORIGINS", "")
    if env_origins:
        return [o.strip() for o in env_origins.split(",") if o.strip()]
    return []


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware de autenticación por API Key"""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in PUBLIC_PATHS:
            return await call_next(request)

        if not os.getenv("AGENTS_API_KEY"):
            logger.warning("[Auth] AGENTS_API_KEY no configurado - autenticación deshabilitada")
            return await call_next(request)

        api_key = request.headers.get(API_KEY_HEADER)
        if not api_key:
            logger.warning(f"[Auth] Missing API key for {path}")
            raise HTTPException(401, "X-API-Key header requerido")

        expected_key = os.getenv("AGENTS_API_KEY")
        if api_key != expected_key:
            logger.warning(f"[Auth] Invalid API key for {path}")
            raise HTTPException(403, "API key inválida")

        return await call_next(request)


def validate_job_id(job_id: str) -> bool:
    """Valida que job_id sea un UUID válido"""
    import uuid
    try:
        uuid.UUID(job_id)
        return True
    except (ValueError, TypeError):
        return False


def validate_framework(framework: str) -> bool:
    """Valida que el framework esté en la lista permitida"""
    valid_frameworks = {"html", "nextjs", "react", "vue", "astro", "svelte"}
    return framework.lower().strip() in valid_frameworks