"""
Smart Reflection Tool - uses LLM to intelligently understand user feedback.

Analyzes notes on upvoted/downvoted items and makes intelligent adjustments
to user preferences and patterns.

Usage:
    python v1/tools/smart_reflection.py --user_id abc123 --date 2026-01-18
"""
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from openai import OpenAI


SMART_REFLECTION_PROMPT = """You are a personalization expert analyzing a user's feedback on content items.

## Current User Profile
- Interests: {interests}
- Content Depth Preference: {content_depth}
- Learning Style: {learning_style}
- Source Preferences: {source_preferences}

## Current Tag Scores (0-100, 50 is neutral)
{current_tags}

## Current Exclude Tags
{exclude_tags}

## Today's Interactions with Notes

### Upvoted Items:
{upvoted_items}

### Downvoted Items:
{downvoted_items}

## Your Task

Analyze the notes carefully to understand:
1. WHY the user liked/disliked each item
2. What specific topics, formats, or styles they prefer or want to avoid
3. Any follow-up topics they want to explore

Return a JSON object with these adjustments:

{{
  "tag_adjustments": [
    {{"tag": "tag_name", "delta": 10, "reason": "why"}},
    ...
  ],
  "new_exclude_tags": [
    {{"tag": "tag_name", "reason": "why"}}
  ],
  "personal_signals": [
    {{"query": "2-5 word search query", "reason": "why", "confidence": 0.8}}
  ],
  "source_adjustments": {{
    "increase": ["video", "blog"],
    "decrease": ["paper"],
    "reason": "why"
  }},
  "content_depth_suggestion": {{
    "suggestion": "quick" | "deep" | "surprise" | null,
    "reason": "why or null if no change"
  }},
  "insights": "Brief summary of what you learned about this user's preferences"
}}

## Rules
1. Only make adjustments if there's clear signal from the notes
2. Tag delta should be between -20 and +20
3. Personal signals should be specific (2-5 words), not generic
4. Don't exclude broad topics unless the user clearly hates them
5. Be conservative - only suggest changes you're confident about
6. If a note is generic like "cool" or "nice", ignore it

Return ONLY valid JSON, no other text."""


def format_interaction(interaction: dict, action: str) -> str:
    """Format an interaction for the prompt."""
    item_meta = interaction.get("item_metadata", {})
    title = item_meta.get("title", "Unknown")
    item_type = item_meta.get("type", "unknown")
    tags = item_meta.get("tags", [])
    note = interaction.get("note", "")
    
    if not note:
        return ""
    
    return f"- [{item_type}] \"{title}\" (tags: {', '.join(tags) if tags else 'none'})\n  Note: \"{note}\""


def run_smart_reflection(
    interactions_with_notes: list[dict],
    user_profile: dict,
    user_patterns: dict,
    user_preferences: dict
) -> dict[str, Any] | None:
    """
    Run smart reflection using LLM to analyze user feedback.
    
    Args:
        interactions_with_notes: List of interactions that have notes
        user_profile: Current user profile
        user_patterns: Current user patterns (tags, exclude_tags, etc.)
        user_preferences: Current user preferences (source_distribution, etc.)
    
    Returns:
        Dict with adjustments, or None if no meaningful adjustments
    """
    # Separate upvoted and downvoted
    upvoted = [i for i in interactions_with_notes if i.get("action") == "upvote"]
    downvoted = [i for i in interactions_with_notes if i.get("action") == "downvote"]
    
    # Format interactions
    upvoted_text = "\n".join(filter(None, [format_interaction(i, "upvote") for i in upvoted]))
    downvoted_text = "\n".join(filter(None, [format_interaction(i, "downvote") for i in downvoted]))
    
    if not upvoted_text and not downvoted_text:
        return None
    
    # Format current tags
    tags_data = user_patterns.get("tags", {})
    tags_text = "\n".join([f"- {tag}: {info.get('score', 50) if isinstance(info, dict) else info}" 
                          for tag, info in list(tags_data.items())[:20]]) or "No tags tracked yet"
    
    # Build prompt
    prompt = SMART_REFLECTION_PROMPT.format(
        interests=", ".join(user_profile.get("interests", [])) or "Not specified",
        content_depth=user_preferences.get("contentDepth") or user_profile.get("contentDepth", "deep"),
        learning_style=user_profile.get("learningStyle", "Not specified"),
        source_preferences=json.dumps(user_preferences.get("source_distribution", {})),
        current_tags=tags_text,
        exclude_tags=", ".join(user_patterns.get("exclude_tags", [])) or "None",
        upvoted_items=upvoted_text or "No upvoted items with notes",
        downvoted_items=downvoted_text or "No downvoted items with notes"
    )
    
    # Call LLM
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a personalization expert. Analyze user feedback and return structured JSON adjustments. Be conservative and only suggest changes you're confident about."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean up JSON if wrapped in code blocks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        result = json.loads(content)
        return result
        
    except json.JSONDecodeError as e:
        print(f"  Error parsing LLM response: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error in smart reflection: {e}", file=sys.stderr)
        return None


def apply_smart_adjustments(
    adjustments: dict[str, Any],
    patterns: dict[str, Any],
    preferences: dict[str, Any]
) -> tuple[dict, dict, dict]:
    """
    Apply the LLM's suggested adjustments to patterns and preferences.
    
    Args:
        adjustments: The LLM's suggested adjustments
        patterns: Current user patterns
        preferences: Current user preferences
    
    Returns:
        Tuple of (updated_patterns, updated_preferences, stats)
    """
    stats = {
        "tags_adjusted": 0,
        "exclude_tags_added": 0,
        "signals_created": 0,
        "source_adjusted": False,
        "depth_adjusted": False
    }
    
    # Apply tag adjustments
    tag_adjustments = adjustments.get("tag_adjustments", [])
    tags_data = patterns.get("tags", {})
    
    for adj in tag_adjustments:
        tag = adj.get("tag", "").lower()
        delta = adj.get("delta", 0)
        
        if not tag or delta == 0:
            continue
        
        # Clamp delta to -20 to +20
        delta = max(-20, min(20, delta))
        
        if tag not in tags_data:
            tags_data[tag] = {"score": 50, "up": 0, "down": 0, "shown": 0}
        
        if isinstance(tags_data[tag], dict):
            current = tags_data[tag].get("score", 50)
            tags_data[tag]["score"] = max(0, min(100, current + delta))
        else:
            tags_data[tag] = max(0, min(100, tags_data[tag] + delta))
        
        stats["tags_adjusted"] += 1
    
    patterns["tags"] = tags_data
    
    # Apply exclude tags
    new_exclude = adjustments.get("new_exclude_tags", [])
    exclude_tags = patterns.get("exclude_tags", [])
    existing_lower = {t.lower() for t in exclude_tags}
    
    for item in new_exclude:
        tag = item.get("tag", "").lower()
        if tag and tag not in existing_lower:
            exclude_tags.append(tag)
            existing_lower.add(tag)
            stats["exclude_tags_added"] += 1
    
    patterns["exclude_tags"] = exclude_tags
    
    # Apply personal signals
    from datetime import datetime, timedelta
    import uuid
    
    new_signals = adjustments.get("personal_signals", [])
    personal_signals = patterns.get("personal_signals", [])
    existing_queries = {s.get("query", "").lower() for s in personal_signals}
    
    for sig in new_signals:
        query = sig.get("query", "")
        confidence = sig.get("confidence", 0.5)
        
        if not query or confidence < 0.5:
            continue
        
        if query.lower() in existing_queries:
            continue
        
        now = datetime.utcnow()
        signal = {
            "signal_id": f"sig_{uuid.uuid4().hex[:12]}",
            "query": query,
            "priority": 5,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=72)).isoformat(),
            "confidence": confidence,
            "source": "smart_reflection"
        }
        
        personal_signals.append(signal)
        existing_queries.add(query.lower())
        stats["signals_created"] += 1
    
    patterns["personal_signals"] = personal_signals
    
    # Apply source adjustments
    source_adj = adjustments.get("source_adjustments", {})
    if source_adj.get("increase") or source_adj.get("decrease"):
        source_dist = preferences.get("source_distribution", {})
        
        for source in source_adj.get("increase", []):
            if source in source_dist:
                source_dist[source] = min(100, source_dist[source] + 10)
        
        for source in source_adj.get("decrease", []):
            if source in source_dist:
                source_dist[source] = max(0, source_dist[source] - 10)
        
        preferences["source_distribution"] = source_dist
        stats["source_adjusted"] = True
    
    # Apply content depth suggestion
    depth_suggestion = adjustments.get("content_depth_suggestion", {})
    if depth_suggestion.get("suggestion"):
        preferences["contentDepth"] = depth_suggestion["suggestion"]
        stats["depth_adjusted"] = True
    
    return patterns, preferences, stats


def main():
    parser = argparse.ArgumentParser(description="Run smart reflection for testing")
    parser.add_argument("--test", action="store_true", help="Run with test data")
    args = parser.parse_args()
    
    if args.test:
        # Test with sample data
        test_interactions = [
            {
                "action": "upvote",
                "note": "love the MCP section, want to learn more about tool use",
                "item_metadata": {
                    "title": "Building AI Agents with Claude",
                    "type": "blog",
                    "tags": ["ai", "agents", "mcp"]
                }
            },
            {
                "action": "downvote",
                "note": "too theoretical, need more practical examples",
                "item_metadata": {
                    "title": "Transformer Architecture Deep Dive",
                    "type": "paper",
                    "tags": ["ml", "transformers", "theory"]
                }
            }
        ]
        
        test_profile = {
            "interests": ["AI", "Frontend"],
            "learningStyle": "hands-on with code"
        }
        
        test_patterns = {
            "tags": {"ai": {"score": 60}, "frontend": {"score": 55}},
            "exclude_tags": [],
            "personal_signals": []
        }
        
        test_preferences = {
            "source_distribution": {"video": 40, "blog": 35, "paper": 15},
            "contentDepth": "deep"
        }
        
        print("Running smart reflection with test data...")
        result = run_smart_reflection(
            test_interactions,
            test_profile,
            test_patterns,
            test_preferences
        )
        
        if result:
            print("\nLLM Adjustments:")
            print(json.dumps(result, indent=2))
            
            patterns, prefs, stats = apply_smart_adjustments(
                result, test_patterns, test_preferences
            )
            
            print("\nApplied Stats:")
            print(json.dumps(stats, indent=2))
        else:
            print("No adjustments suggested")


if __name__ == "__main__":
    main()

