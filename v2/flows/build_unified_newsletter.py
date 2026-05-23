#!/usr/bin/env python3
"""
Build one unified newsletter for all users.

Simple flow:
1) Pull all trending topics from the last daily global feed
   (v3_user_feeds/_global/daily/{date})
2) Ask the LLM to pick the 7-9 most interesting titles
3) Ask the LLM to write a beautiful, fun-to-read newsletter from
   the picked stories (title + summary)
4) Save the result to unified_newsletters/{date}

No hardcoded regex filters. No post-processing of LLM output.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402

MIN_PICKS = 7
MAX_PICKS = 9
PICK_MODEL = os.getenv("NEWSLETTER_PICK_MODEL", "gpt-4o-mini")
WRITE_MODEL = os.getenv("NEWSLETTER_WRITE_MODEL", "gpt-4o-mini")


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _yesterday_ist(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return (dt - timedelta(days=1)).strftime("%Y-%m-%d")


def _normalize_url(url: str) -> str:
    return str(url or "").strip().lower()


def _normalize_title(title: str) -> str:
    return " ".join(str(title or "").strip().lower().split())


def _build_trace_article_url(item: dict[str, Any]) -> str:
    item_id = str(item.get("id") or "").strip()
    feed_type = str(
        item.get("feed_type")
        or (item.get("metadata") or {}).get("feed_type")
        or ""
    ).strip().lower()
    if not item_id:
        return ""

    if item_id.startswith("fy_") or item_id.startswith("tr_"):
        normalized_id = item_id
    elif feed_type == "for_you":
        normalized_id = f"fy_{item_id}"
    elif feed_type == "trending":
        normalized_id = f"tr_{item_id}"
    else:
        return ""
    return f"https://www.yourtrace.online/articles/{normalized_id}"


def _collect_candidates(v3_store: V3Store, date: str) -> list[dict[str, Any]]:
    """Return all candidate stories from the global daily feed as a flat list.

    Each candidate has: id, title, summary, url (best-effort), source.
    We pull from `trending_topics` (curated topic bundles) and fall back to
    `trending` feed items if topics are sparse.
    """
    global_feed = v3_store.load_global_feed(date) or {}

    candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    topics = global_feed.get("trending_topics") or []
    for topic in topics:
        if not isinstance(topic, dict):
            continue
        topic_id = str(topic.get("id") or topic.get("topic_key") or "").strip()
        title = str(topic.get("title") or "").strip()
        if not title:
            continue
        if topic_id and topic_id in seen_ids:
            continue
        summary = str(topic.get("summary") or "").strip()
        url = ""
        trace_url = ""
        image_url = str(topic.get("thumbnail") or "").strip()
        articles = topic.get("articles") or []
        if isinstance(articles, list) and articles:
            first = articles[0] if isinstance(articles[0], dict) else {}
            url = str(first.get("url") or first.get("link") or "").strip()
            trace_url = _build_trace_article_url(first)
            if not image_url:
                image_url = str(first.get("thumbnail") or "").strip()
                if not image_url:
                    imgs = first.get("images") or []
                    if isinstance(imgs, list) and imgs:
                        image_url = str(imgs[0] or "").strip()
        candidates.append(
            {
                "id": topic_id or f"topic-{len(candidates)}",
                "title": title,
                "summary": summary,
                "url": trace_url or url,
                "source_url": url,
                "trace_url": trace_url,
                "image_url": image_url,
                "key_points": topic.get("key_points") or [],
                "source": "trending_topic",
            }
        )
        if topic_id:
            seen_ids.add(topic_id)

    if len(candidates) < MIN_PICKS:
        trending = global_feed.get("trending") or []
        for item in trending:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("id") or item.get("url") or "").strip()
            title = str(item.get("title") or "").strip()
            if not title or (item_id and item_id in seen_ids):
                continue
            image_url = str(item.get("thumbnail") or "").strip()
            if not image_url:
                imgs = item.get("images") or []
                if isinstance(imgs, list) and imgs:
                    image_url = str(imgs[0] or "").strip()
            source_url = str(item.get("url") or "").strip()
            trace_url = _build_trace_article_url(item)
            candidates.append(
                {
                    "id": item_id or f"item-{len(candidates)}",
                    "title": title,
                    "summary": str(item.get("summary") or "").strip(),
                    "url": trace_url or source_url,
                    "source_url": source_url,
                    "trace_url": trace_url,
                    "image_url": image_url,
                    "key_points": [],
                    "source": "trending_item",
                }
            )
            if item_id:
                seen_ids.add(item_id)

    return candidates


def _collect_from_role_sections(global_feed: dict[str, Any]) -> list[dict[str, Any]]:
    """Collect additional candidates from today's role-based feed sections."""
    candidates: list[dict[str, Any]] = []

    def _append_item(item: dict[str, Any], source: str) -> None:
        title = str(item.get("title") or "").strip()
        if not title:
            return
        source_url = str(item.get("url") or "").strip()
        summary_obj = item.get("summary") or {}
        summary = ""
        if isinstance(summary_obj, dict):
            short = summary_obj.get("short_article") or {}
            if isinstance(short, dict):
                summary = str(short.get("subtitle") or short.get("body") or "").strip()
            if not summary:
                summary = str(summary_obj.get("why_it_matters") or "").strip()
        if not summary:
            summary = str(item.get("subtitle") or item.get("description") or "").strip()
        image_url = str(item.get("thumbnail") or "").strip()
        item_id = str(item.get("id") or source_url or title).strip()
        candidates.append(
            {
                "id": item_id,
                "title": title,
                "summary": summary,
                "url": source_url,
                "source_url": source_url,
                "trace_url": "",
                "image_url": image_url,
                "key_points": [],
                "source": source,
            }
        )

    for section in ("for_you_roles", "pulse_roles", "community_pulse_roles", "build_pulse_roles"):
        role_map = global_feed.get(section) or {}
        if not isinstance(role_map, dict):
            continue
        for role_items in role_map.values():
            if not isinstance(role_items, list):
                continue
            for item in role_items:
                if isinstance(item, dict):
                    _append_item(item, section)

    daily_pulse_roles = global_feed.get("daily_pulse_roles") or {}
    if isinstance(daily_pulse_roles, dict):
        for role_bucket in daily_pulse_roles.values():
            if not isinstance(role_bucket, dict):
                continue
            for key in ("tools", "blogs", "discussions"):
                rows = role_bucket.get(key) or []
                if not isinstance(rows, list):
                    continue
                for row in rows:
                    if isinstance(row, dict):
                        _append_item(row, f"daily_pulse_roles.{key}")

    return candidates


def _dedupe_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    for c in candidates:
        norm_url = _normalize_url(str(c.get("url") or c.get("source_url") or ""))
        norm_title = _normalize_title(str(c.get("title") or ""))
        if norm_url and norm_url in seen_urls:
            continue
        # Title dedupe only when URL is missing.
        if not norm_url and norm_title and norm_title in seen_titles:
            continue
        if norm_url:
            seen_urls.add(norm_url)
        if not norm_url and norm_title:
            seen_titles.add(norm_title)
        deduped.append(c)
    return deduped


def _load_previous_newsletter_story_keys(store: FirestoreStore, date: str) -> tuple[set[str], set[str]]:
    prev_date = _yesterday_ist(date)
    doc = store.db.collection("unified_newsletters").document(prev_date).get()
    if not doc.exists:
        return set(), set()
    data = doc.to_dict() or {}
    stories = data.get("stories") or []
    urls: set[str] = set()
    titles: set[str] = set()
    if isinstance(stories, list):
        for story in stories:
            if not isinstance(story, dict):
                continue
            norm_url = _normalize_url(str(story.get("url") or ""))
            norm_title = _normalize_title(str(story.get("title") or ""))
            if norm_url:
                urls.add(norm_url)
            if norm_title:
                titles.add(norm_title)
    return urls, titles


def _exclude_previous_story_keys(
    candidates: list[dict[str, Any]],
    prev_urls: set[str],
    prev_titles: set[str],
) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for c in candidates:
        norm_url = _normalize_url(str(c.get("url") or c.get("source_url") or ""))
        norm_title = _normalize_title(str(c.get("title") or ""))
        if norm_url and norm_url in prev_urls:
            continue
        # Title fallback only when URL is missing.
        if not norm_url and norm_title and norm_title in prev_titles:
            continue
        filtered.append(c)
    return filtered


def _llm_pick_titles(
    client: OpenAI,
    candidates: list[dict[str, Any]],
) -> list[int]:
    """Ask the LLM to pick 7-9 most interesting indices from the title list."""
    numbered_titles = "\n".join(
        f"{idx}. {c['title']}" for idx, c in enumerate(candidates, start=1)
    )
    target = min(MAX_PICKS, max(MIN_PICKS, len(candidates)))

    system = (
        "You are the editor of Trace, a daily briefing that mixes tech, AI, "
        "markets, world events, UX and engineering. Your taste is sharp: "
        "you pick the most interesting, important and varied stories."
    )
    user = (
        f"Here are today's candidate story titles (numbered):\n\n"
        f"{numbered_titles}\n\n"
        f"Pick the {target} most interesting and diverse stories "
        f"for today's newsletter. Favor variety across topics. Avoid near-duplicates.\n\n"
        f"Respond ONLY as JSON: {{\"picks\": [<index>, <index>, ...]}} "
        f"with exactly {target} indices from the list above."
    )

    resp = client.chat.completions.create(
        model=PICK_MODEL,
        temperature=0.3,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    data = json.loads(raw)
    picks_raw = data.get("picks") or []
    picks: list[int] = []
    for p in picks_raw:
        try:
            idx = int(p)
        except (TypeError, ValueError):
            continue
        if 1 <= idx <= len(candidates) and idx not in picks:
            picks.append(idx)
    picks = picks[:MAX_PICKS]
    return picks


def _llm_write_newsletter(
    client: OpenAI,
    date: str,
    picked: list[dict[str, Any]],
) -> dict[str, Any]:
    """Ask the LLM to write the newsletter body as structured JSON."""
    briefing = []
    for idx, c in enumerate(picked, start=1):
        briefing.append(
            {
                "n": idx,
                "title": c["title"],
                "summary": c.get("summary") or "",
                "url": c.get("url") or "",
                "source_url": c.get("source_url") or "",
            }
        )

    system = (
        "You are the voice of Trace, a daily briefing that is smart, witty, "
        "and a genuine pleasure to read. You mix tech, AI, markets, world "
        "events, UX and engineering in a concise, energetic style. You "
        "write like a sharp friend, not a press release."
    )
    user = (
        "Write today's Trace newsletter from the briefing below. "
        "Make it fun, punchy, and a joy to read. Each story should feel "
        "distinct and worth opening.\n\n"
        "Rules:\n"
        "- Keep the intro to 2-4 sentences. No greetings like 'Good morning'. "
        "Do not just paraphrase the first story; give a flavor of the whole mix.\n"
        "- For each story, write a 2-4 sentence body that explains what "
        "happened and why it matters, in a voice that is lively and specific. "
        "Do not number the titles yourself; we number them on render.\n"
        "- Keep the overall tone human, confident, a little playful.\n"
        "- Use only the information from the briefing; do not invent facts.\n"
        "- Preserve the provided url for each story exactly.\n\n"
        f"Briefing (JSON):\n{json.dumps(briefing, ensure_ascii=False)}\n\n"
        "Respond ONLY as JSON with this exact shape:\n"
        "{\n"
        "  \"subject\": \"short, concrete subject line (no prefixes like 'Today:' "
        "or 'Daily Update:' — just the headline of the day)\",\n"
        "  \"intro\": \"2-4 sentences of intro text, plain text\",\n"
        "  \"stories\": [\n"
        "    {\"title\": \"<same title>\", \"url\": \"<same url>\", "
        "\"body\": \"2-4 sentences, plain text, paragraphs separated by \\n\\n if needed\"}\n"
        "  ],\n"
        "  \"sign_off\": \"one short, fun closing line\"\n"
        "}"
    )

    resp = client.chat.completions.create(
        model=WRITE_MODEL,
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    data = json.loads(raw)
    return data


def build_unified_newsletter(
    date: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    store = FirestoreStore()
    v3_store = V3Store()
    target_date = (date or "").strip() or _today_ist()

    doc_ref = store.db.collection("unified_newsletters").document(target_date)
    existing = doc_ref.get()
    if existing.exists and not force:
        data = existing.to_dict() or {}
        if data.get("status") in {"draft", "sent"}:
            return {
                "success": True,
                "skipped": True,
                "reason": "already built (use --force)",
                "date": target_date,
            }

    global_feed = v3_store.load_global_feed(target_date) or {}
    candidates = _collect_candidates(v3_store, target_date)
    candidates.extend(_collect_from_role_sections(global_feed))
    candidates = _dedupe_candidates(candidates)
    previous_urls, previous_titles = _load_previous_newsletter_story_keys(store, target_date)
    if previous_urls or previous_titles:
        filtered_candidates = _exclude_previous_story_keys(candidates, previous_urls, previous_titles)
        if not filtered_candidates:
            return {
                "success": False,
                "error": "all today's candidates were already sent yesterday",
                "date": target_date,
                "pool_size": len(candidates),
            }
        candidates = filtered_candidates

    if not candidates:
        return {
            "success": False,
            "error": "no candidate stories in global feed for date",
            "date": target_date,
        }

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {
            "success": False,
            "error": "OPENAI_API_KEY not set",
            "date": target_date,
        }
    client = OpenAI(api_key=api_key)

    picks = _llm_pick_titles(client, candidates)
    if not picks:
        return {
            "success": False,
            "error": "LLM returned no valid picks",
            "date": target_date,
            "pool_size": len(candidates),
        }

    picked = [candidates[i - 1] for i in picks]

    written = _llm_write_newsletter(client, target_date, picked)

    subject = str(written.get("subject") or "").strip()
    intro = str(written.get("intro") or "").strip()
    sign_off = str(written.get("sign_off") or "").strip()
    raw_stories = written.get("stories") or []
    stories: list[dict[str, Any]] = []
    url_to_image = {c["url"]: c.get("image_url", "") for c in picked if c.get("url")}
    trace_urls = [str(c.get("url") or "").strip() for c in picked]
    if isinstance(raw_stories, list):
        for idx, s in enumerate(raw_stories):
            if not isinstance(s, dict):
                continue
            story_url = str(s.get("url") or "").strip()
            if "yourtrace.online/articles/" not in story_url and idx < len(trace_urls):
                story_url = trace_urls[idx]
            image_url = url_to_image.get(story_url, "")
            if not image_url and idx < len(picked):
                image_url = picked[idx].get("image_url", "")
            stories.append(
                {
                    "title": str(s.get("title") or "").strip(),
                    "url": story_url,
                    "body": str(s.get("body") or "").strip(),
                    "image_url": image_url,
                }
            )

    if not subject or not stories:
        return {
            "success": False,
            "error": "LLM did not return a valid newsletter payload",
            "date": target_date,
            "raw": written,
        }

    payload = {
        "date": target_date,
        "status": "draft",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "email_subject": subject,
        "intro": intro,
        "stories": stories,
        "sign_off": sign_off,
        "pool_size": len(candidates),
        "picked_count": len(stories),
        "pick_indices": picks,
        "source": "llm_pick_v1",
    }
    doc_ref.set(payload)

    return {
        "success": True,
        "date": target_date,
        "pool_size": len(candidates),
        "picked_count": len(stories),
        "subject": subject,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build unified newsletter.")
    parser.add_argument("--date", default="", help="YYYY-MM-DD (defaults to today IST)")
    parser.add_argument("--force", action="store_true", help="Rebuild even if already built")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    result = build_unified_newsletter(date=args.date, force=args.force)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
