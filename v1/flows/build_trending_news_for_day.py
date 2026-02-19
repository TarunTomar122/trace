"""
Build trending news for a day using OpenAI web search.

This flow:
1. Uses canonical interests + subtopics from interest schema
2. Runs multi-pass web search per interest (broad + subtopic-focused)
3. Keeps only strict last-24-hours results
4. Saves results to trending_news Firestore collection

Usage:
    python v1/flows/build_trending_news_for_day.py
    python v1/flows/build_trending_news_for_day.py --date 2026-01-27
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import requests
from dotenv import load_dotenv
from openai import OpenAI

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.algorithm.interest_schema import (  # noqa: E402
    CANONICAL_INTERESTS,
    INTEREST_KEYWORDS,
    SUBTOPIC_LABELS,
    get_interest_ids,
)


MAX_NEWS_PER_TOPIC = 6
OPENAI_TRENDING_MODEL = os.getenv("OPENAI_TRENDING_MODEL", "gpt-4.1-mini")
MAX_DAILY_INTERESTS = 4
TRENDING_MAX_AGE_HOURS = 24 * 7
IST_TZ = timezone(timedelta(hours=5, minutes=30))
MAX_PROMPT_PASSES_PER_TOPIC = 2
OPENAI_TIMEOUT_SECONDS = 90.0
OPENAI_FETCH_RETRIES = 2
MAX_TOTAL_TRENDING_ITEMS = 6
TRENDING_LOOKBACK_DAYS = 7
EXA_API_URL = "https://api.exa.ai/contents"
EXA_TEXT_MAX_CHARS = 4000

TRUSTED_SOURCES: list[dict[str, Any]] = [
    {
        "topic_id": "technology",
        "name": "AI (The Verge)",
        "kind": "exa",
        "query": "latest AI news and product launches",
        "domains": ["theverge.com"],
        "seed_url": "https://www.theverge.com/ai-artificial-intelligence",
        "keywords": ["ai", "artificial-intelligence", "technology", "openai", "anthropic"],
    },
    {
        "topic_id": "experience",
        "name": "UX Design",
        "kind": "exa",
        "query": "latest UX design case studies and product design articles",
        "domains": ["uxdesign.cc"],
        "seed_url": "https://uxdesign.cc/all?topic=editor-picks",
        "keywords": ["ux", "design", "product-design", "ui", "research"],
    },
    {
        "topic_id": "productivity",
        "name": "Productivity",
        "kind": "rss",
        "rss_url": "https://www.fastcompany.com/latest/rss",
        "category_allow": ["work life", "leadership", "productivity", "tech"],
        "keywords": ["productivity", "work", "career", "habits"],
    },
]

try:
    DELAY_BETWEEN_SEARCHES = float(
        os.getenv("OPENAI_TRENDING_DELAY_SECONDS", "0.75")
    )
except ValueError:
    DELAY_BETWEEN_SEARCHES = 0.75

# Interests that consistently produce timely, useful "news" updates.
NEWS_HEAVY_INTEREST_POOL = [
    "technology",
    "business-market",
    "experience",
    "productivity",
]

# Tie-break order when interest counts are equal.
NEWS_INTEREST_PRIORITY = {
    "technology": 1,
    "business-market": 2,
    "experience": 3,
    "productivity": 4,
}


def _get_today_ist_date() -> str:
    """Get today's date in IST timezone as YYYY-MM-DD string."""
    return datetime.now(IST_TZ).strftime("%Y-%m-%d")


def _validate_date_string(date_str: str) -> str:
    """Validate date format (YYYY-MM-DD) and return normalized value."""
    value = (date_str or "").strip()
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(
            "Invalid --date. Expected YYYY-MM-DD, got: "
            f"{date_str!r}"
        ) from exc
    return parsed.strftime("%Y-%m-%d")


def _reference_cutoff_utc(
    reference_date: str | None = None,
    max_age_hours: int = TRENDING_MAX_AGE_HOURS,
) -> datetime:
    """Build UTC cutoff for strict recent-content filtering."""
    if reference_date:
        ref_date = datetime.strptime(
            _validate_date_string(reference_date), "%Y-%m-%d"
        ).date()
        ref_dt = datetime.combine(
            ref_date,
            datetime.max.time().replace(microsecond=0),
            tzinfo=IST_TZ,
        )
    else:
        ref_dt = datetime.now(IST_TZ)
    return ref_dt.astimezone(timezone.utc) - timedelta(hours=max_age_hours)


def _build_interest_topics(
    selected_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Build topic configs from canonical interests + subtopic labels."""
    topics: list[dict[str, Any]] = []
    selected = set(selected_ids or [])
    for item in CANONICAL_INTERESTS:
        interest_id = item["id"]
        if selected and interest_id not in selected:
            continue
        label = item["label"]
        subtopics = list(SUBTOPIC_LABELS.get(interest_id, {}).values())
        keywords = INTEREST_KEYWORDS.get(interest_id, []).copy()
        keywords.extend([s.lower() for s in subtopics])
        # De-dupe while preserving order
        seen = set()
        deduped_keywords: list[str] = []
        for kw in keywords:
            if kw and kw not in seen:
                seen.add(kw)
                deduped_keywords.append(kw)
        topics.append(
            {
                "id": interest_id,
                "name": label,
                "subtopics": subtopics,
                "keywords": deduped_keywords,
            }
        )
    return topics


def _select_daily_news_interests(
    store: FirestoreStore,
    max_interests: int = MAX_DAILY_INTERESTS,
) -> list[str]:
    """Pick top interests for daily news based on subscribed demand."""
    users = store.get_onboarded_users()
    counts = {iid: 0 for iid in NEWS_HEAVY_INTEREST_POOL}

    for user in users:
        interest_ids = set(get_interest_ids(user))
        for iid in interest_ids:
            if iid in counts:
                counts[iid] += 1

    ranked = sorted(
        counts.items(),
        key=lambda kv: (-kv[1], NEWS_INTEREST_PRIORITY.get(kv[0], 999)),
    )
    picked = [iid for iid, _ in ranked[:max_interests]]

    # Fallback if we had no subscribed users or all zero counts.
    if not picked:
        return NEWS_HEAVY_INTEREST_POOL[:max_interests]

    return picked


def _interest_specific_rules(interest_id: str) -> str:
    """Minimal extra guidance per interest."""
    return ""


# URL patterns that indicate non-article pages
JUNK_URL_PATTERNS = [
    "/tag/", "/tags/", "/category/", "/categories/",
    "/top/", "/topics/", "/topic/",
    "/replay/", "/embed/", "/video/",
    "/search?", "/search/",
    "/author/", "/authors/",
    "/archive/", "/archives/",
    "/page/", "/feed/", "/rss/",
    "/about/", "/contact/",
    "/privacy", "/terms", "/login", "/signup", "/subscribe",
]
LOW_QUALITY_DOMAINS = {
    "prnewswire.com",
    "globenewswire.com",
    "businesswire.com",
    "einpresswire.com",
    "openpr.com",
    "newswire.com",
}


def _is_junk_url(url: str) -> bool:
    """Check if URL is a tag page, homepage, or other non-article page."""
    if not url:
        return True
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.lower()
        if not path or path == "/" or path == "/index.html":
            return True
        for pattern in JUNK_URL_PATTERNS:
            if pattern in path:
                return True
        host = (parsed.hostname or "").lower()
        for blocked in LOW_QUALITY_DOMAINS:
            if host == blocked or host.endswith(f".{blocked}"):
                return True
        return False
    except Exception:
        return False


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    """Parse first JSON object from model output."""
    if not raw_text:
        return {}
    raw_text = raw_text.strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(raw_text[start:end + 1])
        except json.JSONDecodeError:
            return {}
    return {}


def _normalize_url(url: str) -> str:
    if not url:
        return ""
    cleaned = url.strip()
    cleaned = re.sub(r"[)\].,;:]+$", "", cleaned)
    return cleaned


def _parse_any_date(value: str, fallback_date: str) -> str:
    """Best-effort date parsing; returns YYYY-MM-DD."""
    raw = (value or "").strip()
    if not raw:
        return fallback_date
    try:
        if "T" in raw:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.astimezone(IST_TZ).strftime("%Y-%m-%d")
        if "," in raw:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(IST_TZ).strftime("%Y-%m-%d")
        return datetime.strptime(raw[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception:
        return fallback_date


def _is_trusted_domain(url: str, allowed_domains: list[str]) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return any(host == d or host.endswith(f".{d}") for d in allowed_domains)


def _is_probable_article_url(url: str) -> bool:
    """Reject hub/list/archive pages and tracking links."""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        path = (parsed.path or "").lower()
    except Exception:
        return False

    if host.startswith("link."):
        return False
    if not path or path in {"/", "/index.html"}:
        return False

    blocked_path_bits = [
        "/tag/",
        "/tags/",
        "/topic/",
        "/topics/",
        "/section/",
        "/categories/",
        "/category/",
        "/all",
        "/archive",
        "/search",
        "/newsletter",
    ]
    if any(bit in path for bit in blocked_path_bits):
        return False
    if path.endswith("/home"):
        return False
    if path.endswith("/ai-artificial-intelligence"):
        return False
    return True


def _extract_exa_items(results: Any) -> list[dict[str, str]]:
    extracted: list[dict[str, str]] = []
    for r in results or []:
        if isinstance(r, dict):
            url = r.get("url")
            title = r.get("title")
            published = r.get("published_date") or r.get("publishedDate") or ""
        else:
            url = getattr(r, "url", None)
            title = getattr(r, "title", None)
            published = (
                getattr(r, "published_date", None)
                or getattr(r, "publishedDate", None)
                or ""
            )
        if url and title:
            extracted.append(
                {
                    "url": str(url).strip(),
                    
                    "title": str(title).strip(),
                    "published_date": str(published).strip(),
                }
            )
    return extracted


def _search_exa_trusted_source(
    source: dict[str, Any],
    reference_date: str,
    max_results: int = 12,
) -> list[dict[str, Any]]:
    api_key = (os.getenv("EXA_API_KEY") or os.getenv("EXA_KEY") or "").strip()
    if not api_key:
        print("EXA_API_KEY missing; skipping Exa source")
        return []

    try:
        from exa_py import Exa
    except Exception:
        print("exa_py missing; skipping Exa source")
        return []

    exa = Exa(api_key=api_key)
    ref_dt = datetime.strptime(reference_date, "%Y-%m-%d").replace(tzinfo=IST_TZ)
    start_dt = ref_dt - timedelta(days=TRENDING_LOOKBACK_DAYS)
    start_iso = start_dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    end_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    query = source.get("query", source["name"])
    domains = source.get("domains", [])

    try:
        try:
            resp = exa.search(
                query,
                num_results=max_results,
                start_published_date=start_iso,
                end_published_date=end_iso,
                include_domains=domains,
                type="auto",
            )
        except TypeError:
            resp = exa.search(
                query,
                num_results=max_results,
                start_published_date=start_iso,
                end_published_date=end_iso,
                type="auto",
            )
    except Exception as exc:
        print(f"    Exa search failed for {source['name']}: {exc}")
        return []

    items = []
    seen = set()
    for item in _extract_exa_items(getattr(resp, "results", resp)):
        url = _normalize_url(item["url"])
        if not url or url in seen:
            continue
        if domains and not _is_trusted_domain(url, domains):
            continue
        if not _is_probable_article_url(url) or _is_junk_url(url):
            continue
        seen.add(url)
        items.append(
            {
                "title": item["title"],
                "url": url,
                "published_date": _parse_any_date(item.get("published_date", ""), reference_date),
                "source_domain": (urlparse(url).hostname or "").replace("www.", ""),
                "source_label": source["name"],
                "topic_id": source["topic_id"],
                "keywords": source.get("keywords", []),
            }
        )
    return items


def _fetch_rss_source(
    source: dict[str, Any],
    reference_date: str,
    max_results: int = 12,
) -> list[dict[str, Any]]:
    rss_url = source.get("rss_url", "")
    if not rss_url:
        return []
    try:
        res = requests.get(
            rss_url,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; TraceBot/1.0)"},
        )
        res.raise_for_status()
        root = ET.fromstring(res.text)
    except Exception as exc:
        print(f"    RSS fetch failed for {source['name']}: {exc}")
        return []

    ref_cutoff = datetime.strptime(reference_date, "%Y-%m-%d").replace(tzinfo=IST_TZ) - timedelta(days=TRENDING_LOOKBACK_DAYS)
    items: list[dict[str, Any]] = []
    seen = set()
    category_allow = [c.lower() for c in source.get("category_allow", [])]

    for node in root.findall(".//item"):
        title = (node.findtext("title") or "").strip()
        url = _normalize_url((node.findtext("link") or "").strip())
        pub_raw = (node.findtext("pubDate") or "").strip()
        categories = [
            (c.text or "").strip().lower()
            for c in node.findall("category")
            if (c.text or "").strip()
        ]
        if not title or not url or url in seen:
            continue
        if category_allow and not any(
            any(allow in cat for allow in category_allow) for cat in categories
        ):
            continue
        if not _is_probable_article_url(url) or _is_junk_url(url):
            continue
        try:
            pub_dt = parsedate_to_datetime(pub_raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            if pub_dt.astimezone(IST_TZ) < ref_cutoff:
                continue
            published_date = pub_dt.astimezone(IST_TZ).strftime("%Y-%m-%d")
        except Exception:
            published_date = reference_date

        seen.add(url)
        items.append(
            {
                "title": title,
                "url": url,
                "published_date": published_date,
                "source_domain": (urlparse(url).hostname or "").replace("www.", ""),
                "source_label": source["name"],
                "topic_id": source["topic_id"],
                "keywords": source.get("keywords", []),
            }
        )
        if len(items) >= max_results:
            break

    return items


def _fetch_exa_contents_for_urls(urls: list[str]) -> tuple[dict[str, str], dict[str, str]]:
    """Fetch cleaned text + image from Exa contents for URL set."""
    api_key = os.getenv("EXA_API_KEY", "").strip()
    if not api_key or not urls:
        return {}, {}

    payload = {"urls": urls, "text": {"maxCharacters": EXA_TEXT_MAX_CHARS}}
    headers = {"Content-Type": "application/json", "x-api-key": api_key}
    try:
        res = requests.post(EXA_API_URL, json=payload, headers=headers, timeout=30)
        if res.status_code >= 400:
            return {}, {}
        data = res.json() or {}
    except Exception:
        return {}, {}

    text_map: dict[str, str] = {}
    image_map: dict[str, str] = {}
    for item in (data.get("results") or []):
        url = (item.get("url") or "").strip()
        text = (item.get("text") or "").strip()
        image = (item.get("image") or "").strip()
        if url and text:
            text_map[url] = text
        if url and image and image.startswith("http") and not image.endswith(".svg"):
            image_map[url] = image
    return text_map, image_map


def _summarize_from_content(client: OpenAI, title: str, content: str) -> tuple[str, str]:
    """Return (subtitle, details) for one article using a small LLM call."""
    if not content:
        return "", ""
    prompt = (
        "Summarize this article into JSON with keys subtitle and details.\n"
        "Rules:\n"
        "- subtitle: one sentence (max 20 words)\n"
        "- details: 2-3 sentences, concrete and factual\n"
        "- no hype, no markdown\n\n"
        f"Title: {title}\n\n"
        f"Content:\n{content[:2500]}"
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=220,
        )
        parsed = json.loads(resp.choices[0].message.content or "{}")
        subtitle = str(parsed.get("subtitle", "")).strip()
        details = str(parsed.get("details", "")).strip()
        return subtitle, details
    except Exception:
        return "", ""


def _is_recent_enough(
    published_date: str,
    reference_date: str | None = None,
    max_age_hours: int = TRENDING_MAX_AGE_HOURS,
) -> bool:
    """Return True only when article timestamp is within max_age_hours."""
    if not published_date:
        return False
    try:
        cutoff = _reference_cutoff_utc(
            reference_date=reference_date,
            max_age_hours=max_age_hours,
        )
        raw = published_date.strip().replace("Z", "+00:00")
        if "T" in raw:
            pub_dt = datetime.fromisoformat(raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            pub_dt = pub_dt.astimezone(timezone.utc)
        else:
            pub_dt = datetime.strptime(raw[:10], "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
        return pub_dt >= cutoff
    except Exception:
        return False


def _dedupe_articles_by_url(
    articles: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Deduplicate articles by URL, keeping the first occurrence."""
    seen_urls: set[str] = set()
    deduped: list[dict[str, Any]] = []

    for article in articles:
        url = article.get("url")
        if url and url not in seen_urls and not _is_junk_url(url):
            seen_urls.add(url)
            deduped.append(article)

    return deduped


def _search_openai_for_interest(
    client: OpenAI,
    topic: dict[str, Any],
    date: str,
    max_results: int,
) -> list[dict[str, Any]]:
    """Single simple web search per topic. No passes, no complexity."""
    topic_name = topic.get("name", "")

    prompt = f"What are today's biggest {topic_name} news stories? Date: {date}. Return up to {max_results} articles as JSON: {{\"articles\": [{{\"title\": \"...\", \"subtitle\": \"...\", \"details\": \"2-3 sentence summary\", \"url\": \"https://...\", \"published_date\": \"{date}\", \"source_domain\": \"example.com\"}}]}}"

    for attempt in range(OPENAI_FETCH_RETRIES + 1):
        try:
            response = client.responses.create(
                model=OPENAI_TRENDING_MODEL,
                tools=[{"type": "web_search_preview"}],
                temperature=0.4,
                max_output_tokens=4000,
                input=prompt,
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
            text = (response.output_text or "").strip()
            data = _extract_json_object(text)
            raw = data.get("articles", []) if isinstance(data, dict) else []
            if not isinstance(raw, list):
                raw = []
            break
        except Exception as exc:
            if attempt >= OPENAI_FETCH_RETRIES:
                print(f"    search failed after retries: {exc}")
                return []
            backoff = (attempt + 1) * 1.5
            print(f"    search failed (attempt {attempt + 1}), retrying in {backoff:.1f}s...")
            time.sleep(backoff)

    # Parse results — accept everything that has a url and title.
    # We trust OpenAI web search to return recent content since we asked for "today's news".
    articles: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for r in raw:
        if not isinstance(r, dict):
            continue
        url = _normalize_url(str(r.get("url", "")))
        title = str(r.get("title", "")).strip()
        if not url or not title or _is_junk_url(url) or url in seen_urls:
            continue
        details = str(r.get("details", "")).strip()
        subtitle = str(r.get("subtitle", "")).strip()
        published_date = str(r.get("published_date", "")).strip() or date
        seen_urls.add(url)
        articles.append({
            "title": title,
            "url": url,
            "content": details or subtitle,
            "published_date": published_date,
            "score": 3.0,
            "source": "openai_web_search",
            "subtopic": str(r.get("subtopic", "")).strip(),
        })
        if len(articles) >= max_results:
            break

    print(f"    found {len(articles)} articles")
    return _dedupe_articles_by_url(articles)[:max_results]


def fetch_news_for_topics(
    topics: list[dict[str, Any]],
    date: str,
    max_results: int = MAX_NEWS_PER_TOPIC,
) -> dict[str, dict[str, Any]]:
    """
    Source-first trending fetch:
    - trusted sources only
    - strict URL filtering
    - dedupe across all sources
    - latest-first ranking
    - capped to MAX_TOTAL_TRENDING_ITEMS globally
    """
    del topics  # We now use TRUSTED_SOURCES for quality control.
    start_time = time.time()

    # Initialize output buckets for all trusted sources.
    news_by_topic: dict[str, dict[str, Any]] = {
        s["topic_id"]: {
            "name": s["name"],
            "search_query": s.get("query", s.get("rss_url", "")),
            "keywords": s.get("keywords", []),
            "articles": [],
        }
        for s in TRUSTED_SOURCES
    }

    print(f"Fetching news from {len(TRUSTED_SOURCES)} trusted sources...")
    candidates: list[dict[str, Any]] = []

    for idx, source in enumerate(TRUSTED_SOURCES):
        try:
            if source.get("kind") == "exa":
                found = _search_exa_trusted_source(source, reference_date=date, max_results=12)
            else:
                found = _fetch_rss_source(source, reference_date=date, max_results=12)
            candidates.extend(found)
            print(f"  [{idx + 1}/{len(TRUSTED_SOURCES)}] {source['name']}: {len(found)} candidates")
        except Exception as exc:
            print(f"  [{idx + 1}/{len(TRUSTED_SOURCES)}] {source['name']}: error - {exc}")

    # Global dedupe by URL, prefer newest.
    dedup: dict[str, dict[str, Any]] = {}
    for item in candidates:
        url = _normalize_url(item.get("url", ""))
        if not url:
            continue
        existing = dedup.get(url)
        if not existing:
            dedup[url] = item
            continue
        if item.get("published_date", "") > existing.get("published_date", ""):
            dedup[url] = item

    unique_items = list(dedup.values())
    unique_items.sort(key=lambda x: x.get("published_date", ""), reverse=True)

    # Keep only latest max items globally, with source diversity via round-robin.
    buckets: dict[str, list[dict[str, Any]]] = {}
    for item in unique_items:
        tid = item.get("topic_id", "misc")
        buckets.setdefault(tid, []).append(item)

    selected: list[dict[str, Any]] = []
    topic_ids = [s["topic_id"] for s in TRUSTED_SOURCES]
    while len(selected) < MAX_TOTAL_TRENDING_ITEMS:
        added = False
        for tid in topic_ids:
            if len(selected) >= MAX_TOTAL_TRENDING_ITEMS:
                break
            queue = buckets.get(tid, [])
            if not queue:
                continue
            selected.append(queue.pop(0))
            added = True
        if not added:
            break

    print(f"Selected {len(selected)} unique latest articles (cap={MAX_TOTAL_TRENDING_ITEMS})")

    # Hydrate with Exa content + image and summarize.
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    client = OpenAI(api_key=openai_key, timeout=OPENAI_TIMEOUT_SECONDS) if openai_key else None
    url_list = [i["url"] for i in selected]
    content_map, image_map = _fetch_exa_contents_for_urls(url_list)

    for item in selected:
        url = item["url"]
        content = content_map.get(url, "")
        subtitle = ""
        details = ""
        if client and content:
            subtitle, details = _summarize_from_content(client, item.get("title", ""), content)

        item["subtitle"] = subtitle or item.get("title", "")
        item["details"] = details or (content[:240] + "..." if content else "")
        item["content"] = content
        if image_map.get(url):
            item["thumbnail"] = image_map[url]

        topic_id = item["topic_id"]
        article = {
            "title": item.get("title", ""),
            "subtitle": item.get("subtitle", ""),
            "details": item.get("details", ""),
            "url": url,
            "published_date": item.get("published_date", date),
            "source_domain": item.get("source_domain", ""),
            "thumbnail": item.get("thumbnail", ""),
        }
        news_by_topic[topic_id]["articles"].append(article)

    elapsed = time.time() - start_time
    total_articles = sum(len(t["articles"]) for t in news_by_topic.values())
    topics_with_news = sum(1 for t in news_by_topic.values() if t["articles"])
    print(f"News fetch complete: {total_articles} articles from {topics_with_news} topics in {elapsed:.1f}s")
    return news_by_topic


def _fetch_og_image(url: str, timeout: int = 5) -> str:
    """Fetch the og:image or twitter:image URL for an article."""
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (compatible; TraceBot/1.0)"},
            allow_redirects=True,
        )
        if not resp.ok:
            return ""
        html = resp.text[:30_000]  # only need the <head>
        for pattern in [
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\']',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                img = m.group(1).strip()
                if img.startswith("http") and not img.endswith(".svg"):
                    return img
        return ""
    except Exception:
        return ""


def _enrich_articles_with_thumbnails(
    news_by_topic: dict[str, dict[str, Any]],
    max_workers: int = 10,
) -> dict[str, dict[str, Any]]:
    """
    Fetch OG images for all articles in parallel.
    Modifies articles in-place, adding a 'thumbnail' key.
    """
    # Collect all (topic_id, article_idx, url) triples that need fetching
    tasks: list[tuple[str, int, str]] = []
    for topic_id, data in news_by_topic.items():
        for idx, article in enumerate(data.get("articles", [])):
            url = article.get("url", "")
            if url and not article.get("thumbnail"):
                tasks.append((topic_id, idx, url))

    if not tasks:
        return news_by_topic

    print(f"  Fetching thumbnails for {len(tasks)} articles...")

    def fetch(task: tuple[str, int, str]) -> tuple[str, int, str]:
        topic_id, idx, url = task
        return topic_id, idx, _fetch_og_image(url)

    completed = 0
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch, t): t for t in tasks}
        for future in as_completed(futures):
            topic_id, idx, thumbnail = future.result()
            if thumbnail:
                news_by_topic[topic_id]["articles"][idx]["thumbnail"] = thumbnail
            completed += 1

    found = sum(
        1 for data in news_by_topic.values()
        for a in data.get("articles", [])
        if a.get("thumbnail")
    )
    print(f"  Thumbnails found: {found}/{len(tasks)}")
    return news_by_topic


def save_trending_news(
    store: FirestoreStore,
    date: str,
    news_by_topic: dict[str, dict[str, Any]],
) -> None:
    """
    Save trending news to Firestore.

    Structure: trending_news/{date}/topics/{topic_id}
    """
    generated_at = datetime.now(timezone.utc).isoformat()

    # Save metadata doc
    total_articles = sum(
        len(t["articles"]) for t in news_by_topic.values()
    )
    metadata = {
        "date": date,
        "generated_at": generated_at,
        "topic_count": len(news_by_topic),
        "total_articles": total_articles,
    }
    store.db.collection("trending_news").document(date).set(metadata)

    # Clear existing topic docs for this date to avoid stale/incorrect leftovers
    existing_topics = (
        store.db.collection("trending_news")
        .document(date)
        .collection("topics")
        .stream()
    )
    for doc in existing_topics:
        doc.reference.delete()

    # Save each topic's news
    for topic_id, data in news_by_topic.items():
        (
            store.db.collection("trending_news")
            .document(date)
            .collection("topics")
            .document(topic_id)
            .set(
                {
                    "topic_id": topic_id,
                    "name": data["name"],
                    "search_query": data["search_query"],
                    "keywords": data["keywords"],
                    "articles": data["articles"],
                    "article_count": len(data["articles"]),
                    "generated_at": generated_at,
                }
            )
        )

    print(
        f"Saved {len(news_by_topic)} topic news docs to "
        f"trending_news/{date}"
    )


def build_trending_news_for_day(date: str | None = None) -> dict[str, Any]:
    """
    Main orchestration function that builds trending news for a day.

    1. Uses canonical interests + subtopics from schema
    2. Fetches news for each interest using OpenAI web search
    3. Saves to Firestore

    Args:
        date: Date string in YYYY-MM-DD format (defaults to today IST)

    Returns:
        Summary dict with date, topics_searched, total_articles, etc.
    """
    if not date:
        date = _get_today_ist_date()
    else:
        date = _validate_date_string(date)

    print("=" * 60)
    print(f"TRENDING NEWS BUILD FOR {date}")
    print("=" * 60)

    start_time = time.time()
    store = FirestoreStore()

    # Step 1: Use trusted source buckets (quality-first)
    topics = [
        {
            "id": s["topic_id"],
            "name": s["name"],
            "keywords": s.get("keywords", []),
        }
        for s in TRUSTED_SOURCES
    ]
    print(f"\n[1/2] Using {len(topics)} trusted sources")
    for t in topics:
        print(f"  - {t['name']}")

    # Step 2: Fetch news
    print("\n[2/2] Fetching news for topics...")
    news_by_topic = fetch_news_for_topics(
        topics=topics,
        date=date,
        max_results=MAX_NEWS_PER_TOPIC,
    )

    # Step 3: Enrich articles with thumbnails
    print("\nFetching thumbnails...")
    news_by_topic = _enrich_articles_with_thumbnails(news_by_topic)

    # Step 4: Save to Firestore
    print("\nSaving to Firestore...")
    save_trending_news(store, date, news_by_topic)

    elapsed = time.time() - start_time
    total_articles = sum(len(t["articles"]) for t in news_by_topic.values())
    topics_with_news = sum(1 for t in news_by_topic.values() if t["articles"])

    print("\n" + "=" * 60)
    print("TRENDING NEWS BUILD COMPLETE")
    print("=" * 60)
    print(f"  Date: {date}")
    print(f"  Topics searched: {len(topics)}")
    print(f"  Topics with news: {topics_with_news}")
    print(f"  Total articles: {total_articles}")
    print(f"  Elapsed time: {elapsed:.1f}s")

    return {
        "date": date,
        "topics_searched": len(topics),
        "selected_interests": [t["id"] for t in topics],
        "total_articles": total_articles,
        "topics_with_news": topics_with_news,
        "elapsed_seconds": round(elapsed, 1),
        "status": "success",
    }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Build trending news for a day using hardcoded topics"
    )
    parser.add_argument(
        "--date",
        help="Date to build news for (YYYY-MM-DD), defaults to today IST",
    )

    args = parser.parse_args()

    try:
        result = build_trending_news_for_day(date=args.date)
        if result.get("status") == "success":
            print(f"\nSuccess! {result['total_articles']} articles saved.")
            sys.exit(0)
        else:
            print(f"\nCompleted with status: {result.get('status')}")
            sys.exit(0)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
