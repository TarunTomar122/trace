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

Deliver the key takeaways and business impact. No jargon, no filler — just what matters.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence — the key takeaway",
    "outline": ["3-4 bullets: the important facts and implications"],
    "body": "Concise analysis in markdown — 3-4 paragraphs max"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Lead with the bottom line — what changed, what it means
- Use numbers and specifics, not vague claims
- Skip background the reader already knows
- End with "so what" — why this matters for their work
- Keep paragraphs to 2-3 sentences
- Bold the single most important data point or claim
"""

PRACTITIONER_DEEP_DIVE = """You are a hands-on technical writer creating an actionable summary for a {seniority_label} practitioner.

They want how-to details, frameworks, and steps they can actually use.

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
    "body": "Detailed walkthrough in markdown — 4-6 paragraphs"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Start with the core technique or framework
- Include specific tools, methods, or code patterns when relevant
- Use ## headers to break into logical sections
- Give concrete examples, not abstract advice
- End with actionable next steps
- Bold key terms and tool names
"""

WATER_COOLER = """You are a smart, well-read friend sharing an interesting find with a {seniority_label} professional.

Make them sound informed in their next meeting. Casual but accurate.

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
    "body": "Engaging, conversational summary in markdown — 3-4 paragraphs"
  }},
  "reading_time_minutes": <estimated int>
}}

RULES:
- Open with the most surprising or conversation-worthy angle
- Write like you're texting a smart colleague, not writing a report
- Use "here's the thing" / "turns out" / "the wild part" energy
- Include one specific stat or fact they can drop in conversation
- Keep it light but substantive — no dumbing down
- Short paragraphs, punchy sentences
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
    else:
        template = STYLE_PROMPTS.get(style, PRACTITIONER_DEEP_DIVE)
    seniority_label = SENIORITY_LABELS.get(seniority, seniority)
    prompt = template.format(
        seniority_label=seniority_label,
        title=title,
        url=url,
        content=content[:12000],
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
    if not parsed or "short_article" not in parsed:
        return None, "bad_json_response"
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
    cache_style = f"{style}__deep" if feed_type == "deep_dives" else style
    cached = store.get_cached_summary(url, cache_style, seniority)
    if cached:
        return cached.get("summary"), True

    summary, error = generate_summary(
        title, url, content, style, seniority, feed_type=feed_type,
    )
    if summary:
        store.save_cached_summary(url, cache_style, seniority, summary, MODEL)
        return summary, False

    return None, False
