import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any


DOCS_BLOCKLIST_PATTERNS = [
    "/docs",
    "/documentation",
    "/reference",
    "/api/",
    "/handbook",
    "/manual",
    "/sdk",
    "/guides",
    "documentation",
    "docs",
    "reference",
    "api reference",
    "getting started",
    "tutorial",
    "beginner",
    "course",
    "handbook",
    "manual",
    "wikipedia.org",
]


def generate_pool_id(url: str, date_str: str) -> str:
    """Generate a stable pool item ID from URL + date."""
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    return f"pool_{date_str}_{url_hash}"


def is_blocklisted_url(
    url: str,
    title: str = "",
    patterns: list[str] | None = None,
) -> bool:
    url_lower = (url or "").lower()
    title_lower = (title or "").lower()
    if not url_lower:
        return False
    blocklist = patterns or DOCS_BLOCKLIST_PATTERNS
    for pattern in blocklist:
        if pattern in url_lower or pattern in title_lower:
            return True
    return False


def get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def within_hours(item: dict[str, Any], max_age_hours: int) -> bool:
    fetched_at = item.get("fetched_at")
    if not fetched_at:
        return False
    try:
        dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
        now = datetime.utcnow()
        if dt.tzinfo:
            now = now.replace(tzinfo=dt.tzinfo)
        age_hours = (now - dt).total_seconds() / 3600
        return age_hours <= max_age_hours
    except (ValueError, TypeError):
        return False
