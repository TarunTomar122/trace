"""
V3 summary generation with Firestore caching.

Unified summary style for all users - no more style variants.
Cache key = sha256(url + feed_type).
"""

from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI

MODEL = "gpt-4o-mini"
TEMPERATURE = 0.3
TIMEOUT = 45

# ---------------------------------------------------------------------------
# Unified summary prompt — one style for all "For You" content
# ---------------------------------------------------------------------------

FOR_YOU_SUMMARY = """You are a skilled editor creating a CONCISE summary for a busy professional.

Your goal: distill the article to its essential points. Be brief but complete.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence capturing the main point or news",
    "key_takeaways": ["3-4 key points — the essential insights"],
    "body": "Concise summary in markdown (see rules below)"
  }},
  "reading_time_minutes": <estimated int>
}}

BODY RULES:
- SHORT paragraphs: 2-3 sentences max per paragraph
- Total length: 2-4 paragraphs for most articles. Only use more for genuinely complex pieces.
- Use ## headers ONLY if the article has 3+ truly distinct topics
- Include specific facts and numbers, but don't exhaustively list every detail
- Bold 1-2 key metrics or claims per summary
- Prefer density over length — pack more meaning into fewer words
- NO concluding paragraphs. No "In summary", "Overall", "In conclusion". Ever.
- If content is thin, write 1-2 paragraphs. Don't pad.

KEY_TAKEAWAYS RULES:
- 3-4 takeaways max (not 5)
- Each should be one sentence with a specific insight
- Cut any takeaway that's obvious or generic
"""

# ---------------------------------------------------------------------------
# Deep Dive — longer, richer summaries for "Deep Dives" feed
# ---------------------------------------------------------------------------

DEEP_DIVE_SUMMARY = """You are creating an in-depth breakdown of an important piece of content.

This is a deep dive — go deep, not surface-level. The reader should feel like they absorbed the full article.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One powerful sentence — the core thesis or insight",
    "key_takeaways": ["4-6 specific, actionable takeaways"],
    "body": "Thorough analysis in markdown — see rules below",
    "why_it_matters": "2-3 sentences on the bigger-picture significance"
  }},
  "reading_time_minutes": <estimated int>
}}

BODY RULES:
- Use ## headers to break into 3-5 logical sections that mirror the article's structure
- Include specific data, quotes, frameworks, tools, or methods from the original
- Mix formats: paragraphs for narrative/analysis, bullets for lists/steps/examples
- Bold the most important insights, metrics, and conclusions
- 6-10 paragraphs typically — this is meant to be comprehensive
- Each section should teach something concrete — not just describe
- NEVER write concluding paragraphs that restate. No "In summary", "Overall". Ever.

KEY_TAKEAWAYS RULES:
- Concrete and actionable — things the reader can apply or remember
- Include specifics: tools, numbers, frameworks, names
- Not vague platitudes like "communication is important"

WHY_IT_MATTERS:
- Connect to broader trends, career implications, or industry shifts
- Make the reader feel the significance
"""

TRENDING_BRIEF = """You are an elite news editor creating an Instagram-style news carousel.

The reader swipes through 2-3 slides to get the story. Make each slide punchy and visual.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One short line (max 12 words) saying what's new",
    "headline": "Ultra-short hook for image overlay (6-10 words max)",
    "slides": [
      "Slide 1: The news — what happened, who's involved, key numbers (40-50 words)",
      "Slide 2: The context or why it matters (35-45 words)",
      "Slide 3 (optional): What's next or deeper insight (30-40 words)"
    ],
    "body": "",
    "outline": []
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- headline: Like an Instagram caption hook. Short, punchy, makes you want to swipe.
- slides: Each is a standalone chunk. No headers or labels. Plain prose.
- 2 slides minimum, 3 if the story warrants it
- Include ONE bold stat or name per slide using **bold**
- No fluff, no filler — every word earns its place
- Slide 1 = the facts (who/what/when/numbers)
- Slide 2 = the so-what (impact, meaning, stakes)
- Slide 3 = optional deeper context or what comes next
"""


QUALITY_GATE_RULES = """
QUALITY GATE (VERY IMPORTANT):
- First, judge whether this source is genuinely useful for professionals.
- Reject low-signal or junk content such as: pure promos/ads, coupons/deals,
  shopping roundups, affiliate pieces, watch-live filler, thin clickbait,
  or articles with too little substance to summarize well.
- If rejected, set "rejected": true and include a short reason.
- If accepted, set "rejected": false and produce the full summary fields.
"""


def _rejection_payload(reason: str) -> dict[str, Any]:
    return {
        "_rejected": True,
        "reason": (reason or "low_signal_content").strip()[:200],
    }


def _is_rejection(summary: dict[str, Any] | None) -> bool:
    return bool(isinstance(summary, dict) and summary.get("_rejected") is True)


def _parse_summary_json(raw: str) -> dict[str, Any] | None:
    cleaned = (raw or "").strip()
    if not cleaned:
        return None
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").replace("json", "", 1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


def _cache_bucket(feed_type: str) -> str:
    """Return cache bucket name for the feed type. No more style/seniority variants."""
    if feed_type == "trending":
        return "trending_v5"  # v5: carousel slides format
    if feed_type == "deep_dives":
        return "deep_dive_v4"
    return "for_you_v5"  # v5: more compact summaries


def summary_lookup_key(url: str, feed_type: str = "default") -> tuple[str, str]:
    """Return (url, cache_bucket) for cache lookups."""
    return (url, _cache_bucket(feed_type))


def _normalize_trending_summary(parsed: dict[str, Any]) -> dict[str, Any]:
    """Clean up trending summary - remove markdown formatting but keep full content."""
    short = parsed.get("short_article")
    if not isinstance(short, dict):
        short = {}

    subtitle = str(short.get("subtitle", "")).strip()

    body = str(short.get("body", "")).strip()
    # Remove markdown headers, bullets, numbered lists
    body = re.sub(r"^\s*#+\s*", "", body, flags=re.MULTILINE)
    body = re.sub(r"^\s*[-*]\s+", "", body, flags=re.MULTILINE)
    body = re.sub(r"^\s*\d+\.\s+", "", body, flags=re.MULTILINE)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    # Remove label prefixes like "What's new:", "Why it matters:", etc.
    label_prefix = re.compile(
        r"^\s*(what'?s\s+new|what\s+happened|why\s+it\s+matters|the\s+impact|bottom\s+line)\s*:\s*",
        re.IGNORECASE,
    )
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    paragraphs = [label_prefix.sub("", p).strip() for p in paragraphs if p.strip()]

    if not paragraphs:
        body = subtitle or "Fresh developments in this story are drawing attention."
    else:
        body = "\n\n".join(paragraphs)

    short["subtitle"] = subtitle
    short["outline"] = []
    short["body"] = body
    parsed["short_article"] = short
    return parsed


def _get_client() -> OpenAI | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return OpenAI(api_key=key) if key else None


def generate_summary(
    title: str,
    url: str,
    content: str,
    feed_type: str = "default",
) -> tuple[dict[str, Any] | None, str]:
    """
    Generate a summary using the appropriate prompt for the feed type.

    feed_type options:
    - "default" or "for_you": Standard summary with key_takeaways
    - "deep_dives": Longer, more comprehensive summary
    - "trending": Short news brief

    Returns (summary_dict, error_string). summary_dict is None on failure.
    """
    client = _get_client()
    if client is None:
        return None, "openai_not_configured"
    if not content:
        return None, "no_content"

    if feed_type == "deep_dives":
        template = DEEP_DIVE_SUMMARY
    elif feed_type == "trending":
        template = TRENDING_BRIEF
    else:
        template = FOR_YOU_SUMMARY

    gate_suffix = (
        "\n" + QUALITY_GATE_RULES + "\n"
        "Return JSON with EXACT structure:\n"
        '{{\n'
        '  "rejected": <true|false>,\n'
        '  "rejection_reason": "<short reason when rejected, '
        'else empty string>",\n'
        '  "short_article": {{\n'
        '    "subtitle": "...",\n'
        '    "key_takeaways": ["..."],\n'
        '    "body": "..."\n'
        '  }},\n'
        '  "reading_time_minutes": <estimated int>\n'
        '}}\n'
    )
    prompt = (template + gate_suffix).format(
        title=title,
        url=url,
        content=content[:16000],
    )

    try:
        t0 = time.time()
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You return valid JSON only. No markdown fences.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=TEMPERATURE,
            response_format={"type": "json_object"},
            timeout=TIMEOUT,
        )
        elapsed = time.time() - t0
        tokens = getattr(resp.usage, "total_tokens", 0) if resp.usage else 0
        print(f"      [summarizer] OpenAI {MODEL} took {elapsed:.1f}s, {tokens} tokens — {title[:40]}")
    except Exception as exc:
        return None, f"openai_error:{exc}"

    parsed = _parse_summary_json(
        (resp.choices[0].message.content or "").strip()
    )
    if not parsed:
        return None, "bad_json_response"
    rejected_flag = bool(parsed.get("rejected"))
    rejection_reason = str(parsed.get("rejection_reason", "")).strip()
    if rejected_flag:
        return None, f"rejected:{rejection_reason or 'low_signal_content'}"
    if "short_article" not in parsed:
        return None, "bad_json_response"
    if feed_type == "trending":
        parsed = _normalize_trending_summary(parsed)
    return parsed, ""


def get_or_generate_summary(
    store,  # V3Store
    url: str,
    title: str,
    content: str,
    feed_type: str = "default",
) -> tuple[dict[str, Any] | None, bool]:
    """
    Check cache first, generate if missing.

    Returns (summary_dict, was_cached).
    """
    cache_bucket = _cache_bucket(feed_type)
    cached = store.get_cached_summary_v2(url, cache_bucket)
    if cached:
        cached_summary = cached.get("summary")
        if _is_rejection(cached_summary):
            return None, True
        return cached_summary, True

    summary, error = generate_summary(title, url, content, feed_type=feed_type)
    if summary:
        store.save_cached_summary_v2(url, cache_bucket, summary, MODEL)
        return summary, False
    if error.startswith("rejected:"):
        store.save_cached_summary_v2(
            url, cache_bucket, _rejection_payload(error.split(":", 1)[1]), MODEL
        )
        return None, False

    return None, False


# ---------------------------------------------------------------------------
# Batch pre-summarization — parallel OpenAI calls via thread pool
# ---------------------------------------------------------------------------

def _log_presummary(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [pre-summarize] {msg}")


def batch_presummarize(
    store,  # V3Store
    pool_items: list[dict[str, Any]],
    feed_type: str = "default",
    max_workers: int = 8,
) -> dict[str, Any]:
    """
    Pre-generate summaries for all pool_items.

    Checks cache first, only calls OpenAI for missing summaries.
    Uses ThreadPoolExecutor for parallel generation.

    Call this BEFORE the per-user loop so every summary is already cached
    and per-user generation is just fast Firestore reads.
    """
    tasks: list[tuple[str, str, str]] = []
    already_cached = 0
    cache_bucket = _cache_bucket(feed_type)
    summary_map: dict[str, dict[str, Any] | None] = {}

    for item in pool_items:
        url = item.get("url", "")
        title = item.get("title", "")
        content = item.get("content", "")
        if not url or not content:
            continue

        cached = store.get_cached_summary_v2(url, cache_bucket)
        if cached:
            cached_summary = cached.get("summary")
            summary_map[url] = None if _is_rejection(cached_summary) else cached_summary
            already_cached += 1
            continue
        tasks.append((url, title, content))

    stats: dict[str, Any] = {
        "to_generate": len(tasks),
        "already_cached": already_cached,
        "generated": 0,
        "rejected": 0,
        "failed": 0,
        "summary_map": summary_map,
    }

    if not tasks:
        _log_presummary(f"All {already_cached} summaries already cached — nothing to do")
        return stats

    _log_presummary(
        f"Generating {len(tasks)} summaries with {max_workers} parallel workers "
        f"({already_cached} already cached)"
    )

    def _generate_one(task: tuple[str, str, str]) -> tuple[str, str]:
        url, title, content = task
        try:
            summary, error = generate_summary(title, url, content, feed_type=feed_type)
            if summary:
                store.save_cached_summary_v2(url, cache_bucket, summary, MODEL)
                summary_map[url] = summary
                return "generated", title[:50]
            if error.startswith("rejected:"):
                store.save_cached_summary_v2(
                    url, cache_bucket, _rejection_payload(error.split(":", 1)[1]), MODEL
                )
                summary_map[url] = None
                return "rejected", f"{title[:40]}: {error}"
            return "failed", f"{title[:40]}: {error}"
        except Exception as exc:
            return "failed", f"{title[:40]}: {exc}"

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_generate_one, t): t for t in tasks}
        done = 0
        for future in as_completed(futures):
            result, detail = future.result()
            done += 1
            if result == "generated":
                stats["generated"] += 1
            elif result == "rejected":
                stats["rejected"] += 1
            else:
                stats["failed"] += 1
            if done % 10 == 0 or done == len(tasks):
                _log_presummary(
                    f"  Progress: {done}/{len(tasks)} "
                    f"(ok={stats['generated']} "
                    f"rejected={stats['rejected']} fail={stats['failed']})"
                )

    _log_presummary(
        f"Done: {stats['generated']} generated, "
        f"{stats['rejected']} rejected, "
        f"{stats['failed']} failed, "
        f"{stats['already_cached']} were cached"
    )
    return stats
