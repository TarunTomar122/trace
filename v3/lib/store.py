"""
V3 storage operations through the configured Firestore-compatible backend.

Collections:
  v3_for_you_pool       — raw articles for "For You" feed
  v3_deep_dive_pool     — raw articles for "Deep Dives" feed
  v3_trending_pool      — raw articles for "Trending" feed
  v3_summary_cache      — cached summaries keyed by
                          (url_hash, style, seniority)
  v3_user_feeds         — global/shared feed sections plus any legacy per-user feed docs
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

from v1.storage import FirestoreStore, is_user_subscribed  # noqa: E402

FREE_TIER_LIMITS = {
    "trending": 3,
    "for_you": 1,
}

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
    """Thin wrapper over the configured backend for v3-specific collections."""

    def __init__(self) -> None:
        self._base = FirestoreStore()
        self.db = self._base.db

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def get_onboarded_users(
        self, audience: str = "all", max_inactive_days: int = 7,
    ) -> list[dict[str, Any]]:
        """
        Get onboarded users by audience segment, skipping stale ones.

        audience:
          - subscribed: trial/active users only
          - unsubscribed: onboarded users without active/trial subscription
          - all: all onboarded users (default; Trace is free for everyone)

        max_inactive_days:
          Skip free users whose lastActiveAt (or updatedAt/onboardedAt
          fallback) is older than this many days. Subscribed users are
          never skipped regardless of activity.
        """
        def _to_jsonable(obj: Any) -> Any:
            if obj is None:
                return obj
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: _to_jsonable(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_to_jsonable(i) for i in obj]
            return obj

        def _serialize(doc) -> dict[str, Any]:
            raw = doc.to_dict() or {}
            return {"uid": doc.id, **_to_jsonable(raw)}

        if audience == "all":
            onboarded_docs = self.db.collection("user_profiles").where(
                "onboarded", "==", True
            ).stream()
            filtered = [_serialize(doc) for doc in onboarded_docs]
        elif audience == "unsubscribed":
            onboarded_docs = self.db.collection("user_profiles").where(
                "onboarded", "==", True
            ).stream()
            onboarded = [_serialize(doc) for doc in onboarded_docs]
            filtered = [p for p in onboarded if not is_user_subscribed(p)]
        else:
            # Query subscribed users server-side where possible, then merge.
            # Fallback to in-memory check when query operators are unavailable.
            try:
                seen_uids: set[str] = set()
                subscribed: list[dict[str, Any]] = []
                for field in ("subscriptionStatus", "appSubscriptionStatus"):
                    docs = (
                        self.db.collection("user_profiles")
                        .where("onboarded", "==", True)
                        .where(field, "in", ["trial", "active"])
                        .stream()
                    )
                    for doc in docs:
                        if doc.id in seen_uids:
                            continue
                        seen_uids.add(doc.id)
                        subscribed.append(_serialize(doc))
                filtered = subscribed
            except Exception:
                onboarded_docs = self.db.collection("user_profiles").where(
                    "onboarded", "==", True
                ).stream()
                onboarded = [_serialize(doc) for doc in onboarded_docs]
                filtered = [p for p in onboarded if is_user_subscribed(p)]

        if max_inactive_days <= 0:
            return filtered

        cutoff = datetime.now(timezone.utc) - timedelta(days=max_inactive_days)
        active: list[dict[str, Any]] = []
        skipped = 0

        for p in filtered:
            if is_user_subscribed(p):
                active.append(p)
                continue

            last = (
                p.get("lastActiveAt")
                or p.get("updatedAt")
                or p.get("onboardedAt")
            )
            if last is None:
                skipped += 1
                continue

            try:
                if hasattr(last, "isoformat"):
                    ts = last
                elif hasattr(last, "seconds"):
                    ts = datetime.fromtimestamp(last.seconds, tz=timezone.utc)
                else:
                    ts = datetime.fromisoformat(
                        str(last).replace("Z", "+00:00")
                    )
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)

                if ts < cutoff:
                    skipped += 1
                    continue
            except (ValueError, TypeError, AttributeError):
                pass

            active.append(p)

        if skipped:
            print(
                f"[v3-store] Skipped {skipped} stale free users "
                f"(inactive >{max_inactive_days}d), "
                f"building for {len(active)}"
            )
        return active

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

    def pool_items_exist(
        self, collection: str, urls: list[str],
    ) -> set[str]:
        """
        Batch-check pool URLs that already exist.

        Returns a set of URLs that already have documents in the pool.
        """
        ordered = [u for u in dict.fromkeys(urls) if u]
        if not ordered:
            return set()

        doc_to_url = {_url_hash(url): url for url in ordered}
        refs = [
            self.db.collection(collection).document(doc_id)
            for doc_id in doc_to_url.keys()
        ]

        existing: set[str] = set()
        chunk_size = 300
        for i in range(0, len(refs), chunk_size):
            chunk = refs[i:i + chunk_size]
            for doc in self.db.get_all(chunk):
                if doc.exists:
                    url = doc_to_url.get(doc.id, "")
                    if url:
                        existing.add(url)
        return existing

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
            key=lambda x: (
                x.get("published_date", "") or x.get("fetched_at", "")
            ),
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

    # V2 cache methods - simplified keys (no style/seniority variants)
    def _cache_key_v2(self, url: str, bucket: str) -> str:
        raw = f"{url}:{bucket}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]

    def get_cached_summary_v2(
        self, url: str, bucket: str
    ) -> dict[str, Any] | None:
        key = self._cache_key_v2(url, bucket)
        doc = self.db.collection(SUMMARY_CACHE).document(key).get()
        if doc.exists:
            return doc.to_dict()
        return None

    def save_cached_summary_v2(
        self, url: str, bucket: str, summary: dict[str, Any], model: str
    ) -> None:
        key = self._cache_key_v2(url, bucket)
        self.db.collection(SUMMARY_CACHE).document(key).set(
            {
                "url": url,
                "cache_bucket": bucket,
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
    # Global feeds (shared across all users, e.g., trending)
    # ------------------------------------------------------------------

    def write_global_feed_section(
        self,
        date: str,
        section: str,
        items: list[dict[str, Any]],
    ) -> None:
        """Write a section to the global feed (shared by all users)."""
        self.db.collection(USER_FEEDS).document("_global").collection(
            "daily"
        ).document(date).set(
            {
                section: items,
                f"{section}_count": len(items),
                f"{section}_generated_at": _now_iso(),
            },
            merge=True,
        )

    def write_global_role_section(
        self,
        date: str,
        section_prefix: str,
        role: str,
        items: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Write one role-specific section into the shared global feed doc."""
        doc_ref = self.db.collection(USER_FEEDS).document("_global").collection(
            "daily"
        ).document(date)
        existing = doc_ref.get().to_dict() or {}

        roles_key = f"{section_prefix}_roles"
        counts_key = f"{section_prefix}_role_counts"
        generated_key = f"{section_prefix}_role_generated_at"
        metadata_key = f"{section_prefix}_role_metadata"

        role_map = existing.get(roles_key, {})
        if not isinstance(role_map, dict):
            role_map = {}
        role_map[role] = items

        counts_map = existing.get(counts_key, {})
        if not isinstance(counts_map, dict):
            counts_map = {}
        counts_map[role] = len(items)

        generated_at_map = existing.get(generated_key, {})
        if not isinstance(generated_at_map, dict):
            generated_at_map = {}
        generated_at_map[role] = _now_iso()

        payload: dict[str, Any] = {
            roles_key: role_map,
            counts_key: counts_map,
            generated_key: generated_at_map,
        }
        if metadata is not None:
            metadata_map = existing.get(metadata_key, {})
            if not isinstance(metadata_map, dict):
                metadata_map = {}
            metadata_map[role] = metadata
            payload[metadata_key] = metadata_map

        doc_ref.set(payload, merge=True)

    def write_global_role_digest(
        self,
        date: str,
        section_prefix: str,
        role: str,
        sections: dict[str, list[dict[str, Any]]],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Write one role-specific structured digest into the shared global feed doc."""
        doc_ref = self.db.collection(USER_FEEDS).document("_global").collection(
            "daily"
        ).document(date)
        existing = doc_ref.get().to_dict() or {}

        roles_key = f"{section_prefix}_roles"
        counts_key = f"{section_prefix}_role_counts"
        generated_key = f"{section_prefix}_role_generated_at"
        metadata_key = f"{section_prefix}_role_metadata"

        role_map = existing.get(roles_key, {})
        if not isinstance(role_map, dict):
            role_map = {}
        role_map[role] = sections

        counts_map = existing.get(counts_key, {})
        if not isinstance(counts_map, dict):
            counts_map = {}
        counts_map[role] = sum(
            len(items)
            for items in sections.values()
            if isinstance(items, list)
        )

        generated_at_map = existing.get(generated_key, {})
        if not isinstance(generated_at_map, dict):
            generated_at_map = {}
        generated_at_map[role] = _now_iso()

        payload: dict[str, Any] = {
            roles_key: role_map,
            counts_key: counts_map,
            generated_key: generated_at_map,
        }
        if metadata is not None:
            metadata_map = existing.get(metadata_key, {})
            if not isinstance(metadata_map, dict):
                metadata_map = {}
            metadata_map[role] = metadata
            payload[metadata_key] = metadata_map

        doc_ref.set(payload, merge=True)

    def write_global_role_digests(
        self,
        date: str,
        section_prefix: str,
        sections_by_role: dict[str, dict[str, list[dict[str, Any]]]],
        metadata_by_role: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        """Atomically replace every role bucket for one structured digest."""
        generated_at = _now_iso()
        payload: dict[str, Any] = {
            f"{section_prefix}_roles": sections_by_role,
            f"{section_prefix}_role_counts": {
                role: sum(len(items) for items in sections.values() if isinstance(items, list))
                for role, sections in sections_by_role.items()
            },
            f"{section_prefix}_role_generated_at": {
                role: generated_at for role in sections_by_role
            },
        }
        if metadata_by_role is not None:
            payload[f"{section_prefix}_role_metadata"] = metadata_by_role
        self.db.collection(USER_FEEDS).document("_global").collection(
            "daily"
        ).document(date).set(payload, merge=True)

    def write_global_role_feed(
        self,
        date: str,
        role: str,
        items: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Backward-compatible wrapper for the shared For You role section."""
        self.write_global_role_section(
            date,
            "for_you",
            role,
            items,
            metadata=metadata,
        )

    def load_global_feed(self, date: str) -> dict[str, Any]:
        """Load the global feed for a given date."""
        doc = (
            self.db.collection(USER_FEEDS)
            .document("_global")
            .collection("daily")
            .document(date)
            .get()
        )
        return doc.to_dict() if doc.exists else {}

    # ------------------------------------------------------------------
    # Pipeline run tracking
    # ------------------------------------------------------------------

    def record_run(
        self, job_name: str, extra: dict[str, Any] | None = None
    ) -> None:
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
            return (
                datetime.now(timezone.utc) - dt
                > timedelta(days=cadence_days)
            )
        except (ValueError, TypeError):
            return True

    # -----------------------------------------------------------------------
    # Synthesis caching (for deep dives)
    # -----------------------------------------------------------------------

    def get_cached_synthesis(self, cache_key: str) -> dict[str, Any] | None:
        """Get a cached synthesis by key."""
        doc = self.db.collection("v3_synthesis_cache").document(cache_key).get()
        if doc.exists:
            data = doc.to_dict() or {}
            # Check if cache is still fresh (7 days)
            cached_at = data.get("cached_at", "")
            if cached_at:
                try:
                    dt = datetime.fromisoformat(cached_at.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) - dt < timedelta(days=7):
                        return data.get("synthesis")
                except (ValueError, TypeError):
                    pass
        return None

    def cache_synthesis(self, cache_key: str, synthesis: dict[str, Any]) -> None:
        """Cache a synthesis result."""
        self.db.collection("v3_synthesis_cache").document(cache_key).set({
            "synthesis": synthesis,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        })

    # -----------------------------------------------------------------------
    # Extraction caching (for deep dive article key points)
    # -----------------------------------------------------------------------

    def _extraction_cache_key(self, url: str) -> str:
        """Generate cache key for article extraction."""
        return hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]

    def get_cached_extraction(self, url: str) -> dict[str, Any] | None:
        """Get cached key points extraction for an article URL."""
        key = self._extraction_cache_key(url)
        doc = self.db.collection("v3_extraction_cache").document(key).get()
        if doc.exists:
            data = doc.to_dict() or {}
            # Check if cache is still fresh (7 days)
            cached_at = data.get("cached_at", "")
            if cached_at:
                try:
                    dt = datetime.fromisoformat(cached_at.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) - dt < timedelta(days=7):
                        return data.get("extraction")
                except (ValueError, TypeError):
                    pass
        return None

    def cache_extraction(self, url: str, extraction: dict[str, Any]) -> None:
        """Cache article key points extraction."""
        key = self._extraction_cache_key(url)
        self.db.collection("v3_extraction_cache").document(key).set({
            "url": url,
            "extraction": extraction,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        })
