"""
Role-first article scoring for the For You feed.

Priority order: role domain > user interests > career goals.
Articles outside user's eligible interests never appear.
"""

from __future__ import annotations

from typing import Any

GOAL_BOOST_MAP: dict[str, dict[str, Any]] = {
    "get-promoted": {
        "interest_ids": {"leadership", "productivity"},
        "keywords": {
            "career", "promotion", "leadership",
            "skill", "level up", "advance",
        },
    },
    "switch-careers": {
        "interest_ids": {
            "productivity", "engineering", "experience", "marketing",
        },
        "keywords": {
            "career change", "pivot", "transition",
            "upskill", "new field",
        },
    },
    "build-something": {
        "interest_ids": {"startups", "engineering", "technology"},
        "keywords": {
            "startup", "launch", "build", "ship",
            "product", "founder", "mvp",
        },
    },
    "lead-team": {
        "interest_ids": {"leadership"},
        "keywords": {
            "management", "team", "hiring",
            "leadership", "manager", "lead",
        },
    },
    "stay-sharp": {
        "interest_ids": set(),
        "keywords": set(),
    },
    "grow-network": {
        "interest_ids": {"leadership", "marketing"},
        "keywords": {
            "network", "community", "mentor",
            "connect", "conference",
        },
    },
}

BASE_SCORE = 1.0
ROLE_PRIMARY_BOOST = 0.6
GOAL_INTEREST_BOOST = 0.3
GOAL_KEYWORD_BOOST = 0.2
SOURCE_WEIGHT_FACTOR = 0.3


def score_article(
    article: dict[str, Any],
    user_goals: list[str],
    role_primary_interests: set[str] | None = None,
) -> float:
    """
    Score an article for ranking in the For You feed.

    Boost priority: role primary > career goals > source weight.
    """
    score = BASE_SCORE
    interest_id = article.get("interest_id", "")
    title_lower = (article.get("title", "") or "").lower()
    content_lower = (
        (article.get("content", "") or "")[:2000].lower()
    )
    text = f"{title_lower} {content_lower}"

    if role_primary_interests and interest_id in role_primary_interests:
        score += ROLE_PRIMARY_BOOST

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

    sw = article.get("_source_weight", 1.0)
    if sw != 1.0:
        score += (sw - 1.0) * SOURCE_WEIGHT_FACTOR

    return score


def rank_articles(
    articles: list[dict[str, Any]],
    user_goals: list[str],
    role_primary_interests: set[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Rank articles by role-first relevance (descending).

    Maintains original order as tiebreaker (recency).
    """
    scored = [
        (
            score_article(a, user_goals, role_primary_interests),
            idx,
            a,
        )
        for idx, a in enumerate(articles)
    ]
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [item for _, _, item in scored]
