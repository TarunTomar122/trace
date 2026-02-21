"""
V3 Firestore operations.

Collections:
  v3_for_you_pool       — raw articles for "For You" feed
  v3_deep_dive_pool     — raw articles for "Deep Dives" feed
  v3_trending_pool      — raw articles for "Trending" feed
  v3_summary_cache      — cached summaries keyed by (url_hash, style, seniority)
  v3_user_feeds         — assembled per-user feeds with 3 sections
  v3_seen_urls          — per-user seen URLs with 30-day pruning
  v3_pipeline_runs      — run timestamps for cadence tracking
"""

from __future__ import annotations

import hashlib
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from v1.storage import FirestoreStore  # noqa: E402

FOR_YOU_POOL = "v3_for_you_pool"
DEEP_DIVE_POOL = "v3_deep_dive_pool"
TRENDING_POOL = "v3_trending_pool"
SUMMARY_CACHE = "v3_summary_cache"
USER_FEEDS = "v3_user_feeds"
SEEN_URLS = "v3_seen_urls"
PIPELINE_RUNS = "v3_pipeline_runs"

IST = timezone(timedelta(hours=5, minutes=30))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]


def _today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


class V3Store:
    """Thin wrapper over FirestoreStore for v3-specific collections."""

    def __init__(self) -> None:
        self._base = FirestoreStore()
        self.db = self._base.db

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def get_onboarded_users(self) -> list[dict[str, Any]]:
        return self._base.get_onboarded_users()

    def get_user_profile(self, uid: str) -> dict[str, Any] | None:
        return self._base.get_user_profile(uid)

    def set_feed_build_status(self, uid: str, status: str) -> None:
        self.db.collection("user_profiles").document(uid).set(
            {"feedBuildStatus": status, "feedBuildCompletedAt": _now_iso()},
            merge=True,
        )

    # ------------------------------------------------------------------
    # Pool CRUD (generic for all 3 pool types)
    # ------------------------------------------------------------------

    def upsert_pool_item(
        self, collection: str, url: str, data: dict[str, Any]
    ) -> str:
        doc_id = _url_hash(url)
        data["url"] = url
        data["doc_id"] = doc_id
        data["updated_at"] = _now_iso()
        self.db.collection(collection).document(doc_id).set(data, merge=True)
        return doc_id

    def pool_item_exists(self, collection: str, url: str) -> bool:
        doc_id = _url_hash(url)
        return self.db.collection(collection).document(doc_id).get().exists

    def load_pool(
        self,
        collection: str,
        *,
        interest_ids: set[str] | None = None,
        source_names: set[str] | None = None,
        max_age_days: int = 14,
        exclude_urls: set[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Load active pool items with optional filters."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        docs = (
            self.db.collection(collection)
            .where("is_active", "==", True)
            .stream()
        )
        items: list[dict[str, Any]] = []
        for doc in docs:
            data = doc.to_dict() or {}
            data["doc_id"] = doc.id

            url = data.get("url", "")
            if exclude_urls and url in exclude_urls:
                continue

            if interest_ids is not None:
                if data.get("interest_id", "") not in interest_ids:
                    continue

            if source_names is not None:
                if data.get("source_name", "") not in source_names:
                    continue

            pub = data.get("published_date") or data.get("fetched_at") or ""
            if pub:
                try:
                    dt = datetime.fromisoformat(
                        str(pub).replace("Z", "+00:00")
                    )
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < cutoff:
                        continue
                except (ValueError, TypeError):
                    pass

            if data.get("fetch_error"):
                continue

            items.append(data)

        items.sort(
            key=lambda x: x.get("published_date", "") or x.get("fetched_at", ""),
            reverse=True,
        )
        return items

    def deactivate_stale(self, collection: str, max_age_days: int) -> int:
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=max_age_days)
        ).isoformat()
        docs = (
            self.db.collection(collection)
            .where("is_active", "==", True)
            .stream()
        )
        count = 0
        for doc in docs:
            data = doc.to_dict() or {}
            pub = data.get("published_date") or data.get("fetched_at") or ""
            if pub and str(pub) < cutoff:
                doc.reference.set(
                    {"is_active": False, "deactivated_at": _now_iso()},
                    merge=True,
                )
                count += 1
        return count

    # ------------------------------------------------------------------
    # Summary cache
    # ------------------------------------------------------------------

    def summary_cache_key(
        self, url: str, style: str, seniority: str
    ) -> str:
        raw = f"{url}:{style}:{seniority}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]

    def get_cached_summary(
        self, url: str, style: str, seniority: str
    ) -> dict[str, Any] | None:
        key = self.summary_cache_key(url, style, seniority)
        doc = self.db.collection(SUMMARY_CACHE).document(key).get()
        if doc.exists:
            return doc.to_dict()
        return None

    def save_cached_summary(
        self,
        url: str,
        style: str,
        seniority: str,
        summary: dict[str, Any],
        model: str,
    ) -> None:
        key = self.summary_cache_key(url, style, seniority)
        self.db.collection(SUMMARY_CACHE).document(key).set(
            {
                "url": url,
                "summary_style": style,
                "seniority": seniority,
                "summary": summary,
                "model": model,
                "created_at": _now_iso(),
            }
        )

    # ------------------------------------------------------------------
    # Seen URLs (per-user, with 30-day pruning)
    # ------------------------------------------------------------------

    def get_seen_urls(self, uid: str) -> set[str]:
        doc = self.db.collection(SEEN_URLS).document(uid).get()
        data = doc.to_dict() if doc.exists else {}
        urls_map = data.get("urls", {})
        if not isinstance(urls_map, dict):
            return set()
        return set(urls_map.keys())

    def promote_feed_to_seen(
        self, uid: str, urls: list[str], prune_days: int = 30
    ) -> int:
        ref = self.db.collection(SEEN_URLS).document(uid)
        doc = ref.get()
        data = doc.to_dict() if doc.exists else {}
        urls_map = data.get("urls", {})
        if not isinstance(urls_map, dict):
            urls_map = {}

        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=prune_days)
        ).isoformat()
        urls_map = {
            u: ts
            for u, ts in urls_map.items()
            if isinstance(ts, str) and ts >= cutoff
        }

        now = _now_iso()
        added = 0
        for url in urls:
            if url and url not in urls_map:
                urls_map[url] = now
                added += 1

        ref.set({"urls": urls_map, "updated_at": now}, merge=True)
        return added

    # ------------------------------------------------------------------
    # User feeds
    # ------------------------------------------------------------------

    def write_feed_section(
        self,
        uid: str,
        date: str,
        section: str,
        items: list[dict[str, Any]],
    ) -> None:
        self.db.collection(USER_FEEDS).document(uid).collection(
            "daily"
        ).document(date).set(
            {
                section: items,
                f"{section}_count": len(items),
                f"{section}_generated_at": _now_iso(),
            },
            merge=True,
        )

    def write_feed_metadata(
        self, uid: str, date: str, metadata: dict[str, Any]
    ) -> None:
        self.db.collection(USER_FEEDS).document(uid).collection(
            "daily"
        ).document(date).set(
            {"date": date, "metadata": metadata, "assembled_at": _now_iso()},
            merge=True,
        )

    def load_feed(
        self, uid: str, date: str
    ) -> dict[str, Any]:
        doc = (
            self.db.collection(USER_FEEDS)
            .document(uid)
            .collection("daily")
            .document(date)
            .get()
        )
        return doc.to_dict() if doc.exists else {}

    # ------------------------------------------------------------------
    # Pipeline run tracking
    # ------------------------------------------------------------------

    def record_run(self, job_name: str, extra: dict[str, Any] | None = None) -> None:
        data = {"last_run_at": _now_iso(), "status": "success"}
        if extra:
            data.update(extra)
        self.db.collection(PIPELINE_RUNS).document(job_name).set(
            data, merge=True
        )

    def last_run_at(self, job_name: str) -> str | None:
        doc = self.db.collection(PIPELINE_RUNS).document(job_name).get()
        if doc.exists:
            return (doc.to_dict() or {}).get("last_run_at")
        return None

    def should_run(self, job_name: str, cadence_days: int) -> bool:
        last = self.last_run_at(job_name)
        if not last:
            return True
        try:
            dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            return datetime.now(timezone.utc) - dt > timedelta(days=cadence_days)
        except (ValueError, TypeError):
            return True
