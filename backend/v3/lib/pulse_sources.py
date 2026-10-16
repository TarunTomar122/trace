from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

import feedparser
import requests
from bs4 import BeautifulSoup

from v2.utils.fetch_article_links import fetch_article_links
from v3.lib.pulse_common import ROLE_ORDER, make_pool_article, normalize_role, signal_score

BACKEND_ROOT = Path(__file__).resolve().parents[2]
BRIEF_SOURCES_PATH = BACKEND_ROOT / "v3/config/brief_sources.json"
PULSE_SOURCES_PATH = BACKEND_ROOT / "v3/config/pulse_sources.json"

HN_TIMEOUT = 15
REDDIT_TIMEOUT = 15
RSS_TIMEOUT = 20
RSS_LINK_LIMIT = 10
RSS_LINK_LIMIT_WEEKLY = 25
REDDIT_USER_AGENT = "TracePulse/1.0"
MONTH_NAME_PATTERN = (
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
)
TLDR_ENTRY_SUFFIX_RE = re.compile(r"\s+\((?:\d+\s+minute read|Tool|Website)\)\s*$", re.I)


def _noop(_msg: str) -> None:
    return None


def _load_brief_sources() -> dict[str, Any]:
    with open(BRIEF_SOURCES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _load_pulse_sources() -> dict[str, Any]:
    with open(PULSE_SOURCES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _strip_html(text: str) -> str:
    raw = str(text or "").strip()
    if not raw:
        return ""
    if "<" not in raw and ">" not in raw:
        return re.sub(r"\s+", " ", raw).strip()
    soup = BeautifulSoup(raw, "html.parser")
    cleaned = " ".join(soup.get_text(" ", strip=True).split())
    return re.sub(r"\s+", " ", cleaned).strip()


def _feed_entry_summary(entry: dict[str, Any]) -> str:
    return _strip_html(
        entry.get("summary")
        or entry.get("description")
        or entry.get("subtitle")
        or ""
    )


def _clean_title(title: str, *, source: str = "", source_kind: str = "") -> str:
    cleaned = re.sub(r"\s+", " ", str(title or "").strip())
    if not cleaned:
        return ""

    cleaned = re.sub(r"^\((?:i will not promote|self promo|self-promo|promo)\)\s*:?\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"^(?:psa|thread|discussion)\s*:\s*", "", cleaned, flags=re.I)

    if source.lower() == "show hn":
        cleaned = re.sub(r"^show hn\s*:\s*", "", cleaned, flags=re.I)

    if source.lower() == "figma blog":
        cleaned = re.sub(rf"\s+{MONTH_NAME_PATTERN}\s+\d{{1,2}},\s+\d{{4}}\b.*$", "", cleaned)
        cleaned = re.sub(r"\s+By\s+.+$", "", cleaned)

    cleaned = re.sub(r"\s*[|·•]\s*(comment|comments|discussion)\s*$", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -–—:|")

    if len(cleaned) > 160:
        split_match = re.search(r"(?<=[.!?])\s", cleaned)
        if split_match:
            cleaned = cleaned[: split_match.start()].strip()
    if len(cleaned) > 140:
        cleaned = cleaned[:139].rstrip() + "…"
    return cleaned


def _extract_entry_image(entry: dict[str, Any], *, source: str = "") -> str:
    media_thumbnail = entry.get("media_thumbnail")
    if isinstance(media_thumbnail, list):
        for image in media_thumbnail:
            if isinstance(image, dict) and str(image.get("url", "")).strip():
                return str(image.get("url", "")).strip()

    media_content = entry.get("media_content")
    if isinstance(media_content, list):
        for image in media_content:
            if isinstance(image, dict) and str(image.get("url", "")).strip():
                return str(image.get("url", "")).strip()

    summary = str(entry.get("summary") or entry.get("description") or "")
    if source.lower() == "product hunt":
        match = re.search(r"/r/p/(\d+)", summary)
        if match:
            post_id = match.group(1)
            return f"https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id={post_id}&theme=light"

    if "<img" in summary.lower():
        soup = BeautifulSoup(summary, "html.parser")
        img = soup.find("img")
        if img and img.get("src"):
            return str(img.get("src", "")).strip()
    return ""


def _source_kind_rank(source_kind: str) -> int:
    mapping = {"build": 0, "community": 1, "editorial": 2, "support": 3}
    return mapping.get(str(source_kind or "").strip().lower(), 3)


def _recent_date_candidates(days: int = 2) -> list[str]:
    base = datetime.now(timezone.utc).date()
    return [(base - timedelta(days=offset)).isoformat() for offset in range(max(0, days) + 1)]


def _extract_tldr_entries(
    *,
    html: str,
    source_name: str,
    source_kind: str,
    role_hints: list[str],
) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    entries: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = str(link.get("href", "")).strip()
        if not href.startswith("http"):
            continue

        title = " ".join(link.get_text(" ", strip=True).split())
        if not title:
            continue
        if "sponsor" in title.lower():
            continue
        if not TLDR_ENTRY_SUFFIX_RE.search(title):
            continue

        cleaned_title = TLDR_ENTRY_SUFFIX_RE.sub("", title).strip()
        cleaned_title = _clean_title(cleaned_title, source=source_name, source_kind=source_kind)
        if not cleaned_title or href in seen_urls:
            continue

        parent = link.find_parent("article") or link.parent
        parent_text = " ".join(parent.get_text(" ", strip=True).split()) if parent else ""
        snippet = parent_text
        for prefix in (title, cleaned_title):
            if prefix and snippet.startswith(prefix):
                snippet = snippet[len(prefix):].strip(" -–—:|")
        snippet = _strip_html(snippet)

        seen_urls.add(href)
        entries.append(
            make_pool_article(
                title=cleaned_title,
                url=href,
                source=source_name,
                role_hints=role_hints,
                source_kind=source_kind,
                snippet=snippet,
            )
        )
    return entries


def _fetch_tldr_digest(
    *,
    name: str,
    url_template: str,
    source_kind: str,
    role_hints: list[str],
    log_fn: Callable[[str], None],
    lookback_days: int = 2,
) -> list[dict[str, Any]]:
    for date_str in _recent_date_candidates(lookback_days):
        url = url_template.format(date=date_str)
        try:
            response = requests.get(url, timeout=RSS_TIMEOUT, headers={"User-Agent": REDDIT_USER_AGENT})
            response.raise_for_status()
        except Exception as exc:
            log_fn(f"{name} {date_str} failed: {exc}")
            continue

        entries = _extract_tldr_entries(
            html=response.text,
            source_name=name,
            source_kind=source_kind,
            role_hints=role_hints,
        )
        if entries:
            log_fn(f"{name}: fetched {len(entries)} entries from {date_str}")
            return entries
    log_fn(f"{name}: fetched 0 entries")
    return []


def _fetch_rundown_ai(
    *,
    name: str,
    source_kind: str,
    role_hints: list[str],
    log_fn: Callable[[str], None],
    lookback_days: int = 7,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Fetch recent posts from The Rundown AI via sitemap + OG meta tags."""
    import xml.etree.ElementTree as ET

    sitemap_url = "https://www.therundown.ai/sitemap.xml"
    try:
        resp = requests.get(sitemap_url, timeout=RSS_TIMEOUT, headers={"User-Agent": REDDIT_USER_AGENT})
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
    except Exception as exc:
        log_fn(f"{name}: sitemap fetch failed: {exc}")
        return []

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=lookback_days)).isoformat()

    candidates: list[tuple[str, str]] = []  # (url, lastmod)
    for url_el in root.findall("sm:url", ns):
        loc = (url_el.findtext("sm:loc", "", ns) or "").strip()
        lastmod = (url_el.findtext("sm:lastmod", "", ns) or "").strip()
        if "/p/" not in loc:
            continue
        if lastmod and lastmod[:10] < cutoff:
            continue
        candidates.append((loc, lastmod))

    candidates = candidates[:limit]
    if not candidates:
        log_fn(f"{name}: no recent posts found in sitemap")
        return []

    entries: list[dict[str, Any]] = []
    for url, lastmod in candidates:
        try:
            page_resp = requests.get(url, timeout=RSS_TIMEOUT, headers={"User-Agent": REDDIT_USER_AGENT})
            page_resp.raise_for_status()
            soup = BeautifulSoup(page_resp.text, "html.parser")

            def _meta(prop: str) -> str:
                tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
                return str(tag.get("content", "")).strip() if tag else ""  # type: ignore[union-attr]

            title = _meta("og:title") or _meta("twitter:title")
            description = _meta("og:description") or _meta("twitter:description")
            pub_date = _meta("article:published_time") or lastmod

            if not title:
                continue

            entries.append(
                make_pool_article(
                    title=title,
                    url=url,
                    source=name,
                    role_hints=role_hints,
                    source_kind=source_kind,
                    snippet=description,
                    published_date=pub_date,
                )
            )
        except Exception as exc:
            log_fn(f"{name}: failed to fetch {url}: {exc}")
            continue

    log_fn(f"{name}: fetched {len(entries)} entries")
    return entries


def _fetch_github_trending(
    *,
    role_hints: list[str],
    source_kind: str,
    log_fn: Callable[[str], None],
) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    try:
        resp = requests.get(
            "https://github.com/trending",
            timeout=RSS_TIMEOUT,
            headers={"User-Agent": REDDIT_USER_AGENT},
        )
        resp.raise_for_status()
    except Exception as exc:
        log_fn(f"GitHub Trending failed: {exc}")
        return articles

    soup = BeautifulSoup(resp.text, "html.parser")
    for row in soup.select("article.Box-row")[:10]:
        text_blob = " ".join(row.get_text(" ", strip=True).split())
        if "Sponsor" in text_blob:
            continue

        repo_link = row.select_one("h2 a[href]")
        if not repo_link:
            continue
        href = str(repo_link.get("href", "")).strip()
        if not href.startswith("/"):
            continue
        repo_name = _clean_title(" ".join(repo_link.get_text(" ", strip=True).split()), source="GitHub Trending", source_kind=source_kind)
        if not repo_name:
            continue

        desc_el = row.select_one("p")
        desc = _strip_html(desc_el.get_text(" ", strip=True) if desc_el else "")

        signal = ""
        for span in row.select("span"):
            span_text = " ".join(span.get_text(" ", strip=True).split())
            if "stars today" in span_text.lower():
                signal = span_text
                break

        articles.append(
            make_pool_article(
                title=repo_name,
                url=f"https://github.com{href}",
                source="GitHub Trending",
                signal=signal,
                role_hints=role_hints,
                source_kind=source_kind,
                snippet=desc,
            )
        )
    log_fn(f"GitHub Trending: fetched {len(articles)} entries")
    return articles


def _fetch_taaft_tools(
    *,
    name: str,
    url: str,
    role_hints: list[str],
    source_kind: str,
    limit: int,
    log_fn: Callable[[str], None],
) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    try:
        response = requests.get(
            url,
            timeout=RSS_TIMEOUT,
            headers={"User-Agent": REDDIT_USER_AGENT},
        )
        response.raise_for_status()
    except Exception as exc:
        log_fn(f"{name} failed: {exc}")
        return articles

    soup = BeautifulSoup(response.text, "html.parser")
    seen_urls: set[str] = set()
    for row in soup.select("li.li[data-url]")[: max(limit, 1)]:
        href = str(row.get("data-url", "")).strip()
        if not href or href in seen_urls:
            continue
        title_link = row.select_one("a.ai_link")
        title = _clean_title(
            title_link.get_text(" ", strip=True) if title_link else "",
            source=name,
            source_kind=source_kind,
        )
        if not title:
            continue

        desc = _strip_html(row.select_one(".short_desc").get_text(" ", strip=True) if row.select_one(".short_desc") else "")
        task = _strip_html(row.select_one(".task_label").get_text(" ", strip=True) if row.select_one(".task_label") else "")
        snippet = desc
        if task:
            snippet = f"{desc} {task}".strip() if desc else task

        image = ""
        screenshot = row.select_one(".screenshot img")
        icon = row.select_one("img.taaft_icon")
        if screenshot and screenshot.get("src"):
            image = str(screenshot.get("src", "")).strip()
        elif icon and icon.get("src"):
            image = str(icon.get("src", "")).strip()

        views = ""
        views_el = row.select_one(".views_count_count")
        if views_el:
            views = _strip_html(views_el.get_text(" ", strip=True))

        articles.append(
            make_pool_article(
                title=title,
                url=href,
                source=name,
                signal=f"{views} views" if views else "",
                role_hints=role_hints,
                source_kind=source_kind,
                snippet=snippet,
                thumbnail=image,
            )
        )
        seen_urls.add(href)

    log_fn(f"{name}: fetched {len(articles)} entries")
    return articles


def _fetch_hn_items(
    api_urls: list[str],
    role_hints: list[str],
    *,
    source_kind: str,
    log_fn: Callable[[str], None],
) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    for api_url in api_urls:
        if not api_url:
            continue
        try:
            resp = requests.get(api_url, timeout=HN_TIMEOUT)
            resp.raise_for_status()
            hits = resp.json().get("hits", [])
        except Exception as exc:
            log_fn(f"HN fetch failed ({api_url[:60]}): {exc}")
            continue

        for hit in hits:
            source = "Show HN" if str(hit.get("title", "")).strip().lower().startswith("show hn") else "Hacker News"
            title = _clean_title(str(hit.get("title", "")).strip(), source=source, source_kind=source_kind)
            if not title:
                continue
            raw_url = str(hit.get("url", "")).strip()
            hn_url = f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            url = raw_url
            if (
                not url
                or "news.ycombinator.com" in url
                or "/vote?" in url
            ):
                url = hn_url
            if source_kind == "build" and url == hn_url:
                continue
            points = hit.get("points") or 0
            comment_text = _strip_html(str(hit.get("story_text", "") or hit.get("comment_text", "")))
            created_at = str(hit.get("created_at", "") or "").strip()
            article = make_pool_article(
                title=title,
                url=url or hn_url,
                source=source,
                signal=f"{points} points",
                role_hints=role_hints,
                source_kind=source_kind,
                snippet=comment_text,
                published_date=created_at,
            )
            # Who posted it (kept with the item; share pages and the feed can show it).
            article["by"] = str(hit.get("author", "") or "").strip()
            articles.append(article)
    log_fn(f"HN: fetched {len(articles)} items")
    return articles


def _fetch_reddit_posts(
    role: str,
    subreddits: list[str],
    *,
    period: str = "day",
    limit: int = 10,
    log_fn: Callable[[str], None],
) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    seen: set[str] = set()
    low_signal_patterns = (
        "how can i improve",
        "how do i improve",
        "what do you think",
        "feedback please",
        "roast my",
        "rate my",
        "my portfolio",
        "my design",
        "can someone explain",
        "beginner question",
        "layoff",
        "laid off",
        "resume",
        "job search",
        "survivor fatigue",
        "salary",
        "compensation",
        "interview",
        "friday share fever",
        "show and tell",
        "i want to quit",
        "no idea what i'm doing",
        "anyone else feeling",
        "dear figma",
        "share your startup",
        "if you're trying to market",
        "dealing with users who",
        "nothing outside of saas/ai",
        "introduce yourself",
    )
    normalized_role = normalize_role(role)

    def _add_article(title: str, link: str, source: str, signal: str = "", snippet: str = "") -> None:
        cleaned_title = _clean_title(title, source=source, source_kind="community")
        lower_title = cleaned_title.lower().strip()
        if (
            not cleaned_title
            or not link
            or link in seen
            or link.startswith("https://i.redd.it/")
            or link.startswith("https://preview.redd.it/")
            or link.startswith("https://v.redd.it/")
            or any(pattern in lower_title for pattern in low_signal_patterns)
        ):
            return
        is_reddit_permalink = link.startswith("https://www.reddit.com/r/")
        if is_reddit_permalink and len(_strip_html(snippet)) < 80:
            return
        if lower_title.endswith("?") and len(_strip_html(snippet)) < 120:
            return
        seen.add(link)
        articles.append(
            make_pool_article(
                title=cleaned_title,
                url=link,
                source=source,
                signal=signal,
                role_hints=[normalized_role],
                source_kind="community",
                snippet=snippet,
            )
        )

    for sub in subreddits:
        try:
            endpoint = "top" if period == "week" else "hot"
            resp = requests.get(
                f"https://www.reddit.com/r/{sub}/{endpoint}.json?limit={limit}&t={period}",
                headers={"User-Agent": REDDIT_USER_AGENT},
                timeout=REDDIT_TIMEOUT,
            )
            resp.raise_for_status()
            posts = resp.json().get("data", {}).get("children", [])
        except Exception as exc:
            log_fn(f"Reddit r/{sub} failed: {exc}")
            try:
                rss_result = fetch_article_links(f"https://www.reddit.com/r/{sub}/.rss", limit=limit)
                rss_links = rss_result.articles if hasattr(rss_result, "articles") else []
            except Exception as rss_exc:
                log_fn(f"Reddit r/{sub} RSS fallback failed: {rss_exc}")
                continue

            for link in rss_links:
                title = str(link.get("title", "")).strip()
                href = str(link.get("url", "")).strip()
                _add_article(title, href, f"r/{sub}")
            continue

        for post in posts:
            data = post.get("data", {})
            title = str(data.get("title", "")).strip()
            url = str(data.get("url", "")).strip()
            permalink = f"https://www.reddit.com{data.get('permalink', '')}"
            ups = data.get("ups", 0)
            selftext = _strip_html(str(data.get("selftext", "") or ""))
            if not title or data.get("stickied"):
                continue
            link = url if url and not url.startswith("https://www.reddit.com/r/") else permalink
            _add_article(title, link, f"r/{sub}", f"{ups} upvotes", selftext)
    log_fn(f"Reddit: fetched {len(articles)} posts from {len(subreddits)} subs")
    return articles


def _fetch_source_entries(
    sources: list[dict[str, Any]],
    *,
    default_role: str | None = None,
    limit: int = RSS_LINK_LIMIT,
    log_fn: Callable[[str], None],
) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    for src in sources:
        name = str(src.get("name", "")).strip()
        url = str(src.get("url", "")).strip()
        if not name or not url:
            continue
        source_kind = str(src.get("source_kind", "editorial")).strip().lower() or "editorial"
        role_hints = [
            normalize_role(role)
            for role in (src.get("role_hints") or ([default_role] if default_role else []))
            if normalize_role(role) in {"developer", "designer", "pm", "marketer", "founder"}
        ]
        source_type = str(src.get("type", "")).strip().lower()

        entries: list[dict[str, Any]] = []
        if source_type == "github_trending":
            articles.extend(
                _fetch_github_trending(
                    role_hints=role_hints,
                    source_kind=source_kind,
                    log_fn=log_fn,
                )
            )
            continue
        if source_type == "taaft_tools":
            articles.extend(
                _fetch_taaft_tools(
                    name=name,
                    url=url,
                    role_hints=role_hints,
                    source_kind=source_kind,
                    limit=limit,
                    log_fn=log_fn,
                )
            )
            continue
        if source_type == "tldr_digest":
            articles.extend(
                _fetch_tldr_digest(
                    name=name,
                    url_template=url,
                    source_kind=source_kind,
                    role_hints=role_hints,
                    log_fn=log_fn,
                )
            )
            continue
        if source_type == "rundown_ai":
            articles.extend(
                _fetch_rundown_ai(
                    name=name,
                    source_kind=source_kind,
                    role_hints=role_hints,
                    log_fn=log_fn,
                )
            )
            continue
        if source_type in {"rss", "atom", "xml"} or url.endswith(".xml") or "/feed" in url:
            try:
                response = requests.get(url, timeout=RSS_TIMEOUT, headers={"User-Agent": REDDIT_USER_AGENT})
                response.raise_for_status()
                parsed = feedparser.parse(response.text)
                for entry in parsed.entries[:limit]:
                    entries.append({
                        "title": str(entry.get("title", "")).strip(),
                        "url": str(entry.get("link", "")).strip(),
                        "summary": _feed_entry_summary(entry),
                        "image": _extract_entry_image(entry, source=name),
                        "published_date": str(entry.get("published", "") or entry.get("updated", "")).strip(),
                    })
            except Exception as exc:
                log_fn(f"Feed {name} failed: {exc}")
        if not entries:
            try:
                result = fetch_article_links(url, limit=limit)
                links = result.articles if hasattr(result, "articles") else []
                for entry in links:
                    entries.append({
                        "title": str(entry.get("title", "")).strip(),
                        "url": str(entry.get("url", "")).strip(),
                        "summary": "",
                        "image": str(entry.get("og_image", "")).strip(),
                        "published_date": str(entry.get("published_date", "")).strip(),
                    })
            except Exception as exc:
                log_fn(f"Source {name} failed: {exc}")
                continue

        added = 0
        for entry in entries:
            title = _clean_title(str(entry.get("title", "")).strip(), source=name, source_kind=source_kind)
            href = str(entry.get("url", "")).strip()
            if not title or not href:
                continue
            articles.append(
                make_pool_article(
                    title=title,
                    url=href,
                    source=name,
                    role_hints=role_hints,
                    source_kind=source_kind,
                    snippet=str(entry.get("summary", "")).strip(),
                    thumbnail=str(entry.get("image", "")).strip(),
                    published_date=str(entry.get("published_date", "")).strip(),
                )
            )
            added += 1
        log_fn(f"{name}: fetched {added} entries")
    return articles


def _dedupe_articles(articles: list[dict[str, Any]], *, lane: str, log_fn: Callable[[str], None]) -> list[dict[str, Any]]:
    deduped_by_url: dict[str, dict[str, Any]] = {}
    for article in articles:
        url = str(article.get("url", "")).strip()
        if not url:
            continue
        existing = deduped_by_url.get(url)
        if not existing:
            deduped_by_url[url] = dict(article)
            continue

        existing_hints = set(existing.get("role_hints", []) or [])
        existing_hints.update(article.get("role_hints", []) or [])
        existing["role_hints"] = sorted(existing_hints)

        if signal_score(article) > signal_score(existing):
            existing["signal"] = article.get("signal", existing.get("signal", ""))
        if _source_kind_rank(article.get("source_kind", "")) < _source_kind_rank(existing.get("source_kind", "")):
            existing["source_kind"] = article.get("source_kind", existing.get("source_kind", ""))
        if len(str(article.get("snippet", "")).strip()) > len(str(existing.get("snippet", "")).strip()):
            existing["snippet"] = article.get("snippet", existing.get("snippet", ""))
        if len(str(article.get("title", "")).strip()) > len(str(existing.get("title", "")).strip()):
            existing["title"] = article.get("title", existing.get("title", ""))

    deduped = list(deduped_by_url.values())
    preferred_kind = "build" if lane == "build" else "community"
    deduped.sort(
        key=lambda article: (
            0 if article.get("source_kind") == preferred_kind else 1,
            -len(article.get("role_hints", []) or []),
            -signal_score(article),
        )
    )
    log_fn(f"{lane} pool ready: {len(deduped)} unique items")
    return deduped


def fetch_community_pool(
    *,
    roles: list[str] | None = None,
    weekly: bool = False,
    log_fn: Callable[[str], None] | None = None,
) -> list[dict[str, Any]]:
    log = log_fn or _noop
    brief_cfg = _load_brief_sources()
    all_roles = {
        normalize_role(role)
        for role in (roles or list(set(list(brief_cfg.get("reddit", {}).keys()) + list(brief_cfg.get("rss", {}).keys()))))
    }

    articles: list[dict[str, Any]] = []
    frontpage_url = str(brief_cfg.get("hn", {}).get("frontpage_url", "")).strip()
    hn_roles = [
        normalize_role(role)
        for role in (brief_cfg.get("hn", {}).get("roles", []) or [])
        if not all_roles or normalize_role(role) in all_roles
    ]
    if frontpage_url:
        articles.extend(
            _fetch_hn_items(
                [frontpage_url],
                hn_roles,
                source_kind="community",
                log_fn=log,
            )
        )

    reddit_period = "week" if weekly else "day"
    entry_limit = RSS_LINK_LIMIT_WEEKLY if weekly else RSS_LINK_LIMIT

    for role, subreddit_list in brief_cfg.get("reddit", {}).items():
        normalized_role = normalize_role(role)
        if all_roles and normalized_role not in all_roles:
            continue
        articles.extend(
            _fetch_reddit_posts(
                normalized_role,
                list(subreddit_list or []),
                period=reddit_period,
                limit=entry_limit,
                log_fn=log,
            )
        )

    for role, sources in brief_cfg.get("rss", {}).items():
        normalized_role = normalize_role(role)
        if all_roles and normalized_role not in all_roles:
            continue
        articles.extend(
            _fetch_source_entries(
                list(sources or []),
                default_role=normalized_role,
                limit=entry_limit,
                log_fn=log,
            )
        )

    return _dedupe_articles(articles, lane="community", log_fn=log)


def top_article_feed_caps() -> dict[str, int]:
    """Per-source caps for the curated Top articles feeds (lowercased name -> cap, default 2)."""
    feeds = (_load_brief_sources().get("top_articles", {}) or {}).get("feeds") or []
    return {
        str(feed.get("name", "")).strip().lower(): int(feed.get("cap", 2))
        for feed in feeds
        if isinstance(feed, dict) and str(feed.get("name", "")).strip()
    }


def fetch_top_articles_extra(
    *,
    log_fn: Callable[[str], None] | None = None,
) -> list[dict[str, Any]]:
    """Candidates for Top articles beyond the community pool: Hacker News's best stories of
    the last couple of days, and the curated link feeds in brief_sources.json top_articles."""
    log = log_fn or _noop
    cfg = _load_brief_sources().get("top_articles", {}) or {}
    articles: list[dict[str, Any]] = []
    best = cfg.get("hn_best") or {}
    if best:
        since = int(time.time()) - int(best.get("hours", 48)) * 3600
        url = (
            "https://hn.algolia.com/api/v1/search?tags=story"
            f"&numericFilters=created_at_i>{since},points>{int(best.get('min_points', 200))}"
            f"&hitsPerPage={int(best.get('hits', 50))}"
        )
        articles.extend(_fetch_hn_items([url], ["developer"], source_kind="community", log_fn=log))
    feeds = [feed for feed in (cfg.get("feeds") or []) if isinstance(feed, dict)]
    if feeds:
        articles.extend(_fetch_source_entries(feeds, limit=int(cfg.get("feed_limit", 10)), log_fn=log))
    return articles


# Product Hunt topic → role mapping
_PH_TOPIC_ROLES: dict[str, str] = {
    "Developer Tools": "developer",
    "Open Source": "developer",
    "API": "developer",
    "Development": "developer",
    "DevOps": "developer",
    "Infrastructure": "developer",
    "Database": "developer",
    "Security": "developer",
    "GitHub": "developer",
    "Programming": "developer",
    "Design Tools": "designer",
    "Design": "designer",
    "Prototyping": "designer",
    "UX": "designer",
    "UI": "designer",
    "Branding": "designer",
    "Graphic Design": "designer",
    "Motion": "designer",
    "Typography": "designer",
    "Product Management": "pm",
    "No-Code": "pm",
    "Analytics": "pm",
    "Project Management": "pm",
    "Customer Communication": "pm",
    "Marketing": "marketer",
    "SEO": "marketer",
    "Social Media": "marketer",
    "Advertising": "marketer",
    "Content Marketing": "marketer",
    "Email": "marketer",
    "Growth Hacking": "marketer",
    "CRM": "marketer",
    "Sales": "marketer",
    "SaaS": "founder",
    "Startups": "founder",
    "YC Application": "founder",
    "E-Commerce": "founder",
    "Fundraising": "founder",
    "Finance": "founder",
}

# Topics that match multiple roles — assigned to both
_PH_TOPIC_MULTI: dict[str, list[str]] = {
    "Productivity": ["pm", "founder"],
    "Artificial Intelligence": ["developer", "founder"],
}

_ph_token_cache: dict[str, Any] = {}


def _get_ph_token(log_fn: Callable[[str], None]) -> str:
    """Get a cached or fresh Product Hunt OAuth token."""
    now = datetime.now(timezone.utc).timestamp()
    cached = _ph_token_cache.get("token")
    expires_at = _ph_token_cache.get("expires_at", 0)
    if cached and now < expires_at - 60:
        return cached

    api_key = os.getenv("PRODUCT_HUNT_API_KEY", "").strip()
    api_secret = os.getenv("PRODUCT_HUNT_API_SECRET", "").strip()
    if not api_key or not api_secret:
        log_fn("Product Hunt: PRODUCT_HUNT_API_KEY or PRODUCT_HUNT_API_SECRET not set")
        return ""

    try:
        resp = requests.post(
            "https://api.producthunt.com/v2/oauth/token",
            json={"client_id": api_key, "client_secret": api_secret, "grant_type": "client_credentials"},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("access_token", "")
        _ph_token_cache["token"] = token
        _ph_token_cache["expires_at"] = now + 3600
        return token
    except Exception as exc:
        log_fn(f"Product Hunt token fetch failed: {exc}")
        return ""


def _fetch_producthunt(
    *,
    roles: set[str] | None = None,
    weekly: bool = False,
    log_fn: Callable[[str], None],
) -> list[dict[str, Any]]:
    """Fetch top Product Hunt posts, filtered and tagged by role."""
    token = _get_ph_token(log_fn)
    if not token:
        return []

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Build two queries: today's top + past week's top (deduped after)
    queries = []
    queries.append(("today", 30, ""))
    if weekly:
        since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        queries.append(("week", 50, since))

    all_edges: list[dict[str, Any]] = []
    for label, limit, since_ts in queries:
        date_arg = f', postedAfter: "{since_ts}"' if since_ts else ""
        query = (
            "{ posts(first: " + str(limit) + ", order: VOTES" + date_arg + ") {"
            " edges { node { name tagline url votesCount commentsCount createdAt"
            " thumbnail { url } topics { edges { node { name slug } } } } } } }"
        )
        try:
            resp = requests.post(
                "https://api.producthunt.com/v2/api/graphql",
                json={"query": query},
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            edges = resp.json().get("data", {}).get("posts", {}).get("edges", [])
            log_fn(f"Product Hunt ({label}): {len(edges)} raw posts")
            all_edges.extend(edges)
        except Exception as exc:
            log_fn(f"Product Hunt ({label}) fetch failed: {exc}")

    seen_urls: set[str] = set()
    articles: list[dict[str, Any]] = []
    for edge in all_edges:
        p = edge.get("node", {})
        name = str(p.get("name", "")).strip()
        tagline = str(p.get("tagline", "")).strip()
        url = str(p.get("url", "")).strip()
        votes = int(p.get("votesCount") or 0)
        comments = int(p.get("commentsCount") or 0)
        thumbnail = str((p.get("thumbnail") or {}).get("url", "")).strip()
        post_topics = [t["node"]["name"] for t in p.get("topics", {}).get("edges", [])]

        if not name or not url or votes < 50 or url in seen_urls:
            continue
        seen_urls.add(url)

        # Determine role hints from topics
        role_hints: set[str] = set()
        for topic in post_topics:
            if topic in _PH_TOPIC_ROLES:
                role_hints.add(_PH_TOPIC_ROLES[topic])
            if topic in _PH_TOPIC_MULTI:
                role_hints.update(_PH_TOPIC_MULTI[topic])

        # Skip if no role match and we're filtering by role
        if roles and not role_hints & roles:
            continue
        # Skip completely unclassifiable posts only if we have a role filter
        if not role_hints:
            if roles:
                continue
            role_hints = {"developer", "founder"}  # default fallback

        if roles:
            role_hints &= roles

        articles.append(
            make_pool_article(
                title=f"{name} — {tagline}" if tagline else name,
                url=url,
                source="Product Hunt",
                signal=f"{votes} upvotes",
                role_hints=sorted(role_hints),
                source_kind="build",
                snippet=tagline,
                thumbnail=thumbnail,
            )
        )

    log_fn(f"Product Hunt: fetched {len(articles)} posts (weekly={weekly})")
    return articles


def fetch_build_pool(
    *,
    roles: list[str] | None = None,
    weekly: bool = False,
    log_fn: Callable[[str], None] | None = None,
) -> list[dict[str, Any]]:
    log = log_fn or _noop
    cfg = _load_pulse_sources().get("build", {})
    all_roles = {normalize_role(role) for role in (roles or []) if normalize_role(role) in ROLE_ORDER}
    entry_limit = RSS_LINK_LIMIT_WEEKLY if weekly else RSS_LINK_LIMIT

    articles: list[dict[str, Any]] = []
    show_hn_url = str(cfg.get("hn", {}).get("show_hn_url", "")).strip()
    hn_roles = [
        normalize_role(role)
        for role in (cfg.get("hn", {}).get("roles", []) or [])
        if not all_roles or normalize_role(role) in all_roles
    ]
    if show_hn_url:
        articles.extend(
            _fetch_hn_items(
                [show_hn_url],
                hn_roles,
                source_kind="build",
                log_fn=log,
            )
        )

    articles.extend(
        _fetch_source_entries(
            list(cfg.get("feeds", []) or []),
            default_role=None,
            limit=entry_limit,
            log_fn=log,
        )
    )

    articles.extend(
        _fetch_producthunt(
            roles=all_roles or None,
            weekly=weekly,
            log_fn=log,
        )
    )

    return _dedupe_articles(articles, lane="build", log_fn=log)


def fetch_pulse_pool(
    lane: str,
    *,
    roles: list[str] | None = None,
    weekly: bool = False,
    log_fn: Callable[[str], None] | None = None,
) -> list[dict[str, Any]]:
    normalized_lane = str(lane or "").strip().lower()
    if normalized_lane == "community":
        return fetch_community_pool(roles=roles, weekly=weekly, log_fn=log_fn)
    if normalized_lane == "build":
        return fetch_build_pool(roles=roles, weekly=weekly, log_fn=log_fn)
    raise ValueError(f"Unsupported pulse lane: {lane}")
