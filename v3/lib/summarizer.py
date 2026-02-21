"""
V3 summary generation with style-based prompts and Firestore caching.

Cache key = sha256(url + summaryStyle + seniority).
Two users with the same (style, seniority) get identical cached summaries.
"""

from __future__ import annotations

import json
import os
import re
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
) -> tuple[dict[str, Any] | None, str]:
    """
    Generate a summary using the appropriate style prompt.

    Returns (summary_dict, error_string). summary_dict is None on failure.
    """
    client = _get_client()
    if client is None:
        return None, "openai_not_configured"
    if not content:
        return None, "no_content"

    template = STYLE_PROMPTS.get(style, PRACTITIONER_DEEP_DIVE)
    seniority_label = SENIORITY_LABELS.get(seniority, seniority)
    prompt = template.format(
        seniority_label=seniority_label,
        title=title,
        url=url,
        content=content[:12000],
    )

    try:
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
) -> tuple[dict[str, Any] | None, bool]:
    """
    Check cache first, generate if missing.

    Returns (summary_dict, was_cached).
    """
    cached = store.get_cached_summary(url, style, seniority)
    if cached:
        return cached.get("summary"), True

    summary, error = generate_summary(title, url, content, style, seniority)
    if summary:
        store.save_cached_summary(url, style, seniority, summary, MODEL)
        return summary, False

    return None, False
