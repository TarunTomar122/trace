"""
Career goal boosting and article scoring.

Articles matching a user's career goals get a ranking boost
when selecting items for the For You feed.
"""

from __future__ import annotations

from typing import Any

# Maps career goal IDs to interest_ids and keyword signals that get boosted.
# These are additive — an article matching ANY of these gets a score bump.
GOAL_BOOST_MAP: dict[str, dict[str, Any]] = {
    "get-promoted": {
        "interest_ids": {"leadership", "productivity"},
        "keywords": {"career", "promotion", "leadership", "skill", "level up", "advance"},
    },
    "switch-careers": {
        "interest_ids": {"productivity", "engineering", "experience", "marketing"},
        "keywords": {"career change", "pivot", "transition", "upskill", "new field"},
    },
    "build-something": {
        "interest_ids": {"startups", "engineering", "technology"},
        "keywords": {"startup", "launch", "build", "ship", "product", "founder", "mvp"},
    },
    "lead-team": {
        "interest_ids": {"leadership"},
        "keywords": {"management", "team", "hiring", "leadership", "manager", "lead"},
    },
    "stay-sharp": {
        "interest_ids": set(),
        "keywords": set(),
    },
    "grow-network": {
        "interest_ids": {"leadership", "marketing"},
        "keywords": {"network", "community", "mentor", "connect", "conference"},
    },
}

BASE_SCORE = 1.0
GOAL_INTEREST_BOOST = 0.3
GOAL_KEYWORD_BOOST = 0.2
RECENCY_BOOST_MAX = 0.5


def score_article(
    article: dict[str, Any],
    user_goals: list[str],
) -> float:
    """
    Score an article based on career goal alignment.

    Higher score = more relevant to user's goals.
    Returns a float >= 1.0.
    """
    score = BASE_SCORE
    interest_id = article.get("interest_id", "")
    title_lower = (article.get("title", "") or "").lower()
    content_lower = (article.get("content", "") or "")[:2000].lower()
    text = f"{title_lower} {content_lower}"

    for goal in user_goals:
        boost = GOAL_BOOST_MAP.get(goal, {})
        boost_interests = boost.get("interest_ids", set())
        boost_keywords = boost.get("keywords", set())

        if interest_id in boost_interests:
            score += GOAL_INTEREST_BOOST

        for kw in boost_keywords:
            if kw in text:
                score += GOAL_KEYWORD_BOOST
                break

    return score


def rank_articles(
    articles: list[dict[str, Any]],
    user_goals: list[str],
) -> list[dict[str, Any]]:
    """
    Rank articles by career goal relevance (descending).

    Maintains original order as tiebreaker (recency).
    """
    scored = [
        (score_article(a, user_goals), idx, a)
        for idx, a in enumerate(articles)
    ]
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [item for _, _, item in scored]
