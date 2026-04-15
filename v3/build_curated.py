#!/usr/bin/env python3
"""
Build shared curated picks from manually saved URLs.

Usage:
  python3 -m v3.build_curated
  python3 -m v3.build_curated --date 2026-04-15
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
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v3.lib.content import fetch_content, fetch_og_image  # noqa: E402
from v3.lib.store import V3Store, _today_ist  # noqa: E402

try:
    from v1.tools.youtube_transcript import fetch_youtube_transcript  # type: ignore # noqa: E402
except Exception:
    fetch_youtube_transcript = None

try:
    import yt_dlp  # type: ignore
except Exception:
    yt_dlp = None

CURATED_QUEUE_COLLECTION = "v3_curated_queue"
CURATED_BUCKET = "curated_summary_v2"
CURATED_MODEL = "gpt-4o-mini"
CURATED_LOOKBACK_DAYS = 14
CURATED_MAX_ITEMS = 8
CURATED_BODY_CHAR_LIMIT = 560
CURATED_BODY_MAX_SENTENCES = 3

VALID_INTEREST_IDS = {
    "ai",
    "products",
    "tech",
    "startups",
    "engineering",
    "ux-design",
    "markets",
    "the-world",
}

def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-curated] {msg}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build curated picks")
    p.add_argument("--date", default="", help="Target date (default: today IST)")
    return p.parse_args()


def _safe_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _clean_multiline(text: str, limit: int = 1800) -> str:
    paragraphs = []
    for block in re.split(r"\n\s*\n", str(text or "")):
        cleaned = re.sub(r"\s+", " ", block).strip()
        if cleaned:
            paragraphs.append(cleaned)
    joined = "\n\n".join(paragraphs)
    if len(joined) <= limit:
        return joined
    return joined[: limit - 1].rstrip() + "…"


def _curated_body_text(text: str) -> str:
    """Normalize curated teaser: one short paragraph, max 3 sentences."""
    normalized = _clean_multiline(text, limit=4000)
    single = re.sub(r"\s+", " ", normalized).strip()
    if not single:
        return ""
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", single) if p.strip()]
    limited = " ".join(parts[:CURATED_BODY_MAX_SENTENCES]).strip() if parts else single
    return _clean_multiline(limited, limit=CURATED_BODY_CHAR_LIMIT)


def _hash_id(prefix: str, url: str) -> str:
    return f"{prefix}_{hashlib.sha256(url.encode('utf-8')).hexdigest()[:24]}"


def _normalize_interest_id(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in VALID_INTEREST_IDS else ""


def _detect_url_type(url: str) -> tuple[str, str]:
    lower = url.lower()
    if "x.com/" in lower or "twitter.com/" in lower:
        return "tweet", "x"
    if "youtube.com/watch" in lower or "youtu.be/" in lower or "youtube.com/shorts/" in lower:
        return "youtube", "youtube"
    return "article", "web"


def _extract_tweet_id(url: str) -> str:
    match = re.search(r"/status/(\d+)", url)
    return match.group(1) if match else ""


def _x_headers() -> dict[str, str]:
    token = os.getenv("X_API_BEARER_TOKEN", "").strip() or os.getenv("TWITTER_BEARER_TOKEN", "").strip()
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def _x_api_get(path: str, params: dict[str, str]) -> dict[str, Any]:
    headers = _x_headers()
    if not headers:
        raise RuntimeError("X_API_BEARER_TOKEN not configured")
    res = requests.get(
        f"https://api.x.com/2/{path}",
        params=params,
        headers=headers,
        timeout=20,
    )
    res.raise_for_status()
    return res.json()


def _fetch_tweet_thread(url: str) -> dict[str, Any]:
    tweet_id = _extract_tweet_id(url)
    if not tweet_id:
        return {"ok": False, "error": "Could not parse tweet ID"}

    if not _x_headers():
        return {
            "ok": True,
            "title": "Curated X post",
            "source_name": "X",
            "thumbnail": "",
            "content": "",
            "source_items": [{"name": "X", "title": "Open post", "url": url}],
            "url": url,
            "degraded": True,
            "degraded_reason": "X_API_BEARER_TOKEN not configured",
        }

    base_params = {
        "tweet.fields": "author_id,conversation_id,created_at,text,entities,attachments",
        "expansions": "author_id,attachments.media_keys",
        "user.fields": "name,username,profile_image_url",
        "media.fields": "preview_image_url,url",
    }
    lookup = _x_api_get(f"tweets/{tweet_id}", base_params)
    root = lookup.get("data") or {}
    if not root:
        return {"ok": False, "error": "Tweet lookup returned no data"}

    includes = lookup.get("includes") or {}
    users = {u.get("id"): u for u in (includes.get("users") or []) if isinstance(u, dict)}
    media = {m.get("media_key"): m for m in (includes.get("media") or []) if isinstance(m, dict)}

    author_id = str(root.get("author_id") or "")
    conversation_id = str(root.get("conversation_id") or tweet_id)
    author = users.get(author_id) or {}

    search = _x_api_get(
        "tweets/search/recent",
        {
            **base_params,
            "max_results": "100",
            "query": f"conversation_id:{conversation_id}",
        },
    )
    thread_tweets = [t for t in (search.get("data") or []) if isinstance(t, dict)]
    if thread_tweets:
        thread_tweets = [t for t in thread_tweets if str(t.get("author_id") or "") == author_id]
        thread_tweets.sort(key=lambda t: str(t.get("created_at") or ""))
    else:
        thread_tweets = [root]

    thumbnail = ""
    attachment_keys = root.get("attachments", {}).get("media_keys") if isinstance(root.get("attachments"), dict) else []
    if isinstance(attachment_keys, list):
        for key in attachment_keys:
            item = media.get(key) or {}
            thumbnail = str(item.get("url") or item.get("preview_image_url") or "").strip()
            if thumbnail:
                break

    thread_lines = []
    source_items = []
    for idx, tweet in enumerate(thread_tweets[:8], start=1):
        text = _safe_text(tweet.get("text"))
        if not text:
            continue
        tweet_url = f"https://x.com/{author.get('username', 'i')}/status/{tweet.get('id')}"
        thread_lines.append(f"{idx}. {text}")
        source_items.append({
            "name": "X",
            "title": text[:120],
            "url": tweet_url,
        })

    headline = _safe_text(root.get("text"))[:140]
    if len(headline) > 110:
        headline = headline[:109].rstrip() + "…"

    return {
        "ok": True,
        "title": headline or "Curated X thread",
        "source_name": f"X · @{author.get('username', 'unknown')}",
        "thumbnail": thumbnail,
        "content": "\n\n".join(thread_lines),
        "source_items": source_items,
        "url": url,
    }


def _fetch_youtube_metadata(url: str) -> dict[str, Any]:
    title = ""
    author_name = ""
    thumbnail = ""

    try:
        resp = requests.get(
            "https://www.youtube.com/oembed",
            params={"url": url, "format": "json"},
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            title = _safe_text(data.get("title"))
            author_name = _safe_text(data.get("author_name"))
            thumbnail = _safe_text(data.get("thumbnail_url"))
    except Exception:
        pass

    if yt_dlp is not None:
        try:
            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
                info = ydl.extract_info(url, download=False) or {}
            title = title or _safe_text(info.get("title"))
            author_name = author_name or _safe_text(info.get("channel") or info.get("uploader"))
            thumbnail = thumbnail or _safe_text(info.get("thumbnail"))
        except Exception:
            pass

    return {"title": title, "author_name": author_name, "thumbnail": thumbnail}


_VTT_TIMING_LINE = re.compile(
    r"^\d{1,2}:\d{2}(:\d{2})?(\.\d{3})?\s+-->\s+\d{1,2}:\d{2}(:\d{2})?(\.\d{3})?"
)


def _webvtt_to_plaintext(vtt: str) -> str:
    parts: list[str] = []
    for raw in vtt.splitlines():
        line = raw.strip()
        if not line or line.startswith("WEBVTT") or line.startswith("NOTE"):
            continue
        if _VTT_TIMING_LINE.match(line):
            continue
        if line.startswith("STYLE") or line.startswith("REGION"):
            continue
        if line.isdigit() and len(line) <= 4:
            continue
        parts.append(line)
    return _safe_text(" ".join(parts))


def _youtube_captions_via_ytdlp(url: str) -> str:
    """Fallback when youtube-transcript-api fails: pull auto/manual captions from yt-dlp."""
    if yt_dlp is None:
        return ""
    try:
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
            info = ydl.extract_info(url, download=False) or {}
    except Exception:
        return ""

    def _pick_tracks() -> list[dict[str, Any]]:
        ordered: list[dict[str, Any]] = []
        for bucket_name in ("subtitles", "automatic_captions"):
            bucket = info.get(bucket_name) or {}
            if not isinstance(bucket, dict):
                continue
            langs = []
            for lang in bucket.keys():
                if not isinstance(lang, str):
                    continue
                langs.append(lang)
            langs.sort(key=lambda s: (0 if s == "en" else 1 if s.startswith("en") else 2, s))
            for lang in langs:
                tracks = bucket.get(lang)
                if isinstance(tracks, list):
                    for tr in tracks:
                        if isinstance(tr, dict):
                            ordered.append(tr)
        return ordered

    ext_pref = ("vtt", "ttml", "srv3", "srv2", "srv1")
    for tr in _pick_tracks():
        ext = str(tr.get("ext") or "").lower()
        if ext not in ext_pref:
            continue
        sub_url = str(tr.get("url") or "").strip()
        if not sub_url:
            continue
        try:
            res = requests.get(sub_url, timeout=20, headers={"User-Agent": "TraceCurated/1.0"})
            res.raise_for_status()
            raw = res.text
            if ext == "vtt" or "WEBVTT" in raw[:400]:
                text = _webvtt_to_plaintext(raw)
                if len(text) > 200:
                    return text[:120000]
        except Exception:
            continue
    return ""


def _fetch_youtube_item(url: str) -> dict[str, Any]:
    transcript = fetch_youtube_transcript(url) if callable(fetch_youtube_transcript) else ""
    transcript = (transcript or "").strip()
    if len(transcript) < 200:
        transcript = _youtube_captions_via_ytdlp(url) or transcript
    metadata = _fetch_youtube_metadata(url)
    title = metadata.get("title") or "Curated YouTube video"
    author_name = metadata.get("author_name") or "YouTube"
    content = transcript.strip()
    if not content:
        content = title
    return {
        "ok": True,
        "title": title,
        "source_name": f"YouTube · {author_name}",
        "thumbnail": metadata.get("thumbnail") or "",
        "content": content,
        "source_items": [{"name": "YouTube", "title": title, "url": url}],
        "url": url,
    }


def _extract_article_title(url: str) -> str:
    try:
        res = requests.get(url, timeout=12, headers={"User-Agent": "TraceCurated/1.0"})
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")
        og = soup.find("meta", property="og:title")
        if og and og.get("content"):
            return _safe_text(og.get("content"))
        title = soup.find("title")
        if title and title.text:
            return _safe_text(title.text)
    except Exception:
        pass
    return ""


def _fetch_article_item(url: str) -> dict[str, Any]:
    payload = fetch_content(url)
    content = _safe_text(payload.get("content"))
    image = _safe_text(payload.get("image")) or fetch_og_image(url)
    title = _extract_article_title(url) or _safe_text(urlparse(url).path.rsplit("/", 1)[-1].replace("-", " "))
    domain = (urlparse(url).hostname or "").replace("www.", "")
    return {
        "ok": True,
        "title": title,
        "source_name": domain or "Curated",
        "thumbnail": image,
        "content": content or title,
        "source_items": [{"name": domain or "Source", "title": title, "url": url}],
        "url": url,
    }


def _fetch_item(raw: dict[str, Any]) -> dict[str, Any]:
    url = _safe_text(raw.get("url"))
    if not url:
        return {"ok": False, "error": "Missing URL"}
    url_type, source_platform = _detect_url_type(url)
    if url_type == "tweet":
        result = _fetch_tweet_thread(url)
    elif url_type == "youtube":
        result = _fetch_youtube_item(url)
    else:
        result = _fetch_article_item(url)
    result["url_type"] = url_type
    result["source_platform"] = source_platform
    return result


def _infer_interest_from_text(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["openai", "claude", "gemini", "anthropic", "llm", "model", "ai "]):
        return "ai"
    if any(word in lowered for word in ["figma", "design", "ux", "ui "]):
        return "ux-design"
    if any(word in lowered for word in ["startup", "founder", "funding", "raise"]):
        return "startups"
    if any(word in lowered for word in ["market", "stock", "tariff", "inflation", "economy"]):
        return "markets"
    if any(word in lowered for word in ["world", "policy", "government", "war", "election"]):
        return "the-world"
    if any(word in lowered for word in ["code", "developer", "engineering", "repo", "api", "sdk"]):
        return "engineering"
    return "tech"


def _summarize_curated(
    store: V3Store,
    raw_item: dict[str, Any],
    fetched: dict[str, Any],
) -> dict[str, Any]:
    cache_url = f"trace://curated/{_safe_text(raw_item.get('url'))}"
    cached = store.get_cached_summary_v2(cache_url, CURATED_BUCKET)
    if cached and isinstance(cached.get("summary"), dict):
        summary = dict(cached["summary"])
        if isinstance(summary.get("body"), str):
            summary["body"] = _curated_body_text(summary["body"])
            summary["key_takeaways"] = []
            return summary

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    note = _safe_text(raw_item.get("note"))
    provided_interest = _normalize_interest_id(str(raw_item.get("interest_id") or ""))
    source_text = _safe_text(fetched.get("content"))[:12000]

    if note:
        manual_interest = provided_interest or _infer_interest_from_text(
            " ".join([fetched.get("title", ""), note, source_text[:800]])
        )
        return {
            "title": _safe_text(fetched.get("title")) or "Curated pick",
            "subtitle": "Curated by the author",
            "body": _curated_body_text(_clean_multiline(note, limit=1200)),
            "key_takeaways": [],
            "interest_id": manual_interest or "tech",
        }

    if not api_key:
        fallback_interest = provided_interest or _infer_interest_from_text(" ".join([fetched.get("title", ""), source_text]))
        fallback = {
            "title": _safe_text(fetched.get("title")) or "Curated pick",
            "subtitle": note or "Picked for Trace curated",
            "body": _curated_body_text(_clean_multiline(note or source_text[:900] or fetched.get("title", ""))),
            "key_takeaways": [],
            "interest_id": fallback_interest or "tech",
        }
        return fallback

    client = OpenAI(api_key=api_key)
    prompt = (
        "You are writing a curated Trace pick from a manually selected link.\n"
        "The editor chose this link; your job is a short teaser so readers can decide whether to open it.\n"
        "Return JSON with keys: title, subtitle, body, key_takeaways, interest_id.\n"
        "Rules:\n"
        "- `body` must be exactly 2 or 3 sentences, plain prose, one short paragraph, "
        f"and must stay under {CURATED_BODY_CHAR_LIMIT} characters.\n"
        "- Spark curiosity and convey what kind of thing it is — do NOT summarize everything; the link is the main experience.\n"
        "- No bullet lists in body; no 'why it matters' framing; no hype adjectives.\n"
        "- `key_takeaways` must be an empty array [].\n"
        f"- interest_id must be one of: {', '.join(sorted(VALID_INTEREST_IDS))}.\n"
        f"- If a manual interest is present, prefer it: {provided_interest or 'none'}.\n\n"
        f"Manual note: {note or 'none'}\n"
        f"Source type: {_safe_text(fetched.get('url_type'))}\n"
        f"Source platform: {_safe_text(fetched.get('source_platform'))}\n"
        f"Title: {_safe_text(fetched.get('title'))}\n"
        f"Source name: {_safe_text(fetched.get('source_name'))}\n"
        f"Content:\n{source_text}"
    )
    if _safe_text(fetched.get("url_type")) == "youtube":
        prompt += (
            "\n\nYouTube rule: the Content is transcript/caption text when available. "
            "Ground every claim in the Content; do not invent details not supported by it."
        )

    response = client.chat.completions.create(
        model=CURATED_MODEL,
        messages=[
            {"role": "system", "content": "Return valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=500,
        timeout=60,
    )
    raw = json.loads(response.choices[0].message.content or "{}")
    summary = {
        "title": _safe_text(raw.get("title")) or _safe_text(fetched.get("title")) or "Curated pick",
        "subtitle": _safe_text(raw.get("subtitle")) or note or "Picked for Trace curated",
        "body": _curated_body_text(_clean_multiline(raw.get("body") or note or source_text[:900])),
        "key_takeaways": [],
        "interest_id": provided_interest or _normalize_interest_id(raw.get("interest_id")) or _infer_interest_from_text(
            " ".join([fetched.get("title", ""), source_text])
        ),
    }
    store.save_cached_summary_v2(cache_url, CURATED_BUCKET, summary, CURATED_MODEL)
    return summary


def _build_feed_item(raw_item: dict[str, Any], fetched: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
    url = _safe_text(raw_item.get("url"))
    title = _safe_text(summary.get("title")) or _safe_text(fetched.get("title"))
    subtitle = _safe_text(summary.get("subtitle"))
    body = _curated_body_text(_clean_multiline(summary.get("body")))
    interest_id = _normalize_interest_id(summary.get("interest_id")) or "tech"
    thumbnail = _safe_text(fetched.get("thumbnail"))
    source_name = _safe_text(fetched.get("source_name")) or "Curated"
    source_items = fetched.get("source_items") if isinstance(fetched.get("source_items"), list) else []
    note = _safe_text(raw_item.get("note"))

    return {
        "id": _hash_id("cu", url),
        "type": "curated",
        "source": fetched.get("source_platform") or "curated",
        "source_name": source_name,
        "title": title,
        "description": subtitle,
        "url": url,
        "thumbnail": thumbnail or None,
        "interest_id": interest_id,
        "feed_type": "curated",
        "published_date": _safe_text(raw_item.get("picked_at")) or datetime.now(timezone.utc).isoformat(),
        "tags": ["curated", interest_id],
        "summary": {
            "reading_time_minutes": 1,
            "short_article": {
                "subtitle": subtitle,
                "body": body,
                "key_takeaways": [],
            },
        },
        "metadata": {
            "feed_category": "curated",
            "feed_type": "curated",
            "source_description": note or "",
            "source_count": len(source_items) or 1,
            "curated": True,
            "curated_platform": fetched.get("source_platform") or "web",
            "curated_url_type": fetched.get("url_type") or "article",
        },
        "sources": [
            {
                "name": _safe_text(src.get("name")) or "Source",
                "title": _safe_text(src.get("title")) or title,
                "url": _safe_text(src.get("url")) or url,
            }
            for src in source_items[:6]
            if _safe_text(src.get("url"))
        ],
    }


def _load_queue_docs(store: V3Store) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=CURATED_LOOKBACK_DAYS)
    items: list[dict[str, Any]] = []
    for doc in store.db.collection(CURATED_QUEUE_COLLECTION).stream():
        data = doc.to_dict() or {}
        if data.get("status") != "approved" or data.get("is_active") is False:
            continue
        picked_at = _safe_text(data.get("picked_at"))
        if picked_at:
            try:
                dt = datetime.fromisoformat(picked_at.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < cutoff:
                    continue
            except Exception:
                pass
        items.append({"id": doc.id, **data})
    items.sort(key=lambda item: _safe_text(item.get("picked_at")), reverse=True)
    return items


def main() -> None:
    args = _parse_args()
    target_date = args.date or _today_ist()
    store = V3Store()
    queue_items = _load_queue_docs(store)
    _log(f"loaded {len(queue_items)} approved curated picks")

    global_items: list[dict[str, Any]] = []
    global_seen_urls: set[str] = set()

    for raw_item in queue_items:
        url = _safe_text(raw_item.get("url"))
        if not url:
            continue
        try:
            fetched = _fetch_item(raw_item)
            if not fetched.get("ok"):
                raise RuntimeError(_safe_text(fetched.get("error")) or "fetch failed")
            summary = _summarize_curated(store, raw_item, fetched)
            item = _build_feed_item(raw_item, fetched, summary)

            if url not in global_seen_urls and len(global_items) < CURATED_MAX_ITEMS:
                global_items.append(item)
                global_seen_urls.add(url)

            store.db.collection(CURATED_QUEUE_COLLECTION).document(raw_item["id"]).set(
                {
                    "build_error": None,
                    "last_built_at": datetime.now(timezone.utc).isoformat(),
                    "built_title": item.get("title"),
                    "built_interest_id": item.get("interest_id"),
                    "built_preview": item.get("summary", {}).get("short_article", {}).get("subtitle", ""),
                },
                merge=True,
            )
        except Exception as exc:
            _log(f"failed for {url}: {exc}")
            store.db.collection(CURATED_QUEUE_COLLECTION).document(raw_item["id"]).set(
                {
                    "build_error": str(exc)[:500],
                    "last_built_at": datetime.now(timezone.utc).isoformat(),
                },
                merge=True,
            )

    store.write_global_feed_section(target_date, "curated", global_items)
    _log(f"wrote curated shared items={len(global_items)}")


if __name__ == "__main__":
    main()
