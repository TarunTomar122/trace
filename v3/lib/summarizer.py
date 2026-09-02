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
FOR_YOU_PROSE_MODEL = "gpt-5-mini"
TEMPERATURE = 0.3
TIMEOUT = 45

SUMMARY_SYSTEM_PROMPT = """You are a rigorous editor at Trace, a professional tech news product.
You return valid JSON only. No markdown code fences.
Your summaries must be source-faithful, concrete, and dense with specific facts.
Never write generic news filler, throat-clearing openers, or commentary that adds no new information.
Body and key_takeaways must complement each other: the body tells the story; takeaways add distinct facts not already in the body."""

# ---------------------------------------------------------------------------
# Technical depth detection from user profile
# ---------------------------------------------------------------------------

TECHNICAL_ROLES = {"developer", "founder", "engineer"}
TECHNICAL_SENIORITIES = {"senior", "executive"}
TECHNICAL_INTERESTS = {"engineering", "ai", "tech", "technology", "ai-machine-learning"}


def compute_technical_depth(profile: dict) -> str:
    """
    Determine if user prefers technical ('deep') or accessible summaries.

    Returns 'deep' or 'accessible'.
    """
    role = (profile.get("role") or "").lower().strip()
    seniority = (profile.get("seniority") or "").lower().strip()
    interests = {i.lower().strip() for i in (profile.get("interests") or [])}

    # Technical if: (technical role + senior) OR has technical interests
    is_technical_role = role in TECHNICAL_ROLES
    is_senior = seniority in TECHNICAL_SENIORITIES
    has_technical_interests = bool(interests & TECHNICAL_INTERESTS)

    if (is_technical_role and is_senior) or has_technical_interests:
        return "deep"
    return "accessible"


# ---------------------------------------------------------------------------
# Unified summary prompt — one style for all "For You" content
# ---------------------------------------------------------------------------

FOR_YOU_SUMMARY = """Write a source-faithful summary for a For You evergreen feed.

The reader wants two complementary layers that together capture much more of the source than a typical short summary:
1. A readable body with the story, context, and main arguments.
2. Key takeaways with additional concrete facts they would miss if they only read the body.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence capturing the central idea or tension",
    "key_takeaways": ["4-6 concrete points with real specifics from the source"],
    "body": "Informative summary in markdown (see rules below)",
    "mobile_card_summary": "1-2 short paragraphs, max 90 words total, plain prose — no markdown, no bullets, no headers. Written for a phone card. Start with the core idea. Be concrete and punchy."
  }},
  "reading_time_minutes": <estimated int>
}}

COVERAGE RULE (VERY IMPORTANT):
- Before writing, mentally list the distinct facts, claims, examples, numbers, and named entities in the source.
- Body + key_takeaways together should capture the top 8-12 most important items from that list.
- Do not compress the whole article into 3 ideas repeated twice.
- Missing a major named company, product, number, or specific claim from the source is a failure unless the article is extremely thin.

REQUIREMENTS:
- Preserve the source's actual ideas, examples, and specific details when they matter.
- Keep the writing balanced: not too technical, not too abstract.
- Make it feel informative and readable, not academic, not like a recommendation, and not like commentary on the source.
- Do not say "this article", "this piece", "the author", or similar.
- Do not invent facts, labels, or explanations that are not supported by the source.
- Avoid generic summary language like "highlights", "underscores", "serves as", "critics argue", or "the importance of".
- Prefer concrete nouns, examples, and distinctions over vague interpretation.
- If the source contains useful examples, numbers, edge cases, or memorable quirks, keep them.
- Never use em dashes. Use commas, periods, or colons instead.

BODY RULES:
- Target 120-220 words across 4-6 short paragraphs.
- This summary will be read on a phone screen, but it should still feel substantial.
- Most paragraphs should be 1-3 sentences.
- Insert a blank line between every paragraph.
- Do not return one large paragraph. If the body is a single block of text, it is wrong.
- Start with the strongest fact, claim, or tension — not throat-clearing like "As X continues to..." or "In recent years..."
- Include the single best number, date, or named entity from the source when one exists.
- You may use short markdown headings like ## Context or ## Why it matters when they improve readability.
- You may use a short bullet list for steps, examples, named points, or concrete facts, but only when the source naturally supports it.
- Plain, strong English.
- No concluding fluff. No "In summary", "Overall", or "In conclusion".

KEY_TAKEAWAYS RULES:
- 4-6 takeaways when the source supports them.
- Each should be one sentence with a concrete fact.
- Each takeaway must add information not already substantially covered in the body.
- Prioritize: numbers -> named companies/products/people -> examples -> rollout details -> consequences.
- Do not paraphrase the body sentence by sentence.
- Cut any takeaway that's obvious, generic, unsupported, or repetitive.
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
    "why_it_matters": "2-3 sentences on the bigger-picture significance",
    "mobile_card_summary": "1-2 short paragraphs, max 90 words total, plain prose — no markdown, no bullets, no headers. Written for a phone card. Start with the core idea. Be concrete and punchy."
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

TRENDING_BRIEF = """You are a rigorous editor writing a high-signal brief for a fast-moving story.

The reader wants two complementary layers that together feel fuller than a typical news blurb:
1. A body paragraph that reads naturally and tells the story clearly.
2. Key takeaways with additional concrete facts they would miss if they only read the body.

The body and takeaways must do different jobs. Do not make the takeaways restate the body.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "interest_id": "One canonical interest id from the allowed list below",
  "short_article": {{
    "subtitle": "One short factual line (max 14 words) saying what changed",
    "headline": "Short factual overlay headline (6-10 words max)",
    "key_takeaways": [
      "3-5 one-sentence bullets with only additional concrete details"
    ],
    "slides": [
      "Slide 1: What happened — who, what, and the most important number/name (30-45 words)",
      "Slide 2: The strongest supporting detail or concrete consequence (25-40 words)",
      "Slide 3 (optional): A second concrete detail only if it adds real information (20-35 words)"
    ],
    "body": "A natural news paragraph, 3-5 sentences and about 100-160 words, that reads like a strong article lead",
    "mobile_card_summary": "1-2 short paragraphs, max 90 words total, plain prose — no markdown, no bullets, no headers. Written for a phone card. Start with the core news. Be concrete and punchy.",
    "outline": []
  }},
  "reading_time_minutes": <estimated int>
}}

COVERAGE RULE (VERY IMPORTANT):
- Before writing, mentally list the distinct facts, claims, examples, numbers, and named entities in the source.
- Body + key_takeaways together should capture the top 8-10 most important items from that list.
- Do not compress the whole article into 3 ideas repeated twice.
- Missing a major named company, product, number, or specific claim from the source is a failure unless the article is extremely thin.

RULES:
- Choose exactly one interest_id from this allowed list:
  ai, tech, startups, markets, engineering, product-design, marketing
- Pick the interest_id based on the actual story itself, not the publisher.
- Prefer narrower lanes when clearly supported:
  model launches, AI products or assistants, AI agents, agent frameworks,
  LLMs, MCP, generative-AI features, and AI policy -> ai
  If a product update adds a material AI assistant, agent, research, or
  language-model capability, use ai even when it also lists ordinary UI or
  workflow changes.
  use product-design, tech, or engineering only when AI is incidental and
  not the core development
  startup funding/M&A/ecosystem/founder news -> startups
  earnings/public markets/company strategy/M&A at large companies -> markets
  developer tools/infra/security/platform engineering -> engineering
  app redesigns/product changes/UX/interface decisions -> product-design
  ad platforms/SEO/GTM/distribution -> marketing
  payments/banking/trading/crypto/financial platforms -> fintech
  use tech for broad consumer tech/platform/device/software stories when no narrower lane fits
- Never return legacy labels like technology, business-market, experience, leadership, productivity, climate, health, or web3.
- Write like a sharp reporter, not a marketer.
- The body is the main story layer. It must read naturally as a paragraph, not as disguised bullet points.
- In the body, cover the core development, the main actors, and the most important concrete detail or consequence from the source.
- Start the body with the strongest fact, demand, or development — not throat-clearing like "As X floods Y..." or "Users are calling for..."
- Include the single best number, percentage, or date from the source in the body when one exists.
- Do not write a generic first sentence followed by filler. Every sentence in the body must add real information.
- Never write "Critics argue", "paying lip service", "underscores a trend", or other commentary that adds no new fact.
- Return 3-5 key takeaways when the source supports them. Prefer fewer only if the article is genuinely thin.
- Key takeaways are the skim layer. Use them for concrete details a reader might miss if they skip the paragraph.
- Each key takeaway must add information that is not already substantially covered in the body.
- Key takeaways must be one complete sentence each, not fragments and not mini-paragraphs.
- When choosing key takeaways, prefer this order:
  1. Exact numbers, prices, percentages, dates, or counts that matter
  2. Named companies, products, people, places, or agencies tied to the event
  3. Concrete deal terms, rollout details, operational effects, or direct consequences stated in the source
  4. Only then, a broader framing point if the source explicitly supports it with specifics
- Use actual names, products, places, numbers, prices, dates, or decisions when present.
- Never write filler like "ongoing improvements", "this highlights a broader trend", "the update is part of...", or "the redesign was announced on...".
- Do not speculate. No "could", "may", "might", "expected to", or generic future talk unless the source explicitly says it.
- Do not include publication dates as a key point unless the timing itself is central to the story.
- Do not create key takeaways by paraphrasing the body sentence by sentence.
- If the source has no good additive bullets, return an empty list rather than weak repetition.
- slides: Each is a standalone chunk. No headers or labels. Plain prose.
- 2 slides minimum, 3 only if the story genuinely has a third concrete detail.
- Include ONE bold stat or name per slide using **bold**
- Slide 1 = the core fact
- Slide 2 = the strongest supporting detail
- Slide 3 = optional extra concrete detail, not commentary

GOOD KEY TAKEAWAY EXAMPLE:
- **Google Maps Go** now uses a gradient app icon that matches Google's newer visual system.

BAD KEY TAKEAWAY EXAMPLES:
- The redesign was announced on March 9, 2026.
- The update is part of ongoing improvements to the app.
- This could reshape the future of mapping.
- The deal is part of a broader trend of investor interest.
- Current AI labeling efforts on platforms like YouTube and Instagram are ineffective. (BAD if the body already says labeling is ineffective)

BAD BODY EXAMPLE:
"As AI-generated content floods social media, users are calling for platforms to introduce filters. Current labeling systems have proven ineffective. Critics argue that without user-controlled filtering options, platforms are merely paying lip service to the issue."
"""

# ---------------------------------------------------------------------------
# Technical Depth Variants — DEEP (jargon-friendly) vs ACCESSIBLE (plain)
# ---------------------------------------------------------------------------

FOR_YOU_DEEP = """You are a skilled editor creating a CONCISE summary for an experienced technical professional.

Your reader is senior/technical — they know industry jargon and don't need hand-holding.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence capturing the main point — can use technical terms",
    "key_takeaways": ["3-4 key points — specific, technical, actionable"],
    "body": "Concise summary in markdown (see rules below)",
    "mobile_card_summary": "1-2 short paragraphs, max 90 words total, plain prose — no markdown, no bullets, no headers. Written for a phone card. Start with the core idea. Be concrete and punchy."
  }},
  "reading_time_minutes": <estimated int>
}}

BODY RULES:
- Assume domain knowledge — use technical terms freely (RLHF, RAG, transformers, etc.)
- SHORT paragraphs: 2-3 sentences max
- Total: 2-4 paragraphs. Dense and information-packed.
- Include specific metrics, model names, architectures, benchmarks
- Bold key numbers and technical claims
- NO dumbed-down explanations. Skip "this means..." or "in other words..."
- NO concluding paragraphs. No "In summary", "Overall". Ever.

KEY_TAKEAWAYS RULES:
- Technical and specific — include tool names, version numbers, metrics
- Actionable for practitioners — what can they use or try?
"""

FOR_YOU_ACCESSIBLE = """You are a skilled editor creating a CLEAR summary for a professional learning about this topic.

Your reader is smart but may not know all the jargon. Explain technical concepts briefly.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence capturing the main point in plain language",
    "key_takeaways": ["3-4 key points — clear, practical insights"],
    "body": "Clear summary in markdown (see rules below)",
    "mobile_card_summary": "1-2 short paragraphs, max 90 words total, plain prose — no markdown, no bullets, no headers. Written for a phone card. Start with the core idea. Be concrete and punchy."
  }},
  "reading_time_minutes": <estimated int>
}}

BODY RULES:
- When using technical terms, add a brief inline clarification: "RLHF (learning from human feedback)"
- SHORT paragraphs: 2-3 sentences max
- Total: 2-4 paragraphs. Clear and accessible.
- Focus on the "so what" — why does this matter to the reader?
- Bold key facts and numbers
- NO jargon without explanation. But don't over-explain either.
- NO concluding paragraphs. No "In summary", "Overall". Ever.

KEY_TAKEAWAYS RULES:
- Practical and understandable — what's the real-world impact?
- Avoid acronyms unless explained
"""

DEEP_DIVE_DEEP = """You are creating an in-depth breakdown for an experienced technical professional.

Go deep. Use technical language. The reader should feel like they absorbed a technical article.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One powerful sentence — the core technical thesis",
    "key_takeaways": ["4-6 specific, technical, actionable takeaways"],
    "body": "Thorough technical analysis in markdown",
    "why_it_matters": "2-3 sentences on industry/technical significance"
  }},
  "reading_time_minutes": <estimated int>
}}

BODY RULES:
- Use ## headers to break into 3-5 logical technical sections
- Include architectures, benchmarks, comparisons, code patterns
- Technical depth: model sizes, latency numbers, accuracy metrics
- Bold the most important technical insights
- 6-10 paragraphs — comprehensive for practitioners
- NO "In summary", "Overall". Ever.
"""

DEEP_DIVE_ACCESSIBLE = """You are creating an in-depth breakdown that makes complex topics understandable.

Go deep, but keep it clear. Explain concepts as you go.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One clear sentence — the core insight",
    "key_takeaways": ["4-6 practical, understandable takeaways"],
    "body": "Thorough but accessible analysis in markdown",
    "why_it_matters": "2-3 sentences on real-world significance"
  }},
  "reading_time_minutes": <estimated int>
}}

BODY RULES:
- Use ## headers with clear, descriptive titles
- When introducing technical concepts, explain briefly
- Focus on implications and applications, not just mechanics
- Bold key insights and numbers
- 6-10 paragraphs — thorough but readable
- NO "In summary", "Overall". Ever.
"""

# ---------------------------------------------------------------------------
# Learning Cards — swipeable bite-sized cards for mobile
# ---------------------------------------------------------------------------

LEARNING_CARDS_PROMPT = """You are creating LEARNING CARDS — bite-sized, swipeable content for mobile.

Think Instagram stories but for learning. Each card is ONE idea, easily digestible while scrolling.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence hook — makes reader want to swipe through",
    "learning_cards": [
      {{
        "type": "hook",
        "emoji": "🎯",
        "content": "What this is about in 2-3 punchy sentences. Set the stage."
      }},
      {{
        "type": "insight",
        "emoji": "💡",
        "content": "Key insight #1 — one specific, interesting point (40-60 words)"
      }},
      {{
        "type": "insight",
        "emoji": "🔍",
        "content": "Key insight #2 — another important point (40-60 words)"
      }},
      {{
        "type": "why",
        "emoji": "🎯",
        "content": "Why this matters — connect to reader's work/life (40-60 words)"
      }},
      {{
        "type": "bottom_line",
        "emoji": "⚡",
        "content": "The key point — what this means or what to remember (30-50 words)"
      }}
    ]
  }},
  "reading_time_minutes": <estimated int>
}}

CARD RULES:
- 4-6 cards total. Hook first, Bottom Line last.
- Each card: ONE idea only. If you need to say "also" or "additionally", make a new card.
- 40-70 words per card MAX. Ruthlessly cut fluff.
- Use **bold** for ONE key term or number per card.
- Conversational tone — like a smart friend explaining something cool.
- Include specific names, numbers, tools — no vague generalities.
- insight cards: Include 2-4 depending on article depth.
- NO headers or labels in content — the type field handles that.

EMOJI GUIDE:
- hook: 🎯 or 📌 or 🔥
- insight: 💡 or 🔍 or 📊 or 🧠 or 🛠️
- why: 🎯 or 💪 or 🌍
- bottom_line: ⚡ or ✅ or 🚀
"""

LEARNING_CARDS_DEEP = """You are creating LEARNING CARDS for a technical audience — bite-sized, swipeable.

Reader knows their stuff. Use jargon freely. Dense, technical, no hand-holding.

SOURCE:
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence technical hook",
    "learning_cards": [
      {{
        "type": "hook",
        "emoji": "🎯",
        "content": "Technical context — what's new/interesting (2-3 sentences)"
      }},
      {{
        "type": "insight",
        "emoji": "💡",
        "content": "Technical insight — architecture, benchmarks, implementation (50-70 words)"
      }},
      {{
        "type": "insight",
        "emoji": "🔍",
        "content": "Another key technical point (50-70 words)"
      }},
      {{
        "type": "why",
        "emoji": "🎯",
        "content": "Industry/practical implications (40-60 words)"
      }},
      {{
        "type": "bottom_line",
        "emoji": "⚡",
        "content": "The key point — what this enables or changes (30-50 words)"
      }}
    ]
  }},
  "reading_time_minutes": <estimated int>
}}

CARD RULES:
- 4-6 cards. Hook first, Bottom Line last.
- ONE idea per card. Dense but focused.
- 50-70 words per insight card. Technical depth welcome.
- **Bold** key metrics, model names, or tools.
- Include version numbers, benchmarks, specific tools.
- Use technical jargon — no explanations needed.
"""


QUALITY_GATE_RULES = """
QUALITY GATE (VERY IMPORTANT):
- First, judge whether this source is genuinely useful for professionals.
- Reject low-signal or junk content such as: pure promos/ads, coupons/deals,
  shopping roundups, affiliate pieces, watch-live filler, thin clickbait,
  or articles with too little substance to summarize well.
- Reject sponsored or commercial content such as: "Sponsored Post", advertorials,
  vendor promos, partner content, product marketing disguised as an article,
  hiring/role-listing posts, or brand/customer success writeups that are mainly promotional.
- Reject entertainment, celebrity, awards-show, culture-war, or general lifestyle stories
  unless the article has a clear, concrete tech/business/product angle that would genuinely
  matter to professionals following Trace.
- For trending specifically, if the story does not plausibly belong in one of the allowed
  professional lanes, reject it instead of force-fitting it into a tag.
- If the title or opening content makes it clear this is sponsored, paid, or promotional,
  reject it even if the rest of the article is readable.
- If rejected, set "rejected": true and include a short reason.
- If accepted, set "rejected": false and produce the full summary fields.
"""

FOR_YOU_FIT_GATE_PROMPT = """You are a strict relevance gate for a personalized learning feed.

Decide if this article is a good fit for the intended learning lane.
Reject if it is mostly politics, legal/government drama, macro geopolitics,
consumer shopping/deals, celebrity/news gossip, or generally off-lane content.

TARGET LANE:
- interest_id: {interest_id}
- subinterest_id: {subinterest_id}
- source_name: {source_name}

ARTICLE:
Title: {title}
URL: {url}
Content excerpt:
{content}

Return JSON ONLY:
{{
  "is_fit": <true|false>,
  "reason": "short reason",
  "primary_topic": "short topic label"
}}
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


def _cache_bucket(feed_type: str, technical_depth: str = "", output_format: str = "") -> str:
    """Return cache bucket name for the feed type, technical depth, and format.

    technical_depth: 'deep' or 'accessible' (empty = legacy/default)
    output_format: 'cards' for learning cards, '' for prose (default)
    """
    if feed_type == "trending":
        return "trending_v9"  # stronger relevance gate for professional/news lane fit
    if feed_type == "deep_dives":
        if technical_depth == "deep":
            return "deep_dive_v6_deep"
        if technical_depth == "accessible":
            return "deep_dive_v6_accessible"
        return "deep_dive_v4"  # legacy
    # for_you / default
    if output_format == "cards":
        if technical_depth == "deep":
            return "for_you_cards_v1_deep"
        return "for_you_cards_v1"
    if technical_depth == "deep":
        return "for_you_v8_deep"
    if technical_depth == "accessible":
        return "for_you_v8_accessible"
    return "for_you_v8"


def _fit_cache_bucket() -> str:
    return "for_you_fit_v1"


def evaluate_for_you_fit(
    title: str,
    url: str,
    content: str,
    interest_id: str,
    subinterest_id: str,
    source_name: str,
) -> tuple[bool, str]:
    """
    LLM relevance gate for for_you lane fit.

    Returns (is_fit, reason).
    """
    client = _get_client()
    if client is None:
        # Fail-open if key is missing; hard filters still run upstream.
        return True, "openai_not_configured"
    if not content:
        return False, "no_content"

    prompt = FOR_YOU_FIT_GATE_PROMPT.format(
        interest_id=interest_id or "",
        subinterest_id=subinterest_id or "",
        source_name=source_name or "",
        title=title or "",
        url=url or "",
        content=(content or "")[:4000],
    )
    try:
        model_name = MODEL
        if feed_type not in ("trending", "deep_dives") and output_format != "cards":
            model_name = FOR_YOU_PROSE_MODEL

        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": "Return valid JSON only. No markdown fences.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            timeout=30,
        )
    except Exception as exc:
        # Fail-open on transient errors to avoid blocking feed generation.
        return True, f"fit_gate_error:{exc}"

    parsed = _parse_summary_json((resp.choices[0].message.content or "").strip()) or {}
    is_fit = bool(parsed.get("is_fit"))
    reason = str(parsed.get("reason", "")).strip()[:200]
    if is_fit:
        return True, reason or "fit"
    return False, reason or "off_topic_for_lane"


def summary_lookup_key(url: str, feed_type: str = "default", technical_depth: str = "", output_format: str = "") -> tuple[str, str]:
    """Return (url, cache_bucket) for cache lookups."""
    return (url, _cache_bucket(feed_type, technical_depth, output_format))


def _normalize_text_for_overlap(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().lower()


def _takeaway_overlaps_body(takeaway: str, body: str, threshold: float = 0.55) -> bool:
    """Return True when a takeaway substantially repeats the body."""
    takeaway_norm = _normalize_text_for_overlap(takeaway)
    body_norm = _normalize_text_for_overlap(body)
    if not takeaway_norm or not body_norm:
        return False
    if takeaway_norm in body_norm:
        return True

    words = [word for word in re.findall(r"[a-z0-9]{5,}", takeaway_norm)]
    if not words:
        return takeaway_norm in body_norm

    hits = sum(1 for word in words if word in body_norm)
    return (hits / len(words)) >= threshold


def _dedupe_takeaways_from_body(body: str, takeaways: Any, *, max_items: int = 6) -> list[str]:
    if not isinstance(takeaways, list):
        return []

    cleaned: list[str] = []
    for raw in takeaways:
        point = str(raw).strip()
        if not point:
            continue
        if _takeaway_overlaps_body(point, body):
            continue
        cleaned.append(point)
        if len(cleaned) >= max_items:
            break
    return cleaned


def _clean_summary_body(body: str, *, fallback: str = "") -> str:
    body = str(body or "").strip()
    body = re.sub(r"^\s*#+\s*", "", body, flags=re.MULTILINE)
    body = re.sub(r"^\s*[-*]\s+", "", body, flags=re.MULTILINE)
    body = re.sub(r"^\s*\d+\.\s+", "", body, flags=re.MULTILINE)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    label_prefix = re.compile(
        r"^\s*(what'?s\s+new|what\s+happened|why\s+it\s+matters|the\s+impact|bottom\s+line)\s*:\s*",
        re.IGNORECASE,
    )
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    paragraphs = [label_prefix.sub("", p).strip() for p in paragraphs if p.strip()]

    if not paragraphs:
        return fallback.strip()
    return "\n\n".join(paragraphs)


def _normalize_short_article_summary(
    parsed: dict[str, Any],
    *,
    strip_markdown_body: bool = False,
    body_fallback: str = "Fresh developments in this story are drawing attention.",
) -> dict[str, Any]:
    short = parsed.get("short_article")
    if not isinstance(short, dict):
        short = {}

    subtitle = str(short.get("subtitle", "")).strip()
    body = str(short.get("body", "")).strip()
    if strip_markdown_body:
        body = _clean_summary_body(body, fallback=subtitle or body_fallback)
    else:
        body = _clean_summary_body(body, fallback=subtitle or body_fallback)

    takeaways = short.get("key_takeaways")
    short["subtitle"] = subtitle
    short["body"] = body
    short["key_takeaways"] = _dedupe_takeaways_from_body(body, takeaways)
    parsed["short_article"] = short
    return parsed


def _normalize_trending_summary(parsed: dict[str, Any]) -> dict[str, Any]:
    """Clean up trending summary - remove markdown formatting but keep full content."""
    allowed_interest_ids = {
        "ai",
        "tech",
        "startups",
        "markets",
        "engineering",
        "marketing",
        "fintech",
        "product-design",
    }
    parsed = _normalize_short_article_summary(parsed, strip_markdown_body=True)
    short = parsed.get("short_article")
    if isinstance(short, dict):
        short["outline"] = []
        parsed["short_article"] = short
    interest_id = str(parsed.get("interest_id", "")).strip().lower()
    legacy_map = {
        "technology": "tech",
        "business-market": "markets",
        "business": "markets",
        "experience": "product-design",
        "design": "product-design",
        "leadership": "markets",
        "productivity": "tech",
        "health": "tech",
        "web3": "fintech",
        "climate": "tech",
    }
    interest_id = legacy_map.get(interest_id, interest_id)
    parsed["interest_id"] = interest_id if interest_id in allowed_interest_ids else "tech"
    return parsed


def _get_client() -> OpenAI | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return OpenAI(api_key=key) if key else None


def generate_summary(
    title: str,
    url: str,
    content: str,
    feed_type: str = "default",
    technical_depth: str = "",
    output_format: str = "",
) -> tuple[dict[str, Any] | None, str]:
    """
    Generate a summary using the appropriate prompt for the feed type.

    feed_type options:
    - "default" or "for_you": Standard summary with key_takeaways
    - "deep_dives": Longer, more comprehensive summary
    - "trending": Short news brief

    technical_depth options:
    - "deep": Technical jargon-friendly, dense
    - "accessible": Plain language, explains concepts
    - "": Use legacy default prompt

    output_format options:
    - "cards": Generate learning cards (swipeable mobile format)
    - "": Generate prose summary (default)

    Returns (summary_dict, error_string). summary_dict is None on failure.
    """
    client = _get_client()
    if client is None:
        return None, "openai_not_configured"
    if not content:
        return None, "no_content"

    # Select prompt template based on feed_type, technical_depth, and output_format
    if output_format == "cards" and feed_type not in ("trending", "deep_dives"):
        # Learning cards format
        if technical_depth == "deep":
            template = LEARNING_CARDS_DEEP
        else:
            template = LEARNING_CARDS_PROMPT
    elif feed_type == "deep_dives":
        if technical_depth == "deep":
            template = DEEP_DIVE_DEEP
        elif technical_depth == "accessible":
            template = DEEP_DIVE_ACCESSIBLE
        else:
            template = DEEP_DIVE_SUMMARY
    elif feed_type == "trending":
        template = TRENDING_BRIEF  # trending doesn't vary by depth
    else:
        # for_you / default prose
        # Keep a single source-faithful summary style for For You.
        # Personalization should come from source selection, not from
        # dramatically different summary voices.
        template = FOR_YOU_SUMMARY

    # Gate suffix varies based on output format
    if output_format == "cards":
        gate_suffix = (
            "\n" + QUALITY_GATE_RULES + "\n"
            "Add rejected/rejection_reason to your JSON response."
        )
    elif feed_type == "trending":
        gate_suffix = (
            "\n" + QUALITY_GATE_RULES + "\n"
            "Return JSON with EXACT structure:\n"
            '{{\n'
            '  "rejected": <true|false>,\n'
            '  "rejection_reason": "<short reason when rejected, else empty string>",\n'
            '  "interest_id": "<one canonical interest id>",\n'
            '  "short_article": {{\n'
            '    "subtitle": "...",\n'
            '    "headline": "...",\n'
            '    "key_takeaways": ["..."],\n'
            '    "slides": ["Slide 1: ...", "Slide 2: ..."],\n'
            '    "body": "...",\n'
            '    "outline": []\n'
            '  }},\n'
            '  "reading_time_minutes": <estimated int>\n'
            '}}\n'
        )
    else:
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

    model_name = MODEL
    if feed_type not in ("trending", "deep_dives") and output_format != "cards":
        model_name = FOR_YOU_PROSE_MODEL

    try:
        t0 = time.time()
        request_kwargs = {
            "model": model_name,
            "messages": [
                {
                    "role": "system",
                    "content": SUMMARY_SYSTEM_PROMPT,
                },
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "timeout": TIMEOUT,
        }
        if model_name != FOR_YOU_PROSE_MODEL:
            request_kwargs["temperature"] = TEMPERATURE
        resp = client.chat.completions.create(**request_kwargs)
        elapsed = time.time() - t0
        tokens = getattr(resp.usage, "total_tokens", 0) if resp.usage else 0
        print(f"      [summarizer] OpenAI {model_name} took {elapsed:.1f}s, {tokens} tokens — {title[:40]}")
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
    elif feed_type in ("default", "for_you"):
        parsed = _normalize_short_article_summary(parsed, strip_markdown_body=False)
    return parsed, ""


def get_or_generate_summary(
    store,  # V3Store
    url: str,
    title: str,
    content: str,
    feed_type: str = "default",
    technical_depth: str = "",
    output_format: str = "",
) -> tuple[dict[str, Any] | None, bool]:
    """
    Check cache first, generate if missing.

    Returns (summary_dict, was_cached).
    """
    cache_bucket = _cache_bucket(feed_type, technical_depth, output_format)
    cached = store.get_cached_summary_v2(url, cache_bucket)
    if cached:
        cached_summary = cached.get("summary")
        if _is_rejection(cached_summary):
            return None, True
        return cached_summary, True

    summary, error = generate_summary(title, url, content, feed_type=feed_type, technical_depth=technical_depth, output_format=output_format)
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
    technical_depth: str = "",
    output_format: str = "",
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
    cache_bucket = _cache_bucket(feed_type, technical_depth, output_format)
    summary_map: dict[str, dict[str, Any] | None] = {}
    stats: dict[str, Any] = {
        "to_generate": 0,
        "already_cached": 0,
        "generated": 0,
        "rejected": 0,
        "failed": 0,
        "summary_map": summary_map,
    }

    for item in pool_items:
        url = item.get("url", "")
        title = item.get("title", "")
        content = item.get("content", "")
        if not url or not content:
            continue

        # For For You, run a semantic lane-fit gate before summary generation.
        if feed_type in ("default", "for_you"):
            fit_bucket = _fit_cache_bucket()
            cached_fit = store.get_cached_summary_v2(url, fit_bucket)
            fit_payload = cached_fit.get("summary") if cached_fit else None
            fit_ok = None
            if isinstance(fit_payload, dict):
                fit_ok = bool(fit_payload.get("is_fit", False))
                if not fit_ok:
                    summary_map[url] = None
                    stats["rejected"] += 1
                    continue
            if fit_ok is None:
                fit_ok, fit_reason = evaluate_for_you_fit(
                    title=title,
                    url=url,
                    content=content,
                    interest_id=str(item.get("interest_id", "")),
                    subinterest_id=str(item.get("subinterest_id", "")),
                    source_name=str(item.get("source_name", "")),
                )
                store.save_cached_summary_v2(
                    url,
                    fit_bucket,
                    {
                        "is_fit": fit_ok,
                        "reason": fit_reason,
                        "interest_id": str(item.get("interest_id", "")),
                        "subinterest_id": str(item.get("subinterest_id", "")),
                    },
                    MODEL,
                )
                if not fit_ok:
                    summary_map[url] = None
                    stats["rejected"] += 1
                    continue

        cached = store.get_cached_summary_v2(url, cache_bucket)
        if cached:
            cached_summary = cached.get("summary")
            summary_map[url] = None if _is_rejection(cached_summary) else cached_summary
            already_cached += 1
            continue
        tasks.append((url, title, content))

    stats["to_generate"] = len(tasks)
    stats["already_cached"] = already_cached

    if not tasks:
        _log_presummary(f"All {already_cached} summaries already cached — nothing to do")
        return stats

    format_label = f"{technical_depth or 'default'}" + (f"/{output_format}" if output_format else "")
    _log_presummary(
        f"Generating {len(tasks)} summaries ({format_label}) with {max_workers} workers "
        f"({already_cached} already cached)"
    )

    def _generate_one(task: tuple[str, str, str]) -> tuple[str, str]:
        url, title, content = task
        try:
            summary, error = generate_summary(title, url, content, feed_type=feed_type, technical_depth=technical_depth, output_format=output_format)
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
