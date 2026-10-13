"""Coverage enrichment: thicken multi-source grouping for top topics.

For each top topic with thin coverage, query Firecrawl search for more
outlets covering the same story and attach them to topic.articles.

Reads the latest _global daily doc, writes it back (unless --dry-run).

    python3 -m v3.enrich_coverage --top 10 --dry-run
    python3 -m v3.enrich_coverage --date 2026-09-02 --top 10 --max-per-topic 4
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] [enrich] {msg}", flush=True)


# Aggregator/scraper domains that add noise, not coverage.
BLOCKLIST = {
    "biztoc.com",
    "jazawta.com",
    "guavy.com",
    "soz6.com",
    "printingpressai.com",
    "brytfmonline.com",
    "arcamax.com",
    "bankwatch.ca",
}

# Non-article destinations.
SKIP_HOSTS = {"youtube.com", "youtu.be", "linkedin.com", "facebook.com", "instagram.com", "tiktok.com"}

STOP = {
    "the", "a", "an", "and", "or", "for", "with", "from", "into", "about",
    "this", "that", "these", "those", "new", "latest", "today", "update",
    "after", "over", "under", "what", "why", "how", "will", "with", "without",
}


def _tokens(text: str) -> set[str]:
    out = set()
    for raw in re.sub(r"[^a-z0-9\s]", " ", (text or "").lower()).split():
        if len(raw) >= 4 and raw not in STOP and not raw.isdigit():
            out.add(raw)
    return out


def _clean_query(title: str) -> str:
    title = re.sub(r"^(PSA|BREAKING|WATCH|UPDATE)\s*:\s*", "", title, flags=re.IGNORECASE)
    title = title.split("|")[0]
    words = [w for w in re.sub(r"[^A-Za-z0-9\s]", " ", title).split() if len(w) > 3]
    return " ".join(words[:8])


def _host(url: str) -> str:
    try:
        return (urllib.parse.urlparse(url).hostname or "").replace("www.", "").lower()
    except Exception:
        return ""


def _firecrawl_search(
    base: str, query: str, limit: int = 10, timeout: int = 90, retries: int = 3
) -> list[dict[str, Any]]:
    body = json.dumps({"query": query, "limit": limit}).encode()
    last_err = ""
    for attempt in range(retries):
        req = urllib.request.Request(
            base.rstrip("/") + "/v2/search", data=body, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                data = json.load(res)
            return data.get("data", {}).get("web", []) or []
        except Exception as exc:
            last_err = str(exc)[:120]
            time.sleep(2 * (attempt + 1))
    _log(f"  search error after {retries} tries: {last_err}")
    return []


def _relevant(hit_title: str, topic_tokens: set[str]) -> bool:
    shared = _tokens(hit_title) & topic_tokens
    return len(shared) >= 2


def enrich_topic(
    topic: dict[str, Any], base: str, max_new: int
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Return (new_articles, stats). Does not mutate."""
    stats = {"hits": 0, "added": 0, "blocked": 0, "irrelevant": 0, "dupes": 0}
    title = str(topic.get("title", "") or "")
    if not title:
        return [], stats
    existing_hosts = {_host(str(a.get("url", ""))) for a in topic.get("articles", [])}
    topic_tokens = _tokens(title)
    query = _clean_query(title)
    if not query:
        return [], stats
    hits = _firecrawl_search(base, query)
    stats["hits"] = len(hits)
    new_articles: list[dict[str, Any]] = []
    for hit in hits:
        if len(new_articles) >= max_new:
            break
        url = str(hit.get("url", "") or "").strip()
        if not url.startswith(("http://", "https://")):
            continue
        host = _host(url)
        if not host or host in existing_hosts:
            stats["dupes"] += 1
            continue
        if host in BLOCKLIST or host in SKIP_HOSTS:
            stats["blocked"] += 1
            continue
        hit_title = str(hit.get("title", "") or "").strip()
        if not hit_title or not _relevant(hit_title, topic_tokens):
            stats["irrelevant"] += 1
            continue
        existing_hosts.add(host)
        new_articles.append({
            "title": hit_title,
            "url": url,
            "source": host,
            "source_name": host,
            "published_date": "",
            "enriched": True,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        })
        stats["added"] += 1
    return new_articles, stats


def _today_ist() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")


def _cluster_host_count(cluster: dict[str, Any]) -> int:
    hosts = set()
    for item in cluster.get("items", []) or []:
        h = _host(str((item or {}).get("url", "")))
        if h:
            hosts.add(h)
    return len(hosts)


def enrich_clusters(
    clusters: list[dict[str, Any]],
    firecrawl_url: str,
    top_n: int = 10,
    max_per_topic: int = 4,
    min_coverage: int = 3,
) -> dict[str, int]:
    """Enrich selected build clusters in place. Returns aggregate stats.

    Clusters are pool-item dicts (title/url/source_name/...). New outlets are
    appended shaped the same way so timelines, counts, and overviews pick
    them up with zero downstream changes.
    """
    stats = {"clusters_enriched": 0, "outlets_added": 0, "search_seconds": 0}
    ranked = sorted(
        clusters, key=lambda c: float(c.get("popularity_score", 0) or 0), reverse=True
    )[: max(0, top_n)]
    for cluster in ranked:
        if _cluster_host_count(cluster) >= min_coverage:
            continue
        items = cluster.get("items", []) or []
        titles = [str((i or {}).get("title", "") or "") for i in items[:2]]
        pseudo = {"title": " ".join(t for t in titles if t), "articles": items}
        t0 = time.time()
        new_articles, s = enrich_topic(pseudo, firecrawl_url, max_per_topic)
        stats["search_seconds"] += round(time.time() - t0, 1)
        _log(
            f"  cluster +{s['added']} (hits={s['hits']} dupes={s['dupes']} "
            f"blocked={s['blocked']} irrelevant={s['irrelevant']}) :: "
            f"{str((items[0] or {}).get('title', '') or '')[:60]}"
        )
        for art in new_articles:
            items.append({
                "title": art["title"],
                "url": art["url"],
                "source": art["source"],
                "source_name": art["source"],
                "published_date": "",
                "fetched_at": "",
                "og_image": "",
                "interest_id": "",
                "_trend_score": 0.0,
                "enriched": True,
            })
            stats["outlets_added"] += 1
        if new_articles:
            stats["clusters_enriched"] += 1
    return stats


def main() -> int:
    from v1.storage import FirestoreStore  # noqa: E402

    p = argparse.ArgumentParser(description="Enrich topic coverage via Firecrawl search.")
    p.add_argument("--date", default="", help="YYYY-MM-DD (defaults to latest doc)")
    p.add_argument("--top", type=int, default=10, help="Top N topics to enrich")
    p.add_argument("--max-per-topic", type=int, default=4, help="Max new outlets per topic")
    p.add_argument("--min-coverage", type=int, default=3, help="Skip topics already at this many domains")
    p.add_argument("--dry-run", action="store_true", help="Do not write back")
    p.add_argument("--firecrawl-url", default=os.getenv("FIRECRAWL_URL", "http://localhost:3002"))
    args = p.parse_args()

    store = FirestoreStore()
    col = store.db.collection("v3_user_feeds").document("_global").collection("daily")
    if args.date.strip():
        doc_ref = col.document(args.date.strip())
        doc = doc_ref.get()
        if not doc.exists:
            _log(f"no doc for {args.date}")
            return 1
    else:
        docs = list(col.order_by("__name__", direction="DESCENDING").limit(1).stream())
        if not docs:
            _log("no daily docs")
            return 1
        doc = docs[0]
        doc_ref = doc.reference
    data = doc.to_dict() or {}
    _log(f"doc: {doc.id}")
    topics = data.get("trending_topics", []) or []
    ranked = sorted(
        topics,
        key=lambda t: float(t.get("popularity_score", 0) or 0),
        reverse=True,
    )[: max(0, args.top)]

    total_added = 0
    total_time = 0.0
    enriched_topics = 0
    for topic in ranked:
        articles = topic.get("articles", []) or []
        hosts = {_host(str(a.get("url", ""))) for a in articles} - {""}
        if len(hosts) >= args.min_coverage:
            continue
        title = str(topic.get("title", "") or "")[:70]
        _log(f"topic ({len(hosts)} domains): {title}")
        t0 = time.time()
        new_articles, stats = enrich_topic(topic, args.firecrawl_url, args.max_per_topic)
        dt = time.time() - t0
        total_time += dt
        _log(
            f"  {dt:.0f}s hits={stats['hits']} added={stats['added']} "
            f"dupes={stats['dupes']} blocked={stats['blocked']} irrelevant={stats['irrelevant']}"
        )
        if new_articles:
            articles.extend(new_articles)
            topic["articles"] = articles
            topic["article_count"] = len(articles)
            topic["source_count"] = len({_host(str(a.get("url", ""))) for a in articles} - {""})
            enriched_topics += 1
            total_added += len(new_articles)

    _log(f"enriched {enriched_topics}/{len(ranked)} topics, +{total_added} outlets, {total_time:.0f}s search time")
    if args.dry_run:
        _log("dry run: not writing back")
        return 0
    doc_ref.set(data, merge=False)
    _log(f"wrote back {doc.id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
