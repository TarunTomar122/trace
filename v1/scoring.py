"""
Multi-Signal Scoring System for feed personalization.

Implements the 12-signal scoring system:
1. Tag Affinity (0-100 points)
2. Source Type Match (0-30 points)
3. Query Specificity (0-20 points)
4. Freshness Decay (0-15 points)
5. Quality Signals (0-15 points)
6. Trending Boost (0-10 points)
7. Novelty/Exploration (±5 points)
8. Content Depth Match (±5 points)
9. Role-Based Content Boost (0-10 points) 🆕
10. Skills-Based Difficulty Filter (±10 points) 🆕
11. Goals-Based Focus Match (0-10 points) 🆕
12. Hobby/Project Context (0-5 points) 🆕
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
    
    # Extract common item attributes (used across multiple signals)
    item_tags = item.get("tags", [])
    title = (item.get("title", "") or "").lower()
    desc = (item.get("description", "") or "").lower()
    item_type = item.get("type", "blog")
    quality = item.get("quality_signals", {})
    read_time = quality.get("read_time_minutes", 10)
    trending_score = item.get("trending_score", 50)
    
    # === SIGNAL 1: Tag Affinity (0-100 points) ===
    tags_data = user_patterns.get("tags", {})
    tag_score = 0
    
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
    domain_authority = quality.get("domain_authority", "low")
    if domain_authority == "high":
        score += 5
    elif domain_authority == "medium":
        score += 2
    
    if quality.get("has_code"):
        score += 3
    
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
    
    # === SIGNAL 9: Role-Based Content Boost (0-10 points) ===
    role = (user_profile.get("role", "") or "").lower()
    
    if role:
        # Developer/Engineer → code-heavy content
        if any(r in role for r in ["developer", "engineer", "programmer", "coder"]):
            if item_type in ["repo", "video"] or quality.get("has_code"):
                score += 4
            if any(tag in ["tutorial", "beginner"] for tag in [t.lower() for t in item_tags]):
                score += 1  # Some tutorials are useful for devs too
        
        # Designer → visual and design tools
        elif any(r in role for r in ["designer", "design"]):
            if item_type in ["video", "launch"]:
                score += 8
            design_keywords = ["design", "ui", "ux", "figma", "interface", "visual"]
            if any(kw in title.lower() for kw in design_keywords):
                score += 5
        
        # Product Manager/Founder → strategy and case studies
        elif any(r in role for r in ["product", "founder", "ceo", "manager", "entrepreneur"]):
            strategy_keywords = ["strategy", "growth", "case study", "analysis", "framework", "launch"]
            if any(kw in title.lower() or kw in desc for kw in strategy_keywords):
                score += 10
            if item_type in ["discussion", "blog"]:
                score += 3
        
        # Student/Learner → educational content
        elif any(r in role for r in ["student", "learner"]):
            if item_type in ["video", "paper", "blog"]:
                score += 5
            tutorial_boost = ["tutorial", "introduction", "guide", "learn", "course"]
            if any(kw in title.lower() for kw in tutorial_boost):
                score += 8  # Students benefit from tutorials
        
        # Content Creator → trends and social
        elif any(r in role for r in ["creator", "writer", "influencer", "youtuber"]):
            if item_type in ["tweet", "video", "discussion"]:
                score += 8
            if trending_score > 70:
                score += 5  # Extra boost for trending content
    
    # === SIGNAL 10: Skills-Based Difficulty Filter (±10 points) ===
    skills = user_profile.get("skills", [])
    if skills:
        skill_tags = [s.lower() for s in skills]
        
        # Check if content is about a skill they have
        has_relevant_skill = False
        for tag in item_tags:
            tag_lower = tag.lower()
            for skill in skill_tags:
                if skill in tag_lower or tag_lower in skill:
                    has_relevant_skill = True
                    break
            if has_relevant_skill:
                break
        
        # If they have the skill, reduce beginner content penalty
        if has_relevant_skill:
            beginner_keywords = ["beginner", "introduction to", "getting started", "basics", "101"]
            is_beginner = any(kw in title.lower() for kw in beginner_keywords)
            if is_beginner:
                score -= 15  # They already know this, penalize heavily
            else:
                score += 5  # Advanced content about their skills is valuable
        
        # If content is learning-focused and NOT about their skills, slight boost
        else:
            learning_keywords = ["learn", "tutorial", "guide", "course"]
            is_learning = any(kw in title.lower() for kw in learning_keywords)
            if is_learning and read_time and read_time > 5:
                score += 3  # Learning new things is good
    
    # === SIGNAL 11: Goals-Based Focus Match (0-10 points) ===
    goals = user_profile.get("goals", {})
    short_term_goals = (goals.get("shortTerm", "") or "").lower()
    
    if short_term_goals:
        # Shipping/Building goals → practical, hands-on content
        if any(kw in short_term_goals for kw in ["ship", "build", "launch", "deploy", "release", "mvp"]):
            practical_keywords = ["how to", "build", "deploy", "ship", "implement", "production", "launch"]
            if any(kw in title.lower() or kw in desc for kw in practical_keywords):
                score += 10
            if quality.get("has_code"):
                score += 5
        
        # Learning goals → educational deep-dives
        elif any(kw in short_term_goals for kw in ["learn", "master", "understand", "study"]):
            learning_keywords = ["guide", "tutorial", "course", "introduction", "deep dive", "explained"]
            if any(kw in title.lower() for kw in learning_keywords):
                score += 10
            if read_time and read_time > 10:
                score += 3  # Longer educational content
        
        # Growth/Scale goals → scaling and optimization
        elif any(kw in short_term_goals for kw in ["grow", "scale", "optimize", "increase", "improve"]):
            growth_keywords = ["scale", "growth", "optimize", "performance", "improve", "increase"]
            if any(kw in title.lower() or kw in desc for kw in growth_keywords):
                score += 10
    
    # === SIGNAL 12: Hobby/Project Context (0-5 points) ===
    hobbies = user_profile.get("hobbies", [])
    projects = user_profile.get("projects", [])
    
    # Check if content relates to their hobbies (for serendipity)
    if hobbies:
        hobby_tags = [h.lower() for h in hobbies]
        for tag in item_tags:
            tag_lower = tag.lower()
            for hobby in hobby_tags:
                if hobby in tag_lower or any(word in tag_lower for word in hobby.split()):
                    score += 5  # Nice serendipitous match
                    break
    
    # Check if content relates to their projects
    if projects:
        project_tags = [p.lower() for p in projects]
        for tag in item_tags:
            tag_lower = tag.lower()
            for project in project_tags:
                if project in tag_lower or any(word in tag_lower for word in project.split()):
                    score += 5  # Relevant to active projects
                    break
    
    # === PENALTIES ===
    exclude_tags = user_patterns.get("exclude_tags", [])
    for tag in item_tags:
        if tag.lower() in [et.lower() for et in exclude_tags]:
            score -= 50
    
    if hours_old > 72:
        score -= 10
    
    # === TUTORIAL/BEGINNER CONTENT PENALTY (Role-Aware) ===
    # Only penalize tutorials if the user role suggests they're experienced
    # Students, learners, and people with learning goals benefit from tutorials
    is_student_or_learner = any(r in role for r in ["student", "learner"]) if role else False
    has_learning_goals = "learn" in short_term_goals if short_term_goals else False
    
    if not is_student_or_learner and not has_learning_goals:
        tutorial_keywords = ["tutorial", "beginner", "how to", "step by step", "for beginners", "getting started", "introduction to", "learn how"]
        for keyword in tutorial_keywords:
            if keyword in title:
                score -= 40  # Heavy penalty for tutorial in title
                break
            elif keyword in desc:
                score -= 15  # Lighter penalty for tutorial in description
                break
    
    return max(0, score)


def apply_diversity_filter(
    scored_items: list[dict[str, Any]],
    max_per_domain: int = 3,
    max_per_type: int | None = 8,
    max_per_umbrella: int = 2,
    max_total_per_umbrella: int | None = None,
    max_items: int | None = None,
    interleave_topics: bool = True
) -> list[dict[str, Any]]:
    """
    Apply diversity filter to avoid feed monotony.
    
    Args:
        scored_items: List of items with 'score' field, sorted by score desc
        max_per_domain: Maximum items from same domain
        max_per_type: Maximum items of same type (None = no limit)
        max_per_umbrella: Maximum consecutive items from same umbrella
        max_total_per_umbrella: Maximum items per umbrella overall (None = no limit)
        max_items: Maximum items to return (None = no limit)
        interleave_topics: If True, interleave items from different umbrellas
    
    Returns:
        Filtered list of items (topic-interleaved for variety)
    """
    if not interleave_topics:
        # Original behavior: just filter by domain/type
        filtered = []
        domain_counts: dict[str, int] = {}
        type_counts: dict[str, int] = {}
        umbrella_counts: dict[str, int] = {}
        
        for item in scored_items:
            domain = extract_domain(item.get("url", ""))
            item_type = item.get("type", "blog")
            
            if domain_counts.get(domain, 0) >= max_per_domain:
                continue
            if max_per_type is not None and type_counts.get(item_type, 0) >= max_per_type:
                continue
            if max_total_per_umbrella is not None and umbrella_counts.get(item.get("umbrella_id", "general"), 0) >= max_total_per_umbrella:
                continue
            
            filtered.append(item)
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
            type_counts[item_type] = type_counts.get(item_type, 0) + 1
            umbrella_id = item.get("umbrella_id", "general")
            umbrella_counts[umbrella_id] = umbrella_counts.get(umbrella_id, 0) + 1
            
            if max_items is not None and len(filtered) >= max_items:
                break
        
        return filtered
    
    # Topic interleaving: group by umbrella and round-robin
    from collections import defaultdict
    
    umbrella_buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    
    # Group items by umbrella (respecting domain limits)
    domain_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    umbrella_counts: dict[str, int] = {}
    
    for item in scored_items:
        domain = extract_domain(item.get("url", ""))
        item_type = item.get("type", "blog")
        
        # Skip if exceeds domain/type limits
        if domain_counts.get(domain, 0) >= max_per_domain:
            continue
        if max_per_type is not None and type_counts.get(item_type, 0) >= max_per_type:
            continue
        if max_total_per_umbrella is not None and umbrella_counts.get(item.get("umbrella_id", "general"), 0) >= max_total_per_umbrella:
            continue
        
        umbrella_id = item.get("umbrella_id", "general")
        umbrella_buckets[umbrella_id].append(item)
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        type_counts[item_type] = type_counts.get(item_type, 0) + 1
        umbrella_counts[umbrella_id] = umbrella_counts.get(umbrella_id, 0) + 1
    
    # Interleave items from different umbrellas (round-robin)
    filtered = []
    umbrella_indices = {uid: 0 for uid in umbrella_buckets.keys()}
    umbrella_list = list(umbrella_buckets.keys())
    
    consecutive_from_same = 0
    last_umbrella = None
    
    while len(filtered) < (max_items or float('inf')):
        added_in_round = False
        
        for umbrella_id in umbrella_list:
            if umbrella_indices[umbrella_id] >= len(umbrella_buckets[umbrella_id]):
                continue  # This umbrella is exhausted
            
            # Check if we need to skip due to consecutive limit
            if umbrella_id == last_umbrella and consecutive_from_same >= max_per_umbrella:
                continue
            
            item = umbrella_buckets[umbrella_id][umbrella_indices[umbrella_id]]
            filtered.append(item)
            umbrella_indices[umbrella_id] += 1
            added_in_round = True
            
            # Track consecutive items from same umbrella
            if umbrella_id == last_umbrella:
                consecutive_from_same += 1
            else:
                consecutive_from_same = 1
                last_umbrella = umbrella_id
            
            if max_items is not None and len(filtered) >= max_items:
                break
        
        if not added_in_round:
            break  # All umbrellas exhausted
        
        if max_items is not None and len(filtered) >= max_items:
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
    title = (item.get("title", "") or "").lower()
    item_type = item.get("type", "blog")
    
    # Check role match (NEW)
    role = (user_profile.get("role", "") or "").lower()
    if role and any(r in role for r in ["developer", "engineer"]):
        if item_type == "repo" or "code" in title:
            reasons.append("Picked for developers")
    elif role and "designer" in role:
        if item_type == "video" or any(kw in title for kw in ["design", "ui", "ux"]):
            reasons.append("Picked for designers")
    elif role and any(r in role for r in ["product", "founder", "manager"]):
        if any(kw in title for kw in ["strategy", "growth", "case"]):
            reasons.append("Relevant for your role")
    
    # Check goals match (NEW)
    goals = user_profile.get("goals", {})
    short_term_goals = (goals.get("shortTerm", "") or "").lower()
    if short_term_goals:
        if any(kw in short_term_goals for kw in ["ship", "build", "launch"]):
            if any(kw in title for kw in ["build", "ship", "deploy"]):
                reasons.append("Matches your shipping goals")
        elif "learn" in short_term_goals:
            if any(kw in title for kw in ["guide", "tutorial", "learn"]):
                reasons.append("Helps with your learning goals")
    
    # Check skills match (NEW)
    skills = user_profile.get("skills", [])
    if skills:
        for skill in skills[:2]:
            if skill.lower() in title:
                reasons.append(f"Advanced {skill} content")
                break
    
    # Check hobbies/projects match (NEW)
    hobbies = user_profile.get("hobbies", [])
    projects = user_profile.get("projects", [])
    for hobby in hobbies[:2]:
        if any(word in title for word in hobby.lower().split()):
            reasons.append(f"Related to {hobby}")
            break
    if not reasons:
        for project in projects[:2]:
            if any(word in title for word in project.lower().split()):
                reasons.append(f"Useful for {project}")
                break
    
    # Check tag/interest match (existing)
    if not reasons:
        for tag in item_tags[:2]:
            tag_lower = tag.lower()
            for interest in interests:
                if tag_lower in interest.lower() or interest.lower() in tag_lower:
                    reasons.append(f"Matches your interest in {interest}")
                    break
            if reasons:
                break
    
    # Check umbrella match (existing)
    if not reasons:
        umbrella = item.get("umbrella_id", "")
        for interest in interests:
            interest_id = interest.lower().replace(" ", "-").replace("&", "and")
            if umbrella == interest_id:
                reasons.append(f"Related to {interest}")
                break
    
    # Quality signals (existing)
    quality = item.get("quality_signals", {})
    if quality.get("domain_authority") == "high":
        reasons.append("from trusted source")
    if quality.get("has_code"):
        reasons.append("includes code examples")
    
    # Trending (existing)
    if item.get("trending_score", 0) > 70:
        reasons.append("trending")
    
    # Freshness (existing)
    hours = hours_since(item.get("fetched_at"))
    if hours < 24:
        reasons.append("fresh content")
    
    if reasons:
        return reasons[0].capitalize() + (", " + reasons[1] if len(reasons) > 1 else "")
    return "Recommended for you"

