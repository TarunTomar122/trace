import hashlib
import re
from typing import Any


CANONICAL_INTERESTS = [
    {"id": "technology", "label": "Technology"},
    {"id": "business-market", "label": "Business & Market"},
    {"id": "experience", "label": "Experience"},
    {"id": "productivity", "label": "Productivity"},
]

CANONICAL_INTEREST_IDS = {item["id"] for item in CANONICAL_INTERESTS}
CANONICAL_INTEREST_LABELS = {item["id"]: item["label"] for item in CANONICAL_INTERESTS}

SUBTOPIC_LABELS: dict[str, dict[str, str]] = {
    "technology": {
        "ai": "AI",
        "automation": "Automation",
        "software-tech": "Software & Tech",
        "productivity-tools": "Productivity Tools",
        "future-tech": "Future Tech",
    },
    "business-market": {
        "product-strategy": "Product Strategy",
        "market-trends": "Market Trends",
        "economy-impact": "Economy & Impact",
        "startups": "Startups",
        "marketing": "Marketing",
    },
    "experience": {
        "creative-process": "Creative Process",
        "design-tools": "Design Tools",
        "ux-design": "UX Design",
        "brand-storytelling": "Brand & Storytelling",
        "user-psychology": "User Psychology",
    },
    "productivity": {
        "career-growth": "Career Growth",
        "personal-finance": "Personal Finance",
        "soft-skills": "Soft Skills",
        "investments": "Investments",
        "wellbeing": "Wellbeing",
    },
}

INTEREST_KEYWORDS: dict[str, list[str]] = {
    "technology": [
        "technology",
        "tech",
        "software",
        "ai",
        "automation",
        "productivity tools",
        "future tech",
    ],
    "business-market": [
        "business",
        "market",
        "startup",
        "startups",
        "product strategy",
        "market trends",
        "economy",
        "economic impact",
        "marketing",
    ],
    "experience": [
        "experience",
        "ux",
        "ux design",
        "design",
        "design tools",
        "creative process",
        "brand",
        "storytelling",
        "user psychology",
    ],
    "productivity": [
        "productivity",
        "career growth",
        "personal finance",
        "soft skills",
        "investments",
        "wellbeing",
        "well-being",
    ],
}

# Backward compatibility map for legacy interests already stored in user profiles.
LEGACY_INTEREST_ALIASES: dict[str, str] = {
    "science": "technology",
    "psychology": "experience",
    "ideas": "experience",
    "business": "business-market",
    "money": "productivity",
    "design": "experience",
    "career": "productivity",
    "self-development": "productivity",
    "health": "productivity",
    "cooking": "productivity",
    "culture": "experience",
    "relationships": "experience",
    "society": "business-market",
}


def get_interest_subtopics() -> dict[str, list[dict[str, str]]]:
    """
    Convert SUBTOPIC_LABELS to frontend-compatible format.
    
    Returns:
        Dict mapping interest_id to list of {id, label} dicts
    """
    result = {}
    for interest_id, subtopics in SUBTOPIC_LABELS.items():
        result[interest_id] = [
            {"id": subtopic_id, "label": label}
            for subtopic_id, label in subtopics.items()
        ]
    return result


# Export in frontend-compatible format for scripts
INTEREST_SUBTOPICS = get_interest_subtopics()


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower().strip())
    return normalized.strip("-")


def _tokenize(value: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", value.lower().strip()) if t}


def get_interest_label(interest_id: str) -> str:
    return CANONICAL_INTEREST_LABELS.get(interest_id, interest_id.replace("-", " ").title())


def map_to_canonical_interest_id(value: str | None) -> str | None:
    if not value or not isinstance(value, str):
        return None
    normalized = _normalize_text(value)
    if not normalized:
        return None
    if normalized in CANONICAL_INTEREST_IDS:
        return normalized
    if normalized in LEGACY_INTEREST_ALIASES:
        return LEGACY_INTEREST_ALIASES[normalized]
    for interest_id, label in CANONICAL_INTEREST_LABELS.items():
        if _normalize_text(label) == normalized:
            return interest_id

    tokens = _tokenize(value)
    best_score = 0
    best_id = None
    for interest_id, keywords in INTEREST_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            keyword_norm = _normalize_text(keyword)
            if keyword_norm and keyword_norm in normalized:
                score += max(2, len(keyword_norm.split("-")))
            else:
                keyword_tokens = _tokenize(keyword)
                overlap = len(tokens & keyword_tokens)
                score += overlap
        if score > best_score:
            best_score = score
            best_id = interest_id

    return best_id


def get_interest_ids(profile: dict[str, Any]) -> list[str]:
    raw = profile.get("interest_ids") or profile.get("interestIds")
    if not raw:
        raw = profile.get("interests", []) or []
    interest_ids = []
    for value in raw:
        mapped = map_to_canonical_interest_id(value)
        if mapped:
            interest_ids.append(mapped)
    seen = set()
    deduped = []
    for interest_id in interest_ids:
        if interest_id not in seen:
            seen.add(interest_id)
            deduped.append(interest_id)
    return deduped


def get_interest_queries(profile: dict[str, Any]) -> dict[str, list[str]]:
    raw = profile.get("interest_queries") or profile.get("interestQueries") or {}
    if not isinstance(raw, dict):
        return {}
    normalized: dict[str, list[str]] = {}
    for key, value in raw.items():
        mapped_key = map_to_canonical_interest_id(key)
        if not mapped_key:
            continue
        queries = []
        if isinstance(value, list):
            for entry in value:
                if isinstance(entry, str) and entry.strip():
                    queries.append(entry.strip())
        if queries:
            normalized[mapped_key] = queries
    return normalized


def normalize_query_text(interest_id: str, query: str) -> str:
    if not query:
        return ""
    query_clean = query.strip()
    label_map = SUBTOPIC_LABELS.get(interest_id, {})
    if query_clean in label_map:
        return label_map[query_clean]
    return query_clean


def build_query_id(query_text: str) -> str:
    slug = _normalize_text(query_text) or "query"
    digest = hashlib.sha256(query_text.encode("utf-8")).hexdigest()[:8]
    return f"{slug}-{digest}"

