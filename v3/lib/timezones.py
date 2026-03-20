from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore


DEFAULT_TIMEZONE = "UTC"


def normalize_timezone(value: Any) -> str:
    tz = str(value or "").strip()
    if not tz:
        return DEFAULT_TIMEZONE
    if ZoneInfo is None:
        return DEFAULT_TIMEZONE
    try:
        ZoneInfo(tz)
        return tz
    except Exception:
        return DEFAULT_TIMEZONE


def profile_timezone(profile: dict[str, Any] | None) -> str:
    return normalize_timezone((profile or {}).get("timezone"))


def now_for_profile(profile: dict[str, Any] | None, now_utc: datetime | None = None) -> datetime:
    base = now_utc or datetime.now(timezone.utc)
    tz_name = profile_timezone(profile)
    if ZoneInfo is None or tz_name == DEFAULT_TIMEZONE:
        return base.astimezone(timezone.utc)
    return base.astimezone(ZoneInfo(tz_name))


def local_date_for_profile(profile: dict[str, Any] | None, now_utc: datetime | None = None) -> str:
    return now_for_profile(profile, now_utc).strftime("%Y-%m-%d")
