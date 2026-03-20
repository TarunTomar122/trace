#!/usr/bin/env python3
"""
Build "For You" feed — one shared community pulse per role.

Fetches one shared content pool from HN, Reddit, and editorial sources,
classifies items into the five product roles, and generates a Morning-Brew-style
brief once per role. The role pulses are stored globally and consumed by clients
based on the user's profile role.

Usage:
  python3 -m v3.build_for_you                          # full: fetch pool + build
  python3 -m v3.build_for_you --skip-pool             # build only (use cached pool)
  python3 -m v3.build_for_you --pool-only             # fetch pool only
  python3 -m v3.build_for_you --user-id <uid>         # single user
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import os
import re
import sys
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from v2.utils.fetch_article_links import fetch_article_links  # noqa: E402
from v3.lib.content import fetch_og_image  # noqa: E402
from v3.lib.store import V3Store, _today_ist  # noqa: E402
from v1.tools.youtube_transcript import fetch_youtube_transcript  # noqa: E402

try:
    import yt_dlp  # type: ignore
except Exception:  # pragma: no cover - optional runtime dependency
    yt_dlp = None

CONFIG_PATH = "v3/config/for_you_sources.json"
BRIEF_SOURCES_PATH = "v3/config/brief_sources.json"
DEFAULT_ITEMS = 0
FOR_YOU_BRIEF_BUCKET = "for_you_brief_v21_top_stories"
FOR_YOU_BRIEF_MODEL = "gpt-5-mini"
FOR_YOU_ROLE_CLASSIFIER_BUCKET = "for_you_role_classifier_v1"
FOR_YOU_ROLE_CLASSIFIER_MODEL = "gpt-4.1-nano"
FOR_YOU_VIDEO_BUCKET = "for_you_video_v1"
FOR_YOU_VIDEO_MODEL = "gpt-4o-mini"
# gpt-5-mini is the default cost/quality tradeoff for daily personalized briefs.
FOR_YOU_VIDEO_CHANNEL_URL = "https://www.youtube.com/@CNET/videos"
FOR_YOU_VIDEO_SCAN_LIMIT = 5

HN_TIMEOUT = 15
REDDIT_TIMEOUT = 15
RSS_LINK_LIMIT = 10
REDDIT_USER_AGENT = "TraceBrief/1.0"
RECENT_BRIEF_LOOKBACK_DAYS = 5
RECENT_ROLE_LOOKBACK_DAYS = 5

ROLE_ORDER = ["developer", "designer", "pm", "marketer", "founder"]

ROLE_FALLBACK_IMAGES = {
    "developer": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop",
    "designer": "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=500&fit=crop",
    "pm": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
    "marketer": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop",
    "founder": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=500&fit=crop",
}

ROLE_LABELS = {
    "developer": "engineer",
    "designer": "designer",
    "pm": "product manager",
    "marketer": "marketer",
    "founder": "founder",
}

ROLE_ALIASES = {
    "developer": "developer",
    "engineer": "developer",
    "software engineer": "developer",
    "software developer": "developer",
    "full stack developer": "developer",
    "full-stack developer": "developer",
    "frontend engineer": "developer",
    "backend engineer": "developer",
    "designer": "designer",
    "product designer": "designer",
    "ux designer": "designer",
    "ui designer": "designer",
    "product manager": "pm",
    "pm": "pm",
    "marketer": "marketer",
    "marketing": "marketer",
    "growth marketer": "marketer",
    "creator": "marketer",
    "founder": "founder",
    "co-founder": "founder",
    "startup founder": "founder",
    "data scientist": "developer",
}

ROLE_FEED_INTEREST = {
    "developer": "engineering",
    "designer": "experience",
    "pm": "business-market",
    "marketer": "marketing",
    "founder": "startups",
}

ROLE_KEYWORDS = {
    "developer": {
        "api", "sdk", "cli", "database", "infra", "infrastructure", "devops",
        "open source", "github", "repository", "framework", "javascript",
        "typescript", "python", "rust", "go", "compiler", "agent", "llm",
        "model", "terminal", "backend", "frontend", "cloud", "kubernetes",
        "show hn", "hacker news", "release", "programming",
    },
    "designer": {
        "figma", "ux", "ui", "design system", "design systems", "typography",
        "prototype", "prototyping", "accessibility", "visual", "layout",
        "interaction", "interaction design", "product design", "wireframe",
        "component library", "brand", "creative", "motion",
    },
    "pm": {
        "product", "roadmap", "prioritization", "retention", "onboarding",
        "user research", "experiment", "conversion", "launch", "feature",
        "product management", "metrics", "activation", "customer feedback",
    },
    "marketer": {
        "seo", "growth", "campaign", "ads", "advertising", "distribution",
        "positioning", "brand", "content marketing", "landing page",
        "acquisition", "newsletter", "copywriting", "social", "funnel",
        "attribution", "conversion rate",
    },
    "founder": {
        "startup", "startups", "saas", "pricing", "fundraising", "venture",
        "founder", "cofounder", "go-to-market", "gtm", "sales", "mrr",
        "acquisition", "market", "competition", "seed", "series a",
        "product-market fit", "pmf",
    },
}

GOAL_LABELS = {
    "get-promoted": "get promoted",
    "switch-careers": "switch careers",
    "build-something": "build something",
    "lead-team": "lead a team",
    "stay-sharp": "stay sharp",
    "grow-network": "grow my network",
}

ROLE_FOCUS = {
    "developer": "Focus on: cool new tools, HN drama, GitHub projects blowing up, infra shifts, AI/agent stuff, and things that make engineers go 'oh that's clever.'",
    "founder": "Focus on: what's changing in distribution, AI product wedges, startup tactics, competition moves, and things that help you build smarter or move faster.",
    "designer": "Focus on: design systems, product craft, AI in the design workflow, tools that are changing how things get built, and things that make designers more dangerous.",
    "pm": "Focus on: product strategy, new product patterns, execution tricks, user insights, and things that sharpen product sense.",
    "marketer": "Focus on: growth channels, positioning shifts, distribution plays, and concrete tactics that are actually working right now.",
}

ROLE_COMMUNITY_RULE = {
    "developer": "If the list contains substantive Hacker News or Reddit posts, include at least 2 community-driven picks.",
    "founder": "If the list contains substantive community posts, include at least 2 community-driven picks.",
    "designer": "If the list contains substantive Reddit/community posts, include 1-2 community-driven picks in the final brief, but keep at least 2 editorial picks. Avoid generic critique requests, inspiration dumps, and low-context 'what do you think/how can I improve this' posts.",
    "pm": "If the list contains substantive Reddit/community posts, include at least 1 community-driven pick in the final brief.",
    "marketer": "If the list contains substantive Reddit/community posts, include at least 1 community-driven pick in the final brief.",
}

PROMPT = """You're writing {name}'s morning brief. Think Morning Brew meets group chat — chill, fun, smart, zero fluff.

Today is {today}.

{name} is an {role} trying to {goal}.
Interests: {interests}.
{role_focus}
{community_rule}

Here are today's top stories and posts from sources relevant to {name}. First act like an editor: ignore low-signal career venting, resume/job angst, beginner asks, or generic complaints unless they contain a very concrete workflow, tool, or debate. Then pick the 5-6 most interesting items and write a brief about them.

Source balance:
- Aim for roughly 75% community-driven signal and 25% editorial grounding.
- In practice, for a 5-6 beat brief, that usually means 3-4 beats from community sources (Reddit/Hacker News) and 1-2 beats from editorial sources.
- Do not make the brief all editorial unless the list truly forces you to.
- Do not make the brief all community unless the list truly forces you to.
- Use editorial sources to sharpen or validate the strongest community ideas, not to drown them out.

---
{articles_block}
---

Tone:
- Conversational. Like a smart friend who's already scrolled through everything and is giving you the highlights over coffee.
- Light humor is good. Don't force it, but don't be a robot either.
- Confident and opinionated. Have a take. "This is cool because..." not "This may be relevant to..."
- Short punchy paragraphs. 2-3 sentences max per paragraph. White space is your friend.
- Talk TO {name}, not AT them. No lectures, no "lesson worth learning" energy.

Structure — this is important, follow it closely:
- Each beat MUST start with a ## header. The header should be short, catchy, Morning Brew style (e.g. "## Cloudflare said hold my beer", "## The AI brain fry is real", "## Your new favorite CLI tool"). Make them fun and specific.
- Under each ## header, write 1-2 short paragraphs about that beat.
- Use **bold** on the first mention of key names, tools, or projects in each beat (e.g. "**vinext**", "**Show HN**", "**GPT-5**"). Don't overdo it — 1-2 bold terms per beat max.
- 5-6 beats total, each with its own ## header.
- End with a short closing line after the last beat (no header needed for the closing).

Do NOT:
- Write "lesson worth learning" or "key takeaway" or anything that sounds like a LinkedIn post
- Use corporate speak or analyst tone
- Put URLs or (source.com) citations in the body text
- Write dense paragraphs — if a paragraph is more than 3 sentences, break it up
- Be generic. Be specific about names, projects, numbers
- Skip the ## headers. Every beat needs one.
- Invent or hallucinate stories. Only use articles from the list above.
- Build the whole brief from one source type only if the list truly forces you to. Mix community and editorial signal when possible.

Do:
- Name-drop specific projects, tools, posts, people from the articles
- Have a point of view on why something matters
- Make it feel like {name} is ahead of the curve after reading this
- Use at least 4 distinct sources from the list
- Use **bold** to make key terms pop
- You can combine related articles into one beat if they tell a bigger story together
- Prefer concrete workflows, launches, case studies, tools, or debates with substance over vague discussion posts.
- If a Reddit or HN post is selected, make sure the reason is obvious from the brief itself.

Important: put the source reference RIGHT AFTER each beat using source numbers only, using this exact format:
→ [3]
or
→ [3, 7]

The numbers must refer to the numbered source list above. Do not write or invent URLs yourself.
Do NOT put a separate ## Sources section at the bottom. Sources go inline, right after the beat that uses them.

Return markdown only in this format:
# Your daily brief

subtitle — one punchy line that makes you want to keep reading

## catchy beat header
1-2 short paragraphs with **bold** key terms
→ [3]

## another catchy beat header
1-2 short paragraphs with **bold** key terms
→ [7, 9]

## one more catchy beat header
1-2 short paragraphs with **bold** key terms
→ [2]

## one more catchy beat header
1-2 short paragraphs with **bold** key terms
→ [5]

## one more catchy beat header
1-2 short paragraphs with **bold** key terms
→ [11]

short closing line"""

ROLE_PROMPT = """You're writing one shared daily community pulse for a group of {role_plural}. Think Morning Brew meets group chat — chill, fun, smart, zero fluff.

Today is {today}.

Audience:
- Role: {role}
- Common goals: {goal}
- Common interests: {interests}
{role_focus}
{community_rule}

Here are today's top stories and posts from sources relevant to this audience. First act like an editor: ignore low-signal career venting, resume/job angst, beginner asks, or generic complaints unless they contain a very concrete workflow, tool, or debate. Then pick the 5-6 most interesting items and write a brief about them.

Source balance:
- Aim for roughly 75% community-driven signal and 25% editorial grounding.
- In practice, for a 5-6 beat brief, that usually means 3-4 beats from community sources (Reddit/Hacker News) and 1-2 beats from editorial sources.
- Do not make the brief all editorial unless the list truly forces you to.
- Do not make the brief all community unless the list truly forces you to.
- Use editorial sources to sharpen or validate the strongest community ideas, not to drown them out.

---
{articles_block}
---

Tone:
- Conversational. Like a smart friend who's already scrolled through everything and is giving the highlights over coffee.
- Light humor is good. Don't force it, but don't be a robot either.
- Confident and opinionated. Have a take. "This is cool because..." not "This may be relevant to..."
- Short punchy paragraphs. 2-3 sentences max per paragraph. White space is your friend.
- Talk to this audience, not at them. No lectures, no "lesson worth learning" energy.

Structure:
- Each beat MUST start with a ## header. The header should be short, catchy, Morning Brew style.
- Under each ## header, write 1-2 short paragraphs about that beat.
- Use **bold** on the first mention of key names, tools, or projects in each beat.
- 5-6 beats total, each with its own ## header.
- End with a short closing line after the last beat.

Do NOT:
- Write "lesson worth learning" or "key takeaway" or anything that sounds like a LinkedIn post
- Use corporate speak or analyst tone
- Put URLs or (source.com) citations in the body text
- Write dense paragraphs
- Be generic. Be specific about names, projects, numbers
- Invent or hallucinate stories. Only use articles from the list above.

Do:
- Name-drop specific projects, tools, posts, people from the articles
- Have a point of view on why something matters for this role
- Make it feel like this audience is ahead of the curve after reading this
- Use at least 4 distinct sources from the list
- You can combine related articles into one beat if they tell a bigger story together

Important: put the source reference RIGHT AFTER each beat using source numbers only, using this exact format:
→ [3]
or
→ [3, 7]

Return markdown only in this format:
# Your daily brief

subtitle — one punchy line that makes you want to keep reading

## catchy beat header
1-2 short paragraphs with **bold** key terms
→ [3]

## another catchy beat header
1-2 short paragraphs with **bold** key terms
→ [7, 9]

## one more catchy beat header
1-2 short paragraphs with **bold** key terms
→ [2]

## one more catchy beat header
1-2 short paragraphs with **bold** key terms
→ [5]

## one more catchy beat header
1-2 short paragraphs with **bold** key terms
→ [11]

short closing line"""

VIDEO_PROMPT = """You are writing a high-value summary for one recent tech video.

The reader wants a clean text version, not video metadata.

SOURCE TITLE: {title}
SOURCE URL: {url}
TRANSCRIPT:
{transcript}

Return JSON with EXACT structure:
{{
  "headline": "Short factual headline",
  "overview": "2-3 sentence overview focused on what is interesting and why it matters",
  "key_points": ["3-5 concrete points with specific features, products, numbers, capabilities, tradeoffs, or implications"]
}}

RULES:
- Do not mention the channel, publisher, or host unless essential to understanding the story
- No timeline
- No hype, no filler, no vague 'industry trend' language
- Be faithful to the transcript
- Headline should be short and natural, not clickbait
- Overview should carry the main value, not just restate the title
- Key points should be specific and additive, not paraphrases of the overview
"""


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [v3-for-you] {msg}")


def _estimate_reading_time_minutes(text: str) -> int:
    words = len(str(text or "").split())
    if words <= 0:
        return 1
    return max(1, int(math.ceil(words / 220)))


def _first_sentence(text: str, max_len: int = 140) -> str:
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    sentence = parts[0].strip() if parts else cleaned
    if len(sentence) <= max_len:
        return sentence
    return sentence[: max_len - 1].rstrip() + "…"


def _fetch_recent_channel_videos(limit: int = FOR_YOU_VIDEO_SCAN_LIMIT) -> list[dict[str, Any]]:
    if yt_dlp is None:
        return []

    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "playlistend": limit,
    }

    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(FOR_YOU_VIDEO_CHANNEL_URL, download=False) or {}
    except Exception as exc:
        _log(f"  recent video fetch failed: {exc}")
        return []

    videos: list[dict[str, Any]] = []
    for entry in info.get("entries", []) or []:
        if not isinstance(entry, dict):
            continue
        video_id = str(entry.get("id", "")).strip()
        title = str(entry.get("title", "")).strip()
        if not video_id or not title:
            continue
        url = str(entry.get("webpage_url") or entry.get("url") or "").strip()
        if not url or not url.startswith("http"):
            url = f"https://www.youtube.com/watch?v={video_id}"
        thumbnail = str(entry.get("thumbnail", "")).strip()
        if not thumbnail:
            thumbs = entry.get("thumbnails")
            if isinstance(thumbs, list) and thumbs:
                last = thumbs[-1] if isinstance(thumbs[-1], dict) else {}
                thumbnail = str(last.get("url", "")).strip()
        videos.append({
            "video_id": video_id,
            "url": url,
            "title": title,
            "thumbnail": thumbnail,
            "published_date": str(entry.get("upload_date", "")).strip(),
        })
    return videos


def _normalize_video_summary(raw: dict[str, Any], transcript: str, source_title: str) -> dict[str, Any]:
    headline = str(raw.get("headline", "")).strip() or source_title
    overview = " ".join(str(raw.get("overview", "")).split()).strip()
    key_points = raw.get("key_points") if isinstance(raw.get("key_points"), list) else []
    cleaned_points = [
        " ".join(str(point).split()).strip()
        for point in key_points
        if str(point).strip()
    ][:5]
    subtitle = _first_sentence(overview) or headline
    return {
        "title": headline,
        "short_article": {
            "subtitle": subtitle,
            "why_it_matters": "",
            "key_takeaways": cleaned_points,
            "body": overview,
            "bottom_line": "",
        },
        "reading_time_minutes": _estimate_reading_time_minutes(transcript),
    }


def _generate_daily_video_summary(
    store: V3Store,
    *,
    target_date: str,
) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        _log("  daily video skipped: OPENAI_API_KEY not configured")
        return None

    recent_videos = _fetch_recent_channel_videos(FOR_YOU_VIDEO_SCAN_LIMIT)
    if not recent_videos:
        _log("  daily video skipped: no recent channel videos found")
        return None

    client = OpenAI(api_key=api_key)

    for video in recent_videos:
        video_url = str(video.get("url", "")).strip()
        title = str(video.get("title", "")).strip()
        if not video_url or not title:
            continue

        cached = store.get_cached_summary_v2(video_url, FOR_YOU_VIDEO_BUCKET)
        if cached:
            cached_summary = cached.get("summary")
            if isinstance(cached_summary, dict):
                return {
                    "video": video,
                    "summary": cached_summary,
                    "cached": True,
                }

        transcript = fetch_youtube_transcript(video_url)
        if not transcript or len(transcript) < 800:
            continue

        prompt = VIDEO_PROMPT.format(
            title=title,
            url=video_url,
            transcript=transcript[:12000],
        )

        try:
            response = client.chat.completions.create(
                model=FOR_YOU_VIDEO_MODEL,
                messages=[
                    {"role": "system", "content": "Return valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
                timeout=60,
            )
            raw = json.loads(response.choices[0].message.content or "{}")
            summary = _normalize_video_summary(raw, transcript, title)
            store.save_cached_summary_v2(video_url, FOR_YOU_VIDEO_BUCKET, summary, FOR_YOU_VIDEO_MODEL)
            return {
                "video": video,
                "summary": summary,
                "cached": False,
            }
        except Exception as exc:
            _log(f"  daily video summary failed for {video_url}: {exc}")

    _log("  daily video skipped: no transcript-backed summary could be generated")
    return None


def _build_daily_video_feed_item(target_date: str, payload: dict[str, Any]) -> dict[str, Any]:
    video = payload.get("video", {}) if isinstance(payload.get("video"), dict) else {}
    summary = payload.get("summary", {}) if isinstance(payload.get("summary"), dict) else {}
    video_url = str(video.get("url", "")).strip()
    item_id = hashlib.sha256(f"for_you_video|{video_url}".encode("utf-8")).hexdigest()[:32]

    return {
        "id": f"fy_video_{item_id}",
        "url": video_url,
        "title": summary.get("title", "") or video.get("title", ""),
        "type": "video",
        "source": "youtube",
        "source_name": "",
        "interest_id": "tech",
        "subinterest_id": "video-brief",
        "feed_type": "for_you",
        "published_date": target_date,
        "thumbnail": video.get("thumbnail", ""),
        "summary": {
            "short_article": summary.get("short_article", {}),
            "reading_time_minutes": summary.get("reading_time_minutes", 2),
        },
        "metadata": {
            "feed_type": "for_you",
            "content_length": len(str((summary.get("short_article") or {}).get("body", ""))),
            "synthesized": True,
            "source_count": 1,
            "why_relevant": "A useful recent tech story in text form.",
            "daily_video": True,
            "video_url": video_url,
            "video_title": video.get("title", ""),
        },
    }


# ── Content pool fetching ─────────────────────────────────────────────

def _load_brief_sources() -> dict[str, Any]:
    with open(REPO_ROOT / BRIEF_SOURCES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _make_pool_article(
    *,
    title: str,
    url: str,
    source: str,
    signal: str = "",
    role_hints: list[str] | None = None,
    source_kind: str,
) -> dict[str, Any]:
    return {
        "title": title,
        "url": url,
        "source": source,
        "signal": signal,
        "role_hints": sorted({
            _normalize_role(role)
            for role in (role_hints or [])
            if str(role or "").strip()
        }),
        "source_kind": source_kind,
    }


def _signal_score(article: dict[str, Any]) -> int:
    sig = str(article.get("signal", "")).strip()
    match = re.search(r"(\d+)", sig)
    return int(match.group(1)) if match else 0


def _fetch_hn_stories(
    brief_cfg: dict[str, Any],
    role_filter: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Fetch HN front page + Show HN via Algolia API."""
    articles: list[dict[str, Any]] = []
    hn_role_hints = [
        _normalize_role(role)
        for role in (brief_cfg.get("hn", {}).get("roles", []) or [])
        if not role_filter or _normalize_role(role) in role_filter
    ]
    urls = [
        brief_cfg.get("hn", {}).get("frontpage_url", ""),
        brief_cfg.get("hn", {}).get("show_hn_url", ""),
    ]
    for api_url in urls:
        if not api_url:
            continue
        try:
            resp = requests.get(api_url, timeout=HN_TIMEOUT)
            resp.raise_for_status()
            hits = resp.json().get("hits", [])
        except Exception as exc:
            _log(f"  HN fetch failed ({api_url[:60]}): {exc}")
            continue
        for hit in hits:
            title = str(hit.get("title", "")).strip()
            url = str(hit.get("url", "")).strip()
            if not title:
                continue
            hn_url = f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            points = hit.get("points") or 0
            source = "Show HN" if title.lower().startswith("show hn") else "Hacker News"
            articles.append(
                _make_pool_article(
                    title=title,
                    url=url or hn_url,
                    source=source,
                    signal=f"{points} points",
                    role_hints=hn_role_hints,
                    source_kind="community",
                )
            )
    _log(f"  HN: fetched {len(articles)} stories")
    return articles


def _fetch_reddit_posts(role: str, subreddits: list[str]) -> list[dict[str, Any]]:
    """Fetch top posts from Reddit subreddits via JSON API."""
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
    )
    normalized_role = _normalize_role(role)

    def _add_article(title: str, link: str, source: str, signal: str = "") -> None:
        lower_title = title.lower().strip()
        if (
            not title
            or not link
            or link in seen
            or any(pattern in lower_title for pattern in low_signal_patterns)
        ):
            return
        seen.add(link)
        articles.append(
            _make_pool_article(
                title=title,
                url=link,
                source=source,
                signal=signal,
                role_hints=[normalized_role],
                source_kind="community",
            )
        )

    for sub in subreddits:
        try:
            resp = requests.get(
                f"https://www.reddit.com/r/{sub}/hot.json?limit=10&t=day",
                headers={"User-Agent": REDDIT_USER_AGENT},
                timeout=REDDIT_TIMEOUT,
            )
            resp.raise_for_status()
            posts = resp.json().get("data", {}).get("children", [])
        except Exception as exc:
            _log(f"  Reddit r/{sub} failed: {exc}")
            try:
                rss_result = fetch_article_links(f"https://www.reddit.com/r/{sub}/.rss", limit=10)
                rss_links = rss_result.articles if hasattr(rss_result, "articles") else []
            except Exception as rss_exc:
                _log(f"  Reddit r/{sub} RSS fallback failed: {rss_exc}")
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
            if not title or data.get("stickied"):
                continue
            link = url if url and not url.startswith("https://www.reddit.com/r/") else permalink
            _add_article(title, link, f"r/{sub}", f"{ups} upvotes")
    _log(f"  Reddit: fetched {len(articles)} posts from {len(subreddits)} subs")
    return articles


def _fetch_rss_articles(role: str, sources: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Fetch latest articles from RSS/HTML sources."""
    articles: list[dict[str, Any]] = []
    normalized_role = _normalize_role(role)
    for src in sources:
        name = src.get("name", "")
        url = src.get("url", "")
        if not url:
            continue
        try:
            result = fetch_article_links(url, limit=RSS_LINK_LIMIT)
            links = result.articles if hasattr(result, "articles") else []
        except Exception as exc:
            _log(f"  RSS {name} failed: {exc}")
            continue
        for link in links:
            title = str(link.get("title", "")).strip()
            href = str(link.get("url", "")).strip()
            if not title or not href:
                continue
            articles.append(
                _make_pool_article(
                    title=title,
                    url=href,
                    source=name,
                    role_hints=[normalized_role],
                    source_kind="editorial",
                )
            )
    _log(f"  RSS: fetched {len(articles)} articles from {len(sources)} sources")
    return articles


def fetch_content_pool(roles: list[str] | None = None) -> list[dict[str, Any]]:
    """Fetch one shared content pool and merge duplicate URLs across roles."""
    brief_cfg = _load_brief_sources()
    reddit_cfg = brief_cfg.get("reddit", {})
    rss_cfg = brief_cfg.get("rss", {})
    all_roles = {
        _normalize_role(role)
        for role in (roles or list(set(list(reddit_cfg.keys()) + list(rss_cfg.keys()))))
    }

    articles: list[dict[str, Any]] = []
    articles.extend(_fetch_hn_stories(brief_cfg, role_filter=all_roles))

    for role, subreddit_list in reddit_cfg.items():
        normalized_role = _normalize_role(role)
        if all_roles and normalized_role not in all_roles:
            continue
        if subreddit_list:
            articles.extend(_fetch_reddit_posts(normalized_role, subreddit_list))

    for role, sources in rss_cfg.items():
        normalized_role = _normalize_role(role)
        if all_roles and normalized_role not in all_roles:
            continue
        if sources:
            articles.extend(_fetch_rss_articles(normalized_role, sources))

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

        if _signal_score(article) > _signal_score(existing):
            existing["signal"] = article.get("signal", existing.get("signal", ""))
        if existing.get("source_kind") != "community" and article.get("source_kind") == "community":
            existing["source_kind"] = "community"
        if len(str(article.get("title", "")).strip()) > len(str(existing.get("title", "")).strip()):
            existing["title"] = article.get("title", existing.get("title", ""))

    deduped = list(deduped_by_url.values())
    deduped.sort(
        key=lambda article: (
            0 if article.get("source_kind") == "community" else 1,
            -len(article.get("role_hints", []) or []),
            -_signal_score(article),
        )
    )
    _log(f"  Shared pool ready: {len(deduped)} unique articles")
    return deduped


def _format_articles_block(articles: list[dict[str, str]], limit: int = 36) -> str:
    """Format articles into a text block for the prompt."""
    lines: list[str] = []
    for i, article in enumerate(articles[:limit], 1):
        source = article.get("source", "")
        title = article.get("title", "")
        url = article.get("url", "")
        signal = article.get("signal", "")
        parts = [f"{i}. [{source}] {title}"]
        if signal:
            parts.append(f"({signal})")
        parts.append(f"→ {url}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def _prioritize_articles_for_brief(
    articles: list[dict[str, str]],
    total_limit: int = 36,
    community_share: float = 0.75,
) -> list[dict[str, str]]:
    if not articles:
        return []

    capped = articles[: max(total_limit * 2, total_limit)]
    community = [article for article in capped if _is_community_domain(article.get("url", ""))]
    editorial = [article for article in capped if not _is_community_domain(article.get("url", ""))]

    community_target = min(len(community), math.ceil(total_limit * community_share))
    editorial_target = min(len(editorial), total_limit - community_target)

    selected = community[:community_target] + editorial[:editorial_target]

    if len(selected) < total_limit:
        community_left = community[community_target:]
        editorial_left = editorial[editorial_target:]
        for article in community_left + editorial_left:
            if len(selected) >= total_limit:
                break
            selected.append(article)

    return selected[:total_limit]


def _expand_source_markers(markdown: str, articles: list[dict[str, str]]) -> str:
    article_map: dict[int, dict[str, str]] = {
        index: article for index, article in enumerate(articles, 1)
    }
    expanded_lines: list[str] = []

    for raw_line in markdown.splitlines():
        stripped = raw_line.strip()
        marker_match = re.search(r"(?:→|->)\s*((?:\[\d+\]\s*,?\s*)+)\s*$", stripped)
        if not marker_match:
            expanded_lines.append(raw_line)
            continue

        prefix = stripped[:marker_match.start()].rstrip()
        if prefix:
            expanded_lines.append(prefix)

        marker_text = marker_match.group(1)
        ids = [int(match) for match in re.findall(r"\[(\d+)\]", marker_text)]
        if not ids:
            expanded_lines.append(raw_line)
            continue

        resolved = []
        for source_id in ids:
            article = article_map.get(source_id)
            if not article:
                continue
            resolved.append(
                f"→ {article.get('source', '').strip()} — {article.get('title', '').strip()} ({article.get('url', '').strip()})"
            )

        if resolved:
            expanded_lines.extend(resolved)
        elif prefix:
            continue
        else:
            expanded_lines.append(raw_line)

    return "\n".join(expanded_lines)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build For You feed")
    p.add_argument("--skip-pool", action="store_true")
    p.add_argument("--pool-only", action="store_true")
    p.add_argument("--user-id", default="")
    p.add_argument("--limit-users", type=int, default=0)
    p.add_argument(
        "--items-per-user", type=int, default=DEFAULT_ITEMS,
        help="Items per user (0 = use config value)",
    )
    p.add_argument("--limit-per-source", type=int, default=15)
    p.add_argument("--max-age-days", type=int, default=365)
    p.add_argument("--date", default="")
    p.add_argument(
        "--users-file",
        default="",
        help="Optional JSON file with pre-fetched user profiles",
    )
    p.add_argument(
        "--audience",
        choices=["subscribed", "unsubscribed", "all"],
        default="subscribed",
        help="Which users to build for",
    )
    p.add_argument(
        "--tier",
        choices=["pro", "free"],
        default="pro",
        help="Ignored by role-pulse For You; accepted for scheduler compatibility.",
    )
    return p.parse_args()


def _load_config() -> dict[str, Any]:
    with open(REPO_ROOT / CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def _load_users(store: V3Store, args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.users_file:
        try:
            with open(args.users_file, "r", encoding="utf-8") as f:
                rows = json.load(f)
            if isinstance(rows, list):
                _log(f"Loaded {len(rows)} users from snapshot {args.users_file}")
                return rows
        except Exception as exc:
            _log(f"WARNING users snapshot load failed ({exc}); falling back to Firestore")
    return store.get_onboarded_users(args.audience)


def _goal_label(goals: list[str]) -> str:
    values = [str(goal or "").strip() for goal in goals if str(goal or "").strip()]
    if not values:
        return "stay sharp"
    primary = values[0]
    return GOAL_LABELS.get(primary, primary.replace("-", " "))


def _normalize_role(role: Any) -> str:
    normalized = str(role or "").strip().lower()
    if normalized in ROLE_ALIASES:
        return ROLE_ALIASES[normalized]
    if not normalized or normalized in {"other", "student", "none", "null"}:
        return "developer"
    return normalized


def _role_label(role: str) -> str:
    normalized = _normalize_role(role)
    return ROLE_LABELS.get(normalized, normalized or "professional")


def _role_plural_label(role: str) -> str:
    normalized = _normalize_role(role)
    mapping = {
        "developer": "engineers",
        "designer": "designers",
        "pm": "product managers",
        "marketer": "marketers",
        "founder": "founders",
    }
    return mapping.get(normalized, f"{_role_label(normalized)}s")


def _allowed_domains_for_role(role: str) -> list[str]:
    normalized = _normalize_role(role)
    domains = list(BASE_ALLOWED_DOMAINS)
    domains.extend(ROLE_ALLOWED_DOMAINS.get(normalized, []))
    return list(dict.fromkeys(domains))


def _brief_cache_url(
    uid: str,
    target_date: str,
    role: str,
    goal: str,
    interests: list[str],
) -> str:
    raw = "|".join([
        uid,
        target_date,
        role,
        goal,
        ",".join(sorted(str(item).strip() for item in interests if str(item).strip())),
    ])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"trace://for-you-morning-brief/{uid}/{target_date}/{digest}"


def _role_brief_cache_url(
    target_date: str,
    role: str,
    goals: list[str],
    interests: list[str],
) -> str:
    raw = "|".join([
        target_date,
        role,
        ",".join(sorted(str(item).strip() for item in goals if str(item).strip())),
        ",".join(sorted(str(item).strip() for item in interests if str(item).strip())),
    ])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"trace://for-you-role-brief/{role}/{target_date}/{digest}"


def _recent_dates_before(target_date: str, days: int) -> list[str]:
    try:
        base = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        return []
    return [
        (base - timedelta(days=offset)).strftime("%Y-%m-%d")
        for offset in range(1, max(0, days) + 1)
    ]


def _load_recent_brief_urls(
    store: V3Store,
    uid: str,
    target_date: str,
    lookback_days: int = RECENT_BRIEF_LOOKBACK_DAYS,
) -> set[str]:
    seen_urls: set[str] = set()
    for date_key in _recent_dates_before(target_date, lookback_days):
        feed = store.load_feed(uid, date_key)
        items = feed.get("for_you", [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url", "")).strip()
            if url:
                seen_urls.add(url)
            sources = item.get("sources", [])
            if not isinstance(sources, list):
                continue
            for source in sources:
                if not isinstance(source, dict):
                    continue
                source_url = str(source.get("url", "")).strip()
                if source_url:
                    seen_urls.add(source_url)
    return seen_urls


def _deprioritize_recent_articles(
    articles: list[dict[str, str]],
    recent_urls: set[str],
) -> list[dict[str, str]]:
    if not recent_urls:
        return list(articles)

    fresh = [
        article for article in articles
        if str(article.get("url", "")).strip() not in recent_urls
    ]
    repeated = [
        article for article in articles
        if str(article.get("url", "")).strip() in recent_urls
    ]
    return fresh + repeated


def _normalize_title_signature(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()
    tokens = [token for token in normalized.split() if token]
    return " ".join(tokens[:10])


def _load_recent_role_history(
    store: V3Store,
    role: str,
    target_date: str,
    lookback_days: int = RECENT_ROLE_LOOKBACK_DAYS,
) -> tuple[set[str], set[str]]:
    role = _normalize_role(role)
    recent_urls: set[str] = set()
    recent_titles: set[str] = set()
    for date_key in _recent_dates_before(target_date, lookback_days):
        global_feed = store.load_global_feed(date_key)
        role_map = global_feed.get("for_you_roles", {})
        if not isinstance(role_map, dict):
            continue
        items = role_map.get(role, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url", "")).strip()
            if url:
                recent_urls.add(url)
            title_sig = _normalize_title_signature(str(item.get("title", "")))
            if title_sig:
                recent_titles.add(title_sig)
            sources = item.get("sources", [])
            if isinstance(sources, list):
                for source in sources:
                    if not isinstance(source, dict):
                        continue
                    source_url = str(source.get("url", "")).strip()
                    if source_url:
                        recent_urls.add(source_url)
                    source_sig = _normalize_title_signature(str(source.get("title", "")))
                    if source_sig:
                        recent_titles.add(source_sig)
    return recent_urls, recent_titles


def _score_roles_by_rules(article: dict[str, Any]) -> dict[str, int]:
    text = " ".join([
        str(article.get("title", "")),
        str(article.get("source", "")),
        str(article.get("signal", "")),
    ]).lower()
    scores = {role: 0 for role in ROLE_ORDER}

    for hint in article.get("role_hints", []) or []:
        normalized_hint = _normalize_role(hint)
        if normalized_hint in scores:
            scores[normalized_hint] += 4

    if str(article.get("source", "")).strip().lower() == "show hn":
        scores["developer"] += 3
        scores["founder"] += 2
    elif str(article.get("source", "")).strip().lower() == "hacker news":
        scores["developer"] += 2
        scores["founder"] += 1

    for role, keywords in ROLE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                scores[role] += 3 if " " in keyword else 2

    return scores


def _classifier_cache_url(article: dict[str, Any]) -> str:
    raw = "|".join([
        str(article.get("title", "")).strip(),
        str(article.get("source", "")).strip(),
        str(article.get("url", "")).strip(),
        ",".join(sorted(str(hint).strip() for hint in article.get("role_hints", []) or [])),
    ])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"trace://for-you-role-classifier/{digest}"


def _classify_roles_with_llm(
    store: V3Store,
    article: dict[str, Any],
) -> tuple[list[str], bool]:
    cache_url = _classifier_cache_url(article)
    cached = store.get_cached_summary_v2(cache_url, FOR_YOU_ROLE_CLASSIFIER_BUCKET)
    if cached:
        cached_summary = cached.get("summary")
        if isinstance(cached_summary, dict):
            cached_roles = [
                _normalize_role(role)
                for role in (cached_summary.get("roles") or [])
                if _normalize_role(role) in ROLE_ORDER
            ]
            return cached_roles[:2], True

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return [], False

    prompt = (
        "Classify this content item for Trace's professional audience buckets.\n"
        "Return JSON only with keys roles and reject.\n"
        "roles must be an array containing up to 2 values chosen from "
        f"{', '.join(ROLE_ORDER)}.\n"
        "Use reject=true if the item does not clearly belong to any of those buckets.\n\n"
        f"Title: {str(article.get('title', '')).strip()}\n"
        f"Source: {str(article.get('source', '')).strip()}\n"
        f"Signal: {str(article.get('signal', '')).strip()}\n"
        f"Role hints from source list: {', '.join(article.get('role_hints', []) or []) or 'none'}\n"
        f"Source type: {str(article.get('source_kind', '')).strip()}\n"
    )

    client = OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=FOR_YOU_ROLE_CLASSIFIER_MODEL,
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            timeout=30,
        )
        raw = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        _log(f"  classifier fallback failed for {article.get('title', '')[:50]}: {exc}")
        return [], False

    roles = [
        _normalize_role(role)
        for role in (raw.get("roles") or [])
        if _normalize_role(role) in ROLE_ORDER
    ][:2]
    summary = {"roles": roles, "reject": bool(raw.get("reject"))}
    store.save_cached_summary_v2(
        cache_url,
        FOR_YOU_ROLE_CLASSIFIER_BUCKET,
        summary,
        FOR_YOU_ROLE_CLASSIFIER_MODEL,
    )
    if summary["reject"]:
        return [], False
    return roles, False


def _assign_roles_to_article(
    store: V3Store,
    article: dict[str, Any],
) -> tuple[list[str], str]:
    scores = _score_roles_by_rules(article)
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_role, top_score = ranked[0]
    second_role, second_score = ranked[1]
    role_hints = [_normalize_role(role) for role in (article.get("role_hints") or []) if _normalize_role(role) in ROLE_ORDER]

    if top_score >= 6 and second_score >= 5 and (top_score - second_score) <= 1:
        return [top_role, second_role], "rules"
    if top_score >= 4:
        return [top_role], "rules"
    if len(role_hints) == 1:
        return [role_hints[0]], "rules"
    if len(role_hints) >= 2:
        return role_hints[:2], "rules"
    if top_score > 0:
        return [top_role], "rules"

    roles, cached = _classify_roles_with_llm(store, article)
    if roles:
        return roles, "cache" if cached else "llm"

    return [], "reject"


def _classify_content_pool(
    store: V3Store,
    articles: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    stats = {"classified_with_rules": 0, "classified_with_cache": 0, "classified_with_llm": 0, "rejected": 0}
    classified: list[dict[str, Any]] = []
    for article in articles:
        roles, method = _assign_roles_to_article(store, article)
        if not roles:
            stats["rejected"] += 1
            continue
        record = dict(article)
        record["roles"] = roles
        classified.append(record)
        if method == "cache":
            stats["classified_with_cache"] += 1
        elif method == "llm":
            stats["classified_with_llm"] += 1
        else:
            stats["classified_with_rules"] += 1
    return classified, stats


def _score_article_for_role(
    role: str,
    article: dict[str, Any],
    recent_urls: set[str],
    recent_titles: set[str],
) -> float:
    role = _normalize_role(role)
    score = 0.0
    if role in (article.get("roles") or []):
        score += 24.0
    if role in (article.get("role_hints") or []):
        score += 8.0

    source_kind = str(article.get("source_kind", "")).strip().lower()
    if source_kind == "community":
        score += 18.0
    elif source_kind == "editorial":
        score += 8.0

    signal_score = _signal_score(article)
    score += min(12.0, math.log1p(max(signal_score, 0)))

    title_sig = _normalize_title_signature(article.get("title", ""))
    if str(article.get("url", "")).strip() in recent_urls:
        score -= 60.0
    if title_sig and title_sig in recent_titles:
        score -= 35.0
    return score


def _select_role_articles(
    role: str,
    articles: list[dict[str, Any]],
    recent_urls: set[str],
    recent_titles: set[str],
    total_limit: int = 36,
) -> list[dict[str, Any]]:
    role = _normalize_role(role)
    candidates = [
        dict(article, _rank_score=_score_article_for_role(role, article, recent_urls, recent_titles))
        for article in articles
        if role in (article.get("roles") or [])
    ]
    candidates.sort(key=lambda article: (article.get("_rank_score", 0), _signal_score(article)), reverse=True)

    diverse: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    community_limit_per_source = 2
    editorial_limit_per_source = 1
    for article in candidates:
        source = str(article.get("source", "")).strip().lower()
        source_kind = str(article.get("source_kind", "")).strip().lower()
        limit_per_source = community_limit_per_source if source_kind == "community" else editorial_limit_per_source
        if source and source_counts.get(source, 0) >= limit_per_source:
            continue
        diverse.append(article)
        if source:
            source_counts[source] = source_counts.get(source, 0) + 1
        if len(diverse) >= max(total_limit * 2, total_limit):
            break
    return diverse


def _parse_source_lines(markdown: str) -> tuple[str, list[dict[str, str]]]:
    parts = re.split(r"\n##\s+Sources\s*\n", markdown, maxsplit=1, flags=re.IGNORECASE)
    main = parts[0].strip()
    source_block = parts[1].strip() if len(parts) > 1 else ""
    sources: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    def _try_add(line: str, prefix: str) -> None:
        content = line[len(prefix):].strip()
        match = re.match(r"^(.+?)\s+[—-]\s+(.+?)\s+\((https?://[^)]+)\)\s*$", content)
        if match:
            source_name = match.group(1).strip()
            title = match.group(2).strip()
            url = match.group(3).strip()
        else:
            url_match = re.search(r"\((https?://[^)]+)\)\s*$", content)
            if not url_match:
                return
            url = url_match.group(1).strip()
            head = content[:url_match.start()].strip()
            if " — " in head:
                source_name, title = [p.strip() for p in head.split(" — ", 1)]
            elif " - " in head:
                source_name, title = [p.strip() for p in head.split(" - ", 1)]
            else:
                source_name = urlparse(url).netloc
                title = head or url
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append({"name": source_name, "title": title, "url": url})

    for raw_line in main.splitlines():
        line = raw_line.strip()
        if line.startswith("→"):
            _try_add(line, "→")

    for raw_line in source_block.splitlines():
        line = raw_line.strip()
        if line.startswith("- "):
            _try_add(line, "- ")

    return main, sources


def _is_community_domain(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return host == "news.ycombinator.com" or host.endswith(".reddit.com") or host == "reddit.com"


def _clean_brief_text(text: str) -> str:
    cleaned = str(text or "").strip()
    if not cleaned:
        return ""
    result_lines: list[str] = []
    for line in cleaned.split("\n"):
        if line.strip().startswith("→"):
            result_lines.append(line)
            continue
        line = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1", line)
        line = re.sub(r"\(?https?://\S+\)?", "", line)
        line = re.sub(r"[ \t]{2,}", " ", line)
        line = re.sub(r" +([,.;:!?])", r"\1", line)
        line = re.sub(r"\(\s*\)", "", line)
        result_lines.append(line)
    return "\n".join(result_lines).strip()


def _normalize_markdown_brief(markdown: str, role: str = "") -> dict[str, Any]:
    main, sources = _parse_source_lines(markdown)
    lines = [line.rstrip() for line in main.splitlines()]

    title = ""
    remainder: list[str] = []
    title_consumed = False
    for line in lines:
        stripped = line.strip()
        if not title_consumed and stripped.startswith("# "):
            title = stripped[2:].strip()
            title_consumed = True
            continue
        remainder.append(line)

    if not title:
        for line in lines:
            stripped = line.strip()
            if stripped:
                title = stripped
                break

    subtitle = ""
    body_lines: list[str] = []
    subtitle_set = False
    for line in remainder:
        stripped = line.strip()
        if not subtitle_set and stripped:
            subtitle = stripped
            subtitle_set = True
            continue
        body_lines.append(line)

    body = _clean_brief_text("\n".join(body_lines).strip())
    subtitle = _clean_brief_text(subtitle)

    primary_source = next(
        (src for src in sources if not _is_community_domain(src["url"])),
        sources[0] if sources else None,
    )
    primary_url = primary_source["url"] if primary_source else ""

    thumbnail = ""
    for source in sources:
        image = fetch_og_image(str(source.get("url", "")).strip())
        if image:
            thumbnail = image
            if not primary_url:
                primary_url = str(source.get("url", "")).strip()
            break

    if not thumbnail:
        thumbnail = ROLE_FALLBACK_IMAGES.get(str(role or "").strip().lower(), "")

    word_count = len(re.findall(r"\w+", body))
    reading_time = max(1, round(word_count / 220))

    return {
        "title": "Your daily brief",
        "short_article": {
            "subtitle": subtitle,
            "why_it_matters": "",
            "key_takeaways": [],
            "body": body,
            "bottom_line": "",
        },
        "put_this_to_work": [],
        "reading_time_minutes": reading_time,
        "sources": sources,
        "primary_url": primary_url,
        "thumbnail": thumbnail,
    }


def _generate_personalized_brief(
    store: V3Store,
    *,
    profile: dict[str, Any],
    target_date: str,
    articles: list[dict[str, str]],
) -> tuple[dict[str, Any] | None, bool]:
    uid = str(profile.get("uid", "")).strip()
    role = _normalize_role(profile.get("role"))
    name = str(profile.get("name") or profile.get("displayName") or "there").strip() or "there"
    goals = profile.get("careerGoals") or []
    interests = [
        str(item).strip()
        for item in (profile.get("interests") or [])
        if str(item).strip()
    ]
    goal_label = _goal_label(goals)

    cache_url = _brief_cache_url(uid, target_date, role, goal_label, interests)
    cached = store.get_cached_summary_v2(cache_url, FOR_YOU_BRIEF_BUCKET)
    if cached:
        cached_summary = cached.get("summary")
        if isinstance(cached_summary, dict):
            return cached_summary, True

    if not articles:
        raise RuntimeError(f"No articles in pool for role={role}")

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    prompt_articles = _prioritize_articles_for_brief(articles, total_limit=36, community_share=0.75)
    articles_block = _format_articles_block(prompt_articles, limit=36)

    prompt = PROMPT.format(
        name=name,
        today=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        role=_role_label(role),
        goal=goal_label,
        interests=", ".join(interests) if interests else "engineering, tech, AI",
        role_focus=ROLE_FOCUS.get(role, "Lean into the most useful, timely signals for this person's work."),
        community_rule=ROLE_COMMUNITY_RULE.get(role, "Mix community and editorial signal when possible."),
        articles_block=articles_block,
    )

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=FOR_YOU_BRIEF_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_markdown = (response.choices[0].message.content or "").strip()
    if not raw_markdown:
        raise RuntimeError("OpenAI returned empty brief")

    expanded_markdown = _expand_source_markers(raw_markdown, prompt_articles)
    summary = _normalize_markdown_brief(expanded_markdown, role=role)
    store.save_cached_summary_v2(cache_url, FOR_YOU_BRIEF_BUCKET, summary, FOR_YOU_BRIEF_MODEL)
    return summary, False


def _generate_role_brief(
    store: V3Store,
    *,
    role: str,
    target_date: str,
    profiles: list[dict[str, Any]],
    articles: list[dict[str, str]],
) -> tuple[dict[str, Any] | None, bool]:
    role = _normalize_role(role)
    if not articles:
        raise RuntimeError(f"No articles in pool for role={role}")

    interest_counter: Counter[str] = Counter()
    goal_counter: Counter[str] = Counter()
    for profile in profiles:
        for interest in profile.get("interests") or []:
            value = str(interest or "").strip()
            if value:
                interest_counter[value] += 1
        for goal in profile.get("careerGoals") or []:
            value = str(goal or "").strip()
            if value:
                goal_counter[value] += 1

    common_interests = [item for item, _ in interest_counter.most_common(5)]
    common_goals_raw = [item for item, _ in goal_counter.most_common(3)]
    common_goals = [_goal_label([goal]) for goal in common_goals_raw if goal]
    if not common_goals:
        common_goals = ["stay sharp"]

    cache_url = _role_brief_cache_url(
        target_date=target_date,
        role=role,
        goals=common_goals,
        interests=common_interests,
    )
    cached = store.get_cached_summary_v2(cache_url, FOR_YOU_BRIEF_BUCKET)
    if cached:
        cached_summary = cached.get("summary")
        if isinstance(cached_summary, dict):
            return cached_summary, True

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    prompt_articles = _prioritize_articles_for_brief(articles, total_limit=36, community_share=0.75)
    articles_block = _format_articles_block(prompt_articles, limit=36)
    prompt = ROLE_PROMPT.format(
        today=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        role=_role_label(role),
        role_plural=_role_plural_label(role),
        goal=", ".join(common_goals),
        interests=", ".join(common_interests) if common_interests else "engineering, tech, AI",
        role_focus=ROLE_FOCUS.get(role, "Lean into the most useful, timely signals for this audience."),
        community_rule=ROLE_COMMUNITY_RULE.get(role, "Mix community and editorial signal when possible."),
        articles_block=articles_block,
    )

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=FOR_YOU_BRIEF_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    raw_markdown = (response.choices[0].message.content or "").strip()
    if not raw_markdown:
        raise RuntimeError("OpenAI returned empty role brief")

    expanded_markdown = _expand_source_markers(raw_markdown, prompt_articles)
    summary = _normalize_markdown_brief(expanded_markdown, role=role)
    store.save_cached_summary_v2(cache_url, FOR_YOU_BRIEF_BUCKET, summary, FOR_YOU_BRIEF_MODEL)
    return summary, False


def _build_synthesized_feed_item(
    uid: str,
    target_date: str,
    role: str,
    goal: str,
    summary: dict[str, Any],
) -> dict[str, Any]:
    primary_url = str(summary.get("primary_url", "")).strip()
    sources = summary.get("sources") if isinstance(summary.get("sources"), list) else []
    raw_id = f"{uid}|{target_date}|{role}|{goal}|{primary_url}|{summary.get('title', '')}"
    item_id = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:32]

    return {
        "id": f"fy_{item_id}",
        "url": primary_url,
        "title": summary.get("title", ""),
        "type": "brief",
        "source": "trace",
        "source_name": "Trace Brief",
        "interest_id": ROLE_FEED_INTEREST.get(role, ""),
        "subinterest_id": role,
        "feed_type": "for_you",
        "published_date": target_date,
        "thumbnail": summary.get("thumbnail", ""),
        "summary": {
            "short_article": summary.get("short_article", {}),
            "reading_time_minutes": summary.get("reading_time_minutes", 2),
        },
        "sources": sources,
        "metadata": {
            "feed_type": "for_you",
            "content_length": len(str((summary.get("short_article") or {}).get("body", ""))),
            "synthesized": True,
            "source_count": len(sources),
            "why_relevant": f"For {_role_label(role)}s focused on {goal}.",
            "goal": goal,
            "role": role,
            "source_description": ", ".join(
                str(src.get("name", "")).strip()
                for src in sources[:3]
                if str(src.get("name", "")).strip()
            ),
            "morning_brief": True,
        },
    }


def _build_role_feed_item(
    target_date: str,
    role: str,
    goals: list[str],
    summary: dict[str, Any],
) -> dict[str, Any]:
    primary_url = str(summary.get("primary_url", "")).strip()
    sources = summary.get("sources") if isinstance(summary.get("sources"), list) else []
    raw_id = f"{target_date}|{role}|{primary_url}|{summary.get('title', '')}"
    item_id = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:32]

    return {
        "id": f"fy_role_{item_id}",
        "url": primary_url,
        "title": summary.get("title", ""),
        "type": "brief",
        "source": "trace",
        "source_name": "Trace Brief",
        "interest_id": ROLE_FEED_INTEREST.get(role, ""),
        "subinterest_id": role,
        "feed_type": "for_you",
        "published_date": target_date,
        "thumbnail": summary.get("thumbnail", ""),
        "summary": {
            "short_article": summary.get("short_article", {}),
            "reading_time_minutes": summary.get("reading_time_minutes", 2),
        },
        "sources": sources,
        "metadata": {
            "feed_type": "for_you",
            "content_length": len(str((summary.get("short_article") or {}).get("body", ""))),
            "synthesized": True,
            "source_count": len(sources),
            "why_relevant": f"Shared daily pulse for {_role_plural_label(role)} focused on {', '.join(goals)}.",
            "goal": ", ".join(goals),
            "role": role,
            "source_description": ", ".join(
                str(src.get("name", "")).strip()
                for src in sources[:3]
                if str(src.get("name", "")).strip()
            ),
            "morning_brief": True,
            "role_pulse": True,
        },
    }


_content_pool_cache: list[dict[str, Any]] = []


def refresh_pool(store: V3Store, config: dict[str, Any], limit_per_source: int) -> dict[str, int]:
    del store, config, limit_per_source
    global _content_pool_cache
    _log("Fetching content pool from HN, Reddit, and RSS sources...")
    _content_pool_cache = fetch_content_pool()
    total = len(_content_pool_cache)
    stats = {
        "sources": 1,
        "links_found": total,
        "new_items": total,
        "skipped": 0,
        "filtered": 0,
        "errors": 0,
        "deactivated": 0,
        "mode": "self_fetched",
    }
    _log(f"Content pool ready: {total} shared articles")
    return stats


def build_user_feeds(
    store: V3Store,
    config: dict[str, Any],
    args: argparse.Namespace,
) -> dict[str, int]:
    global _content_pool_cache
    target_date = args.date.strip() or _today_ist()
    cfg_items = max(1, int(config.get("items_per_user", 1) or 1))
    items_per_user = max(1, int(args.items_per_user or cfg_items))
    audience_users = _load_users(store, args)
    if args.limit_users > 0:
        audience_users = audience_users[: args.limit_users]

    target_users = audience_users
    if args.user_id:
        target_users = [u for u in audience_users if u.get("uid") == args.user_id]

    target_roles = {
        _normalize_role(profile.get("role"))
        for profile in target_users
        if str(profile.get("uid", "")).strip()
    }
    if not target_roles:
        target_roles = {
            _normalize_role(profile.get("role"))
            for profile in audience_users
            if str(profile.get("uid", "")).strip()
        }

    users_by_role: dict[str, list[dict[str, Any]]] = {}
    for profile in audience_users:
        role = _normalize_role(profile.get("role"))
        if target_roles and role not in target_roles:
            continue
        users_by_role.setdefault(role, []).append(profile)

    roles_needed = sorted(users_by_role.keys())
    if not _content_pool_cache:
        _log("Content pool empty, fetching now...")
        _content_pool_cache = fetch_content_pool(roles=roles_needed)

    classified_pool, classification_stats = _classify_content_pool(store, _content_pool_cache)
    _log(
        f"Building For You for roles={roles_needed} "
        f"(audience_users={len(audience_users)} target_users={len(target_users)}), "
        f"date={target_date}"
    )

    stats = {
        "roles": 0,
        "target_users": len(target_users),
        "audience_users": len(audience_users),
        "items_total": 0,
        "briefs_generated": 0,
        "briefs_cached": 0,
        "daily_video_generated": 0,
        "daily_video_cached": 0,
        "rejected_roles": 0,
        **classification_stats,
    }

    daily_video_item: dict[str, Any] | None = None
    try:
        daily_video_payload = _generate_daily_video_summary(store, target_date=target_date)
        if daily_video_payload:
            daily_video_item = _build_daily_video_feed_item(target_date, daily_video_payload)
            if daily_video_payload.get("cached"):
                stats["daily_video_cached"] += 1
            else:
                stats["daily_video_generated"] += 1
    except Exception as exc:
        _log(f"  daily video generation failed: {exc}")

    for role in roles_needed:
        role_profiles = users_by_role.get(role, [])
        if not role_profiles:
            continue

        interest_counter: Counter[str] = Counter()
        goal_counter: Counter[str] = Counter()
        for profile in role_profiles:
            for interest in profile.get("interests") or []:
                value = str(interest or "").strip()
                if value:
                    interest_counter[value] += 1
            for goal in profile.get("careerGoals") or []:
                value = str(goal or "").strip()
                if value:
                    goal_counter[value] += 1

        common_interests = [item for item, _ in interest_counter.most_common(5)]
        common_goals = [_goal_label([goal]) for goal, _ in goal_counter.most_common(3)]
        if not common_goals:
            common_goals = ["stay sharp"]

        recent_urls, recent_titles = _load_recent_role_history(store, role, target_date)
        candidate_articles = _select_role_articles(
            role,
            classified_pool,
            recent_urls,
            recent_titles,
            total_limit=36,
        )

        try:
            summary, was_cached = _generate_role_brief(
                store,
                role=role,
                target_date=target_date,
                profiles=role_profiles,
                articles=candidate_articles,
            )
        except Exception as exc:
            _log(f"  role={role} pulse generation failed: {exc}")
            summary = None
            was_cached = False

        if not summary:
            stats["rejected_roles"] += 1
            continue

        if was_cached:
            stats["briefs_cached"] += 1
        else:
            stats["briefs_generated"] += 1

        role_feed_items = [
            _build_role_feed_item(target_date, role, common_goals, summary)
        ]
        if daily_video_item:
            role_feed_items.append(dict(daily_video_item))
        role_feed_items = role_feed_items[:items_per_user]

        store.write_global_role_feed(
            target_date,
            role,
            role_feed_items,
            metadata={
                "role": role,
                "users_count": len(role_profiles),
                "common_goals": common_goals,
                "common_interests": common_interests,
                "candidate_count": len(candidate_articles),
                "cached": was_cached,
            },
        )
        stats["roles"] += 1
        stats["items_total"] += len(role_feed_items)
        _log(
            f"  role={role} wrote {len(role_feed_items)} global items "
            f"(users={len(role_profiles)} candidates={len(candidate_articles)})"
        )

    store.record_run("for_you", {"date": target_date, **stats})
    _log(f"For You feeds done: {stats}")
    return stats


def main() -> None:
    args = _parse_args()
    _log("=" * 50)
    _log("FOR YOU — Starting")
    _log(
        f"  user-id={args.user_id or 'ALL'} audience={args.audience} "
        f"skip-pool={args.skip_pool} pool-only={args.pool_only}"
    )
    _log("=" * 50)

    store = V3Store()
    config = _load_config()
    _log(f"Config loaded: {len(config.get('sources', []))} sources")

    if not args.skip_pool:
        _log("-" * 40)
        _log("PHASE 1: Pool refresh")
        _log("-" * 40)
        pool_stats = refresh_pool(store, config, args.limit_per_source)
        if args.pool_only:
            print(json.dumps(pool_stats, indent=2))
            return

    _log("-" * 40)
    _log("PHASE 2: Role pulse generation")
    _log("-" * 40)
    feed_stats = build_user_feeds(store, config, args)
    _log("=" * 50)
    _log(f"FOR YOU — Complete: {feed_stats}")
    _log("=" * 50)
    print(json.dumps(feed_stats, indent=2))


if __name__ == "__main__":
    main()
