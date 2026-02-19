#!/usr/bin/env python3
"""
Generate daily feeds for subscribed users from Firestore article pool.

Reads from:
  article_pool_v2 (is_active == true)

Writes to:
  user_feeds/{uid}/daily/{YYYY-MM-DD}
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.algorithm.interest_schema import get_interest_ids  # noqa: E402
from v2.flows.add_trending_news_to_feed import (  # noqa: E402
    add_trending_news_to_feed,
)
from v1.flows.build_suggested_items_for_user import (  # noqa: E402
    build_suggested_items_for_user,
)
from v1.flows.fetch_og_images_for_feeds import (  # noqa: E402
    fetch_images_for_urls,
)
from v1.storage import FirestoreStore  # noqa: E402
from v1.tools.summary_prompts import get_prompt_for_skill_level  # noqa: E402

POOL_COLLECTION = "article_pool_v2"
RUNS_COLLECTION = "pipeline_runs_v2"
DEFAULT_ITEMS_PER_USER = 8
SEEN_URLS_COLLECTION = "user_seen_urls"
FEED_SUMMARY_MODEL = "gpt-4o-mini"
FEED_SUMMARY_TEMPERATURE = 0.3
FEED_SUMMARY_TIMEOUT_SECONDS = 45


def _log(message: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{stamp}] [v2-feeds] {message}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate daily subscribed feeds from article pool."
    )
    parser.add_argument(
        "--date",
        default="",
        help="Date in YYYY-MM-DD. Defaults to today IST.",
    )
    parser.add_argument(
        "--limit-users",
        type=int,
        default=0,
        help="Optional max subscribed users to process.",
    )
    parser.add_argument(
        "--user-id",
        default="",
        help="Run feed generation for one specific subscribed user.",
    )
    parser.add_argument(
        "--items-per-user",
        type=int,
        default=DEFAULT_ITEMS_PER_USER,
        help="Feed items per user.",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=14,
        help="Only pull pool items newer than this age.",
    )
    parser.add_argument(
        "--interest-id",
        action="append",
        default=[],
        help="Optional global interest filter. Repeat for multiple.",
    )
    parser.add_argument(
        "--add-suggested",
        action="store_true",
        help="Append suggested items (1-2) before final curation.",
    )
    parser.add_argument(
        "--add-trending",
        action="store_true",
        help="Append trending items before final curation.",
    )
    parser.add_argument(
        "--suggested-max-topics",
        type=int,
        default=2,
        help="Max suggested topics per user.",
    )
    parser.add_argument(
        "--suggested-items-per-topic",
        type=int,
        default=1,
        help="Suggested items per topic.",
    )
    parser.add_argument(
        "--min-suggested-items",
        type=int,
        default=1,
        help="Minimum suggested items in each final feed.",
    )
    parser.add_argument(
        "--min-trending-items",
        type=int,
        default=1,
        help="Minimum trending items in each final feed.",
    )
    return parser.parse_args()


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _parse_iso(value: str) -> datetime | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def _previous_date_str(date_str: str) -> str:
    prev = _parse_date(date_str) - timedelta(days=1)
    return prev.strftime("%Y-%m-%d")


def _item_sort_key(item: dict[str, Any]) -> datetime:
    dt = _parse_iso(item.get("published_date", ""))
    if dt is not None:
        return dt
    dt = _parse_iso(item.get("last_seen_at", ""))
    if dt is not None:
        return dt
    return datetime.min.replace(tzinfo=timezone.utc)


def _build_feed_item(pool_item: dict[str, Any]) -> dict[str, Any]:
    url = pool_item.get("url", "")
    title = pool_item.get("title", "")
    domain = urlparse(url).netloc.lower() if url else ""
    item_id = hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]
    return {
        "id": item_id,
        "url": url,
        "title": title,
        "type": "blog",
        "source": domain,
        "interest_id": pool_item.get("interest_id", ""),
        "subinterest_id": pool_item.get("subinterest_id", ""),
        "feed_category": "pool_v2",
        "published_date": pool_item.get("published_date", ""),
        "thumbnail": pool_item.get("og_image", ""),
        "summary": pool_item.get("summary", {}),
        "metadata": {
            "pool_doc_id": pool_item.get("doc_id", ""),
            "summary_model": pool_item.get("summary_model", ""),
            "summary_skill_level": pool_item.get("summary_skill_level", ""),
            "content_length": pool_item.get("content_length", 0),
        },
    }


def _has_summary(pool_item: dict[str, Any]) -> bool:
    summary = pool_item.get("summary", {})
    if not isinstance(summary, dict):
        return False
    short_article = summary.get("short_article", {})
    return isinstance(short_article, dict) and bool(short_article)


def _parse_summary_json(raw_text: str) -> tuple[dict[str, Any] | None, str]:
    cleaned = (raw_text or "").strip()
    if not cleaned:
        return None, "empty_response"
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None, "no_json_object_found"
        try:
            parsed = json.loads(match.group())
        except json.JSONDecodeError as exc:
            return None, f"json_parse_error:{exc}"
    if not isinstance(parsed, dict):
        return None, "response_not_object"
    if "short_article" not in parsed:
        return None, "missing_short_article"
    return parsed, ""


def _summarize_for_feed_backfill(
    client: OpenAI | None,
    interest_id: str,
    subinterest_id: str,
    title: str,
    url: str,
    content: str,
) -> tuple[dict[str, Any], str]:
    if client is None:
        return {}, "openai_not_configured"
    if not content:
        return {}, "missing_content"

    prompt = get_prompt_for_skill_level(
        skill_level="intermediate",
        title=title,
        content=content,
        user_context={
            "interests": [interest_id],
            "subinterests": [subinterest_id],
            "skills": [],
            "content_depth": "high",
        },
        url=url,
        is_video=False,
    )
    try:
        response = client.chat.completions.create(
            model=FEED_SUMMARY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You return valid JSON only. "
                        "No markdown fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=FEED_SUMMARY_TEMPERATURE,
            response_format={"type": "json_object"},
            timeout=FEED_SUMMARY_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        return {}, f"openai_error:{exc}"

    parsed, error = _parse_summary_json(
        (response.choices[0].message.content or "").strip()
    )
    if not parsed:
        return {}, error
    return parsed, ""


def _backfill_pool_items_for_feed(
    store: FirestoreStore,
    pool_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int, int]:
    """
    Ensure selected pool items have summary + image.

    Returns:
      (updated_items, summaries_generated, images_filled)
    """
    if not pool_items:
        return pool_items, 0, 0

    summaries_generated = 0
    images_filled = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_client = OpenAI(api_key=openai_key) if openai_key else None

    urls_missing_image = [
        item.get("url", "")
        for item in pool_items
        if item.get("url") and not item.get("og_image")
    ]
    image_map = fetch_images_for_urls(
        store=store,
        urls=list(dict.fromkeys(urls_missing_image)),
        force=False,
    ) if urls_missing_image else {}

    for item in pool_items:
        doc_id = item.get("doc_id", "")
        if not doc_id:
            continue
        doc_ref = store.db.collection(POOL_COLLECTION).document(doc_id)
        updates: dict[str, Any] = {"updated_at": now_iso}

        url = item.get("url", "")
        if not item.get("og_image") and url in image_map and image_map[url]:
            item["og_image"] = image_map[url]
            updates["og_image"] = image_map[url]
            images_filled += 1

        if not _has_summary(item):
            summary_payload, summary_error = _summarize_for_feed_backfill(
                client=openai_client,
                interest_id=item.get("interest_id", ""),
                subinterest_id=item.get("subinterest_id", ""),
                title=item.get("title", ""),
                url=url,
                content=item.get("content", "") or "",
            )
            if summary_payload:
                item["summary"] = summary_payload
                item["summary_error"] = ""
                item["summary_model"] = FEED_SUMMARY_MODEL
                item["summary_skill_level"] = "intermediate"
                updates["summary"] = summary_payload
                updates["summary_error"] = ""
                updates["summary_model"] = FEED_SUMMARY_MODEL
                updates["summary_skill_level"] = "intermediate"
                updates["summary_generated_at"] = now_iso
                summaries_generated += 1
            else:
                item["summary_error"] = summary_error
                updates["summary_error"] = summary_error

        if len(updates) > 1:
            doc_ref.set(updates, merge=True)

    return pool_items, summaries_generated, images_filled


def _item_category(item: dict[str, Any]) -> str:
    meta = item.get("metadata", {}) or {}
    if isinstance(meta, dict):
        if meta.get("feed_category") == "suggested":
            return "suggested"
        if meta.get("feed_category") == "trending_news":
            return "trending_news"
    feed_category = item.get("feed_category", "")
    if feed_category == "pool_v2":
        return "pool_v2"
    return "other"


def _count_items_by_category(
    items: list[dict[str, Any]],
    category: str,
) -> int:
    return sum(1 for item in items if _item_category(item) == category)


def _build_trending_fallback_item(
    article: dict[str, Any],
    topic_id: str,
    topic_name: str,
    idx: int,
    date: str,
) -> dict[str, Any]:
    return {
        "id": f"trending_fallback_{topic_id}_{idx}_{date}",
        "type": "news",
        "title": article.get("title", ""),
        "description": (
            article.get("details", "")
            or article.get("subtitle", "")
        ),
        "url": article.get("url", ""),
        "tags": [topic_id],
        "source": "trending_news",
        "metadata": {
            "why_relevant": f"Trending in {topic_name}",
            "feed_category": "trending_news",
            "is_hot": True,
            "published_date": article.get("published_date", ""),
        },
    }


def _get_trending_fallback_items(
    store: FirestoreStore,
    date: str,
    existing_urls: set[str],
    limit: int,
) -> list[dict[str, Any]]:
    if limit <= 0:
        return []
    root = store.db.collection("trending_news").document(date).get()
    if not root.exists:
        return []

    rows: list[tuple[datetime, str, str, dict[str, Any]]] = []
    docs = (
        store.db.collection("trending_news")
        .document(date)
        .collection("topics")
        .stream()
    )
    for doc in docs:
        data = doc.to_dict() or {}
        topic_id = data.get("topic_id", doc.id)
        topic_name = data.get("name", topic_id)
        for article in data.get("articles", []) or []:
            if not isinstance(article, dict):
                continue
            url = article.get("url", "")
            if not url or url in existing_urls:
                continue
            published = _parse_iso(article.get("published_date", ""))
            rows.append(
                (
                    published or datetime.min.replace(tzinfo=timezone.utc),
                    topic_id,
                    topic_name,
                    article,
                )
            )
    rows.sort(key=lambda x: x[0], reverse=True)

    items: list[dict[str, Any]] = []
    for idx, (_, topic_id, topic_name, article) in enumerate(rows, start=1):
        url = article.get("url", "")
        if not url or url in existing_urls:
            continue
        items.append(
            _build_trending_fallback_item(
                article=article,
                topic_id=topic_id,
                topic_name=topic_name,
                idx=idx,
                date=date,
            )
        )
        existing_urls.add(url)
        if len(items) >= limit:
            break
    return items


def _cap_and_balance_items(
    items: list[dict[str, Any]],
    max_items: int,
) -> list[dict[str, Any]]:
    if len(items) <= max_items:
        return items

    trending = [i for i in items if _item_category(i) == "trending_news"]
    suggested = [i for i in items if _item_category(i) == "suggested"]
    pool = [i for i in items if _item_category(i) == "pool_v2"]
    other = [i for i in items if _item_category(i) == "other"]

    final: list[dict[str, Any]] = []
    final.extend(suggested[:2])
    final.extend(trending[:2])

    for bucket in (pool, other, suggested[2:], trending[2:]):
        for item in bucket:
            if len(final) >= max_items:
                break
            final.append(item)
        if len(final) >= max_items:
            break
    return final[:max_items]


def _load_user_feed(
    store: FirestoreStore,
    user_id: str,
    date: str,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    ref = (
        store.db.collection("user_feeds")
        .document(user_id)
        .collection("daily")
        .document(date)
    )
    doc = ref.get()
    data = doc.to_dict() if doc.exists else {}
    items = data.get("items", []) if isinstance(data, dict) else []
    if not isinstance(items, list):
        items = []
    return ref, data if isinstance(data, dict) else {}, items


def _get_seen_urls_doc(
    store: FirestoreStore,
    user_id: str,
) -> tuple[Any, dict[str, Any]]:
    ref = store.db.collection(SEEN_URLS_COLLECTION).document(user_id)
    doc = ref.get()
    data = doc.to_dict() if doc.exists else {}
    if not isinstance(data, dict):
        data = {}
    return ref, data


def _get_user_seen_urls(store: FirestoreStore, user_id: str) -> set[str]:
    _, data = _get_seen_urls_doc(store, user_id)
    urls_map = data.get("urls", {})
    if not isinstance(urls_map, dict):
        return set()
    return set(urls_map.keys())


def _promote_previous_feed_urls_to_seen(
    store: FirestoreStore,
    user_id: str,
    target_date: str,
) -> tuple[int, bool]:
    """
    Promote yesterday's feed URLs to seen for freshness.

    Idempotency:
    - Uses user_seen_urls.promoted_from_feed_dates[YYYY-MM-DD] marker.
    - If today's generation is rerun, this promotion is not repeated.
    """
    yesterday = _previous_date_str(target_date)
    seen_ref, seen_data = _get_seen_urls_doc(store, user_id)
    promoted_map = seen_data.get("promoted_from_feed_dates", {})
    if not isinstance(promoted_map, dict):
        promoted_map = {}
    if promoted_map.get(yesterday) is True:
        return 0, True

    _, y_feed_data, y_items = _load_user_feed(store, user_id, yesterday)
    if not y_feed_data or not y_items:
        promoted_map[yesterday] = True
        seen_ref.set(
            {
                "promoted_from_feed_dates": promoted_map,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            merge=True,
        )
        return 0, False

    seen_urls_map = seen_data.get("urls", {})
    if not isinstance(seen_urls_map, dict):
        seen_urls_map = {}
    now_iso = datetime.now(timezone.utc).isoformat()
    added = 0
    for item in y_items:
        if not isinstance(item, dict):
            continue
        url = item.get("url", "")
        if not url or url in seen_urls_map:
            continue
        seen_urls_map[url] = now_iso
        added += 1

    promoted_map[yesterday] = True
    seen_ref.set(
        {
            "urls": seen_urls_map,
            "promoted_from_feed_dates": promoted_map,
            "updated_at": now_iso,
        },
        merge=True,
    )
    return added, False


def _load_recent_pool_for_interest(
    store: FirestoreStore,
    interest_id: str,
    max_age_days: int,
    seen_urls: set[str],
) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    docs = (
        store.db.collection(POOL_COLLECTION)
        .where("is_active", "==", True)
        .where("interest_id", "==", interest_id)
        .stream()
    )
    items: list[dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict() or {}
        if not data:
            continue
        dt = _item_sort_key(data)
        if dt < cutoff:
            continue
        url = data.get("url", "")
        if not url or url in seen_urls:
            continue
        if data.get("fetch_error"):
            continue
        if data.get("summary_error"):
            continue
        items.append(data)
    items.sort(key=_item_sort_key, reverse=True)
    return items


def generate_daily_subscribed_feeds_from_pool(
    args: argparse.Namespace,
) -> dict[str, Any]:
    store = FirestoreStore()
    target_date = args.date.strip() or _today_ist()
    now_iso = datetime.now(timezone.utc).isoformat()
    _log(f"Starting feed generation for date={target_date}")

    users = store.get_onboarded_users()
    _log(f"Loaded subscribed users: {len(users)}")
    if args.user_id:
        users = [u for u in users if u.get("uid") == args.user_id]
        _log(
            f"Filtered to user_id={args.user_id}. "
            f"Users to process: {len(users)}"
        )
    if args.limit_users > 0:
        users = users[: args.limit_users]
        _log(f"Applied --limit-users={args.limit_users}")

    forced_interest_ids = set(args.interest_id)
    if forced_interest_ids:
        _log(f"Interest filter enabled: {sorted(list(forced_interest_ids))}")

    users_processed = 0
    users_with_items = 0
    items_written = 0
    suggested_added_total = 0
    trending_added_total = 0
    promoted_seen_total = 0
    promoted_already_done_users = 0
    pool_backfill_summaries_total = 0
    pool_backfill_images_total = 0

    for profile in users:
        user_id = profile.get("uid", "")
        if not user_id:
            continue
        _log(f"Processing user={user_id}")

        interest_ids = set(get_interest_ids(profile))
        if forced_interest_ids:
            interest_ids &= forced_interest_ids
        if not interest_ids:
            _log(f"Skipping user={user_id}; no matching interests")
            continue

        promoted_count, already_done = _promote_previous_feed_urls_to_seen(
            store=store,
            user_id=user_id,
            target_date=target_date,
        )
        promoted_seen_total += promoted_count
        if already_done:
            promoted_already_done_users += 1
            _log(f"user={user_id} yesterday->seen already promoted")
        elif promoted_count > 0:
            _log(
                f"user={user_id} promoted yesterday URLs to seen: "
                f"{promoted_count}"
            )
        seen_urls = _get_user_seen_urls(store, user_id)
        _log(f"user={user_id} seen URLs count={len(seen_urls)}")

        candidate_items: list[dict[str, Any]] = []
        for interest_id in sorted(interest_ids):
            candidate_items.extend(
                _load_recent_pool_for_interest(
                    store=store,
                    interest_id=interest_id,
                    max_age_days=args.max_age_days,
                    seen_urls=seen_urls,
                )
            )
        _log(f"user={user_id} candidate pool items={len(candidate_items)}")

        deduped: dict[str, dict[str, Any]] = {}
        for item in sorted(candidate_items, key=_item_sort_key, reverse=True):
            url = item.get("url", "")
            if not url or url in deduped:
                continue
            deduped[url] = item

        ordered_pool_items = list(deduped.values())
        picked_items = ordered_pool_items[: args.items_per_user]
        spare_pool_items = ordered_pool_items[args.items_per_user:]
        picked_items, backfill_summaries, backfill_images = (
            _backfill_pool_items_for_feed(store, picked_items)
        )
        pool_backfill_summaries_total += backfill_summaries
        pool_backfill_images_total += backfill_images
        _log(
            f"user={user_id} pool backfill "
            f"(summaries={backfill_summaries}, images={backfill_images})"
        )
        feed_items = [_build_feed_item(item) for item in picked_items]
        _log(
            f"user={user_id} picked base items={len(feed_items)} "
            f"(cap={args.items_per_user})"
        )

        feed_doc = {
            "date": target_date,
            "items": feed_items,
            "generated_at": now_iso,
            "source_pipeline": "v2_pool_firestore",
            "metadata": {
                "items_requested": args.items_per_user,
                "items_generated": len(feed_items),
                "interest_ids": sorted(list(interest_ids)),
            },
        }
        (
            store.db.collection("user_feeds")
            .document(user_id)
            .collection("daily")
            .document(target_date)
            .set(feed_doc, merge=True)
        )

        suggested_added = 0
        trending_added = 0

        if args.add_suggested:
            try:
                _log(f"user={user_id} adding suggested items...")
                sres = build_suggested_items_for_user(
                    user_id=user_id,
                    date=target_date,
                    max_topics=args.suggested_max_topics,
                    items_per_topic=args.suggested_items_per_topic,
                )
                suggested_added = int(sres.get("items_added", 0))
                _log(f"user={user_id} suggested added={suggested_added}")
            except Exception:
                suggested_added = 0
                _log(f"user={user_id} suggested step failed")

        if args.add_trending:
            try:
                _log(f"user={user_id} adding trending items...")
                tres = add_trending_news_to_feed(
                    user_id=user_id,
                    date=target_date,
                    force=False,
                )
                trending_added = int(tres.get("items_added", 0))
                _log(f"user={user_id} trending added={trending_added}")
            except Exception:
                trending_added = 0
                _log(f"user={user_id} trending step failed")

        suggested_added_total += suggested_added
        trending_added_total += trending_added

        ref, full_feed, final_items = _load_user_feed(
            store,
            user_id,
            target_date,
        )

        existing_urls = {
            i.get("url", "")
            for i in final_items
            if isinstance(i, dict) and i.get("url", "")
        }

        missing_suggested = max(
            0,
            args.min_suggested_items
            - _count_items_by_category(final_items, "suggested"),
        )
        if missing_suggested > 0 and spare_pool_items:
            added_suggested_fallback = 0
            for spare in spare_pool_items:
                if added_suggested_fallback >= missing_suggested:
                    break
                spare_url = spare.get("url", "")
                if not spare_url or spare_url in existing_urls:
                    continue
                spare_items, ssum, simg = _backfill_pool_items_for_feed(
                    store,
                    [spare],
                )
                pool_backfill_summaries_total += ssum
                pool_backfill_images_total += simg
                suggested_item = _build_feed_item(spare_items[0])
                suggested_item.setdefault("metadata", {})
                suggested_item["metadata"]["feed_category"] = "suggested"
                suggested_item["metadata"]["why_relevant"] = (
                    "Suggested for you"
                )
                final_items.append(suggested_item)
                existing_urls.add(spare_url)
                added_suggested_fallback += 1
            if added_suggested_fallback:
                _log(
                    f"user={user_id} suggested fallback added="
                    f"{added_suggested_fallback}"
                )

        missing_trending = max(
            0,
            args.min_trending_items
            - _count_items_by_category(final_items, "trending_news"),
        )
        if missing_trending > 0:
            fallback_trending = _get_trending_fallback_items(
                store=store,
                date=target_date,
                existing_urls=existing_urls,
                limit=missing_trending,
            )
            if fallback_trending:
                final_items.extend(fallback_trending)
                _log(
                    f"user={user_id} trending fallback added="
                    f"{len(fallback_trending)}"
                )

        final_items = _cap_and_balance_items(final_items, args.items_per_user)
        full_feed["items"] = final_items
        full_feed["generated_at"] = datetime.now(timezone.utc).isoformat()
        full_feed.setdefault("metadata", {})
        full_feed["metadata"]["item_count"] = len(final_items)
        full_feed["metadata"]["source_pipeline"] = "v2_pool_firestore"
        full_feed["metadata"]["suggested_items_added"] = suggested_added
        full_feed["metadata"]["trending_items_added"] = trending_added
        ref.set(full_feed, merge=True)
        _log(
            f"user={user_id} final curated items={len(final_items)} "
            f"(suggested={suggested_added}, trending={trending_added})"
        )

        users_processed += 1
        if final_items:
            users_with_items += 1
            items_written += len(final_items)

    (
        store.db.collection(RUNS_COLLECTION)
        .document("daily_subscribed_feeds")
        .set(
            {
                "last_run_at": now_iso,
                "date": target_date,
                "status": "success",
                "users_processed": users_processed,
                "users_with_items": users_with_items,
                "items_written": items_written,
                "suggested_items_added": suggested_added_total,
                "trending_items_added": trending_added_total,
                "items_per_user_cap": args.items_per_user,
                "promoted_prev_day_urls_to_seen": promoted_seen_total,
                "promote_prev_day_already_done_users": (
                    promoted_already_done_users
                ),
                "pool_backfill_summaries_generated": (
                    pool_backfill_summaries_total
                ),
                "pool_backfill_images_filled": pool_backfill_images_total,
            },
            merge=True,
        )
    )
    _log(
        "Feed generation complete: "
        f"users_processed={users_processed}, "
        f"users_with_items={users_with_items}, "
        f"items_written={items_written}, "
        f"suggested_added={suggested_added_total}, "
        f"trending_added={trending_added_total}, "
        f"pool_backfill_summaries={pool_backfill_summaries_total}, "
        f"pool_backfill_images={pool_backfill_images_total}"
    )

    return {
        "date": target_date,
        "users_processed": users_processed,
        "users_with_items": users_with_items,
        "items_written": items_written,
        "suggested_items_added": suggested_added_total,
        "trending_items_added": trending_added_total,
        "items_per_user_cap": args.items_per_user,
        "promoted_prev_day_urls_to_seen": promoted_seen_total,
        "promote_prev_day_already_done_users": promoted_already_done_users,
        "pool_backfill_summaries_generated": pool_backfill_summaries_total,
        "pool_backfill_images_filled": pool_backfill_images_total,
    }


def main() -> None:
    args = _parse_args()
    result = generate_daily_subscribed_feeds_from_pool(args)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
