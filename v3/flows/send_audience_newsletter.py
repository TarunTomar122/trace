#!/usr/bin/env python3
"""Send the redesigned audience newsletters: landing / free / pro.

One email per person per day. Bucket precedence: pro > free > landing.

- landing: email-only subscribers from the homepage form -> the 3 biggest
  stories of the day (global, not personalized).
- free: onboarded non-paying users, email on by default (only an explicit
  opt-out disables it) -> top 3 stories matched to their interests.
- pro: paying users, email always on -> top 8 stories matched to interests.

Stories come from the 24h trending pool (v3_user_feeds/_global). Topics that
Jev flagged send_worthy=0 are dropped whenever verdicts exist. Story links
point at the app, never the publisher.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from urllib.parse import quote, urlparse

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")
# Local runs keep API keys in the gitignored .environment (same as the
# trending pipeline); the VPS exposes them through systemd.
load_dotenv(REPO_ROOT / ".environment")

from google.cloud import firestore  # noqa: E402

from v1.storage import FirestoreStore, is_user_subscribed  # noqa: E402
from v1.tools.brevo_client import send_newsletter_email  # noqa: E402
from v3.lib.send_worthy import (  # noqa: E402
    SEND_WORTHY_PROMPT_VERSION,
    judge_send_worthy,
)
from v3.lib.store import V3Store  # noqa: E402
from v3.build_trending import (  # noqa: E402
    RANKING_QUESTIONS,
    _document_frequencies,
    _looks_like_model_release,
    _rare_tokens,
    _topic_tokens,
)

APP_URL = "https://yourtrace.online"
LANDING_COUNT = 5
FREE_COUNT = 5
PRO_COUNT = 10

# Lane priority: AI always leads, then markets, tech, design, then startups.
# Slots follow a 3/2/1/1/1 shape across the matched lanes: the leading lane
# gets the biggest share and each next lane one fewer.
LANE_ORDER = (
    "ai", "markets", "tech", "ux-design", "startups", "engineering",
    "products", "the-world",
)
LANE_PATTERN = {
    "pro": (3, 2, 2, 1, 1, 1),
    "free": (2, 1, 1),
    "landing": (2, 1, 1),
}

# Subject/headline: "<count> big things today <emoji>", emoji rotating daily.
SUBJECT_EMOJIS = ("\U0001f62e", "\U0001f525", "\U0001f680", "\U0001f440", "\U0001f9e0",
                  "\u26a1", "\u2728", "\U0001f973", "\U0001f37f", "\U0001f92f")

# Launches get their own heading at the top of the email, ahead of the lane
# pattern. Slots come out of the same total (8 / 3 / 3).
MODEL_RELEASE_LANE = "model-releases"
MODEL_RELEASE_SLOTS = {"pro": 2, "free": 1, "landing": 1}

# What counts as send-worthy is a judgement call, not a keyword list: Jev
# (Typesafe) scores every candidate with the shared RANKING_QUESTIONS rubric
# from v3.build_trending. Score 0 stories are dropped.
MACRO_RE = re.compile(
    r"\b("
    r"fed|federal reserve|inflation|rate cut|rate hike|interest rates?|"
    r"s&p ?500|nasdaq|dow|stock market|markets?|jobs report|payrolls|"
    r"tariffs?|oil|dollar|treasury|recession|gdp|cpi|yields?|rally|"
    r"sell-?off|wall street|layoffs?"
    r")\b",
    re.IGNORECASE,
)

INTEREST_LABELS = {
    "ai": "AI",
    "markets": "Markets",
    "startups": "Startups",
    "tech": "Tech",
    "engineering": "Engineering",
    "ux-design": "Design",
}

BUCKETS = {
    "landing": {
        "count": LANDING_COUNT,
        "headline": "5 big things today",
        "intro": (
            "You signed up on Trace with this email. Here is what moved the "
            "needle in tech — nothing else."
        ),
    },
    "free": {
        "count": FREE_COUNT,
        "headline": "5 big things today",
        "intro": (
            "Picked from the last 24 hours, matched to the topics you follow. "
            "Every original source is one tap away in the app."
        ),
    },
    "pro": {
        "count": PRO_COUNT,
        "headline": "10 big things today",
        "intro": (
            "The complete picture for your interests, ranked from everything "
            "that moved in the last 24 hours."
        ),
    },
}


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _display_date(date: str) -> str:
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%B %d")
    except ValueError:
        return date


def _load_template(name: str) -> str:
    path = REPO_ROOT / "v1" / "templates" / name
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    return path.read_text()


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [audience-newsletter] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Story selection
# ---------------------------------------------------------------------------


def _coverage_map(feed: dict) -> dict[str, int]:
    coverage: dict[str, int] = {}
    for topic in feed.get("trending_topics", []) or []:
        if not isinstance(topic, dict):
            continue
        count = int(topic.get("article_count") or topic.get("source_count") or 0)
        for row in topic.get("articles", []) or []:
            if isinstance(row, dict):
                url = str(row.get("url", "")).strip()
                if url:
                    coverage[url] = max(coverage.get(url, 0), count)
    return coverage


def _plain(value: Any) -> str:
    """Strip markdown emphasis so no ** or ` leaks into the email."""
    text = str(value or "").replace("\u2019", "'").replace("\u2018", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = re.sub(r"[*_`#]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _summary_text(value: Any) -> str:
    """Stories carry either a string summary or a structured dict.

    The dict shape (shortarticle/body, headline, slides, keytakeaways ...)
    must never reach the email as a raw repr.
    """
    if isinstance(value, str):
        return _plain(value)
    if not isinstance(value, dict):
        return ""

    for key in ("short_article", "shortarticle"):
        short = value.get(key)
        if isinstance(short, dict) and _plain(short.get("body")):
            return _plain(short["body"])

    for key in ("body", "subtitle", "summary", "microcardsummary", "headline"):
        text = _plain(value.get(key))
        if text:
            return text

    slides = value.get("slides")
    if isinstance(slides, list):
        cleaned = [
            re.sub(r"^Slide \d+:\s*", "", _plain(s), flags=re.IGNORECASE)
            for s in slides
        ]
        cleaned = [c for c in cleaned if c]
        if cleaned:
            return " ".join(cleaned)
    return ""


def _domain(url: str) -> str:
    return (urlparse(url).hostname or "").lower().replace("www.", "")


def _source_name(item: dict) -> str:
    source = str(item.get("source_name", "")).strip()
    if source:
        return source
    return _domain(str(item.get("url", ""))) or "Source"


def _candidates(feed: dict) -> list[dict]:
    """Flatten trending topics + raw trending rows into candidate stories.

    Applies the pipeline's stored Jev verdicts when this edition has them;
    fresh verdicts are requested separately (see _send_worthy_verdicts).
    """
    topics = [
        t for t in (feed.get("trending_topics", []) or [])
        if isinstance(t, dict) and t.get("title")
    ]

    if any(t.get("jev_send_worthy") is not None for t in topics):
        rejected = [
            t.get("title", "") for t in topics if t.get("jev_send_worthy") == 0
        ]
        if rejected:
            _log(f"pipeline Jev verdict dropped {len(rejected)} topic(s)")
        topics = [t for t in topics if t.get("jev_send_worthy") != 0]

    coverage = _coverage_map(feed)
    candidates: list[dict] = []
    seen_urls: set[str] = set()

    for topic in topics:
        articles = [a for a in (topic.get("articles", []) or []) if isinstance(a, dict)]
        hero = next(
            (a for a in articles if str(a.get("url", "")).strip()), {}
        )
        url = str(hero.get("url", "")).strip()
        title = _plain(topic.get("title"))
        if not url or not title:
            continue
        sources = []
        for a in articles:
            d = _domain(str(a.get("url", "")))
            if d and d not in sources:
                sources.append(d)
        interest = str(topic.get("interest_id", "")).strip().lower()
        if not interest:
            continue
        summary = _summary_text(topic.get("summary")) or _summary_text(
            hero.get("summary")
        )
        seen_urls.add(url)
        for a in articles:
            seen_urls.add(str(a.get("url", "")).strip())
        candidates.append({
            "topic_id": str(topic.get("id", "")),
            "url": url,
            "title": title,
            "summary": summary,
            "interest_id": interest,
            "source_name": _source_name(hero),
            "sources": sources[:4],
            "source_count": int(
                topic.get("source_count") or len(sources) or 1
            ),
            "coverage": coverage.get(url, 1),
            "macro": bool(MACRO_RE.search(f"{title} {summary}")),
            "model_release": _looks_like_model_release(
                title, _source_name(hero), summary
            ),
        })

    # Raw trending rows not already covered by a topic (singleton lanes).
    for row in feed.get("trending", []) or []:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url", "")).strip()
        interest = str(row.get("interest_id", "")).strip().lower()
        title = _plain(row.get("title"))
        if not url or url in seen_urls or not interest or not title:
            continue
        seen_urls.add(url)
        domain = _domain(url)
        summary = _summary_text(row.get("summary"))
        candidates.append({
            "topic_id": f"row_{url}",
            "url": url,
            "title": title,
            "summary": summary,
            "interest_id": interest,
            "source_name": _source_name(row),
            "sources": [domain] if domain else [],
            "source_count": 1,
            "coverage": coverage.get(url, 1),
            "macro": bool(MACRO_RE.search(f"{title} {summary}")),
            "model_release": _looks_like_model_release(
                title, _source_name(row), summary
            ),
        })
    return candidates


def _send_worthy_verdicts(v3_store: Any, candidates: list[dict]) -> dict[str, int]:
    """Jev's verdict for each candidate, cached. Empty means judge unavailable."""
    verdicts = judge_send_worthy(
        v3_store,
        [
            {
                "key": candidate["topic_id"],
                "title": candidate["title"],
                "summary": candidate.get("summary", ""),
            }
            for candidate in candidates
        ],
    )
    return verdicts


def _ranked(candidates: list[dict]) -> list[dict]:
    # Jev's verdict leads: a "clear keep" (2) beats a "borderline" (1), so the
    # short emails do not fill up with the first routine story in the lane.
    # Multi-source coverage breaks ties.
    def verdict_rank(candidate: dict) -> float:
        value = candidate.get("send_worthy")
        return float(value) if isinstance(value, (int, float)) else 1.0

    return sorted(
        candidates,
        key=lambda c: (-verdict_rank(c), -c["source_count"], -c["coverage"]),
    )


def _story_groups(feed: dict, verdicts: dict[str, int] | None = None) -> list[dict]:
    """Merge candidates covering the same event into one story group.

    Uses the same deterministic rare-token title rule the feed uses for
    merge candidates, so the email's "N sources" matches what the app
    shows for grouped coverage. Verdict score 0 drops the group.
    """
    verdicts = verdicts or {}
    candidates = _candidates(feed)
    ranked = _ranked(candidates)
    df = _document_frequencies([{"title": c["title"]} for c in candidates])
    rare = set(_rare_tokens(df, len(candidates)))

    groups: list[dict] = []
    for cand in ranked:
        tokens = _topic_tokens(cand["title"])
        target = None
        for group in groups:
            shared = tokens & group["_tokens"]
            specific = {t for t in shared if len(t) >= 4}
            if len(specific) >= 3 or ((shared & group["_rare"]) and len(specific) >= 2):
                target = group
                break
        if target is None:
            groups.append({
                **cand,
                "_tokens": tokens,
                "_rare": rare,
                "_verdicts": [verdicts.get(cand["topic_id"])],
            })
            continue
        target["_tokens"] |= tokens
        target["_verdicts"].append(verdicts.get(cand["topic_id"]))
        for domain in cand["sources"]:
            if domain not in target["sources"]:
                target["sources"].append(domain)
        target["sources"] = target["sources"][:4]
        target["source_count"] = max(
            target["source_count"], len(target["sources"]), cand["source_count"]
        )
        target["coverage"] = max(target["coverage"], cand["coverage"])

    kept: list[dict] = []
    for group in groups:
        scores = [s for s in group.pop("_verdicts", []) if s is not None]
        group.pop("_tokens", None)
        group.pop("_rare", None)
        # A story is only dropped when every source in the group was judged
        # worthless; one keep-worthy outlet saves the group.
        if scores and max(scores) == 0:
            continue
        group["send_worthy"] = max(scores) if scores else None
        kept.append(group)
    return kept


def _select(
    feed: dict,
    interests: list[str],
    count: int,
    bucket: str,
    verdicts: dict[str, int] | None = None,
) -> list[tuple[str, list[dict]]]:
    """Return (lane, stories) sections following lane priority + slot shape.

    Landing subscribers have no interests, so AI leads with the strongest
    available story from the other lanes behind it. Signed-in users only get
    lanes they actually follow, in the same priority order.
    """
    groups = _story_groups(feed, verdicts)
    if interests:
        wanted = {i.strip().lower() for i in interests if i.strip()}
        primary = [g for g in groups if g["interest_id"] in wanted]
        secondary = [g for g in groups if g["interest_id"] not in wanted]
        lanes = [lane for lane in LANE_ORDER if lane in wanted]
    else:
        primary, secondary = list(groups), []
        lanes = list(LANE_ORDER)

    ordered = _ranked(primary)
    used: set[str] = set()
    sections: list[tuple[str, list[dict]]] = []

    # Model releases lead the email under their own heading, before the lane
    # pattern. Only stories the reader's interests already cover qualify.
    release_slots = MODEL_RELEASE_SLOTS.get(bucket, 0)
    if release_slots:
        releases = [g for g in ordered if g.get("model_release")][:release_slots]
        if releases:
            for g in releases:
                used.add(g["topic_id"])
            sections.append((MODEL_RELEASE_LANE, releases))

    picked = sum(len(stories) for _, stories in sections)
    remaining = count - picked

    pattern = LANE_PATTERN.get(bucket, ())
    for position, lane in enumerate(lanes):
        if remaining <= 0:
            break
        quota = min(pattern[position] if position < len(pattern) else 1, remaining)
        if quota <= 0:
            continue
        lane_items = [
            g for g in ordered
            if g["interest_id"] == lane and g["topic_id"] not in used
        ]
        # Markets means the overall market: macro stories first.
        if lane == "markets":
            lane_items = sorted(lane_items, key=lambda g: not g.get("macro"))
        lane_items = lane_items[:quota]
        if not lane_items:
            continue
        for g in lane_items:
            used.add(g["topic_id"])
        sections.append((lane, lane_items))
        remaining -= len(lane_items)

    # Backfill any unfilled slots from the remaining lanes in priority order.
    if remaining > 0:
        by_lane: dict[str, list[dict]] = {}
        for g in ordered + _ranked(secondary):
            if g["topic_id"] in used:
                continue
            by_lane.setdefault(g["interest_id"], []).append(g)
        lane_order = [l for l in LANE_ORDER if l in by_lane] + sorted(
            set(by_lane) - set(LANE_ORDER)
        )
        for lane in lane_order:
            if remaining <= 0:
                break
            got = by_lane.get(lane, [])[:remaining]
            if got:
                for g in got:
                    used.add(g["topic_id"])
                sections.append((lane, got))
                remaining -= len(got)
    return sections


# ---------------------------------------------------------------------------
# Audience resolution
# ---------------------------------------------------------------------------


def _email_enabled(profile: dict, bucket: str) -> bool:
    """Pro users are always on; everyone else needs no explicit opt-out."""
    if bucket == "pro":
        return True
    if "dailyNewsletterEnabled" in profile:
        return profile.get("dailyNewsletterEnabled") is True
    if "newsletterOptIn" in profile:
        return profile.get("newsletterOptIn") is True
    return True


def _resolve_audience(store: FirestoreStore, v3_store: V3Store) -> dict:
    buckets: dict[str, list[dict]] = {"pro": [], "free": [], "landing": []}
    seen_emails: set[str] = set()

    for profile in v3_store.get_onboarded_users("all"):
        email = str(profile.get("email", "")).strip().lower()
        if not email or email in seen_emails:
            continue
        bucket = "pro" if is_user_subscribed(profile) else "free"
        if not _email_enabled(profile, bucket):
            continue
        interests = [
            str(i).strip().lower()
            for i in (profile.get("interests", []) or [])
            if str(i).strip()
        ]
        name = str(profile.get("name", "")).strip() or str(
            profile.get("displayName", "")
        ).strip()
        buckets[bucket].append({
            "uid": str(profile.get("uid", "") or profile.get("id", "")),
            "email": email,
            "name": name,
            "interests": interests,
        })
        seen_emails.add(email)

    # Landing-page subscribers: everyone the account buckets did not claim.
    docs = (
        store.db.collection("free_newsletter_subscribers")
        .where("active", "==", True)
        .stream()
    )
    for doc in docs:
        data = doc.to_dict() or {}
        email = str(data.get("email", "")).strip().lower()
        if email and email not in seen_emails:
            buckets["landing"].append({"email": email, "name": "", "interests": []})
            seen_emails.add(email)

    return buckets


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


def _favicon_stack(sources: list[str]) -> str:
    icons = "".join(
        f'<img src="https://www.google.com/s2/favicons?domain={escape(d)}&sz=64" '
        'width="14" height="14" alt="" style="display: inline-block; border-radius: 3px; '
        'border: 1px solid #eff3f4; vertical-align: middle; margin-right: 3px;" />'
        for d in sources[:3]
    )
    return f'<span style="white-space: nowrap;">{icons}</span>'


def _clamp_summary(text: str, limit: int = 340) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if "." in cut:
        cut = cut[: cut.rfind(".") + 1]
    return cut.rstrip(" ,;:") + "…"


def _story_html(story: dict) -> str:
    title = escape(story["title"])
    # Topic ids are recomputed on every trending rebuild (sha of cluster urls),
    # so an emailed tt_… link is dead within half an hour. The article URL is
    # stable and the app resolves stories by it.
    app_link = (
        f"{APP_URL}/feed?from=email&story={quote(story['url'], safe='')}"
    )
    summary = escape(story["summary"])
    favicon = _favicon_stack(story["sources"])
    count_word = "source" if story["source_count"] == 1 else "sources"
    meta = (
        f'<p style="margin: 0; font-size: 12px; color: #71767b; font-family: {_FONT};">'
        f'{favicon}{source}&nbsp;&middot;&nbsp;{story["source_count"]} {count_word}</p>'
    ) if (source := escape(story["source_name"])) else ""
    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin: 0 0 4px 0;">'
        "<tr>"
        '<td style="padding: 16px 0 0 0; vertical-align: top;">'
        f'<a href="{app_link}" style="display: block; margin: 0 0 7px 0; font-size: 18px; '
        f'font-weight: 800; letter-spacing: -0.02em; line-height: 1.3; color: #0f1419; '
        f'text-decoration: none; font-family: {_FONT};">{title}</a>'
        f'<p style="margin: 0 0 9px 0; font-size: 14px; color: #536471; line-height: 1.65; '
        f'font-family: {_FONT};">{summary}</p>'
        f"{meta}"
        "</td>"
        "</tr>"
        '<tr><td style="padding: 16px 0 0 0;">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
        '<td height="1" style="height: 1px; line-height: 1px; font-size: 1px; '
        'background-color: #eff3f4;">&nbsp;</td>'
        "</tr></table></td></tr>"
        "</table>"
    )


def _section_body(label: str, stories: list[dict]) -> str:
    kicker = (
        '<p style="margin: 0 0 2px 0; font-size: 11px; color: #e5484d; '
        f'font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; '
        f'font-family: {_FONT};">'
        f"&#9733; {escape(label)}</p>"
    )
    return kicker + "".join(_story_html(story) for story in stories)


def _sections_html(bucket: str, sections: list[tuple[str, list[dict]]]) -> str:
    """One table row per section.

    The email stays plain text on white — the launch group is set apart by
    its heading only, no tinted panel.
    """
    rows: list[str] = []
    for index, (lane, stories) in enumerate(sections):
        if lane == MODEL_RELEASE_LANE:
            label = "Model releases"
        elif bucket == "landing":
            label = "Top stories"
        else:
            label = f"Top in {INTEREST_LABELS.get(lane, lane.upper())}"
        top = 18 if index == 0 else 22
        rows.append(
            f'<tr><td class="nl-p28" style="padding: {top}px 28px 0 28px;">'
            f"{_section_body(label, stories)}"
            "</td></tr>"
        )
    return "".join(rows)


def _cta_html(bucket: str) -> str:
    base = f"height: 46px; line-height: 46px; border-radius: 999px; font-size: 15px; font-weight: 700; text-decoration: none; font-family: {_FONT};"
    if bucket == "pro":
        # Pro already has everything; no upsell block.
        return ""
    if bucket == "free":
        return (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
            'style="background-color: #e5f2fc; border-radius: 16px;">'
            '<tr><td align="center" style="padding: 22px 24px;">'
            '<p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0f1419; '
            f'font-family: {_FONT};">Double this, every morning.</p>'
            '<p style="margin: 0 0 14px 0; font-size: 13.5px; color: #536471; line-height: 1.6; '
            f'font-family: {_FONT};">Pro sends 10 big things instead of 5, ranked deeper into '
            "your interests, plus full Pulse and the archive.</p>"
            f'<a href="{APP_URL}/subscribe?from=email" style="display: inline-block; padding: 0 28px; '
            f'background-color: #1d9bf0; color: #ffffff; {base}">Go Pro</a>'
            "</td></tr></table>"
        )
    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color: #f7f9f9; border-radius: 16px;">'
        '<tr><td align="center" style="padding: 22px 24px;">'
        '<p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0f1419; '
        f'font-family: {_FONT};">Want the 10 big things?</p>'
        '<p style="margin: 0 0 14px 0; font-size: 13.5px; color: #536471; line-height: 1.6; '
        f'font-family: {_FONT};">Create a free account and pick your topics, so tomorrow&rsquo;s '
        "brief follows exactly those — or go straight to Pro for all 10 big things in "
        "tech and AI, every morning.</p>"
        f'<a href="{APP_URL}/feed?from=email" style="display: inline-block; padding: 0 28px; '
        f'background-color: #1d9bf0; color: #ffffff; {base}">Personalize it</a>'
        '&nbsp;&nbsp;'
        f'<a href="{APP_URL}/subscribe?from=email" style="display: inline-block; padding: 0 22px; '
        f'border: 1px solid #cfd9de; color: #0f1419; {base}">Go Pro</a>'
        "</td></tr></table>"
    )


RATINGS = (
    (5, "\u2605\u2605\u2605\u2605\u2605", "Absolutely Loved It"),
    (4, "\u2605\u2605\u2605\u2605", "Better Than Usual"),
    (3, "\u2605\u2605\u2605", "Meh, It Was Okay"),
    (2, "\u2605\u2605", "Could Be Better"),
)


def _feedback_html(bucket: str, email: str, date: str) -> str:
    email_esc = escape(email)
    rows = "".join(
        '<tr><td style="padding: 0 0 8px 0;">'
        f'<a href="{APP_URL}/api/newsletter-feedback?r={score}&amp;email={email_esc}&amp;d={date}" '
        'style="display: block; padding: 12px 16px; border: 1px solid #e1e8ed; '
        'border-radius: 10px; text-decoration: none; font-size: 15px; '
        f'font-family: {_FONT};">'
        f'<span style="color: #f5a623; font-size: 15px;">{stars}</span> '
        f'<span style="color: #0f1419; font-weight: 650;">{label}</span>'
        "</a></td></tr>"
        for score, stars, label in RATINGS
    )
    manage = (
        f"{APP_URL}/api/unsubscribe?email={email_esc}" if bucket == "landing"
        else f"{APP_URL}/feed?tab=profile"
    )
    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color: #f7f9f9; border-radius: 16px;">'
        '<tr><td style="padding: 24px 24px 20px 24px;">'
        '<p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; '
        f'color: #e5484d; letter-spacing: 0.06em; font-family: {_FONT};">Feedback</p>'
        '<p style="margin: 0 0 4px 0; font-size: 19px; font-weight: 800; color: #0f1419; '
        f'letter-spacing: -0.02em; line-height: 1.3; font-family: {_FONT};">'
        "What'd you think of today's newsletter?</p>"
        '<p style="margin: 0 0 16px 0; font-size: 14px; color: #536471; '
        f'font-family: {_FONT};">Vote below and tell me how this is landing.</p>'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0">{rows}</table>'
        '<p style="margin: 16px 0 6px 0; font-size: 14px; color: #0f1419; '
        f'font-family: {_FONT};">Too frequent? Update your preference '
        f'<a href="{manage}" style="color: #0f1419; font-weight: 700;">here</a>.</p>'
        '<p style="margin: 0; font-size: 14px; color: #0f1419; '
        f'font-family: {_FONT};">Hated it and want to stop receiving them? '
        f'<a href="{manage}" style="color: #0f1419; font-weight: 700;">Unsubscribe here</a>.</p>'
        "</td></tr></table>"
    )


def _replace_block(html: str, marker: str, content: str) -> str:
    """Fill a marked template block, or drop it entirely when empty."""
    pattern = re.compile(rf"<!-- {marker} -->.*?<!-- /{marker} -->", re.DOTALL)
    if not content:
        return pattern.sub("", html)
    return pattern.sub(
        lambda m: m.group(0).replace(f"{{{{{marker}_HTML}}}}", content),
        html,
    )


def _daily_emoji(date: str) -> str:
    """Same emoji for everyone, different every day."""
    try:
        day = datetime.strptime(date, "%Y-%m-%d").timetuple().tm_yday
    except ValueError:
        return SUBJECT_EMOJIS[0]
    return SUBJECT_EMOJIS[day % len(SUBJECT_EMOJIS)]


def _render(
    bucket: str,
    sections: list[tuple[str, list[dict]]],
    date: str,
    email: str = "",
) -> tuple[str, str, str]:
    cfg = BUCKETS[bucket]
    headline = f"{cfg['headline']} {_daily_emoji(date)}"
    subject = f"{headline} — {_display_date(date)}"
    html = _load_template("audience_newsletter.html")
    html = html.replace("{{SUBJECT}}", escape(subject))
    html = html.replace("{{DATE}}", escape(_display_date(date)))
    html = html.replace("{{HEADLINE}}", escape(headline))
    html = html.replace("{{INTRO}}", escape(cfg["intro"]))
    html = html.replace("{{SECTIONS_HTML}}", _sections_html(bucket, sections))
    html = _replace_block(html, "CTA", _cta_html(bucket))
    # Feedback block is intentionally hidden for now; the renderer stays in
    # place so it can be switched on with one line.
    html = _replace_block(html, "FEEDBACK", "")

    if bucket == "landing":
        footer = (
            f'<a href="{APP_URL}/feed?from=email" style="color: #1d9bf0; font-weight: 700; '
            'text-decoration: none;">Open the feed</a>'
            "<span style=\"color: #cfd9de;\">&nbsp;&middot;&nbsp;</span>"
            f'<a href="{APP_URL}/api/unsubscribe?email={escape(email)}" '
            'style="color: #71767b; text-decoration: underline;">Unsubscribe</a>'
        )
    else:
        footer = (
            f'<a href="{APP_URL}/feed?from=email" style="color: #1d9bf0; font-weight: 700; '
            'text-decoration: none;">Open the feed</a>'
            "<span style=\"color: #cfd9de;\">&nbsp;&middot;&nbsp;</span>"
            f'<a href="{APP_URL}/feed?tab=profile" style="color: #71767b; text-decoration: underline;">'
            "Manage email settings</a>"
        )
    html = html.replace("{{FOOTER_LINKS}}", footer)
    text = _text_version(cfg, sections)
    return subject, html, text


def _text_version(cfg: dict, sections: list[tuple[str, list[dict]]]) -> str:
    lines = ["TRACE", cfg["headline"], ""]
    for _, stories in sections:
        for story in stories:
            lines.append(story["title"])
            lines.append(f"   {story['summary']}")
            lines.append(
                f"   {story['source_name']} · {story['source_count']} sources"
            )
            lines.append(f"   {APP_URL}/feed?from=email")
            lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Send
# ---------------------------------------------------------------------------


def _load_global_feed(store: FirestoreStore, date: str) -> dict:
    doc = (
        store.db.collection("v3_user_feeds")
        .document("_global")
        .collection("daily")
        .document(date)
        .get()
    )
    if doc.exists:
        return doc.to_dict() or {}
    latest = (
        store.db.collection("v3_user_feeds")
        .document("_global")
        .collection("daily")
        .order_by("__name__", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    for doc in latest:
        _log(f"feed for {date} missing; using latest {doc.id}")
        return doc.to_dict() or {}
    return {}


def _send_one(
    store: FirestoreStore,
    feed: dict,
    date: str,
    bucket: str,
    recipient: dict,
    dry_run: bool,
    cache: dict,
    verdicts: dict[str, int] | None = None,
) -> dict:
    interests = tuple(recipient.get("interests") or [])
    key = (bucket, interests)
    if key not in cache:
        cache[key] = _select(
            feed, list(interests), BUCKETS[bucket]["count"], bucket, verdicts
        )
    sections = cache[key]
    stories = [s for _, group in sections for s in group]
    if not stories:
        return {"ok": False, "error": "no stories selected"}
    if len(stories) < BUCKETS[bucket]["count"]:
        _log(
            f"only {len(stories)}/{BUCKETS[bucket]['count']} stories for "
            f"{recipient['email']} (interests={list(interests)})"
        )

    subject, html, text = _render(bucket, sections, date, recipient["email"])
    if dry_run:
        _log(f"[dry-run] {bucket} -> {recipient['email']} | {subject}")
        return {"ok": True}

    res = send_newsletter_email(
        to_email=recipient["email"],
        to_name=recipient.get("name") or None,
        subject=subject,
        html_content=html,
        text_content=text,
    )
    if res.get("success"):
        _log(f"sent {bucket} email to {recipient['email']}")
        return {"ok": True}
    return {"ok": False, "error": res.get("error", "unknown")}


def send_audience_newsletter(
    *,
    date: str,
    dry_run: bool,
    demo_email: str = "",
    demo_bucket: str = "",
    demo_interests: str = "",
    preview: bool = False,
    preview_bucket: str = "",
    preview_interests: str = "",
) -> dict:
    store = FirestoreStore()
    v3_store = V3Store()
    target_date = date.strip() or _today_ist()
    feed = _load_global_feed(store, target_date)
    if not feed:
        return {"success": False, "error": "no global feed found", "date": target_date}

    verdicts = _send_worthy_verdicts(v3_store, _candidates(feed))

    if preview:
        interests = [
            i.strip().lower() for i in preview_interests.split(",") if i.strip()
        ]
        for bucket in ([preview_bucket] if preview_bucket else ["pro", "free", "landing"]):
            sections = _select(
                feed, interests, BUCKETS[bucket]["count"], bucket, verdicts
            )
            print(f"\n=== {bucket.upper()} ({BUCKETS[bucket]['count']} stories) ===")
            for lane, stories in sections:
                print(f"  -- {INTEREST_LABELS.get(lane, lane)}")
                for story in stories:
                    count_word = "source" if story["source_count"] == 1 else "sources"
                    macro = " [macro]" if story.get("macro") else ""
                    score = story.get("send_worthy")
                    mark = f" (jev {score})" if score is not None else " (no verdict)"
                    print(
                        f"     [{story['source_count']} {count_word}]{macro}{mark} "
                        f"{story['title']}"
                    )
        return {"success": True, "mode": "preview", "date": target_date}

    if demo_email:
        bucket = demo_bucket or "pro"
        interests = [
            i.strip().lower() for i in demo_interests.split(",") if i.strip()
        ]
        if not interests and bucket != "landing":
            matches = (
                store.db.collection("user_profiles")
                .where("email", "==", demo_email.strip().lower())
                .limit(1)
                .stream()
            )
            for doc in matches:
                profile = doc.to_dict() or {}
                interests = [
                    str(i).strip().lower()
                    for i in (profile.get("interests", []) or [])
                    if str(i).strip()
                ]
                if not profile.get("name") and bucket != "landing":
                    pass
                recipient = {
                    "uid": doc.id,
                    "email": demo_email.strip().lower(),
                    "name": str(profile.get("name", "")).strip(),
                    "interests": interests,
                }
                break
            else:
                recipient = {
                    "uid": "",
                    "email": demo_email.strip().lower(),
                    "name": "",
                    "interests": [],
                }
        else:
            recipient = {
                "uid": "",
                "email": demo_email.strip().lower(),
                "name": "",
                "interests": interests,
            }
        _log(f"demo send: bucket={bucket} email={recipient['email']} interests={interests}")
        result = _send_one(
            store, feed, target_date, bucket, recipient, dry_run, {}, verdicts
        )
        return {
            "success": result["ok"],
            "mode": "demo",
            "bucket": bucket,
            "error": result.get("error"),
            "date": target_date,
            "dry_run": dry_run,
        }

    buckets = _resolve_audience(store, v3_store)
    counts = {k: len(v) for k, v in buckets.items()}
    _log(f"audience: {counts}")

    sent = failed = 0
    errors: list[str] = []
    cache: dict = {}
    for bucket in ("pro", "free", "landing"):
        for recipient in buckets[bucket]:
            res = _send_one(
                store, feed, target_date, bucket, recipient, dry_run, cache, verdicts
            )
            if res["ok"]:
                sent += 1
            else:
                failed += 1
                errors.append(f"{bucket}:{recipient['email']}: {res.get('error')}")
    return {
        "success": failed == 0 and sent > 0,
        "mode": "full",
        "date": target_date,
        "dry_run": dry_run,
        "audience": counts,
        "sent": sent,
        "failed": failed,
        "errors": errors[:20],
    }


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Send redesigned audience newsletters.")
    p.add_argument("--date", default="", help="YYYY-MM-DD feed date (defaults to today IST)")
    p.add_argument("--dry-run", action="store_true", help="Log recipients instead of sending")
    p.add_argument("--demo-email", default="", help="Send a single demo email to this address")
    p.add_argument(
        "--demo-bucket",
        choices=["", "pro", "free", "landing"],
        default="",
        help="Bucket for the demo email (default: pro)",
    )
    p.add_argument(
        "--interests",
        default="",
        help="Comma-separated interests for the demo (default: the profile's interests)",
    )
    p.add_argument(
        "--preview",
        action="store_true",
        help="Print the selected stories instead of sending anything",
    )
    p.add_argument(
        "--preview-bucket",
        choices=["", "pro", "free", "landing"],
        default="",
        help="Limit --preview to one bucket (default: all)",
    )
    p.add_argument(
        "--preview-interests",
        default="",
        help="Comma-separated interests for --preview (default: none/global)",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    result = send_audience_newsletter(
        date=args.date,
        dry_run=args.dry_run,
        demo_email=args.demo_email,
        demo_bucket=args.demo_bucket,
        demo_interests=args.interests,
        preview=args.preview,
        preview_bucket=args.preview_bucket,
        preview_interests=args.preview_interests,
    )
    print(json.dumps(result, indent=2))
    if not result.get("success"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
