#!/usr/bin/env python3
"""
Test all realistic launch/product sources.
Shows what's fetchable, signal quality, and role relevance.

Usage:
  python3 -m v3.test_launch_sources
  python3 -m v3.test_launch_sources --source producthunt
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import requests
from bs4 import BeautifulSoup

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

UA = "Mozilla/5.0 (compatible; TracePulse/1.0)"
TIMEOUT = 15


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def _log(msg: str) -> None:
    print(f"[{_ts()}] {msg}")


def _strip(text: str) -> str:
    return re.sub(r"\s+", " ", BeautifulSoup(str(text or ""), "html.parser").get_text(" ")).strip()


# ── 1. Product Hunt RSS ────────────────────────────────────────────────────────

def fetch_producthunt_rss() -> list[dict]:
    _log("Product Hunt RSS...")
    url = "https://www.producthunt.com/feed"
    try:
        r = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        feed = feedparser.parse(r.text)
        items = []
        for e in feed.entries[:15]:
            items.append({
                "title": e.get("title", ""),
                "url": e.get("link", ""),
                "summary": _strip(e.get("summary", ""))[:200],
                "published": e.get("published", ""),
                "signal": "",  # RSS has no upvote count
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 2. Product Hunt scrape (top of day) ───────────────────────────────────────

def fetch_producthunt_scrape() -> list[dict]:
    _log("Product Hunt scrape (today's top)...")
    try:
        r = requests.get("https://www.producthunt.com", timeout=TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        items = []

        # PH renders server-side data in a __NEXT_DATA__ script tag
        script = soup.find("script", {"id": "__NEXT_DATA__"})
        if script:
            data = json.loads(script.string or "{}")
            # Try to find posts in the page props
            posts = []
            def _find_posts(obj, depth=0):
                if depth > 8 or not isinstance(obj, (dict, list)):
                    return
                if isinstance(obj, list):
                    for item in obj[:20]:
                        _find_posts(item, depth + 1)
                elif isinstance(obj, dict):
                    # Look for post-like objects with votesCount
                    if obj.get("votesCount") and obj.get("name") and obj.get("tagline"):
                        posts.append(obj)
                    for v in obj.values():
                        _find_posts(v, depth + 1)
            _find_posts(data)

            seen = set()
            for p in sorted(posts, key=lambda x: x.get("votesCount", 0), reverse=True)[:15]:
                name = p.get("name", "")
                slug = p.get("slug", "")
                if not name or name in seen:
                    continue
                seen.add(name)
                items.append({
                    "title": name,
                    "url": f"https://www.producthunt.com/posts/{slug}" if slug else "",
                    "summary": p.get("tagline", ""),
                    "signal": f"{p.get('votesCount', 0)} upvotes",
                    "topics": [t.get("name", "") for t in (p.get("topics") or [])[:3]],
                    "thumbnail": (p.get("thumbnail") or {}).get("url", "") if isinstance(p.get("thumbnail"), dict) else "",
                })

        if items:
            return items

        # Fallback: look for data-test or structured markup
        _log("  __NEXT_DATA__ parse failed, trying DOM fallback...")
        for tag in soup.select("[data-test='post-item']")[:10]:
            title_el = tag.select_one("h3, h2, [data-test='post-name']")
            link_el = tag.select_one("a[href*='/posts/']")
            upvotes_el = tag.select_one("[data-test*='vote'], button[aria-label*='upvote']")
            title = _strip(title_el.get_text() if title_el else "")
            url = "https://www.producthunt.com" + link_el["href"] if link_el else ""
            signal = _strip(upvotes_el.get_text() if upvotes_el else "")
            if title:
                items.append({"title": title, "url": url, "summary": "", "signal": signal, "topics": []})
        return items

    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 3. Show HN (Algolia) ──────────────────────────────────────────────────────

def fetch_show_hn() -> list[dict]:
    _log("Show HN (Algolia)...")
    try:
        r = requests.get(
            "https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=20&numericFilters=points>50",
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        hits = r.json().get("hits", [])
        items = []
        for h in hits:
            title = re.sub(r"^show hn\s*:\s*", "", h.get("title", ""), flags=re.I).strip()
            url = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID', '')}"
            items.append({
                "title": title,
                "url": url,
                "summary": _strip(h.get("story_text", ""))[:200],
                "signal": f"{h.get('points', 0)} points, {h.get('num_comments', 0)} comments",
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 4. GitHub Trending ────────────────────────────────────────────────────────

def fetch_github_trending() -> list[dict]:
    _log("GitHub Trending...")
    try:
        r = requests.get("https://github.com/trending", timeout=TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        items = []
        for row in soup.select("article.Box-row")[:15]:
            link = row.select_one("h2 a[href]")
            if not link:
                continue
            repo = re.sub(r"\s+", "", link.get_text()).strip().lstrip("/")
            url = f"https://github.com{link['href']}"
            desc = _strip(row.select_one("p").get_text() if row.select_one("p") else "")
            stars_today = ""
            for span in row.select("span"):
                t = span.get_text(" ", strip=True)
                if "stars today" in t.lower():
                    stars_today = t
                    break
            lang_el = row.select_one("[itemprop='programmingLanguage']")
            lang = lang_el.get_text(strip=True) if lang_el else ""
            items.append({
                "title": repo,
                "url": url,
                "summary": desc,
                "signal": stars_today,
                "language": lang,
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 5. Betalist ───────────────────────────────────────────────────────────────

def fetch_betalist() -> list[dict]:
    _log("Betalist (new startups)...")
    try:
        r = requests.get("https://betalist.com/feed", timeout=TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        feed = feedparser.parse(r.text)
        items = []
        for e in feed.entries[:15]:
            items.append({
                "title": e.get("title", ""),
                "url": e.get("link", ""),
                "summary": _strip(e.get("summary", ""))[:200],
                "signal": "",
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 6. Indie Hackers ──────────────────────────────────────────────────────────

def fetch_indiehackers() -> list[dict]:
    _log("Indie Hackers (top posts)...")
    try:
        r = requests.get(
            "https://www.indiehackers.com/feed.xml",
            timeout=TIMEOUT,
            headers={"User-Agent": UA},
        )
        r.raise_for_status()
        feed = feedparser.parse(r.text)
        items = []
        for e in feed.entries[:15]:
            items.append({
                "title": e.get("title", ""),
                "url": e.get("link", ""),
                "summary": _strip(e.get("summary", ""))[:200],
                "signal": "",
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 7. Uneed (PH alternative) ─────────────────────────────────────────────────

def fetch_uneed() -> list[dict]:
    _log("Uneed (PH alternative)...")
    try:
        r = requests.get("https://www.uneed.best/", timeout=TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        items = []
        for card in soup.select("a[href*='/tool/']")[:15]:
            title = _strip(card.get_text())[:80]
            href = card.get("href", "")
            url = href if href.startswith("http") else f"https://www.uneed.best{href}"
            if title:
                items.append({"title": title, "url": url, "summary": "", "signal": ""})
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 8. HN Ask "What are you building" monthly ─────────────────────────────────

def fetch_hn_whatbuilding() -> list[dict]:
    _log("HN 'What are you working on' thread...")
    try:
        # Search for the monthly thread
        r = requests.get(
            "https://hn.algolia.com/api/v1/search?query=what+are+you+working+on&tags=ask_hn&hitsPerPage=3",
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        hits = r.json().get("hits", [])
        items = []
        for h in hits[:1]:  # just the most recent thread
            thread_id = h.get("objectID", "")
            items.append({
                "title": h.get("title", ""),
                "url": f"https://news.ycombinator.com/item?id={thread_id}",
                "summary": f"{h.get('num_comments', 0)} comments — community sharing what they're building",
                "signal": f"{h.get('num_comments', 0)} comments",
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 9. Peerlist (dev/design launches) ─────────────────────────────────────────

def fetch_peerlist() -> list[dict]:
    _log("Peerlist launches...")
    try:
        r = requests.get(
            "https://peerlist.io/launches",
            timeout=TIMEOUT,
            headers={"User-Agent": UA},
        )
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        items = []
        # Look for launch cards
        for card in soup.select("article, [class*='launch'], [class*='project']")[:10]:
            title_el = card.select_one("h2, h3, [class*='title'], [class*='name']")
            link_el = card.select_one("a[href]")
            if not title_el:
                continue
            title = _strip(title_el.get_text())
            href = link_el["href"] if link_el else ""
            url = href if href.startswith("http") else f"https://peerlist.io{href}"
            if title and len(title) > 3:
                items.append({"title": title, "url": url, "summary": "", "signal": ""})
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 10. Lobsters (tech community) ─────────────────────────────────────────────

def fetch_lobsters() -> list[dict]:
    _log("Lobsters (tech/show)...")
    try:
        r = requests.get(
            "https://lobste.rs/t/show.json",
            timeout=TIMEOUT,
            headers={"User-Agent": UA},
        )
        r.raise_for_status()
        posts = r.json()[:15]
        items = []
        for p in posts:
            items.append({
                "title": p.get("title", ""),
                "url": p.get("url") or p.get("short_id_url", ""),
                "summary": _strip(p.get("description", ""))[:200],
                "signal": f"{p.get('score', 0)} points",
                "tags": p.get("tags", []),
            })
        return items
    except Exception as exc:
        _log(f"  FAILED: {exc}")
        return []


# ── 11. TLDR newsletters ──────────────────────────────────────────────────────

def fetch_tldr(name: str, slug: str) -> list[dict]:
    _log(f"TLDR {name}...")
    from datetime import date
    for days_back in range(3):
        d = date.today()
        from datetime import timedelta
        d = d - timedelta(days=days_back)
        url = f"https://tldr.tech/{slug}/{d.isoformat()}"
        try:
            r = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": UA})
            if r.status_code == 404:
                continue
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            items = []
            seen = set()
            suffix_re = re.compile(r"\s+\((?:\d+\s+minute read|Tool|Website)\)\s*$", re.I)
            for link in soup.find_all("a", href=True):
                href = str(link.get("href", "")).strip()
                if not href.startswith("http"):
                    continue
                title = " ".join(link.get_text(" ", strip=True).split())
                if not title or "sponsor" in title.lower():
                    continue
                if not suffix_re.search(title):
                    continue
                cleaned = suffix_re.sub("", title).strip()
                if not cleaned or href in seen:
                    continue
                seen.add(href)
                parent = link.find_parent("article") or link.parent
                snippet = _strip(parent.get_text() if parent else "")[:200]
                items.append({"title": cleaned, "url": href, "summary": snippet, "signal": ""})
            if items:
                _log(f"  {name}: {len(items)} items from {d.isoformat()}")
                return items
        except Exception as exc:
            _log(f"  {name} {d.isoformat()} failed: {exc}")
            continue
    return []


# ── Runner ─────────────────────────────────────────────────────────────────────

SOURCES = {
    "producthunt_rss": fetch_producthunt_rss,
    "producthunt_scrape": fetch_producthunt_scrape,
    "show_hn": fetch_show_hn,
    "github_trending": fetch_github_trending,
    "betalist": fetch_betalist,
    "indiehackers": fetch_indiehackers,
    "uneed": fetch_uneed,
    "hn_whatbuilding": fetch_hn_whatbuilding,
    "peerlist": fetch_peerlist,
    "lobsters": fetch_lobsters,
    "tldr_ai": lambda: fetch_tldr("AI", "ai"),
    "tldr_marketing": lambda: fetch_tldr("Marketing", "marketing"),
    "tldr_design": lambda: fetch_tldr("Design", "design"),
    "tldr_webdev": lambda: fetch_tldr("WebDev", "webdev"),
}


def _print_results(source: str, items: list[dict]) -> None:
    print(f"\n{'─'*60}")
    print(f"  {source.upper()} — {len(items)} items")
    print(f"{'─'*60}")
    if not items:
        print("  [empty]")
        return
    for i, item in enumerate(items[:8], 1):
        signal = item.get("signal", "")
        topics = ", ".join(item.get("topics", []) or item.get("tags", []))
        lang = item.get("language", "")
        meta = " | ".join(filter(None, [signal, topics, lang]))
        print(f"  {i}. {item['title'][:70]}")
        if meta:
            print(f"     [{meta}]")
        if item.get("summary"):
            print(f"     {item['summary'][:120]}...")
        print(f"     {item.get('url', '')[:80]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="", help="Run only this source")
    args = parser.parse_args()

    to_run = {args.source: SOURCES[args.source]} if args.source and args.source in SOURCES else SOURCES

    print(f"\n{'='*60}")
    print(f"  LAUNCH SOURCE AUDIT — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    print(f"{'='*60}")

    results = {}
    for name, fn in to_run.items():
        try:
            items = fn()
            results[name] = items
            _print_results(name, items)
        except Exception as exc:
            _log(f"  {name} crashed: {exc}")
            results[name] = []
        time.sleep(0.5)

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for name, items in results.items():
        status = f"{len(items)} items" if items else "EMPTY / FAILED"
        signal_quality = ""
        if items:
            has_signal = sum(1 for i in items if i.get("signal"))
            signal_quality = f" ({has_signal}/{len(items)} have signal)"
        print(f"  {name:<25} {status}{signal_quality}")


if __name__ == "__main__":
    main()
