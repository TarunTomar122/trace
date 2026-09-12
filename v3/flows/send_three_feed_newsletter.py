#!/usr/bin/env python3
"""Send the shared Trace feed as an editorial newsletter."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from google.cloud import firestore
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.newsletter_preferences import is_newsletter_enabled  # noqa: E402
from v1.tools.brevo_client import send_newsletter_email  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402

NEWSLETTER_INTERESTS = ("ai", "startups", "engineering")
NEWSLETTER_TOP_STORIES = 7
EDITORIAL_VERSION = "builder_digest_v15"
EDITORIAL_MODEL = os.getenv("NEWSLETTER_WRITE_MODEL", "gpt-5-mini")

def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _editorial_model_options(
    model: str,
    limit: int,
    temperature: float,
) -> dict[str, int | float]:
    """Use only the Chat Completions parameters accepted by the selected model."""
    if model.startswith("gpt-5"):
        return {"max_completion_tokens": limit, "reasoning_effort": "minimal"}
    return {"max_tokens": limit, "temperature": temperature}


def _load_template(name: str) -> str:
    path = REPO_ROOT / "v1" / "templates" / name
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    return path.read_text()


def _display_date(date: str) -> str:
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
    except ValueError:
        return date


def _topic_coverage(feed: dict[str, Any]) -> dict[str, int]:
    """Map article URL -> number of outlets covering that story."""
    coverage: dict[str, int] = {}
    topics = feed.get("trending_topics", [])
    if isinstance(topics, list):
        for topic in topics:
            if not isinstance(topic, dict):
                continue
            articles = topic.get("articles", [])
            count = int(topic.get("article_count") or topic.get("source_count") or 0)
            if count <= 0 and isinstance(articles, list):
                count = len(articles)
            if isinstance(articles, list):
                for row in articles:
                    url = str((row or {}).get("url", "")).strip()
                    if url:
                        coverage[url] = max(coverage.get(url, 0), count)
    return coverage


def _candidate_stories(feed: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    used_urls: set[str] = set()
    coverage = _topic_coverage(feed)

    topics = feed.get("trending_topics", [])
    if isinstance(topics, list):
        for topic in topics:
            if not isinstance(topic, dict) or topic.get("interest_id") not in NEWSLETTER_INTERESTS:
                continue
            articles = topic.get("articles", [])
            article = next(
                (
                    row for row in articles
                    if isinstance(row, dict) and str(row.get("url", "")).strip()
                ),
                None,
            ) if isinstance(articles, list) else None
            if not article:
                continue
            story = dict(article)
            story.update({
                "title": topic.get("title") or article.get("title"),
                "description": topic.get("summary") or article.get("description", ""),
                "interest_id": topic.get("interest_id"),
                "thumbnail": topic.get("thumbnail") or article.get("thumbnail", ""),
            })
            url = str(story.get("url", "")).strip()
            story["_coverage"] = coverage.get(url, 1)
            candidates.append(story)
            used_urls.add(url)

    rows = feed.get("trending", [])
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict) or row.get("interest_id") not in NEWSLETTER_INTERESTS:
                continue
            url = str(row.get("url", "")).strip()
            if url and url not in used_urls:
                row = dict(row)
                row["_coverage"] = coverage.get(url, 1)
                candidates.append(row)
                used_urls.add(url)
    return candidates


def _pick_items(feed: dict[str, Any]) -> list[dict[str, Any]]:
    eligible = _candidate_stories(feed)
    selected: list[dict[str, Any]] = []
    used_urls: set[str] = set()

    # Top stories only: most-covered stories first, then feed order.
    by_coverage = sorted(
        eligible, key=lambda r: (-int(r.get("_coverage") or 1), eligible.index(r))
    )
    for row in by_coverage:
        url = str(row.get("url", "")).strip()
        if not url or url in used_urls:
            continue
        selected.append({**row, "newsletter_group": "top_stories"})
        used_urls.add(url)
        if len(selected) >= NEWSLETTER_TOP_STORIES:
            break

    return selected


def _has_required_mix(items: list[dict[str, Any]]) -> bool:
    return sum(item.get("newsletter_group") == "top_stories" for item in items) == NEWSLETTER_TOP_STORIES


def _source_name(item: dict[str, Any]) -> str:
    source = str(item.get("source_name", "")).strip()
    if source:
        return source
    source = item.get("source")
    if isinstance(source, str) and source.strip():
        return source.strip()
    url = str(item.get("url", "")).strip()
    host = (urlparse(url).hostname or "").lower().replace("www.", "")
    return host or "Source"


def _plain_text(value: Any) -> str:
    return re.sub(r"[*_`]+", "", str(value or "")).strip()


def _summary_body(item: dict[str, Any]) -> str:
    if item.get("editorial_body"):
        return _plain_text(item["editorial_body"])
    summary = item.get("summary", {})
    if isinstance(summary, dict):
        short = summary.get("short_article", {})
        if isinstance(short, dict) and short.get("body"):
            return _plain_text(short["body"])
    return _plain_text(item.get("description", ""))


def _key_takeaways(item: dict[str, Any]) -> list[str]:
    editorial = item.get("editorial_takeaways")
    if isinstance(editorial, list):
        return [_plain_text(value) for value in editorial if _plain_text(value)]
    return []


def _takeaway_candidates(item: dict[str, Any]) -> list[str]:
    summary = item.get("summary", {})
    short = summary.get("short_article", {}) if isinstance(summary, dict) else {}
    if not isinstance(short, dict):
        return []

    candidates: list[str] = []
    for value in list(short.get("key_takeaways", []) or []) + list(short.get("slides", []) or []):
        cleaned = re.sub(r"^Slide \d+:\s*", "", _plain_text(value), flags=re.IGNORECASE)
        if cleaned and cleaned not in candidates:
            candidates.append(cleaned)
    return candidates[:3]


def _editorial_briefing(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "section": item.get("newsletter_group", ""),
            "format": (
                "two short paragraphs"
                if item.get("newsletter_group") == "top_stories"
                else "one compact paragraph"
            ),
            "category": item.get("interest_id", ""),
            "title": item.get("title", ""),
            "source": _source_name(item),
            "url": item.get("url", ""),
            "facts": _summary_body(item),
            "takeaways": _takeaway_candidates(item),
        }
        for item in items
    ]


def _edition_is_complete(edition: dict[str, Any], items: list[dict[str, Any]]) -> bool:
    stories = edition.get("stories")
    if not edition.get("subject") or not edition.get("intro") or not isinstance(stories, list):
        return False
    by_url = {
        str(story.get("url", "")).strip(): story
        for story in stories
        if isinstance(story, dict)
    }
    return all(
        (story := by_url.get(str(item.get("url", "")).strip()))
        and _plain_text(story.get("body", ""))
        and isinstance(story.get("takeaways"), list)
        for item in items
    )


def _takeaway_review_is_complete(review: dict[str, Any], items: list[dict[str, Any]]) -> bool:
    stories = review.get("stories")
    if not isinstance(stories, list):
        return False
    by_url = {
        str(story.get("url", "")).strip(): story
        for story in stories
        if isinstance(story, dict)
    }
    return all(
        (story := by_url.get(str(item.get("url", "")).strip()))
        and isinstance(story.get("takeaways"), list)
        for item in items
    )


def _build_editorial_edition(
    store: FirestoreStore,
    feed: dict[str, Any],
    date: str,
    *,
    force: bool = False,
    persist: bool = True,
) -> dict[str, Any]:
    items = _pick_items(feed)
    if not _has_required_mix(items):
        return {}

    briefing = _editorial_briefing(items)
    fingerprint = hashlib.sha256(
        json.dumps(briefing, ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()
    doc_ref = store.db.collection("newsletter_editions").document(date)
    existing = doc_ref.get()
    if existing.exists and not force:
        cached = existing.to_dict() or {}
        if (
            cached.get("version") == EDITORIAL_VERSION
            and cached.get("fingerprint") == fingerprint
            and _edition_is_complete(cached, items)
        ):
            return cached

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or not items:
        return {}

    prompt = (
        "Turn this factual briefing into a self-contained Trace newsletter edition.\n\n"
        "The reader should understand every item without opening a link. This is an editorial "
        "rewrite, not a new summary: use only the supplied facts and never add facts, numbers, "
        "quotes, opinions, or implications that are not supported by the briefing.\n\n"
        "Write with the energy of a smart technology newsroom: sharp, warm, and lightly playful when "
        "the facts make room for it. Lead with the twist, tension, or surprising detail rather than "
        "a generic announcement. A clean aside is welcome once or twice in the edition; never force a "
        "joke or invent colour. Prefer active, concrete language. Never use corporate filler such as "
        "'significant leap', 'rapidly evolving landscape', 'notable progress', 'reflects a practical "
        "approach', 'showcasing', or 'further diversifying'. Make technical material easy to read "
        "without dumbing it down. "
        "Avoid hype, filler, greetings, marketing language, and phrases such as 'the key takeaway'.\n\n"
        "Rules:\n"
        "- Write a 25-40 word intro that gives the shape of the day through two actual stories and has "
        "one human, conversational turn of phrase grounded in those facts. Never "
        "open with 'Today', 'This edition', or 'We dive', and never call it a 'tech landscape'.\n"
        "- Keep every supplied story, in the same order and section.\n"
        "- Preserve each title and URL exactly.\n"
        "- Follow each story's format field exactly. Top stories use two short paragraphs; every other "
        "story gets one compact paragraph. Never add a vague closing sentence to fill space.\n"
        "- Rewrite the supplied facts in original language. State a specific fact instead of making a "
        "broad conclusion about a company, industry, or strategy.\n"
        "- Treat the supplied takeaways as a fact bank. For every top story that has candidates, reserve "
        "at least one candidate fact for a takeaway rather than mentioning its core detail in the body. "
        "A takeaway must be a distinct concrete detail (a number, date, name, comparison, or constraint) "
        "not stated or substantially paraphrased in the body. Empty is better than repetition.\n"
        "- Before responding, compare every takeaway against its story at the meaning level. Remove any "
        "takeaway that repeats, paraphrases, generalizes, or merely concludes what the body already says.\n"
        "- Never pad thin material or invent detail to reach a length target.\n"
        "- The subject must be concrete, plain, and under 55 characters.\n\n"
        f"Briefing:\n{json.dumps(briefing, ensure_ascii=False)}\n\n"
        "Return only JSON with this shape:\n"
        '{"subject":"...","intro":"...","stories":['
        '{"title":"exact title","url":"exact url","body":"two short paragraphs separated by \\n\\n",'
        '"takeaways":["...","..."]}]}'
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=EDITORIAL_MODEL,
            **_editorial_model_options(EDITORIAL_MODEL, 6000, 0.4),
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You edit Trace, a daily briefing for builders. Accuracy is absolute. "
                        "Use only the supplied briefing."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        written = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        print(f"[newsletter] editorial rewrite failed: {exc}")
        return {}

    if not _edition_is_complete(written, items):
        print("[newsletter] editorial draft is incomplete")
        return {}

    review_prompt = (
        "You are Trace's final editor. Return a corrected final edition, using only the factual briefing. "
        "Do not summarize the review or explain your choices. Preserve the subject, intro, every title, "
        "every URL, story order, and section. Keep every story's required paragraph format.\n\n"
        "Remove corporate filler and vague closing sentences while preserving all supported detail. Leave "
        "takeaway selection to the specialist editor that follows.\n\n"
        f"Briefing:\n{json.dumps(briefing, ensure_ascii=False)}\n\n"
        f"Draft:\n{json.dumps(written, ensure_ascii=False)}\n\n"
        "Return only JSON in the original edition shape."
    )
    try:
        response = client.chat.completions.create(
            model=EDITORIAL_MODEL,
            **_editorial_model_options(EDITORIAL_MODEL, 6000, 0.2),
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You are a meticulous factual copy editor. Return valid JSON only.",
                },
                {"role": "user", "content": review_prompt},
            ],
        )
        reviewed = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        print(f"[newsletter] editorial review failed: {exc}")
        return {}
    if not _edition_is_complete(reviewed, items):
        print("[newsletter] editorial review is incomplete")
        return {}

    takeaway_prompt = (
        "You are Trace's takeaway editor. You are not writing story bodies. For every story, decide whether "
        "it deserves one final takeaway or an empty list. The supplied candidate fact bank is the only source "
        "for a takeaway. Treat the draft body as authoritative for what the reader has already learned.\n\n"
        "Keep a candidate only when it adds a concrete fact absent from the body at the meaning level. A fact "
        "is disqualified when the body states it directly, paraphrases it, names the same event and entities, "
        "or already gives its implication. Do not turn a body conclusion into a takeaway. Empty is the normal "
        "answer when no candidate survives. Return at most one candidate per story, in your own clear wording.\n\n"
        f"Fact bank:\n{json.dumps(briefing, ensure_ascii=False)}\n\n"
        f"Finished bodies:\n{json.dumps(reviewed, ensure_ascii=False)}\n\n"
        'Return only JSON: {"stories":[{"url":"exact source URL","takeaways":["..."]}]}. '
        "Include every source URL exactly once and no other fields."
    )
    try:
        response = client.chat.completions.create(
            model=EDITORIAL_MODEL,
            **_editorial_model_options(EDITORIAL_MODEL, 2000, 0.2),
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict semantic editor. Return valid JSON only.",
                },
                {"role": "user", "content": takeaway_prompt},
            ],
        )
        takeaway_review = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        print(f"[newsletter] takeaway review failed: {exc}")
        return {}
    if not _takeaway_review_is_complete(takeaway_review, items):
        print("[newsletter] takeaway review is incomplete")
        return {}

    reviewed_by_url = {
        str(story.get("url", "")).strip(): story
        for story in reviewed.get("stories", [])
        if isinstance(story, dict)
    }
    takeaways_by_url = {
        str(story.get("url", "")).strip(): story.get("takeaways", [])
        for story in takeaway_review.get("stories", [])
        if isinstance(story, dict)
    }

    edition = {
        "version": EDITORIAL_VERSION,
        "date": date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": EDITORIAL_MODEL,
        "fingerprint": fingerprint,
        "subject": _plain_text(reviewed.get("subject", "")),
        "intro": _plain_text(reviewed.get("intro", "")),
        "stories": [
            {
                "url": str(item.get("url", "")).strip(),
                "body": _plain_text(
                    reviewed_by_url[str(item.get("url", "")).strip()].get("body", "")
                ),
                "takeaways": [
                    _plain_text(value)
                    for value in takeaways_by_url[str(item.get("url", "")).strip()]
                ],
            }
            for item in items
        ],
    }
    if not _edition_is_complete(edition, items):
        return {}
    if persist:
        doc_ref.set(edition)
    return edition


def _apply_editorial(
    items: list[dict[str, Any]],
    edition: dict[str, Any],
) -> list[dict[str, Any]]:
    drafts = {
        str(story.get("url", "")).strip(): story
        for story in edition.get("stories", [])
        if isinstance(story, dict)
    }
    out = []
    for item in items:
        draft = drafts.get(str(item.get("url", "")).strip(), {})
        out.append(
            {
                **item,
                "editorial_body": draft.get("body", ""),
                "editorial_takeaways": draft.get("takeaways", []),
            }
        )
    return out


def _image_url(item: dict[str, Any]) -> str:
    for key in ("thumbnail", "image_url", "imageUrl", "urlToImage", "image"):
        value = str(item.get(key, "")).strip()
        if value.startswith(("https://", "http://")):
            return value
    return ""


_DOT = ""

_ABBR_RE = re.compile(r"\b(U\.S|U\.K|E\.U|U\.N|Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e)\.", re.IGNORECASE)


def _protect_abbr(text: str) -> str:
    text = _ABBR_RE.sub(lambda m: m.group(0).replace(".", _DOT), text)
    text = re.sub(r"\b([A-Z])\.", lambda m: m.group(1) + _DOT, text)
    text = re.sub(r"(\d)\.(\d)", lambda m: m.group(1) + _DOT + m.group(2), text)
    return text


def _split_sentences(text: str) -> list[str]:
    hidden = _protect_abbr(text)
    parts = re.findall(r"[^.!?]+[.!?]+[\"')\]]*|[^.!?]+$", hidden) or [hidden]
    return [p.replace(_DOT, ".").strip() for p in parts if p.strip()]


def _chunk_paragraphs(text: str, max_paras: int) -> list[str]:
    sentences: list[str] = []
    for block in re.split(r"\n\s*\n", text):
        sentences.extend(_split_sentences(block))
    sentences = [x for x in sentences if x]
    if not sentences:
        return []
    if len(sentences) <= max_paras:
        return sentences
    total_words = sum(len(x.split()) for x in sentences)
    per_para = max(1, -(-total_words // max_paras))
    paras: list[str] = []
    cur: list[str] = []
    cur_words = 0
    for sent in sentences:
        words = len(sent.split())
        if cur and cur_words + words > per_para and len(paras) < max_paras - 1:
            paras.append(" ".join(cur))
            cur, cur_words = [sent], words
        else:
            cur.append(sent)
            cur_words += words
    if cur:
        paras.append(" ".join(cur))
    return paras[:max_paras]


def _paragraph_html(text: str, max_paras: int = 2) -> str:
    paragraphs = [escape(part) for part in _chunk_paragraphs(text, max_paras)]
    return "".join(
        f'<p style="margin: 0 0 12px 0; font-size: 15px; color: #0f1419; '
        f'line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, '
        f'\'Segoe UI\', sans-serif;">{paragraph}</p>'
        for paragraph in paragraphs
    )


def _render_item(item: dict[str, Any]) -> str:
    title = escape(str(item.get("title", "Untitled")).removeprefix("Article: ").strip())
    url = escape(str(item.get("url", "#")))
    source = escape(_source_name(item))
    group = str(item.get("newsletter_group", "top_stories"))
    summary_html = _paragraph_html(_summary_body(item), max_paras=3 if group == "briefing" else 2)
    image_url = escape(_image_url(item))
    label = (
        str(item.get("interest_id", "tech")).replace("-", " ").upper()
        if group == "top_stories"
        else group.replace("_", " ").upper()
    )
    label = escape(label)
    takeaway_html = "".join(
        '<tr><td style="width: 16px; padding: 0 8px 8px 0; color: #1d9bf0; '
        'font-size: 16px; line-height: 1.45; vertical-align: top;">&bull;</td>'
        f'<td style="padding: 0 0 8px 0; color: #0f1419; font-size: 14px; '
        "line-height: 1.55; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', "
        f'sans-serif; vertical-align: top;">{escape(takeaway)}</td></tr>'
        for takeaway in _key_takeaways(item)
    )
    takeaways_block = (
        '<p style="margin: 18px 0 10px 0; color: #1d9bf0; font-size: 11px; '
        'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-weight: 800; '
        'letter-spacing: 0.12em; text-transform: uppercase;">Key takeaways</p>'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0">{takeaway_html}</table>'
    ) if takeaway_html else ""
    image_block = (
        '<tr><td>'
        f'<img src="{image_url}" alt="" width="624" style="display: block; width: 100%; height: auto; '
        'border: 0; border-radius: 8px;" /></td></tr>'
    ) if image_url else ""

    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0;">'
        f"{image_block}"
        '<tr><td style="padding: 18px 0 26px 0;">'
        f'<p style="margin: 0 0 9px 0; font-size: 11px; color: #1d9bf0; letter-spacing: 0.12em; '
        f'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-weight: 800; text-transform: uppercase;">{label} &nbsp;&middot;&nbsp; {source}</p>'
        f'<a href="{url}" style="display: block; margin: 0 0 10px 0; font-size: 25px; '
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 800; letter-spacing: -0.02em; "
        f'color: #0f1419; text-decoration: none; line-height: 1.25;">{title}</a>'
        f"{summary_html}"
        f"{takeaways_block}"
        "</td></tr>"
        '<tr><td style="padding: 0 0 30px 0;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
        '<td height="1" style="height: 1px; line-height: 1px; font-size: 1px; background: #eff3f4;">&nbsp;</td>'
        "</tr></table></td></tr></table>"
    )


def _generate_html(
    feed: dict[str, Any],
    date: str,
    user_name: str,
    edition: dict[str, Any] | None = None,
) -> tuple[str, str]:
    tpl = _load_template("three_feed_newsletter.html")
    edition = edition or {}
    selected = _apply_editorial(_pick_items(feed), edition)

    stories_html = ""
    for group, label in (("top_stories", "Top stories"),):
        rows = [item for item in selected if item.get("newsletter_group") == group]
        if not rows:
            continue
        stories_html += (
            '<p style="margin: 24px 0 14px 0; color: #1d9bf0; font-size: 11px; '
            'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-weight: 800; '
            f'letter-spacing: 0.12em; text-transform: uppercase;">{escape(label)}</p>'
        )
        stories_html += "".join(_render_item(item) for item in rows)

    html = tpl.replace("{{DATE}}", _display_date(date))
    html = html.replace("{{STORY_COUNT}}", str(len(selected)))

    html = html.replace("{{STORIES_HTML}}", stories_html)

    subject = str(edition.get("subject") or "").strip()
    if not subject:
        subject = f"{len(selected)} AI & tech stories worth knowing — {_display_date(date)}"
    return subject, html


def _generate_text(
    feed: dict[str, Any],
    date: str,
    edition: dict[str, Any] | None = None,
) -> str:
    edition = edition or {}
    selected = _apply_editorial(_pick_items(feed), edition)
    lines = [
        "TRACE",
        f"{len(selected)} things worth knowing - {date}",
        "",
        str(edition.get("intro") or "The top AI, startup, and engineering stories from today."),
        "",
    ]
    for idx, item in enumerate(selected, start=1):
        lines.append(f"{idx}. {item.get('title', 'Untitled')}")
        lines.append(f"   {_summary_body(item)}")
        for takeaway in _key_takeaways(item):
            lines.append(f"   - {takeaway}")
        lines.append(f"   {item.get('url', '')}")
        lines.append("")
    return "\n".join(lines)


def _load_daily_feed(store: FirestoreStore, owner: str, date: str) -> dict[str, Any]:
    doc = (
        store.db.collection("v3_user_feeds")
        .document(owner)
        .collection("daily")
        .document(date)
        .get()
    )
    if doc.exists:
        return doc.to_dict() or {}

    latest_docs = (
        store.db.collection("v3_user_feeds")
        .document(owner)
        .collection("daily")
        .order_by("__name__", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    for latest in latest_docs:
        return latest.to_dict() or {}
    return {}


def _load_newsletter_feed(store: FirestoreStore, date: str) -> dict[str, Any]:
    return _load_daily_feed(store, "_global", date)


def _resolve_recipients(
    store: FirestoreStore,
    v3_store: V3Store,
    user_id: str,
    audience: str,
) -> list[dict[str, str]]:
    if user_id:
        profile = store.get_user_profile(user_id) or {}
        email = str(profile.get("email", "")).strip().lower()
        if not email:
            return []
        name = str(profile.get("name", "")).strip() or str(profile.get("displayName", "")).strip()
        return [{"uid": user_id, "email": email, "name": name}]

    users = v3_store.get_onboarded_users(audience)
    out: list[dict[str, str]] = []
    for profile in users:
        uid = str(profile.get("uid", "")).strip()
        email = str(profile.get("email", "")).strip().lower()
        if not uid or not email:
            continue
        name = str(profile.get("name", "")).strip() or str(profile.get("displayName", "")).strip()
        out.append({"uid": uid, "email": email, "name": name})
    return out


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [three-feed-newsletter] {msg}", flush=True)


def _wait_for_complete_mix(
    store: Any,
    target_date: str,
    wait_minutes: int,
    poll_seconds: int = 300,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Reload the feed until the content mix is complete or time runs out.

    The newsletter cron has no ordering guarantee against the feed builders
    (morning builds + hourly pulse). Without this wait, a delayed builder
    means the newsletter reads a partial doc and silently sends nothing.
    """
    deadline = time.time() + max(wait_minutes, 0) * 60
    attempt = 0
    feed: dict[str, Any] | None = None
    items: list[dict[str, Any]] = []
    while True:
        attempt += 1
        feed = _load_newsletter_feed(store, target_date)
        items = _pick_items(feed) if feed else []
        if _has_required_mix(items):
            if attempt > 1:
                _log(f"content mix complete after {attempt} attempts")
            return feed, items
        remaining = deadline - time.time()
        if remaining <= 0:
            _log(f"content mix still incomplete after {attempt} attempts; giving up")
            return feed, items
        _log(
            f"content mix incomplete (attempt {attempt}); "
            f"rechecking in {int(min(poll_seconds, remaining))}s"
        )
        time.sleep(min(poll_seconds, remaining))


def send_three_feed_newsletter(
    *,
    date: str,
    user_id: str,
    audience: str,
    dry_run: bool,
) -> dict[str, Any]:
    store = FirestoreStore()
    v3_store = V3Store()
    target_date = date.strip() or _today_ist()
    recipients = _resolve_recipients(store, v3_store, user_id, audience)
    if not recipients:
        return {"success": False, "error": "no recipients found", "date": target_date}

    feed = _load_newsletter_feed(store, target_date)
    items = _pick_items(feed) if feed else []
    wait_minutes = int(os.getenv("NEWSLETTER_WAIT_MINUTES", "60") or 0)
    if (
        not dry_run
        and wait_minutes > 0
        and target_date == _today_ist()
        and not _has_required_mix(items)
    ):
        # Today's builders may still be running (delayed morning pipeline,
        # in-progress hourly pulse). Wait for the mix instead of skipping.
        feed, items = _wait_for_complete_mix(store, target_date, wait_minutes)
    if not _has_required_mix(items):
        return {"success": False, "error": "incomplete newsletter content mix", "date": target_date}

    sent = 0
    failed = 0
    skipped = len(recipients)
    errors: list[str] = []
    eligible = []

    for row in recipients:
        # Missing preference is not consent. Legacy newsletterOptIn=true remains valid.
        profile = store.get_user_profile(row["uid"]) or {}
        if is_newsletter_enabled(profile):
            eligible.append(row)

    skipped -= len(eligible)
    edition = _build_editorial_edition(
        store,
        feed,
        target_date,
        persist=not dry_run,
    ) if eligible else {}
    if eligible and not edition:
        return {
            "success": False,
            "error": "newsletter editorial rewrite failed",
            "date": target_date,
            "recipient_count": len(recipients),
            "sent": 0,
            "failed": len(eligible),
            "skipped": skipped,
            "errors": [],
        }

    for row in eligible:
        uid = row["uid"]
        subject, html = _generate_html(feed, target_date, row.get("name", ""), edition)
        text = _generate_text(feed, target_date, edition)

        if dry_run:
            sent += 1
            continue

        res = send_newsletter_email(
            to_email=row["email"],
            to_name=row.get("name") or None,
            subject=subject,
            html_content=html,
            text_content=text,
        )
        if res.get("success"):
            sent += 1
        else:
            failed += 1
            errors.append(f"{uid}<{row['email']}>: {res.get('error', 'unknown')}")

    return {
        "success": sent > 0 and failed == 0,
        "date": target_date,
        "dry_run": dry_run,
        "recipient_count": len(recipients),
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "errors": errors,
    }


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Send v3 three-feed newsletters.")
    p.add_argument("--date", default="", help="YYYY-MM-DD (defaults to today IST)")
    p.add_argument("--user-id", default="", help="Send only to one uid")
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Audience when --user-id is not provided",
    )
    p.add_argument("--dry-run", action="store_true", help="Build but do not send")
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    result = send_three_feed_newsletter(
        date=args.date,
        user_id=args.user_id,
        audience=args.audience,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, indent=2))
    # Fail loudly: a silent success hid a missed send day (exit 0 with
    # success:false). The scheduler + workflow now go red instead.
    if not result.get("success"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
