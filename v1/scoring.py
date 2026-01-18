"""
Multi-Signal Scoring System for feed personalization.

Implements the 8-signal scoring from AGENT_ARCHITECTURE.md:
1. Tag Affinity (0-100 points)
2. Source Type Match (0-30 points)
3. Query Specificity (0-20 points)
4. Freshness Decay (0-15 points)
5. Quality Signals (0-15 points)
6. Trending Boost (0-10 points)
7. Novelty/Exploration (±5 points)
8. Content Depth Match (±5 points)
"""
from datetime import datetime
from typing import Any
from urllib.parse import urlparse


def hours_since(iso_timestamp: str | None) -> float:
    """Calculate hours since an ISO timestamp."""
    if not iso_timestamp:
        return 999
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        now = datetime.utcnow()
        if dt.tzinfo:
            now = now.replace(tzinfo=dt.tzinfo)
        return (now - dt).total_seconds() / 3600
    except (ValueError, TypeError):
        return 999


def extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def score_item_for_user(
    item: dict[str, Any],
    user_profile: dict[str, Any],
    user_patterns: dict[str, Any],
    user_preferences: dict[str, Any]
) -> float:
    """
    Score a pool item for a specific user using multi-signal scoring.
    
    Args:
        item: Pool item from retrieval_pool
        user_profile: User profile with interests, umbrellas, learningStyle
        user_patterns: User patterns with tags, exclude_tags
        user_preferences: User preferences with source_distribution, contentDepth
    
    Returns:
        Score (0-200 range typically, can go higher for exceptional matches)
    """
    score = 0.0
    
    # === SIGNAL 1: Tag Affinity (0-100 points) ===
    tags_data = user_patterns.get("tags", {})
    tag_score = 0
    item_tags = item.get("tags", [])
    
    for tag in item_tags:
        tag_lower = tag.lower()
        if tag_lower in tags_data:
            tag_info = tags_data[tag_lower]
            if isinstance(tag_info, dict):
                tag_score += tag_info.get("score", 50)
            else:
                tag_score += 50
    
    if item_tags:
        tag_score = (tag_score / len(item_tags)) * 0.4
    score += tag_score
    
    # === SIGNAL 2: Source Type Match (0-30 points) ===
    item_type = item.get("type", "blog")
    source_dist = user_preferences.get("source_distribution", {})
    
    type_mapping = {
        "video": source_dist.get("video", 30),
        "blog": source_dist.get("blog", 25),
        "paper": source_dist.get("paper", 10),
        "repo": source_dist.get("repo", 15),
        "discussion": source_dist.get("discussion", 10),
        "tweet": source_dist.get("tweet", 5),
        "launch": source_dist.get("launch", 5),
        "model": source_dist.get("model", 5),
    }
    
    source_score = type_mapping.get(item_type, 20) * 0.3
    score += source_score
    
    # === SIGNAL 3: Query Specificity (0-20 points) ===
    specific_queries = user_profile.get("specific_queries", [])
    user_umbrellas = user_profile.get("umbrellas", [])
    
    # Also check interests as umbrella fallback
    interests = user_profile.get("interests", [])
    interest_umbrellas = [i.lower().replace(" ", "-").replace("&", "and") for i in interests]
    all_umbrellas = set(user_umbrellas + interest_umbrellas)
    
    if item.get("query_id") in specific_queries:
        score += 20  # Direct query match
    elif item.get("umbrella_id") in all_umbrellas:
        score += 10  # Umbrella match
    
    # === SIGNAL 4: Freshness Decay (0-15 points) ===
    hours_old = hours_since(item.get("fetched_at"))
    if hours_old < 6:
        score += 15
    elif hours_old < 24:
        score += 12
    elif hours_old < 48:
        score += 8
    else:
        score += 3
    
    # === SIGNAL 5: Quality Signals (0-15 points) ===
    quality = item.get("quality_signals", {})
    
    domain_authority = quality.get("domain_authority", "low")
    if domain_authority == "high":
        score += 5
    elif domain_authority == "medium":
        score += 2
    
    if quality.get("has_code"):
        score += 3
    
    read_time = quality.get("read_time_minutes", 10)
    content_depth = user_preferences.get("contentDepth") or user_profile.get("contentDepth", "deep")
    
    if content_depth == "quick" and read_time and read_time < 5:
        score += 4
    elif content_depth == "deep" and read_time and read_time > 10:
        score += 4
    elif content_depth == "surprise":
        score += 2
    
    if read_time and read_time > 30 and content_depth != "deep":
        score -= 5
    
    # === SIGNAL 6: Trending Boost (0-10 points) ===
    trending_score = item.get("trending_score", 50)
    if trending_score > 80:
        score += 10
    elif trending_score > 60:
        score += 5
    
    # === SIGNAL 7: Novelty/Exploration (±5 points) ===
    for tag in item_tags:
        tag_lower = tag.lower()
        if tag_lower in tags_data:
            tag_info = tags_data[tag_lower]
            shown = tag_info.get("shown", 0) if isinstance(tag_info, dict) else 0
            if shown < 3:
                score += 5
                break
    
    # === SIGNAL 8: Content Depth Match (±5 points) ===
    learning_style = user_profile.get("learningStyle", "") or ""
    learning_style_lower = learning_style.lower()
    
    if "hands-on" in learning_style_lower and quality.get("has_code"):
        score += 5
    if "visual" in learning_style_lower and item_type == "video":
        score += 5
    if "theory" in learning_style_lower and item_type == "paper":
        score += 5
    
    # === PENALTIES ===
    exclude_tags = user_patterns.get("exclude_tags", [])
    for tag in item_tags:
        if tag.lower() in [et.lower() for et in exclude_tags]:
            score -= 50
    
    if hours_old > 72:
        score -= 10
    
    return max(0, score)


def apply_diversity_filter(
    scored_items: list[dict[str, Any]],
    max_per_domain: int = 3,
    max_per_type: int = 8,
    max_items: int = 20
) -> list[dict[str, Any]]:
    """
    Apply diversity filter to avoid feed monotony.
    
    Args:
        scored_items: List of items with 'score' field, sorted by score desc
        max_per_domain: Maximum items from same domain
        max_per_type: Maximum items of same type
        max_items: Maximum items to return
    
    Returns:
        Filtered list of items
    """
    filtered = []
    domain_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    
    for item in scored_items:
        domain = extract_domain(item.get("url", ""))
        item_type = item.get("type", "blog")
        
        if domain_counts.get(domain, 0) >= max_per_domain:
            continue
        if type_counts.get(item_type, 0) >= max_per_type:
            continue
        
        filtered.append(item)
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        type_counts[item_type] = type_counts.get(item_type, 0) + 1
        
        if len(filtered) >= max_items:
            break
    
    return filtered


def generate_why_relevant(
    item: dict[str, Any],
    user_profile: dict[str, Any],
    score: float
) -> str:
    """Generate a short 'why relevant' explanation for feed item."""
    reasons = []
    
    item_tags = item.get("tags", [])
    interests = user_profile.get("interests", [])
    
    # Check tag match
    for tag in item_tags[:2]:
        tag_lower = tag.lower()
        for interest in interests:
            if tag_lower in interest.lower() or interest.lower() in tag_lower:
                reasons.append(f"Matches your interest in {interest}")
                break
        if reasons:
            break
    
    # Check umbrella match
    if not reasons:
        umbrella = item.get("umbrella_id", "")
        for interest in interests:
            interest_id = interest.lower().replace(" ", "-").replace("&", "and")
            if umbrella == interest_id:
                reasons.append(f"Related to {interest}")
                break
    
    # Quality signals
    quality = item.get("quality_signals", {})
    if quality.get("domain_authority") == "high":
        reasons.append("from trusted source")
    if quality.get("has_code"):
        reasons.append("includes code examples")
    
    # Trending
    if item.get("trending_score", 0) > 70:
        reasons.append("trending")
    
    # Freshness
    hours = hours_since(item.get("fetched_at"))
    if hours < 24:
        reasons.append("fresh content")
    
    if reasons:
        return reasons[0].capitalize() + (", " + reasons[1] if len(reasons) > 1 else "")
    return "Recommended for you"

