#!/usr/bin/env python3
"""
Compare summary quality across feed types on real articles.

Usage:
  python3 -m v3.test_summary_prompts
  python3 -m v3.test_summary_prompts --feed trending
  python3 -m v3.test_summary_prompts --url "https://..."
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT.parent / ".env")

from v3.lib.content import fetch_content  # noqa: E402
from v3.lib.summarizer import generate_summary  # noqa: E402

FILLER_PATTERNS = [
    r"critics argue",
    r"paying lip service",
    r"underscores",
    r"highlights a broader trend",
    r"as .+ continues to",
    r"in recent years",
]

TEST_ARTICLES = [
    {
        "title": "Let us filter AI slop, you cowards",
        "url": "https://www.theverge.com/ai-artificial-intelligence/942909/let-us-filter-ai-slop-google-youtube-meta-instagram-tiktok",
        "must_capture": [
            "youtube",
            "instagram",
            "tiktok",
            "deviantart",
            "pinterest",
            "20%",
            "label",
        ],
    },
    {
        "title": "Anthropic accidentally leaked its own source code, and the internet made 8,000 copies",
        "url": "https://techround.co.uk/artificial-intelligence/anthropic-accidentally-leaked-its-own-source-code-and-the-internet-made-8000-copies-before-anyone-noticed/",
        "must_capture": [
            "anthropic",
            "claude",
            "npm",
            "github",
            "8,000",
            "source map",
            "takedown",
        ],
    },
    {
        "title": "Nvidia launches turbocharged Vera Rubin platform at GTC",
        "url": "https://siliconangle.com/2026/03/16/nvidia-ups-stakes-ai-infra-turbocharged-vera-rubin-platform-launch/",
        "must_capture": [
            "vera rubin",
            "nvlink",
            "groq",
            "gtc",
            "jensen",
            "nvidia",
        ],
    },
]


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def _coverage_hits(text: str, needles: list[str]) -> tuple[int, list[str], list[str]]:
    hay = (text or "").lower()
    hit, miss = [], []
    for needle in needles:
        if needle.lower() in hay:
            hit.append(needle)
        else:
            miss.append(needle)
    return len(hit), hit, miss


def _filler_hits(text: str) -> list[str]:
    lower = (text or "").lower()
    return [pat for pat in FILLER_PATTERNS if re.search(pat, lower)]


def _print_summary_block(
    *,
    feed_type: str,
    title: str,
    summary: dict[str, Any],
    must_capture: list[str],
) -> None:
    short = summary.get("short_article") or {}
    body = str(short.get("body", "")).strip()
    slides = short.get("slides") or []
    if not isinstance(slides, list):
        slides = []

    combined = body + "\n" + "\n".join(str(s) for s in slides)
    capture_count, hits, misses = _coverage_hits(combined, must_capture)
    filler = _filler_hits(body)

    print(f"\n{'=' * 72}")
    print(f"[{feed_type.upper()}] {title}")
    print(f"{'=' * 72}")
    print(f"Body words: {_word_count(body)}")
    if must_capture:
        print(f"Coverage: {capture_count}/{len(must_capture)} — hit {hits}, miss {misses}")
    if filler:
        print(f"Filler phrases in body: {filler}")
    print("\n--- BODY ---")
    print(body)
    if slides:
        print("\n--- SLIDES ---")
        for i, slide in enumerate(slides, 1):
            print(f"{i}. {slide}")


def run_article(article: dict[str, str | list[str]], feed_types: list[str]) -> None:
    url = str(article["url"])
    title = str(article["title"])
    must_capture = list(article.get("must_capture") or [])

    print(f"\nFetching: {url}")
    fetched = fetch_content(url)
    content = fetched.get("content", "")
    if not content:
        print(f"  SKIP — no content (source={fetched.get('source')})")
        return
    print(f"  Content: {len(content)} chars via {fetched.get('source')}")

    for feed_type in feed_types:
        summary, error = generate_summary(title, url, content, feed_type=feed_type)
        if not summary:
            print(f"\n[{feed_type}] FAILED: {error}")
            continue
        _print_summary_block(
            feed_type=feed_type,
            title=title,
            summary=summary,
            must_capture=must_capture,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Test summary prompt quality")
    parser.add_argument(
        "--feed",
        choices=["trending", "for_you", "both"],
        default="both",
        help="Which feed prompt to test",
    )
    parser.add_argument("--url", help="Single article URL to test")
    parser.add_argument("--title", default="Test article", help="Title when using --url")
    args = parser.parse_args()

    if args.feed == "both":
        feed_types = ["trending", "for_you"]
    else:
        feed_types = [args.feed]

    if args.url:
        articles = [{"title": args.title, "url": args.url, "must_capture": []}]
    else:
        articles = TEST_ARTICLES

    for article in articles:
        run_article(article, feed_types)


if __name__ == "__main__":
    main()
