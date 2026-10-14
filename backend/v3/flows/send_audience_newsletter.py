#!/usr/bin/env python3
"""Send the audience newsletters: member / winback / landing.

One email per person per day. Bucket precedence: member > winback > landing.
Trace is free for everyone; there are no paid tiers.

- member: onboarded accounts that are active (or got the daily recently),
  email on by default (only an explicit opt-out disables it) -> stories
  matched to their saved topics, 5/10/15 per their preferences (default 10).
- winback: dormant accounts, opt-in via NEWSLETTER_WINBACK=1 plus `winback`
  in EMAIL_BREVO_BUCKETS; capped per run, at most WINBACK_MAX_SENDS each.
- landing: email-only subscribers from the homepage form -> the day's
  biggest stories (global, not personalized).

Stories come from the 24h trending pool (v3_user_feeds/_global). Topics that
Jev flagged send_worthy=0 are dropped whenever verdicts exist. Story links
point at the app, never the publisher.
"""

from __future__ import annotations

import argparse
import hashlib
import uuid
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from urllib.parse import quote, urlparse

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")
# Local runs keep API keys in the gitignored .environment (same as the
# trending pipeline); the VPS exposes them through systemd.
load_dotenv(BACKEND_ROOT.parent / ".environment")

from google.cloud import firestore  # noqa: E402

from v1.storage import FirestoreStore, is_user_subscribed  # noqa: E402
from v1.tools.email_sender import send_newsletter_email  # noqa: E402
from v3.lib.send_worthy import (  # noqa: E402
    SEND_WORTHY_PROMPT_VERSION,
    judge_send_worthy,
)
from v3.lib.store import V3Store  # noqa: E402
from v3.build_trending import (  # noqa: E402
    RANKING_QUESTIONS,
    _looks_like_model_release,
    _topic_tokens,
)

# Self-hosters set TRACE_APP_URL; every link in the email is built from it.
APP_URL = (os.getenv("TRACE_APP_URL") or "https://yourtrace.online").rstrip("/")
LANDING_COUNT = 10
MEMBER_COUNT = 10

# Readers build their own brief in the app (frontend/lib/newsletter-prefs.ts
# mirrors these): how many stories, which lanes, and summaries or headlines.
STORY_COUNT_CHOICES = (5, 10, 15)
FORMAT_CHOICES = ("summaries", "headlines", "images")

# Trace is free: every account reader is a "member" and gets the full edition.
# Dormant accounts get a short win-back run instead of the daily ("winback").
# Both share the member layout; landing subscribers keep the short edition.
WINBACK_MAX_SENDS = 3
WINBACK_GAP_DAYS = 4
WINBACK_DAILY_CAP_DEFAULT = 250
# Someone who got the daily inside this window stays on it, even if the app
# never stamped them active (lastActiveAt was not written Sep 4 – Oct 12).
MEMBER_CONTINUITY_DAYS = 7

# Selection priority: AI, markets, tech, design, startups, then other lanes.
# Per-bucket slots give the leading lanes the biggest shares.
LANE_ORDER = (
    "ai", "markets", "tech", "ux-design", "startups", "engineering",
    "products", "the-world",
)
LANE_PATTERN = {
    "member": (3, 2, 2, 1, 1, 1),
    "winback": (3, 2, 2, 1, 1, 1),
    "landing": (2, 1, 1),
}

# Subject/headline: "<count> big things today <emoji>", emoji rotating daily.
def _headline(story_count: int) -> str:
    return f"{story_count} big things today"

SUBJECT_EMOJIS = ("\U0001f62e", "\U0001f525", "\U0001f680", "\U0001f440", "\U0001f9e0",
                  "\u26a1", "\u2728", "\U0001f973", "\U0001f37f", "\U0001f92f")

# Launches get their own heading at the top of the email, ahead of the lane
# pattern. Slots come out of the same total story count.
MODEL_RELEASE_LANE = "model-releases"
MODEL_RELEASE_SLOTS = {"member": 2, "winback": 2, "landing": 1}

# Sort only the finished full-edition sections; LANE_ORDER controls selection.
FULL_DISPLAY_ORDER = (
    MODEL_RELEASE_LANE, "ai", "markets", "startups", "tech", "ux-design",
)

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
    "products": "Products",
    "the-world": "World",
}

BUCKETS = {
    "landing": {
        "count": LANDING_COUNT,
        "intro": (
            "You signed up on Trace with this email. Here is what moved the "
            "needle in tech, nothing else."
        ),
    },
    "member": {
        "count": MEMBER_COUNT,
        "intro": (
            "The complete picture for your interests, ranked from everything "
            "that moved in the last 24 hours."
        ),
    },
    "winback": {
        "count": MEMBER_COUNT,
        # Leads the subject line: the news is the reason to open this one.
        "subject_lead": "Everything in Trace is unlocked",
        "intro": (
            "Every story, Pulse, and the full archive are now included for "
            "everyone. Trace is free and open source. Here is what moved in "
            "tech today, matched to the topics you picked."
        ),
    },
}


# Readers who may not be able to sign in to manage settings get a one-click
# unsubscribe link instead (it also clears the profile flags).
UNSUBSCRIBE_LINK_BUCKETS = ("landing", "winback")


def _today_ist() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


def _display_date(date: str) -> str:
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%B %d")
    except ValueError:
        return date


def _load_template(name: str) -> str:
    path = BACKEND_ROOT / "v1" / "templates" / name
    if not path.exists():
        raise FileNotFoundError(f"Template not found: {path}")
    # Templates carry the hosted URL; point them at this deployment.
    return path.read_text().replace("https://yourtrace.online", APP_URL)


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


NON_IMAGE_RE = re.compile(r"\.(avi|mp4|m4v|mov|webm|m3u8|mpd)(\?|#|$)", re.IGNORECASE)


def _image(*items: dict) -> str:
    """First usable https thumbnail among the given feed items, or ""."""
    for item in items:
        url = str((item or {}).get("thumbnail") or "").strip()
        # Some feeds put a video in the thumbnail slot; mail clients show those
        # as a broken box.
        if url.startswith("https://") and not NON_IMAGE_RE.search(url):
            return url
    return ""


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
            "image": _image(topic, hero, *articles),
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
            "image": _image(row),
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


def _same_event_summary(a: dict, b: dict) -> bool:
    """Match paraphrases only when they share a named event detail."""
    # ponytail: sparse paraphrases may survive; use stable event IDs if the feed gains them.
    def kind(title: str) -> str:
        if re.search(r"\b(jailbreak|vulnerability|breach|exploit|patch|hack)\w*\b", title, re.I):
            return "security"
        if re.search(r"\b(cancel|abandon|scrap|halt|ditch)\w*\b", title, re.I):
            return "cancellation"
        if re.search(r"\b(release|launch|unveil|introduc|ship|debut)\w*\b", title, re.I):
            return "launch"
        return ""

    kind_a, kind_b = kind(a["title"]), kind(b["title"])
    if kind_a and kind_b and kind_a != kind_b:
        return False

    def names(item: dict) -> set[str]:
        found: set[str] = set()
        for text in (item["title"], item.get("summary", "")[:250]):
            for match in re.finditer(r"\b(?:[A-Z][A-Za-z0-9.]*|[a-z]+[A-Z][A-Za-z0-9.]*)\b", text):
                prefix = text[:match.start()].rstrip()
                if prefix and not prefix.endswith((".", "!", "?")):
                    found.update(_topic_tokens(match.group()))
        lead = re.match(r"[a-z0-9]+", item["title"].lower())
        if lead:
            found.discard(lead.group())
        return found - {"model", "models", "safety", "security", "releases", "issues", "series"}

    shared_names = names(a) & names(b)
    lead_a = re.match(r"[a-z0-9]+", a["title"].lower())
    lead_b = re.match(r"[a-z0-9]+", b["title"].lower())
    same_lead = (lead_a and lead_b and lead_a.group() == lead_b.group()
                 and bool(_topic_tokens(lead_a.group())))
    title_a = _topic_tokens(a["title"])
    title_b = _topic_tokens(b["title"])
    def versions(item: dict) -> set[tuple[str, str]]:
        text = f"{item['title']} {item.get('summary', '')[:250]}"
        return {(name.lower(), number) for name, number in re.findall(
            r"\b([A-Za-z][A-Za-z0-9]*)[- ](\d+(?:\.\d+)*)\b", text
        )}

    same_round = (same_lead and "series" in title_a & title_b
                  and bool(set(re.findall(r"\d+(?:\.\d+)?", a["title"]))
                           & set(re.findall(r"\d+(?:\.\d+)?", b["title"]))))
    anchor = (shared_names & (title_a | title_b)
              or versions(a) & versions(b) or same_round)
    if not anchor:
        return False
    # Two distinctive names in both headlines ("Muse Wonder") is the same
    # event even when the summaries paraphrase too loosely to overlap.
    if len(shared_names & title_a & title_b) >= 2:
        return True
    tokens_a = _topic_tokens(f"{a['title']} {a.get('summary', '')[:250]}")
    tokens_b = _topic_tokens(f"{b['title']} {b.get('summary', '')[:250]}")
    shared = tokens_a & tokens_b
    return len(shared) >= 6 and len(shared) / min(len(tokens_a), len(tokens_b)) >= 0.25


def _story_groups(feed: dict, verdicts: dict[str, int] | None = None) -> list[dict]:
    """Merge candidates covering the same event into one story group.

    Uses exact titles plus a conservative named-event check for paraphrased
    headlines before allocating email slots. Verdict score 0 drops the group.
    """
    verdicts = verdicts or {}
    candidates = _candidates(feed)
    ranked = _ranked(candidates)

    groups: list[dict] = []
    for cand in ranked:
        target = next((group for group in groups if
                       cand["title"].casefold() == group["title"].casefold()
                       or _same_event_summary(cand, group)), None)
        if target is None:
            groups.append({
                **cand,
                "_verdicts": [verdicts.get(cand["topic_id"])],
            })
            continue
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
    return _select_from_groups(_story_groups(feed, verdicts), interests, count, bucket)


def _select_from_groups(
    groups: list[dict],
    interests: list[str],
    count: int,
    bucket: str,
) -> list[tuple[str, list[dict]]]:
    """The allocation half of _select, over already-merged story groups.

    frontend/lib/newsletter-select.ts is a line-for-line port used for the
    live preview in the newsletter builder; keep the two in step
    (v3/test_newsletter_parity.py checks them against each other).
    """
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
    if count <= 5:
        # A five-story brief cannot spend two of its slots on launches.
        release_slots = min(release_slots, 1)
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
    # Backfill can reopen a lane the pattern already used; one heading per
    # lane reads better than "Top in AI" twice.
    merged: dict[str, list[dict]] = {}
    for lane, stories in sections:
        merged.setdefault(lane, []).extend(stories)
    sections = list(merged.items())
    if bucket in ("member", "winback"):
        display_order = {
            lane: index for index, lane in enumerate(FULL_DISPLAY_ORDER)
        }
        sections.sort(
            key=lambda section: display_order.get(section[0], len(display_order))
        )
    return sections


# ---------------------------------------------------------------------------
# Audience resolution
# ---------------------------------------------------------------------------


def _email_enabled(profile: dict) -> bool:
    """Email is on by default for every bucket.

    An explicit opt-out always wins, whatever the bucket. The unsubscribe link
    and the List-Unsubscribe header both land in the same flags, and an
    unhonoured unsubscribe is what gets a sending IP filtered.
    """
    if "dailyNewsletterEnabled" in profile:
        return profile.get("dailyNewsletterEnabled") is True
    if "newsletterOptIn" in profile:
        return profile.get("newsletterOptIn") is True
    return True


def _parse_ts(value: Any) -> datetime | None:
    """Firestore timestamp, datetime, or ISO string → aware datetime."""
    if value is None or value == "":
        return None
    try:
        if isinstance(value, datetime):
            ts = value
        elif hasattr(value, "seconds"):
            ts = datetime.fromtimestamp(value.seconds, tz=timezone.utc)
        else:
            ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return None


def _last_active(profile: dict) -> datetime | None:
    return (
        _parse_ts(profile.get("lastActiveAt"))
        or _parse_ts(profile.get("updatedAt"))
        or _parse_ts(profile.get("onboardedAt"))
    )


def _recent_daily_recipients(store: FirestoreStore, since: str) -> set[str]:
    """Emails that got the daily (not a win-back) on or after `since`."""
    recipients: set[str] = set()
    docs = store.db.collection("email_sends").where("date", ">=", since).stream()
    for doc in docs:
        data = doc.to_dict() or {}
        # One-off emails (welcome, supporter thanks, the founder's post kit) are not the daily.
        if data.get("status") != "sent" or data.get("bucket") in ("winback", "test", "welcome", "supporter_thanks", "post_kit"):
            continue
        email = str(data.get("to", "")).strip().lower()
        if email:
            recipients.add(email)
    return recipients


# The lanes the pipeline publishes and the builder offers (newsletter-prefs.ts).
PICKABLE_LANES = ("ai", "markets", "tech", "ux-design", "startups")


def newsletter_prefs(profile: dict) -> dict:
    """The reader's own brief: lanes, story count, format (validated).

    Topics fall back to the feed interests, so nobody has to visit the
    builder to get a sensible email. A saved empty list means all topics.
    """
    topics = profile.get("newsletterTopics")
    if not isinstance(topics, list):
        topics = profile.get("interests", []) or []
    lanes: list[str] = []
    for topic in topics:
        lane = str(topic).strip().lower()
        # Only the lanes the builder offers, so its preview stays exact.
        if lane in PICKABLE_LANES and lane not in lanes:
            lanes.append(lane)
    try:
        count = int(profile.get("newsletterStoryCount") or MEMBER_COUNT)
    except (TypeError, ValueError):
        count = MEMBER_COUNT
    if count not in STORY_COUNT_CHOICES:
        count = MEMBER_COUNT
    story_format = str(profile.get("newsletterFormat") or "summaries")
    if story_format not in FORMAT_CHOICES:
        story_format = "summaries"
    return {"interests": lanes, "count": count, "format": story_format}


def winback_enabled() -> tuple[bool, str]:
    """Win-back sends are opt-in and must ride Brevo.

    Mailing hundreds of cold addresses from our own, still-warming MTA is how
    it gets filtered, so the run refuses unless Brevo is the route for the
    bucket. Returns (enabled, reason when not).
    """
    if (os.getenv("NEWSLETTER_WINBACK", "") or "").strip() != "1":
        return False, "NEWSLETTER_WINBACK is not 1"
    buckets = {
        part.strip().lower()
        for part in (os.getenv("EMAIL_BREVO_BUCKETS", "") or "").split(",")
    }
    if "winback" not in buckets:
        return False, "winback is not in EMAIL_BREVO_BUCKETS (refusing to send cold mail from our MTA)"
    return True, ""


def _winback_due(profile: dict, now: datetime) -> bool:
    if int(profile.get("winbackSends") or 0) >= WINBACK_MAX_SENDS:
        return False
    last = _parse_ts(profile.get("winbackLastSentAt"))
    return last is None or now - last >= timedelta(days=WINBACK_GAP_DAYS)


# Anyone who ever paid, including after their subscription is cancelled now
# that Trace is free: supporters keep the daily without having to come back.
SUPPORTER_STATUSES = {"active", "trial", "on_hold", "cancelled", "expired"}


def _supporter(profile: dict) -> bool:
    if is_user_subscribed(profile):
        return True
    return any(
        str(profile.get(field) or "") in SUPPORTER_STATUSES
        for field in ("subscriptionStatus", "appSubscriptionStatus")
    )


def _audience_profiles(store: FirestoreStore, v3_store) -> list[dict]:
    """Onboarded accounts, plus anyone who turned the daily on in the
    newsletter builder before finishing onboarding (signed in from
    /brief/customize and saved), who would otherwise never get it."""
    profiles = list(v3_store.get_onboarded_users("all", max_inactive_days=0))
    seen = {str(p.get("uid", "")) for p in profiles}
    try:
        docs = store.db.collection("user_profiles").where(
            "dailyNewsletterEnabled", "==", True
        ).stream()
    except Exception as exc:  # noqa: BLE001 - audience must still resolve
        _log(f"builder-only profiles skipped: {exc}")
        return profiles
    for doc in docs:
        if doc.id in seen:
            continue
        seen.add(doc.id)
        profiles.append({"uid": doc.id, **(doc.to_dict() or {})})
    return profiles


def _resolve_audience(store: FirestoreStore, v3_store: V3Store) -> dict:
    """Split readers into member (daily), winback (dormant) and landing.

    Member: an onboarded account that was active inside the window, is still
    paying out a subscription, or already gets the daily (continuity, so going
    free never silently drops a current reader). Everyone else with email on
    is dormant and, when enabled, gets at most WINBACK_MAX_SENDS win-back
    emails, most recently active first, capped per day. Opening the feed
    stamps lastActiveAt, which makes them a member the next morning.
    """
    buckets: dict[str, list[dict]] = {"member": [], "winback": [], "landing": []}
    profile_emails: set[str] = set()
    now = datetime.now(timezone.utc)
    active_cutoff = now - timedelta(days=MEMBER_CONTINUITY_DAYS)
    continuing = _recent_daily_recipients(
        store, (now - timedelta(days=MEMBER_CONTINUITY_DAYS)).strftime("%Y-%m-%d")
    )
    winback_on, winback_reason = winback_enabled()
    if not winback_on:
        _log(f"win-back off: {winback_reason}")
    try:
        cap = int(os.getenv("NEWSLETTER_WINBACK_DAILY_CAP", "") or WINBACK_DAILY_CAP_DEFAULT)
    except ValueError:
        cap = WINBACK_DAILY_CAP_DEFAULT

    dormant: list[tuple[datetime, dict]] = []
    for profile in _audience_profiles(store, v3_store):
        email = str(profile.get("email", "")).strip().lower()
        if not email or email in profile_emails or profile.get("deleted") is True:
            continue
        if not _email_enabled(profile):
            continue
        prefs = newsletter_prefs(profile)
        name = str(profile.get("name", "")).strip() or str(
            profile.get("displayName", "")
        ).strip()
        recipient = {
            "uid": str(profile.get("uid", "") or profile.get("id", "")),
            "email": email,
            "name": name,
            **prefs,
        }
        profile_emails.add(email)
        last = _last_active(profile)
        if (
            _supporter(profile)
            or email in continuing
            or (last is not None and last >= active_cutoff)
        ):
            buckets["member"].append(recipient)
        elif winback_on and _winback_due(profile, now):
            recipient["winback_sends"] = int(profile.get("winbackSends") or 0)
            dormant.append((last or datetime.min.replace(tzinfo=timezone.utc), recipient))

    dormant.sort(key=lambda item: item[0], reverse=True)
    buckets["winback"] = [recipient for _, recipient in dormant[:max(cap, 0)]]
    # A dormant account that also joined from the landing page and was not
    # picked for win-back today still gets the landing edition, as before.
    seen_emails = {r["email"] for r in buckets["member"] + buckets["winback"]}

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
        'width="16" height="16" alt="" style="display: inline-block; border-radius: 50%; '
        'border: 1px solid #eff3f4; vertical-align: middle; margin-right: 3px;" />'
        for d in sources[:3]
    )
    return f'<span style="white-space: nowrap;">{icons}</span>'


def _clean_summary(text: str) -> str:
    """Collapse whitespace. Summaries are always published in full."""
    return re.sub(r"\s+", " ", text or "").strip()


_ABBR_DOT = "\u2024"  # stands in for a non-sentence period while splitting


def _u16(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def _sentences(text: str) -> list[str]:
    """A summary's sentences; abbreviations (U.S., 5.1, initials) never split."""
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return []
    clean = re.sub(
        r"\b(U\.S|U\.K|E\.U|U\.N|Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e)\.",
        lambda m: m.group(0).replace(".", _ABBR_DOT), clean, flags=re.I,
    )
    clean = re.sub(r"\b([A-Z])\.", lambda m: m.group(1) + _ABBR_DOT, clean)
    clean = re.sub(r"(\d)\.(\d)", lambda m: m.group(1) + _ABBR_DOT + m.group(2), clean)
    found = re.findall(r"[^.!?]+[.!?]+[\"')\]]*|[^.!?]+$", clean) or [clean]
    return [s.strip().replace(_ABBR_DOT, ".") for s in found if s.strip()]


def _paragraphs(text: str) -> list[str]:
    """Split a summary into short paragraphs, like the feed's story view.

    Port of bodyParagraphs (frontend/lib/body-text.ts): sentences grouped up
    to ~38 words / 230 chars, abbreviations (U.S., 5.1, initials) never split.
    Keep the two in step so the builder preview matches the email.
    """
    paras: list[str] = []
    cur = ""
    for t in _sentences(text):
        cur_words = len(cur.split()) if cur else 0
        # Lengths in UTF-16 units, as JavaScript counts them (emoji count twice).
        if cur and (cur_words + len(t.split()) > 38 or _u16(cur) + _u16(t) > 230):
            paras.append(cur)
            cur = t
        else:
            cur = (cur + " " + t).strip()
    if cur:
        paras.append(cur)
    whole = re.sub(r"\s+", " ", text or "").strip()
    return paras if len(paras) > 1 else ([whole] if whole else [])


def _app_link(story: dict) -> str:
    """Where an emailed story's title points: the story in the app.

    Topic ids are recomputed on every trending rebuild (sha of cluster urls),
    so an emailed tt_… link is dead within half an hour. The article URL is
    stable and the app resolves stories by it.
    """
    return f"{APP_URL}/feed?from=email&story={quote(story['url'], safe='')}"


def _story_html(story: dict, show_summary: bool = True, show_image: bool = False) -> str:
    title = escape(story["title"])
    app_link = _app_link(story)
    image_url = str(story.get("image") or "") if show_image else ""
    original = escape(story["url"])
    # The feed's story layout: byline, title, full summary, inset image.
    image = (
        f'<a href="{original}" style="display: block; margin: 14px 0 0 0; text-decoration: none;">'
        f'<img src="{escape(image_url)}" alt="" width="568" '
        'style="display: block; width: 100%; max-width: 568px; height: auto; '
        'border: 0; border-radius: 16px;" /></a>'
    ) if image_url.startswith("https://") else ""
    favicon = _favicon_stack(story["sources"])
    count_word = "source" if story["source_count"] == 1 else "sources"
    source = escape(story["source_name"])
    byline = (
        f'<p style="margin: 0 0 8px 0; font-size: 14px; color: #71767b; font-family: {_FONT};">'
        f'{favicon}<a href="{original}" style="color: #0f1419; font-weight: 700; '
        f'text-decoration: none;">{source}</a>'
        + (f'&nbsp;&middot;&nbsp;{story["source_count"]} {count_word}'
           if int(story.get("source_count") or 1) > 1 else "")
        + "</p>"
    ) if source else ""
    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin: 0 0 4px 0;">'
        "<tr>"
        '<td style="padding: 18px 0 0 0; vertical-align: top;">'
        + byline
        + f'<a href="{app_link}" style="display: block; margin: 0; font-size: 20px; '
        f'font-weight: 700; letter-spacing: -0.01em; line-height: 26px; color: #0f1419; '
        f'text-decoration: none; font-family: {_FONT};">{title}</a>'
        + "".join(
            f'<p style="margin: {10 if index == 0 else 12}px 0 0 0; font-size: 16px; color: #0f1419; '
            f'line-height: 25px; font-family: {_FONT};">{escape(para)}</p>'
            for index, para in enumerate(_paragraphs(story["summary"]) if show_summary else [])
        )
        + image
        + "</td>"
        "</tr>"
        '<tr><td style="padding: 18px 0 0 0;">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
        '<td height="1" style="height: 1px; line-height: 1px; font-size: 1px; '
        'background-color: #eff3f4;">&nbsp;</td>'
        "</tr></table></td></tr>"
        "</table>"
    )


def _section_body(
    label: str, stories: list[dict], show_summary: bool = True, show_image: bool = False,
) -> str:
    kicker = (
        '<p style="margin: 0 0 2px 0; font-size: 12px; color: #f91880; '
        f'font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; '
        f'font-family: {_FONT};">'
        f"&#9733; {escape(label)}</p>"
    )
    return kicker + "".join(
        _story_html(story, show_summary, show_image) for story in stories
    )


def _sections_html(
    bucket: str,
    sections: list[tuple[str, list[dict]]],
    show_summary: bool = True,
    show_image: bool = False,
) -> str:
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
            label = f"Top in {INTEREST_LABELS[lane]}" if lane in INTEREST_LABELS else "More stories"
        top = 18 if index == 0 else 22
        rows.append(
            f'<tr><td class="nl-p28" style="padding: {top}px 28px 0 28px;">'
            f"{_section_body(label, stories, show_summary, show_image)}"
            "</td></tr>"
        )
    return "".join(rows)


def _cta_html(bucket: str) -> str:
    base = f"height: 46px; line-height: 46px; border-radius: 999px; font-size: 15px; font-weight: 700; text-decoration: none; font-family: {_FONT};"
    if bucket == "member":
        return ""
    if bucket == "winback":
        title = "Your feed is still here."
        body = (
            "Everything is unlocked now: every story, Pulse, and the archive. "
            "No plan, no trial, nothing to pay."
        )
        label = "Open my feed"
    else:
        title = "Make tomorrow&rsquo;s brief yours."
        body = (
            "Create a free account to pick your topics, how many stories "
            "you get, and how you read them."
        )
        label = "Personalize it"
    return (
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color: #f7f9f9; border-radius: 16px;">'
        '<tr><td align="center" style="padding: 22px 24px;">'
        '<p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0f1419; '
        f'font-family: {_FONT};">{title}</p>'
        '<p style="margin: 0 0 14px 0; font-size: 13.5px; color: #536471; line-height: 1.6; '
        f'font-family: {_FONT};">{body}</p>'
        f'<a href="{APP_URL}/feed?from=email" style="display: inline-block; padding: 0 28px; '
        f'background-color: #1d9bf0; color: #ffffff; {base}">{label}</a>'
        "</td></tr></table>"
    )


RATINGS = (
    (5, "\u2605\u2605\u2605\u2605\u2605", "Absolutely Loved It"),
    (4, "\u2605\u2605\u2605\u2605", "Better Than Usual"),
    (3, "\u2605\u2605\u2605", "Meh, It Was Okay"),
    (2, "\u2605\u2605", "Could Be Better"),
)


def _feedback_html(bucket: str, email: str, date: str) -> str:
    # Percent-encode first: a raw "+" in a query string decodes to a space.
    email_esc = escape(quote(email, safe=''))
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
        f"{APP_URL}/api/unsubscribe?email={email_esc}" if bucket in UNSUBSCRIBE_LINK_BUCKETS
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



def _instrument_tracking(html: str, track_id: str) -> str:
    """Route our own links through the tracker and append the open pixel.

    Set EMAIL_TRACKING=0 to send the plain email instead. Links that are
    themselves an action (unsubscribe, manage settings) are left alone so we
    do not add a hop or a second counting path.
    """
    if not track_id or os.getenv("EMAIL_TRACKING", "1").strip() == "0":
        return html

    def _wrap(match: "re.Match[str]") -> str:
        url = match.group(1)
        if "/api/unsubscribe" in url or "tab=profile" in url:
            return match.group(0)
        tracked = (
            f"{APP_URL}/api/email/track?e=c&t={track_id}&u={quote(url, safe='')}"
        )
        return match.group(0).replace(url, tracked)

    html = re.sub(rf'href="({re.escape(APP_URL)}[^"]*)"', _wrap, html)
    pixel = (
        f'<img src="{APP_URL}/api/email/track?e=o&t={track_id}" width="1" height="1" '
        'alt="" style="display:block;width:1px;height:1px;border:0;" />'
    )
    if "</body>" in html:
        return html.replace("</body>", f"{pixel}</body>")
    return html + pixel


def _render(
    bucket: str,
    sections: list[tuple[str, list[dict]]],
    date: str,
    email: str = "",
    track_id: str = "",
    story_format: str = "summaries",
) -> tuple[str, str, str]:
    cfg = BUCKETS[bucket]
    story_count = sum(len(group) for _, group in sections)
    headline = f"{_headline(story_count)} {_daily_emoji(date)}"
    subject = f"{headline} · {_display_date(date)}"
    if cfg.get("subject_lead"):
        subject = f"{cfg['subject_lead']} · {headline}"
    html = _load_template("audience_newsletter.html")
    html = html.replace("{{SUBJECT}}", escape(subject))
    html = html.replace("{{DATE}}", escape(_display_date(date)))
    html = html.replace("{{HEADLINE}}", escape(headline))
    html = html.replace("{{INTRO}}", escape(cfg["intro"]))
    show_summary = story_format != "headlines"
    show_image = story_format == "images"
    html = html.replace(
        "{{SECTIONS_HTML}}", _sections_html(bucket, sections, show_summary, show_image)
    )
    html = _replace_block(html, "CTA", _cta_html(bucket))
    # Feedback block is intentionally hidden for now; the renderer stays in
    # place so it can be switched on with one line.
    html = _replace_block(html, "FEEDBACK", "")

    share = (
        f'<a href="{_share_url(date)}" style="color: #1d9bf0; font-weight: 700; '
        'text-decoration: none;">Share today&rsquo;s brief</a>'
        "<span style=\"color: #cfd9de;\">&nbsp;&middot;&nbsp;</span>"
    )
    dot = "<span style=\"color: #cfd9de;\">&nbsp;&middot;&nbsp;</span>"
    # Topics, length and format live in the builder; it also has the on/off.
    customize = (
        f'<a href="{APP_URL}/brief/customize?from=email" style="color: #1d9bf0; font-weight: 700; '
        'text-decoration: none;">Customize your brief</a>'
    )
    if bucket in UNSUBSCRIBE_LINK_BUCKETS:
        footer = share + customize + dot + (
            f'<a href="{APP_URL}/api/unsubscribe?email={escape(quote(email, safe=""))}" '
            'style="color: #71767b; text-decoration: underline;">Unsubscribe</a>'
        )
    else:
        footer = share + customize + dot + (
            f'<a href="{APP_URL}/feed?tab=profile" style="color: #71767b; text-decoration: underline;">'
            "Email settings</a>"
        )
    html = html.replace("{{FOOTER_LINKS}}", footer)
    html = _instrument_tracking(html, track_id)
    text = _text_version(_headline(story_count), sections, date, show_summary)
    return subject, html, text


def _share_url(date: str) -> str:
    """Public web copy of the day's brief: the thing readers forward."""
    return f"{APP_URL}/brief/{date}?from=email-share"


def _text_version(
    headline: str,
    sections: list[tuple[str, list[dict]]],
    date: str = "",
    show_summary: bool = True,
) -> str:
    lines = ["TRACE", headline, ""]
    for _, stories in sections:
        for story in stories:
            lines.append(story["title"])
            if show_summary and story.get("summary"):
                lines.extend(f"   {para}" for para in _paragraphs(story["summary"]))
            count = int(story.get("source_count") or 1)
            lines.append(
                f"   {story['source_name']}"
                + (f" · {count} sources" if count > 1 else "")
            )
            lines.append(f"   {story['url']}")
            lines.append("")
    if date:
        lines.append(f"Share today's brief: {_share_url(date)}")
    lines.append(f"Customize your brief: {APP_URL}/brief/customize?from=email")
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


EDITIONS_COLLECTION = "daily_editions"


def _record_winback(store: FirestoreStore, recipient: dict) -> None:
    """Count the win-back send so the run stops after WINBACK_MAX_SENDS."""
    uid = recipient.get("uid")
    if not uid:
        return
    try:
        store.db.collection("user_profiles").document(uid).set(
            {
                "winbackSends": int(recipient.get("winback_sends") or 0) + 1,
                "winbackLastSentAt": datetime.now(timezone.utc).isoformat(),
            },
            merge=True,
        )
    except Exception as exc:  # noqa: BLE001 - a failed stamp must not stop the run
        _log(f"win-back stamp failed for {uid}: {exc}")


POOL_FIELDS = (
    "topic_id", "title", "summary", "url", "source_name", "image", "sources",
    "source_count", "coverage", "interest_id", "macro", "model_release",
    "send_worthy",
)


def _web_story(story: dict, lane: str) -> dict:
    return {
        "title": story["title"],
        "summary": _clean_summary(story.get("summary", "")),
        "url": story["url"],
        "source_name": story.get("source_name", ""),
        "image": story.get("image", ""),
        "sources": list(story.get("sources") or [])[:4],
        "source_count": int(story.get("source_count") or 1),
        "lane": lane,
        "model_release": bool(story.get("model_release")),
    }


def _publish_edition(
    store: FirestoreStore,
    feed: dict,
    date: str,
    verdicts: dict[str, int] | None,
) -> int:
    """Save the day's brief for the public /brief pages and the builder.

    `stories` is the landing selection (no interests), exactly what a new
    subscriber receives. `pool` is every merged story group the selection
    chose from, so the newsletter builder can preview any combination of
    lanes and counts with the same allocation (newsletter-select.ts).
    Returns the story count.
    """
    groups = _story_groups(feed, verdicts)
    sections = _select_from_groups(groups, [], BUCKETS["landing"]["count"], "landing")
    stories = [_web_story(story, lane) for lane, group in sections for story in group]
    if not stories:
        return 0
    pool = [
        {
            **{field: group.get(field) for field in POOL_FIELDS},
            "summary": _clean_summary(group.get("summary", "")),
            "sources": list(group.get("sources") or [])[:4],
        }
        for group in groups
    ]
    headline = f"{_headline(len(stories))} {_daily_emoji(date)}"
    store.db.collection(EDITIONS_COLLECTION).document(date).set({
        "date": date,
        "headline": headline,
        "subject": f"{headline} · {_display_date(date)}",
        "stories": stories,
        "story_count": len(stories),
        "pool": pool,
        "published_at": datetime.now(timezone.utc).isoformat(),
    })
    return len(stories)


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
    count = int(recipient.get("count") or BUCKETS[bucket]["count"])
    key = (bucket, interests, count)
    if key not in cache:
        cache[key] = _select(feed, list(interests), count, bucket, verdicts)
    sections = cache[key]
    stories = [s for _, group in sections for s in group]
    if not stories:
        return {"ok": False, "error": "no stories selected"}
    if len(stories) < count:
        _log(
            f"only {len(stories)}/{count} stories for "
            f"{recipient['email']} (interests={list(interests)})"
        )

    # Mint the tracking id before rendering so the pixel and the wrapped
    # links carry the same id the send log will record.
    track_id = uuid.uuid4().hex
    subject, html, text = _render(
        bucket, sections, date, recipient["email"], track_id,
        story_format=recipient.get("format") or "summaries",
    )
    if dry_run:
        _log(f"[dry-run] {bucket} -> {recipient['email']} | {subject}")
        return {"ok": True}

    res = send_newsletter_email(
        to_email=recipient["email"],
        to_name=recipient.get("name") or None,
        subject=subject,
        html_content=html,
        text_content=text,
        bucket=bucket,
        track_id=track_id,
        list_unsubscribe=(
            f"{APP_URL}/api/unsubscribe?email={quote(recipient['email'], safe='')}"
            if bucket in UNSUBSCRIBE_LINK_BUCKETS
            else f"{APP_URL}/feed?tab=profile"
        ),
    )
    if res.get("success"):
        transport = res.get("transport", "brevo")
        _log(f"sent {bucket} email to {recipient['email']} via {transport}")
        return {"ok": True, "transport": transport}
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
    publish_only: bool = False,
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
        for bucket in ([preview_bucket] if preview_bucket else ["member", "winback", "landing"]):
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
        bucket = demo_bucket or "member"
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
                # The reader's own brief (topics, length, format), as the daily sends it.
                prefs = newsletter_prefs(profile)
                interests = prefs["interests"]
                recipient = {
                    "uid": doc.id,
                    "email": demo_email.strip().lower(),
                    "name": str(profile.get("name", "")).strip(),
                    "interests": interests,
                    "count": prefs["count"],
                    "format": prefs["format"],
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

    if publish_only or not dry_run:
        # Publish before sending so every "Share today's brief" link resolves
        # the moment the first email lands. A failure here must not cost the send.
        try:
            published = _publish_edition(store, feed, target_date, verdicts)
            _log(f"published {EDITIONS_COLLECTION}/{target_date} ({published} stories)")
        except Exception as exc:  # noqa: BLE001
            published = 0
            _log(f"publishing {EDITIONS_COLLECTION}/{target_date} failed: {exc}")
        if publish_only:
            return {
                "success": published > 0,
                "mode": "publish",
                "date": target_date,
                "stories": published,
            }

    buckets = _resolve_audience(store, v3_store)
    counts = {k: len(v) for k, v in buckets.items()}
    _log(f"audience: {counts}")

    sent = failed = 0
    errors: list[str] = []
    cache: dict = {}
    transports: dict[str, int] = {}
    for bucket in ("member", "winback", "landing"):
        for recipient in buckets[bucket]:
            res = _send_one(
                store, feed, target_date, bucket, recipient, dry_run, cache, verdicts
            )
            if res["ok"] and bucket == "winback" and not dry_run:
                _record_winback(store, recipient)
            if res["ok"]:
                sent += 1
                if res.get("transport"):
                    transports[res["transport"]] = transports.get(res["transport"], 0) + 1
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
        "transports": transports,
        "errors": errors[:20],
    }


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Send redesigned audience newsletters.")
    p.add_argument("--date", default="", help="YYYY-MM-DD feed date (defaults to today IST)")
    p.add_argument("--dry-run", action="store_true", help="Log recipients instead of sending")
    p.add_argument("--demo-email", default="", help="Send a single demo email to this address")
    p.add_argument(
        "--demo-bucket",
        choices=["", "member", "winback", "landing"],
        default="",
        help="Bucket for the demo email (default: member)",
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
        choices=["", "member", "winback", "landing"],
        default="",
        help="Limit --preview to one bucket (default: all)",
    )
    p.add_argument(
        "--preview-interests",
        default="",
        help="Comma-separated interests for --preview (default: none/global)",
    )
    p.add_argument(
        "--publish-only",
        action="store_true",
        help="Save the day's public web edition (/brief/<date>) without sending",
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
        publish_only=args.publish_only,
    )
    print(json.dumps(result, indent=2))
    if not result.get("success"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
