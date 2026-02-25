"""
V3 summary generation with style-based prompts and Firestore caching.

Cache key = sha256(url + summaryStyle + seniority).
Two users with the same (style, seniority) get identical cached summaries.
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

SENIORITY_LABELS = {
    "early": "early-career (0-3 years experience)",
    "mid": "mid-level (3-7 years experience)",
    "senior": "senior (7-12 years experience)",
    "executive": "executive / lead (12+ years experience)",
}

# ---------------------------------------------------------------------------
# Prompt templates — one per summary style, seniority injected as a variable
# ---------------------------------------------------------------------------

EXECUTIVE_BRIEF = """You are a sharp executive briefer summarizing content for a busy {seniority_label} professional.

Before writing, identify the 3-5 most important NEW facts, conclusions, or implications. Each must be distinct — if two points say the same thing differently, merge them into one.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence — the key takeaway",
    "outline": ["3-5 bullets: the important facts and implications"],
    "body": "Concise analysis in markdown"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Lead with the bottom line — what changed, what it means
- Use numbers and specifics, not vague claims
- Skip background the reader already knows
- Keep paragraphs to 2-3 sentences
- Bold the single most important data point or claim
- Include specific conclusions, data points, or decisions from the article — don't generalize them away
- NEVER write a paragraph that summarizes or restates previous paragraphs. No "In summary", "Overall", "In conclusion", or "To sum up" paragraphs. Ever.
- NEVER repeat the same idea across paragraphs using different words. If you've said it, move on.
- Each paragraph = one distinct point. Delete any paragraph where you can't name a NEW fact it introduces.
- Fewer strong paragraphs > more fluffy ones. 2 paragraphs is fine. 1 is fine if the article is thin.
"""

PRACTITIONER_DEEP_DIVE = """You are a hands-on technical writer creating an actionable summary for a {seniority_label} practitioner.

Before writing, list every distinct actionable insight from the article. Merge any that overlap. Your summary covers each one ONCE.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "The practical insight or framework",
    "outline": ["3-5 bullets: key techniques, tools, or steps"],
    "body": "Detailed walkthrough in markdown"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Start with the core technique or framework
- Include specific tools, methods, or code patterns when relevant
- Use ## headers to break into logical sections if the article has multiple distinct topics
- Give concrete examples, not abstract advice
- Bold key terms and tool names
- Preserve the article's specific conclusions and recommendations — don't water them down into generic advice
- NEVER write a paragraph that summarizes or restates previous paragraphs. No "In summary", "Overall", "In conclusion", "To sum up", or "As a next step, experiment with..." filler. Ever.
- NEVER repeat the same idea across paragraphs using different words. Read back your draft — if two paragraphs make the same point, delete one.
- Each paragraph = one distinct insight. If you can't name the NEW thing it teaches, delete it.
- If the source article is short or has only 1-2 real insights, write 1-2 paragraphs. Do NOT pad thin content.
"""

WATER_COOLER = """You are a smart, well-read friend sharing an interesting find with a {seniority_label} professional.

Before writing, identify the 2-4 most interesting or surprising things from this article. Each must be genuinely different. Your summary hits each one ONCE.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "The hook — why this is interesting",
    "outline": ["3-4 bullets: the talking points"],
    "body": "Engaging, conversational summary in markdown"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Open with the most surprising or conversation-worthy angle
- Write like you're texting a smart colleague, not writing a report
- Keep it light but substantive — no dumbing down
- Include specific stats, names, or facts — these are what make it shareable
- Short paragraphs, punchy sentences
- NEVER write a concluding paragraph that restates what you already said. No "In summary", "Overall", "In conclusion", "To sum up". Ever.
- NEVER repeat the same idea in different words across paragraphs. If you've said it, move on to the next thing.
- If the article is thin and only has 1-2 interesting points, write 1-2 short paragraphs. That's it. Don't stretch.
- The reader should learn something NEW from every single paragraph. If they don't, cut it.
"""

STYLE_PROMPTS = {
    "executive": EXECUTIVE_BRIEF,
    "practitioner": PRACTITIONER_DEEP_DIVE,
    "casual": WATER_COOLER,
}

# ---------------------------------------------------------------------------
# Deep Dive overrides — richer, longer summaries with structured sections
# ---------------------------------------------------------------------------

DEEP_DIVE_EXECUTIVE = """You are a senior analyst creating a thorough briefing on an important industry piece for a {seniority_label} professional.

This is a deep dive — give them real depth, not a surface skim.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One powerful sentence — the core thesis of this piece",
    "outline": ["5-7 key section titles that map the article's structure"],
    "body": "Thorough analysis in markdown — 6-8 paragraphs with ## section headers",
    "key_takeaways": ["3-5 specific, actionable takeaways"],
    "why_it_matters": "2-3 sentences on the bigger-picture significance"
  }},
  "reading_time_minutes": <estimated int, likely 8-20>
}}

RULES:
- Lead with the thesis, not a summary sentence
- Use ## headers to break into 3-4 logical sections
- Include specific data, quotes, or frameworks from the original
- Each section should teach something — not just describe
- "key_takeaways" must be concrete and actionable, not vague platitudes
- "why_it_matters" connects this to broader industry trends
- Bold the most important insights
- This should feel like reading a well-structured report, not a blurb
"""

DEEP_DIVE_PRACTITIONER = """You are a senior technical writer creating an in-depth breakdown for a {seniority_label} practitioner.

This is a deep dive — go deep on the how, not just the what.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "The core technique, framework, or insight",
    "outline": ["5-7 key section titles covering the full scope"],
    "body": "Detailed technical walkthrough in markdown — 6-8 paragraphs with ## section headers",
    "key_takeaways": ["3-5 actionable takeaways with specific tools, methods, or patterns"],
    "why_it_matters": "2-3 sentences on how this changes their workflow or thinking"
  }},
  "reading_time_minutes": <estimated int, likely 8-20>
}}

RULES:
- Start with the problem being solved, then the approach
- Use ## headers for logical sections (e.g., "The Problem", "The Approach", "Implementation", "Results")
- Include specific tools, code patterns, methods, or design frameworks
- Give concrete examples, not abstract advice
- "key_takeaways" should be things they can apply this week
- "why_it_matters" connects to their career and skill growth
- Bold key terms, tools, and metric names
- This should feel like a study guide, not a news summary
"""

DEEP_DIVE_CASUAL = """You are a smart, curious friend who just spent an hour reading something fascinating and is now telling a {seniority_label} professional all about it.

This is a deep dive — go beyond the surface. Make them feel like they read the whole thing.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "The hook — why this piece is worth 15 minutes of their life",
    "outline": ["5-7 key sections that tell the story of the article"],
    "body": "Engaging, in-depth walkthrough in markdown — 6-8 paragraphs with ## section headers",
    "key_takeaways": ["3-5 things they'll remember and want to share"],
    "why_it_matters": "2-3 sentences — the 'so what' in plain language"
  }},
  "reading_time_minutes": <estimated int, likely 8-20>
}}

RULES:
- Open with the most mind-blowing or counterintuitive thing from the piece
- Use ## headers as story beats — guide them through the narrative
- Write conversationally but go deep — "here's where it gets interesting"
- Include the best specific facts, stats, or quotes from the original
- "key_takeaways" are the dinner-party talking points
- "why_it_matters" makes them feel smart about the world
- Short punchy paragraphs but MORE of them — this is a longer read
- Bold the stats and facts that make people say "wait, really?"
"""

DEEP_DIVE_PROMPTS = {
    "executive": DEEP_DIVE_EXECUTIVE,
    "practitioner": DEEP_DIVE_PRACTITIONER,
    "casual": DEEP_DIVE_CASUAL,
}

TRENDING_BRIEF = """You are an elite news editor writing a concise trending brief.

This summary is for a fast-scrolling feed, so make it sharp and useful.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One short line (max 12 words) saying what's new",
    "outline": [],
    "body": "Exactly 2-3 short paragraphs separated by a blank line"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Body paragraph 1: 35-45 words
- Body paragraph 2: 25-35 words
- Body paragraph 3: optional 20-30 words
- Do NOT use markdown headers, bullets, or numbered lists
- You MAY use light markdown emphasis with **bold** (max 1-2 highlights total)
- Use plain language, no fluff
- Paragraph 1 must include concrete specifics (at least one of: company/org, metric/number, timeline/date, or named product/model)
- Paragraph 2 must be a clear conclusion/so-what (impact, risk, or practical implication)
- Do NOT prefix paragraphs with labels like "What's new:", "What happened:", "Why it matters:", "The impact:"
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


def _cache_bucket(
    style: str, seniority: str, feed_type: str
) -> tuple[str, str]:
    # Trending is shared across users by design; keep one cache bucket.
    if feed_type == "trending":
        return "trending__brief_v3", "all"
    if feed_type == "deep_dives":
        return f"{style}__deep", seniority
    return style, seniority


def summary_lookup_key(
    url: str, style: str, seniority: str, feed_type: str = "default",
) -> tuple[str, str, str]:
    cache_style, cache_seniority = _cache_bucket(style, seniority, feed_type)
    return (url, cache_style, cache_seniority)


def _clip_words(text: str, max_words: int) -> str:
    words = (text or "").split()
    if len(words) <= max_words:
        return " ".join(words).strip()
    return " ".join(words[:max_words]).strip()


def _normalize_trending_summary(parsed: dict[str, Any]) -> dict[str, Any]:
    short = parsed.get("short_article")
    if not isinstance(short, dict):
        short = {}

    subtitle = _clip_words(str(short.get("subtitle", "")).strip(), 12)

    body = str(short.get("body", "")).strip()
    body = re.sub(r"^\s*#+\s*", "", body, flags=re.MULTILINE)
    body = re.sub(r"^\s*[-*]\s+", "", body, flags=re.MULTILINE)
    body = re.sub(r"^\s*\d+\.\s+", "", body, flags=re.MULTILINE)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    label_prefix = re.compile(
        r"^\s*(what'?s\s+new|what\s+happened|why\s+it\s+matters|the\s+impact|bottom\s+line)\s*:\s*",
        re.IGNORECASE,
    )
    paragraphs = [label_prefix.sub("", p).strip() for p in paragraphs if p.strip()]
    if not paragraphs:
        paragraphs = [subtitle or "Fresh developments in this story are drawing attention."]

    first = _clip_words(paragraphs[0], 45)
    second_source = " ".join(paragraphs[1:]).strip() or first
    second = _clip_words(label_prefix.sub("", second_source).strip(), 30)

    short["subtitle"] = subtitle
    short["outline"] = []
    short["body"] = f"{first}\n\n{second}".strip()
    parsed["short_article"] = short
    return parsed


def _get_client() -> OpenAI | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return OpenAI(api_key=key) if key else None


def generate_summary(
    title: str,
    url: str,
    content: str,
    style: str,
    seniority: str,
    feed_type: str = "default",
) -> tuple[dict[str, Any] | None, str]:
    """
    Generate a summary using the appropriate style prompt.

    For feed_type="deep_dives", uses a richer prompt that produces longer
    summaries with key_takeaways and why_it_matters fields.

    Returns (summary_dict, error_string). summary_dict is None on failure.
    """
    client = _get_client()
    if client is None:
        return None, "openai_not_configured"
    if not content:
        return None, "no_content"

    if feed_type == "deep_dives":
        template = DEEP_DIVE_PROMPTS.get(style, DEEP_DIVE_PRACTITIONER)
    elif feed_type == "trending":
        template = TRENDING_BRIEF
    else:
        template = STYLE_PROMPTS.get(style, PRACTITIONER_DEEP_DIVE)
    seniority_label = SENIORITY_LABELS.get(seniority, seniority)
    gate_suffix = (
        "\n" + QUALITY_GATE_RULES + "\n"
        "Return JSON with EXACT structure:\n"
        '{{\n'
        '  "rejected": <true|false>,\n'
        '  "rejection_reason": "<short reason when rejected, '
        'else empty string>",\n'
        '  "short_article": {{\n'
        '    "subtitle": "...",\n'
        '    "outline": [],\n'
        '    "body": "..."\n'
        '  }},\n'
        '  "reading_time_minutes": <estimated int>\n'
        '}}\n'
    )
    prompt = (template + gate_suffix).format(
        seniority_label=seniority_label,
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
    style: str,
    seniority: str,
    feed_type: str = "default",
) -> tuple[dict[str, Any] | None, bool]:
    """
    Check cache first, generate if missing.
    feed_type="deep_dives" uses a richer prompt and a separate cache bucket.

    Returns (summary_dict, was_cached).
    """
    cache_style, cache_seniority = _cache_bucket(style, seniority, feed_type)
    cached = store.get_cached_summary(url, cache_style, cache_seniority)
    if cached:
        cached_summary = cached.get("summary")
        if _is_rejection(cached_summary):
            return None, True
        return cached_summary, True

    summary, error = generate_summary(
        title, url, content, style, seniority, feed_type=feed_type,
    )
    if summary:
        store.save_cached_summary(
            url, cache_style, cache_seniority, summary, MODEL
        )
        return summary, False
    if error.startswith("rejected:"):
        store.save_cached_summary(
            url,
            cache_style,
            cache_seniority,
            _rejection_payload(error.split(":", 1)[1]),
            MODEL,
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
    style_seniority_combos: list[tuple[str, str]],
    feed_type: str = "default",
    max_workers: int = 8,
) -> dict[str, Any]:
    """
    Pre-generate summaries for all pool_items × style/seniority combos.

    Checks cache first, only calls OpenAI for missing summaries.
    Uses ThreadPoolExecutor for parallel generation.

    Call this BEFORE the per-user loop so every summary is already cached
    and per-user generation is just fast Firestore reads.
    """
    tasks: list[tuple[str, str, str, str, str, str]] = []
    already_cached = 0
    summary_map: dict[tuple[str, str, str], dict[str, Any] | None] = {}

    for item in pool_items:
        url = item.get("url", "")
        title = item.get("title", "")
        content = item.get("content", "")
        if not url or not content:
            continue

        for style, seniority in style_seniority_combos:
            cache_style, cache_seniority = _cache_bucket(
                style, seniority, feed_type
            )
            cached = store.get_cached_summary(
                url, cache_style, cache_seniority
            )
            if cached:
                cached_summary = cached.get("summary")
                summary_map[(url, cache_style, cache_seniority)] = (
                    None if _is_rejection(cached_summary) else cached_summary
                )
                already_cached += 1
                continue
            tasks.append((url, title, content, style, seniority, feed_type))

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

    def _generate_one(
        task: tuple[str, str, str, str, str, str],
    ) -> tuple[str, str]:
        url, title, content, style, seniority, ft = task
        try:
            summary, error = generate_summary(
                title, url, content, style, seniority, feed_type=ft,
            )
            if summary:
                cache_style, cache_seniority = _cache_bucket(
                    style, seniority, ft
                )
                store.save_cached_summary(
                    url,
                    cache_style,
                    cache_seniority,
                    summary,
                    MODEL,
                )
                summary_map[(url, cache_style, cache_seniority)] = summary
                return "generated", title[:50]
            if error.startswith("rejected:"):
                cache_style, cache_seniority = _cache_bucket(
                    style, seniority, ft
                )
                store.save_cached_summary(
                    url,
                    cache_style,
                    cache_seniority,
                    _rejection_payload(error.split(":", 1)[1]),
                    MODEL,
                )
                summary_map[(url, cache_style, cache_seniority)] = None
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
