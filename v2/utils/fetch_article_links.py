#!/usr/bin/env python3
"""
Fetch article links from a source URL without Exa.

Supports:
- RSS/Atom feeds
- XML sitemaps (urlset + sitemapindex)
- HTML pages (extract article-like links)

Also returns best-effort metadata:
- published_date
- og_image

Usage:
  python3 v2/utils/fetch_article_links.py --url "https://venturebeat.com/feed"
  python3 v2/utils/fetch_article_links.py \
    --url "https://example.com/news" --limit 30
  python3 v2/utils/fetch_article_links.py \
    --url "https://example.com/feed" --json
  python3 v2/utils/fetch_article_links.py \
    --url "https://example.com/news" --enrich-metadata --json
"""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

USER_AGENT = "TraceLinkFetcher/1.0 (+https://trace.app)"
REQUEST_TIMEOUT_SECONDS = 20
METADATA_TIMEOUT_SECONDS = 12
DEFAULT_LIMIT = 50
MAX_HTML_PAGES = 5

_RSS_HINTS = ("<rss", "<channel", "<item")
_ATOM_HINTS = ("<feed", "<entry")
_SITEMAP_HINTS = ("<urlset", "<sitemapindex")

_NON_ARTICLE_PATH_HINTS = (
    "/tag/",
    "/tags/",
    "/category/",
    "/categories/",
    "/author/",
    "/authors/",
    "/search",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/login",
    "/signup",
    "/subscribe",
    "/feed",
    "/rss",
    "/wp-json/",
)

_NON_ARTICLE_EXACT_PATHS = {
    "",
    "/",
    "/news",
    "/blog",
    "/blogs",
    "/articles",
    "/posts",
    "/latest",
    "/stories",
}

_LIKELY_ARTICLE_PATTERNS = (
    r"/\d{4}/\d{2}/\d{2}/",
    r"/\d{4}/\d{2}/",
    r"/[a-z0-9-]{20,}",
)


@dataclass
class ExtractResult:
    source_url: str
    source_type: str
    articles: list[dict[str, str]]


def _normalize_url(raw_url: str, base_url: str) -> str:
    absolute = urljoin(base_url, (raw_url or "").strip())
    parsed = urlparse(absolute)
    if not parsed.scheme or not parsed.netloc:
        return ""
    cleaned = parsed._replace(query="", fragment="")
    path = cleaned.path or ""
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    cleaned = cleaned._replace(path=path)
    return urlunparse(cleaned)


def _to_iso_datetime(raw_value: str) -> str:
    value = (raw_value or "").strip()
    if not value:
        return ""
    try:
        dt = parsedate_to_datetime(value)
        if dt is not None:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def _is_likely_article(
    url: str,
    base_host: str,
    include_external: bool,
) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.netloc.lower()
    if not include_external and host != base_host:
        return False
    path = (parsed.path or "").lower()
    if re.search(r"/page/\d+/?$", path):
        return False
    if path in _NON_ARTICLE_EXACT_PATHS:
        return False
    if any(h in path for h in _NON_ARTICLE_PATH_HINTS):
        return False
    if re.search(r"\.(xml|json|jpg|jpeg|png|gif|svg|pdf|mp3|mp4)$", path):
        return False
    if any(re.search(pattern, path) for pattern in _LIKELY_ARTICLE_PATTERNS):
        return True
    segments = [s for s in path.split("/") if s]
    return len(segments) >= 2


def _dedupe_articles_keep_order(
    items: Iterable[dict[str, str]],
) -> list[dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    order: list[str] = []
    for item in items:
        url = item.get("url", "")
        if not url:
            continue
        if url not in merged:
            merged[url] = {
                "url": url,
                "title": item.get("title", ""),
                "description": item.get("description", ""),
                "published_date": item.get("published_date", ""),
                "og_image": item.get("og_image", ""),
            }
            order.append(url)
            continue
        existing = merged[url]
        for field in ("title", "description", "published_date", "og_image"):
            if not existing.get(field) and item.get(field):
                existing[field] = item[field]
    return [merged[url] for url in order]


def _first_text(node: ET.Element, paths: list[str]) -> str:
    for path in paths:
        found = node.find(path)
        if found is not None:
            text = " ".join(found.itertext()).strip()
            if text:
                return text
    return ""


def _clean_rss_description(raw: str) -> str:
    if not raw:
        return ""
    text = BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def _extract_image_from_xml_node(node: ET.Element, base_url: str) -> str:
    for child in node.iter():
        tag = (child.tag or "").lower()
        if not (
            tag.endswith("enclosure")
            or tag.endswith("thumbnail")
            or tag.endswith("content")
            or tag.endswith("image")
        ):
            continue
        url = (
            child.attrib.get("url")
            or child.attrib.get("href")
            or child.attrib.get("src")
            or ""
        )
        image_type = (child.attrib.get("type") or "").lower()
        if not url or (image_type and "image" not in image_type):
            continue
        normalized = _normalize_url(url, base_url)
        if normalized:
            return normalized
    return ""


def _extract_from_rss_or_atom(
    xml_text: str,
    base_url: str,
) -> list[dict[str, str]]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    articles: list[dict[str, str]] = []

    for item in root.findall(".//item"):
        link_node = item.find("link")
        if link_node is None or not link_node.text:
            continue
        normalized = _normalize_url(link_node.text, base_url)
        if not normalized:
            continue
        title = _first_text(item, ["title", "{*}title"])
        description = _clean_rss_description(
            _first_text(item, ["description", "{*}description", "{*}summary", "{*}encoded"])
        )
        published = _first_text(
            item,
            ["pubDate", "{*}published", "{*}updated", "{*}date"],
        )
        articles.append(
            {
                "url": normalized,
                "title": title,
                "description": description,
                "published_date": _to_iso_datetime(published),
                "og_image": _extract_image_from_xml_node(item, base_url),
            }
        )

    for entry in root.findall(".//{*}entry"):
        for link_node in entry.findall("{*}link"):
            href = link_node.attrib.get("href")
            rel = (link_node.attrib.get("rel") or "").lower()
            if not href or (rel and rel != "alternate"):
                continue
            normalized = _normalize_url(href, base_url)
            if not normalized:
                continue
            title = _first_text(entry, ["{*}title", "title"])
            description = _clean_rss_description(
                _first_text(entry, ["{*}summary", "{*}description", "{*}content"])
            )
            published = _first_text(entry, ["{*}published", "{*}updated"])
            articles.append(
                {
                    "url": normalized,
                    "title": title,
                    "description": description,
                    "published_date": _to_iso_datetime(published),
                    "og_image": _extract_image_from_xml_node(entry, base_url),
                }
            )

    if not articles:
        for link_node in root.findall(".//link"):
            if not link_node.text:
                continue
            normalized = _normalize_url(link_node.text, base_url)
            if normalized:
                articles.append(
                    {
                        "url": normalized,
                        "title": "",
                        "description": "",
                        "published_date": "",
                        "og_image": "",
                    }
                )
    return _dedupe_articles_keep_order(articles)


def _extract_from_sitemap(
    xml_text: str,
    base_url: str,
) -> list[dict[str, str]]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    articles: list[dict[str, str]] = []
    for url_node in root.findall(".//{*}url"):
        loc_node = url_node.find("{*}loc")
        if loc_node is None or not loc_node.text:
            continue
        normalized = _normalize_url(loc_node.text, base_url)
        if not normalized:
            continue
        lastmod_node = url_node.find("{*}lastmod")
        lastmod = (
            _to_iso_datetime(lastmod_node.text)
            if lastmod_node is not None and lastmod_node.text
            else ""
        )
        articles.append(
            {
                "url": normalized,
                "title": "",
                "description": "",
                "published_date": lastmod,
                "og_image": "",
            }
        )

    if not articles:
        for loc_node in root.findall(".//{*}sitemap/{*}loc"):
            if not loc_node.text:
                continue
            normalized = _normalize_url(loc_node.text, base_url)
            if normalized:
                articles.append(
                    {
                        "url": normalized,
                        "title": "",
                        "published_date": "",
                        "og_image": "",
                    }
                )
    return _dedupe_articles_keep_order(articles)


def _extract_from_html(
    html_text: str,
    base_url: str,
) -> list[dict[str, str]]:
    soup = BeautifulSoup(html_text, "html.parser")
    articles: list[dict[str, str]] = []

    for article in soup.find_all("article"):
        for anchor in article.find_all("a", href=True):
            normalized = _normalize_url(anchor["href"], base_url)
            if not normalized:
                continue
            articles.append(
                {
                    "url": normalized,
                    "title": anchor.get_text(" ", strip=True),
                    "published_date": "",
                    "og_image": "",
                }
            )

    if not articles:
        selectors = [
            "main a[href]",
            "[role='main'] a[href]",
            ".post a[href]",
            ".entry a[href]",
            ".article a[href]",
            ".story a[href]",
            "a[href]",
        ]
        for selector in selectors:
            for anchor in soup.select(selector):
                normalized = _normalize_url(anchor.get("href", ""), base_url)
                if not normalized:
                    continue
                articles.append(
                    {
                        "url": normalized,
                        "title": anchor.get_text(" ", strip=True),
                        "published_date": "",
                        "og_image": "",
                    }
                )
            if articles:
                break

    return _dedupe_articles_keep_order(articles)


def _find_next_html_page(
    html_text: str,
    current_url: str,
) -> str:
    soup = BeautifulSoup(html_text, "html.parser")
    parsed_current = urlparse(current_url)
    current_host = parsed_current.netloc.lower()

    candidates = []

    rel_next = soup.select("a[rel~='next'][href], link[rel~='next'][href]")
    candidates.extend(rel_next)

    labeled = soup.select(
        "a[aria-label*='next' i][href], "
        "a[title*='next' i][href], "
        "a[class*='next' i][href], "
        "a[href]"
    )
    candidates.extend(labeled)

    text_hints = {"next", "older", "more", "more stories", "next page"}
    for anchor in soup.find_all("a", href=True):
        text = anchor.get_text(" ", strip=True).lower()
        if text in text_hints:
            candidates.append(anchor)

    seen_urls: set[str] = set()
    for node in candidates:
        href = node.get("href", "")
        normalized = _normalize_url(href, current_url)
        if not normalized or normalized in seen_urls:
            continue
        seen_urls.add(normalized)
        parsed = urlparse(normalized)
        if parsed.netloc.lower() != current_host:
            continue
        if normalized == current_url:
            continue
        path = (parsed.path or "").lower()
        if (
            "/page/" in path
            or "page=" in href.lower()
            or "p=" in href.lower()
        ):
            return normalized
    return ""


def _extract_og_from_soup(soup: BeautifulSoup, base_url: str) -> str:
    candidates = [
        soup.find("meta", attrs={"property": "og:image"}),
        soup.find("meta", attrs={"name": "og:image"}),
        soup.find("meta", attrs={"name": "twitter:image"}),
    ]
    for node in candidates:
        if not node:
            continue
        content = (node.get("content") or "").strip()
        if not content:
            continue
        normalized = _normalize_url(content, base_url)
        if normalized:
            return normalized
    return ""


def _extract_published_from_soup(soup: BeautifulSoup) -> str:
    meta_candidates = [
        ("meta", {"property": "article:published_time"}),
        ("meta", {"property": "og:published_time"}),
        ("meta", {"name": "pubdate"}),
        ("meta", {"name": "publish_date"}),
        ("meta", {"name": "date"}),
        ("meta", {"itemprop": "datePublished"}),
    ]
    for tag_name, attrs in meta_candidates:
        node = soup.find(tag_name, attrs=attrs)
        if not node:
            continue
        value = (node.get("content") or node.get("datetime") or "").strip()
        parsed = _to_iso_datetime(value)
        if parsed:
            return parsed
    time_node = soup.find("time")
    if time_node:
        value = time_node.get("datetime") or time_node.get_text(" ", strip=True)
        parsed = _to_iso_datetime(value or "")
        if parsed:
            return parsed
    return ""


def _enrich_article_metadata(article: dict[str, str]) -> dict[str, str]:
    url = article.get("url", "")
    if not url:
        return article
    try:
        response = requests.get(
            url,
            timeout=METADATA_TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
    except Exception:
        return article
    soup = BeautifulSoup(response.text or "", "html.parser")
    enriched = dict(article)
    if not enriched.get("published_date"):
        enriched["published_date"] = _extract_published_from_soup(soup)
    if not enriched.get("og_image"):
        enriched["og_image"] = _extract_og_from_soup(soup, url)
    if not enriched.get("title"):
        title_node = soup.find("meta", attrs={"property": "og:title"})
        og_title = (title_node.get("content") or "").strip() if title_node else ""
        html_title = soup.title.get_text(strip=True) if soup.title else ""
        enriched["title"] = og_title or html_title
    return enriched


def _detect_source_type(text: str, content_type: str) -> str:
    lower_text = (text or "").lstrip().lower()[:2000]
    content_type = (content_type or "").lower()
    if "rss+xml" in content_type or any(h in lower_text for h in _RSS_HINTS):
        return "rss"
    if "atom+xml" in content_type or any(h in lower_text for h in _ATOM_HINTS):
        return "atom"
    if "xml" in content_type or any(h in lower_text for h in _SITEMAP_HINTS):
        return "sitemap"
    return "html"


def fetch_article_links(
    source_url: str,
    limit: int = DEFAULT_LIMIT,
    include_external: bool = False,
    enrich_metadata: bool = False,
) -> ExtractResult:
    response = requests.get(
        source_url,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()
    response_text = response.text or ""
    source_type = _detect_source_type(
        response_text,
        response.headers.get("content-type", ""),
    )

    if source_type in ("rss", "atom"):
        candidates = _extract_from_rss_or_atom(response_text, source_url)
    elif source_type == "sitemap":
        candidates = _extract_from_sitemap(response_text, source_url)
    else:
        candidates = _extract_from_html(response_text, source_url)
        if len(candidates) < limit:
            next_url = _find_next_html_page(response_text, source_url)
            seen_pages = {source_url}
            pages_visited = 1
            while next_url and next_url not in seen_pages and pages_visited < MAX_HTML_PAGES:
                seen_pages.add(next_url)
                try:
                    next_response = requests.get(
                        next_url,
                        timeout=REQUEST_TIMEOUT_SECONDS,
                        headers={"User-Agent": USER_AGENT},
                    )
                    next_response.raise_for_status()
                except Exception:
                    break
                next_text = next_response.text or ""
                candidates.extend(_extract_from_html(next_text, next_url))
                if len(candidates) >= limit:
                    break
                next_url = _find_next_html_page(next_text, next_url)
                pages_visited += 1

        candidates = _dedupe_articles_keep_order(candidates)

    base_host = urlparse(source_url).netloc.lower()
    if source_type in ("rss", "atom"):
        filtered = [a for a in candidates if a.get("url")][:max(0, limit)]
    else:
        filtered = [
            article
            for article in candidates
            if _is_likely_article(
                article.get("url", ""),
                base_host=base_host,
                include_external=include_external,
            )
        ][: max(0, limit)]

    if enrich_metadata:
        filtered = [_enrich_article_metadata(article) for article in filtered]

    return ExtractResult(
        source_url=source_url,
        source_type=source_type,
        articles=filtered,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch article links from RSS/HTML/sitemap sources."
    )
    parser.add_argument(
        "--url",
        required=True,
        action="append",
        help="Source URL to parse. Repeat --url for multiple sources.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Max links per source (default: {DEFAULT_LIMIT}).",
    )
    parser.add_argument(
        "--include-external",
        action="store_true",
        help="Include external-domain links (default: same-domain only).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON instead of plain text.",
    )
    parser.add_argument(
        "--enrich-metadata",
        action="store_true",
        help=(
            "Fetch each article page to enrich missing published_date/og_image."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    results: list[ExtractResult] = []

    for source_url in args.url:
        try:
            result = fetch_article_links(
                source_url=source_url,
                limit=args.limit,
                include_external=args.include_external,
                enrich_metadata=args.enrich_metadata,
            )
            results.append(result)
        except Exception as exc:
            if args.json:
                print(
                    json.dumps(
                        {
                            "source_url": source_url,
                            "error": str(exc),
                            "source_type": "unknown",
                            "count": 0,
                            "articles": [],
                            "links": [],
                        }
                    )
                )
            else:
                print(f"\nSource: {source_url}\nError: {exc}\n")

    if args.json:
        payload = [
            {
                "source_url": r.source_url,
                "source_type": r.source_type,
                "count": len(r.articles),
                "articles": r.articles,
                "links": [a.get("url", "") for a in r.articles],
            }
            for r in results
        ]
        print(json.dumps(payload, indent=2))
        return

    for r in results:
        print(f"\nSource: {r.source_url}")
        print(f"Detected: {r.source_type}")
        print(f"Article links: {len(r.articles)}")
        for idx, article in enumerate(r.articles, start=1):
            link = article.get("url", "")
            published = article.get("published_date", "")
            og_image = article.get("og_image", "")
            print(f"{idx:02d}. {link}")
            if published:
                print(f"    published_date: {published}")
            if og_image:
                print(f"    og_image: {og_image}")


if __name__ == "__main__":
    main()
