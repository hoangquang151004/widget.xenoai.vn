from typing import Optional
from urllib.parse import urlparse

from fastapi import Request

API_STORAGE_PREFIX = "/api/storage/"
LEGACY_STORAGE_PREFIX = "/storage/"


def _extract_internal_storage_path(logo_url: str) -> Optional[str]:
    value = (logo_url or "").strip()
    if not value:
        return None

    parsed = urlparse(value)
    candidate_path = parsed.path if parsed.scheme or parsed.netloc else value
    if not candidate_path.startswith("/"):
        candidate_path = f"/{candidate_path}"

    for prefix in (API_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX):
        if candidate_path.startswith(prefix):
            return candidate_path[len(prefix) :].lstrip("/")

    return None


def build_api_storage_path(relative_path: str) -> str:
    normalized = (relative_path or "").strip().lstrip("/")
    return f"{API_STORAGE_PREFIX}{normalized}" if normalized else API_STORAGE_PREFIX.rstrip("/")


def canonicalize_logo_url(logo_url: Optional[str]) -> Optional[str]:
    value = (logo_url or "").strip()
    if not value:
        return None

    internal_path = _extract_internal_storage_path(value)
    if internal_path is None:
        return value

    return build_api_storage_path(internal_path)


def resolve_logo_url(request: Request, logo_url: Optional[str]) -> Optional[str]:
    canonical = canonicalize_logo_url(logo_url)
    if not canonical:
        return None

    internal_path = _extract_internal_storage_path(canonical)
    if internal_path is None:
        return canonical

    return str(request.url_for("api-storage", path=internal_path))
