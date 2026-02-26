#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Any

from google.cloud import firestore

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from v1.storage import FirestoreStore


DEFAULT_USER_ID = "TTK4PNFSO2PxTBrSCvvXBmHsCIE2"
SECTION_ORDER = ("trending", "for_you", "deep_dives")


def _to_lines(text: str, max_lines: int = 4) -> list[str]:
    raw = [p.strip() for p in text.replace("\n", " ").split(".") if p.strip()]
    return [f"{p}." for p in raw[:max_lines]]


def _tag_for_section(section: str) -> str:
    if section == "trending":
        return "AI NEWS"
    if section == "for_you":
        return "FOR YOU"
    return "DEEP DIVE"


def _extract_summary_fields(item: dict[str, Any]) -> tuple[str, str]:
    summary = item.get("summary") if isinstance(item.get("summary"), dict) else {}
    short_article = summary.get("short_article") if isinstance(summary.get("short_article"), dict) else {}
    subtitle = short_article.get("subtitle") or ""
    body = short_article.get("body") or ""
    return str(subtitle).strip(), str(body).strip()


def _pick_item(feed_data: dict[str, Any], preferred_section: str | None, item_index: int) -> tuple[str, dict[str, Any]]:
    ordered_sections = [preferred_section] if preferred_section else list(SECTION_ORDER)
    for section in ordered_sections:
        items = feed_data.get(section, [])
        if isinstance(items, list) and len(items) > item_index:
            return section, items[item_index]
    raise ValueError("No feed items found for selected section/index.")


def build_story_json(user_id: str, preferred_section: str | None, item_index: int) -> dict[str, Any]:
    store = FirestoreStore()
    docs = (
        store.db.collection("v3_user_feeds")
        .document(user_id)
        .collection("daily")
        .order_by("__name__", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    doc = next(iter(docs), None)
    if not doc or not doc.exists:
        raise ValueError(f"No v3 feed found for user: {user_id}")

    feed_data = doc.to_dict() or {}
    section, item = _pick_item(feed_data, preferred_section, item_index)
    title = (item.get("title") or item.get("headline") or "").strip()
    if not title:
        raise ValueError("Selected feed item has no title/headline.")

    subtitle, body = _extract_summary_fields(item)
    lines = _to_lines(body or subtitle or title, max_lines=4)
    if not lines:
        lines = [title]

    source_name = item.get("source_name") or item.get("source") or "Unknown source"
    url = item.get("url") or ""
    thumbnail = item.get("thumbnail") or ""

    caption_parts = [
        title,
        "",
        subtitle or lines[0],
        "",
        *lines,
        "",
        f"Source: {source_name}",
    ]
    if url:
        caption_parts.append(url)

    return {
        "tag": _tag_for_section(section),
        "headline": title,
        "summary_lines": lines,
        "caption": "\n".join(caption_parts).strip(),
        "source_url": url,
        "source_name": source_name,
        "image_url": thumbnail,
        "source_note": f"From v3_user_feeds/{user_id}/daily/{doc.id} ({section})",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build post story JSON from latest user v3 feed.")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID, help="User ID to pull from v3_user_feeds")
    parser.add_argument(
        "--section",
        choices=SECTION_ORDER,
        default=None,
        help="Optional section override; defaults to first non-empty section in order.",
    )
    parser.add_argument("--item-index", type=int, default=0, help="Item index within section (0-based)")
    parser.add_argument("--output", default="input/story_001.json", help="Output story JSON path")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    story = build_story_json(args.user_id, args.section, args.item_index)
    out_path = root / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(story, indent=2), encoding="utf-8")
    print(f"Wrote story JSON: {out_path}")


if __name__ == "__main__":
    main()
