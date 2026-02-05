import hashlib
import re
from typing import Any


CANONICAL_INTERESTS = [
    {"id": "technology", "label": "Technology"},
    {"id": "science", "label": "Science"},
    {"id": "psychology", "label": "Psychology"},
    {"id": "ideas", "label": "Ideas"},
    {"id": "business", "label": "Business"},
    {"id": "money", "label": "Money"},
    {"id": "design", "label": "Design"},
    {"id": "career", "label": "Career"},
    {"id": "self-development", "label": "Self development"},
    {"id": "health", "label": "Health"},
    {"id": "cooking", "label": "Cooking"},
    {"id": "culture", "label": "Culture"},
    {"id": "relationships", "label": "Relationships"},
    {"id": "society", "label": "Society"},
]

CANONICAL_INTEREST_IDS = {item["id"] for item in CANONICAL_INTERESTS}
CANONICAL_INTEREST_LABELS = {item["id"]: item["label"] for item in CANONICAL_INTERESTS}

SUBTOPIC_LABELS: dict[str, dict[str, str]] = {
    "technology": {
        "ai": "AI",
        "automation": "Automation",
        "software": "Software",
        "productivity-tools": "Productivity Tools",
        "future-tech": "Future Tech",
    },
    "science": {
        "space": "Space",
        "biology": "Biology",
        "physics": "Physics",
        "climate": "Climate",
        "explained": "Explained",
    },
    "psychology": {
        "mental-health": "Mental Health",
        "habits": "Habits",
        "learning": "Learning",
        "relationships": "Relationships",
        "emotions": "Emotions",
    },
    "ideas": {
        "philosophy": "Philosophy",
        "essays": "Essays",
        "creativity": "Creativity",
        "meaning": "Meaning",
        "big-ideas": "Big Ideas",
    },
    "business": {
        "startups": "Startups",
        "product": "Product",
        "marketing": "Marketing",
        "operations": "Operations",
        "leadership": "Leadership",
    },
    "money": {
        "personal-finance": "Personal Finance",
        "investing": "Investing",
        "income": "Income",
        "markets": "Markets",
        "crypto": "Crypto",
    },
    "design": {
        "visual-design": "Visual Design",
        "ux": "UX",
        "branding": "Branding",
        "creative-process": "Creative Process",
        "tools": "Tools",
    },
    "career": {
        "job-search": "Job Search",
        "skills": "Skills",
        "portfolio": "Portfolio",
        "career-growth": "Career Growth",
        "workplace": "Workplace",
    },
    "self-development": {
        "focus": "Focus",
        "routines": "Routines",
        "mindset": "Mindset",
        "confidence": "Confidence",
        "life-design": "Life Design",
    },
    "health": {
        "workouts": "Workouts",
        "nutrition": "Nutrition",
        "sleep": "Sleep",
        "recovery": "Recovery",
        "fitness": "Fitness",
    },
    "cooking": {
        "recipes": "Recipes",
        "healthy-meals": "Healthy Meals",
        "baking": "Baking",
        "drinks": "Drinks",
        "food-culture": "Food Culture",
    },
    "culture": {
        "movies": "Movies",
        "music": "Music",
        "games": "Games",
        "books": "Books",
        "internet": "Internet",
    },
    "relationships": {
        "dating": "Dating",
        "family": "Family",
        "friendships": "Friendships",
        "communication": "Communication",
        "conflict": "Conflict",
    },
    "society": {
        "politics": "Politics",
        "economics": "Economics",
        "history": "History",
        "media": "Media",
        "technology-impact": "Technology Impact",
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
    "science": ["science", "space", "biology", "physics", "climate", "explained"],
    "psychology": ["psychology", "mental health", "habits", "learning", "emotions"],
    "ideas": ["ideas", "philosophy", "essays", "creativity", "meaning", "big ideas"],
    "business": ["business", "startups", "product", "marketing", "operations", "leadership"],
    "money": ["money", "finance", "investing", "markets", "crypto", "personal finance"],
    "design": ["design", "visual design", "ux", "branding", "creative process", "tools"],
    "career": ["career", "job search", "skills", "portfolio", "career growth", "workplace"],
    "self-development": [
        "self development",
        "personal growth",
        "mindset",
        "confidence",
        "routines",
        "focus",
        "life design",
    ],
    "health": ["health", "fitness", "nutrition", "sleep", "workouts", "recovery"],
    "cooking": ["cooking", "recipes", "baking", "food culture", "drinks", "healthy meals"],
    "culture": ["culture", "movies", "music", "games", "books", "internet"],
    "relationships": ["relationships", "dating", "family", "friendships", "communication", "conflict"],
    "society": ["society", "politics", "economics", "history", "media", "technology impact"],
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

