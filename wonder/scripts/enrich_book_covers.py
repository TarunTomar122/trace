#!/usr/bin/env python3
"""
Enrich book seed JSON files with cover image URLs.

Sources (in order):
1) Open Library Search + Open Library Covers
2) Google Books Volumes API (fallback)

Writes enriched output for:
- data/top_books_by_interest.json
- data/book_reading_cards_by_interest.json
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple


ROOT = Path("/Users/ttomar/Documents/personal/claudia/wonder")
TOP_BOOKS_PATH = ROOT / "data" / "top_books_by_interest.json"
READING_CARDS_PATH = ROOT / "data" / "book_reading_cards_by_interest.json"


def _http_json(url: str, timeout: int = 20) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "wonder-cover-enricher/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _title_similarity(a: str, b: str) -> float:
    na = set(_norm(a).split())
    nb = set(_norm(b).split())
    if not na or not nb:
        return 0.0
    inter = len(na.intersection(nb))
    union = len(na.union(nb))
    return inter / union if union else 0.0


def _author_match(target_author: str, candidate_authors: List[str]) -> float:
    ta = _norm(target_author)
    if not ta:
        return 0.0
    parts = [p for p in ta.split() if len(p) > 1]
    if not parts:
        return 0.0
    candidates = " ".join(_norm(a) for a in candidate_authors)
    hits = sum(1 for p in parts if p in candidates)
    return hits / len(parts)


@dataclass
class CoverInfo:
    image_url: str
    thumbnail_url: Optional[str]
    source: str
    confidence: float
    fetched_at: str


def _fetch_open_library_cover(title: str, author: str) -> Optional[CoverInfo]:
    query = urllib.parse.urlencode({"title": title, "author": author, "limit": 8})
    url = f"https://openlibrary.org/search.json?{query}"
    data = _http_json(url)
    docs = data.get("docs", []) or []

    best_score = -1.0
    best_doc = None
    for doc in docs:
        doc_title = doc.get("title", "")
        doc_authors = doc.get("author_name", []) or []
        t_score = _title_similarity(title, doc_title)
        a_score = _author_match(author, doc_authors)
        has_cover = 1.0 if doc.get("cover_i") else 0.0
        score = (0.55 * t_score) + (0.35 * a_score) + (0.10 * has_cover)
        if score > best_score:
            best_score = score
            best_doc = doc

    if not best_doc or not best_doc.get("cover_i"):
        return None

    cover_id = best_doc["cover_i"]
    now = datetime.now(timezone.utc).isoformat()
    return CoverInfo(
        image_url=f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg",
        thumbnail_url=f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg",
        source="open_library",
        confidence=round(min(0.99, max(0.3, best_score)), 2),
        fetched_at=now,
    )


def _fetch_google_books_cover(title: str, author: str) -> Optional[CoverInfo]:
    q = urllib.parse.quote_plus(f'intitle:"{title}" inauthor:"{author}"')
    url = f"https://www.googleapis.com/books/v1/volumes?q={q}&maxResults=5&printType=books"
    data = _http_json(url)
    items = data.get("items", []) or []
    if not items:
        return None

    best_score = -1.0
    best_cover = None
    for item in items:
        vi = item.get("volumeInfo", {}) or {}
        doc_title = vi.get("title", "")
        doc_authors = vi.get("authors", []) or []
        images = vi.get("imageLinks", {}) or {}
        thumb = images.get("thumbnail") or images.get("smallThumbnail")
        if not thumb:
            continue
        thumb = thumb.replace("http://", "https://")
        high = images.get("small") or images.get("medium") or images.get("large") or images.get(
            "extraLarge"
        )
        high = (high or thumb).replace("http://", "https://")

        t_score = _title_similarity(title, doc_title)
        a_score = _author_match(author, doc_authors)
        score = (0.6 * t_score) + (0.4 * a_score)
        if score > best_score:
            best_score = score
            best_cover = (high, thumb)

    if not best_cover:
        return None

    now = datetime.now(timezone.utc).isoformat()
    return CoverInfo(
        image_url=best_cover[0],
        thumbnail_url=best_cover[1],
        source="google_books",
        confidence=round(min(0.95, max(0.25, best_score)), 2),
        fetched_at=now,
    )


def fetch_cover(title: str, author: str, retries: int = 2) -> Optional[CoverInfo]:
    for attempt in range(retries + 1):
        try:
            cover = _fetch_open_library_cover(title, author)
            if cover:
                return cover
            cover = _fetch_google_books_cover(title, author)
            if cover:
                return cover
            return None
        except Exception:
            if attempt == retries:
                return None
            time.sleep(0.5 * (attempt + 1))
    return None


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def collect_books_from_top(top_books_data: dict) -> List[Tuple[str, str]]:
    books: List[Tuple[str, str]] = []
    seen = set()
    for interest_books in top_books_data.values():
        for b in interest_books:
            title = b.get("title", "").strip()
            author = b.get("author", "").strip()
            key = (_norm(title), _norm(author))
            if title and author and key not in seen:
                seen.add(key)
                books.append((title, author))
    return books


def collect_books_from_reading_cards(reading_cards_data: dict) -> List[Tuple[str, str]]:
    books: List[Tuple[str, str]] = []
    seen = set()
    interests = reading_cards_data.get("interests", {}) or {}
    for _, payload in interests.items():
        book = payload.get("book", {}) or {}
        title = str(book.get("title", "")).strip()
        author = str(book.get("author", "")).strip()
        key = (_norm(title), _norm(author))
        if title and author and key not in seen:
            seen.add(key)
            books.append((title, author))
    return books


def apply_covers_to_top_books(top_books_data: dict, cover_map: Dict[Tuple[str, str], CoverInfo]) -> dict:
    for _, interest_books in top_books_data.items():
        for b in interest_books:
            key = (_norm(b.get("title", "")), _norm(b.get("author", "")))
            cover = cover_map.get(key)
            if cover:
                b["cover"] = {
                    "image_url": cover.image_url,
                    "thumbnail_url": cover.thumbnail_url,
                    "source": cover.source,
                    "confidence": cover.confidence,
                    "fetched_at": cover.fetched_at,
                }
            else:
                b.setdefault("cover", None)
    return top_books_data


def apply_covers_to_reading_cards(
    reading_cards_data: dict, cover_map: Dict[Tuple[str, str], CoverInfo]
) -> dict:
    interests = reading_cards_data.get("interests", {})
    for _, payload in interests.items():
        book = payload.get("book", {})
        key = (_norm(book.get("title", "")), _norm(book.get("author", "")))
        cover = cover_map.get(key)
        if cover:
            book["cover"] = {
                "image_url": cover.image_url,
                "thumbnail_url": cover.thumbnail_url,
                "source": cover.source,
                "confidence": cover.confidence,
                "fetched_at": cover.fetched_at,
            }
        else:
            book.setdefault("cover", None)
        payload["book"] = book
    return reading_cards_data


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich wonder book seed files with cover URLs.")
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite source files. Without this, writes to *_enriched.json files.",
    )
    parser.add_argument(
        "--scope",
        choices=["starter", "all"],
        default="starter",
        help=(
            "starter: fetch covers only for one-book-per-interest dataset "
            "(from reading cards). all: fetch for every book in top_books_by_interest."
        ),
    )
    args = parser.parse_args()

    top_books_data = load_json(TOP_BOOKS_PATH)
    reading_cards_data = load_json(READING_CARDS_PATH)

    if args.scope == "all":
        books = collect_books_from_top(top_books_data)
    else:
        books = collect_books_from_reading_cards(reading_cards_data)
    cover_map: Dict[Tuple[str, str], CoverInfo] = {}

    for idx, (title, author) in enumerate(books, start=1):
        cover = fetch_cover(title, author)
        key = (_norm(title), _norm(author))
        if cover:
            cover_map[key] = cover
            status = f"{cover.source} ({cover.confidence})"
        else:
            status = "not_found"
        print(f"[{idx}/{len(books)}] {title} — {author} -> {status}")

    top_out = apply_covers_to_top_books(top_books_data, cover_map)
    cards_out = apply_covers_to_reading_cards(reading_cards_data, cover_map)

    if args.in_place:
        top_path = TOP_BOOKS_PATH
        cards_path = READING_CARDS_PATH
    else:
        top_path = TOP_BOOKS_PATH.with_name("top_books_by_interest_enriched.json")
        cards_path = READING_CARDS_PATH.with_name("book_reading_cards_by_interest_enriched.json")

    write_json(top_path, top_out)
    write_json(cards_path, cards_out)

    print("")
    print(f"Matched covers: {len(cover_map)}/{len(books)}")
    print(f"Wrote: {top_path}")
    print(f"Wrote: {cards_path}")


if __name__ == "__main__":
    main()
