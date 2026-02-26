#!/usr/bin/env python3
"""
Daily Story AI Generator - Personalized content using OpenAI + Web Search

This script generates personalized daily stories for users based on their profile data.
It uses OpenAI's API with web search capabilities (via function calling or Perplexity).
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
import openai
import requests
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Role descriptions for context
ROLE_CONTEXT = {
    "designer": "UX/UI Designer, Product Designer, or Visual Designer",
    "developer": "Software Engineer, Frontend/Backend/Full-stack Developer",
    "pm": "Product Manager focused on strategy and roadmaps",
    "marketer": "Growth Marketer, Content Marketer, or Brand Marketer",
    "founder": "Startup Founder or CEO building and leading a company",
    "other": "Professional in a unique role",
}

# Seniority level context
SENIORITY_CONTEXT = {
    "early": "0-3 years of experience, early in career",
    "mid": "3-7 years of experience, mid-level professional",
    "senior": "7-12 years of experience, senior professional",
    "executive": "12+ years of experience, executive or leadership level",
}

# Career goals context
CAREER_GOALS_CONTEXT = {
    "get-promoted": "wants to level up and get promoted in current role",
    "switch-careers": "looking to pivot to a new field or role",
    "build-something": "wants to launch a product or startup",
    "lead-team": "aspiring to move into management and lead a team",
    "stay-sharp": "focused on staying current with industry trends",
    "grow-network": "wants to connect with the right people and expand network",
}


def search_web_perplexity(query: str, profile_context: str) -> str:
    """
    Search the web using Perplexity API.
    Perplexity provides real-time web search with citations.
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        return "Web search unavailable - no Perplexity API key"

    try:
        url = "https://api.perplexity.ai/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {
                    "role": "system",
                    "content": f"You are a research assistant. Search for latest information relevant to: {profile_context}"
                },
                {
                    "role": "user",
                    "content": query
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.2,
            "return_citations": True
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()

        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = result.get("citations", [])

        # Format with citations
        if citations:
            content += "\n\nSources:\n" + "\n".join([f"- {cite}" for cite in citations[:3]])

        return content

    except Exception as e:
        print(f"Perplexity search error: {e}")
        return f"Search error: {str(e)}"


def search_web_exa(query: str) -> List[Dict[str, Any]]:
    """
    Search the web using Exa API (Neural search engine).
    Returns a list of high-quality results.
    """
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        return []

    try:
        url = "https://api.exa.ai/search"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "x-api-key": api_key
        }

        payload = {
            "query": query,
            "type": "neural",
            "useAutoprompt": True,
            "numResults": 5,
            "contents": {
                "text": {"maxCharacters": 1000}
            }
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()

        results = response.json().get("results", [])
        return results

    except Exception as e:
        print(f"Exa search error: {e}")
        return []


def build_profile_context(profile: Dict[str, Any]) -> str:
    """Build a rich context string from user profile."""
    role = profile.get("role", "professional")
    seniority = profile.get("seniority", "mid")
    interests = profile.get("interests", [])
    career_goals = profile.get("careerGoals", [])
    summary_style = profile.get("summaryStyle", "practitioner")

    context_parts = [
        f"Role: {ROLE_CONTEXT.get(role, role)}",
        f"Experience: {SENIORITY_CONTEXT.get(seniority, seniority)}",
        f"Interests: {', '.join(interests)}",
        f"Career Goals: {', '.join([CAREER_GOALS_CONTEXT.get(g, g) for g in career_goals])}",
        f"Preferred Style: {summary_style}",
    ]

    return "\n".join(context_parts)


def generate_search_queries(profile: Dict[str, Any]) -> List[str]:
    """Generate relevant search queries based on user profile."""
    role = profile.get("role", "professional")
    interests = profile.get("interests", [])
    career_goals = profile.get("careerGoals", [])

    queries = []

    # Role-specific queries
    if role == "designer":
        queries.append("latest UX design tools and AI features 2026")
        queries.append("designer promotion success stories")
    elif role == "developer":
        queries.append("new programming tools and frameworks 2026")
        queries.append("software engineer career growth stories")
    elif role == "pm":
        queries.append("product management trends 2026")
        queries.append("product manager promotion case studies")
    elif role == "marketer":
        queries.append("marketing automation and AI tools 2026")
        queries.append("growth marketer success stories")
    elif role == "founder":
        queries.append("startup success stories 2026")
        queries.append("founder insights and lessons learned")

    # Interest-specific queries
    for interest in interests[:2]:  # Top 2 interests
        queries.append(f"latest {interest} trends and developments 2026")

    # Career goal queries
    if "get-promoted" in career_goals:
        queries.append(f"{role} promotion strategies and success stories")
    if "build-something" in career_goals:
        queries.append(f"how to build and launch products as a {role}")

    return queries[:3]  # Limit to top 3 queries


def generate_story(profile: Dict[str, Any], search_method: str = "perplexity") -> str:
    """
    Generate a personalized daily story using OpenAI + web search.

    Args:
        profile: User profile data from onboarding
        search_method: "perplexity", "exa", or "none"

    Returns:
        Generated story as markdown string
    """
    profile_context = build_profile_context(profile)
    search_queries = generate_search_queries(profile)

    # Gather web search results
    search_results = []

    if search_method == "perplexity":
        print("🔍 Searching web via Perplexity...")
        for query in search_queries:
            print(f"  Query: {query}")
            result = search_web_perplexity(query, profile_context)
            search_results.append(f"Query: {query}\n{result}")
    elif search_method == "exa":
        print("🔍 Searching web via Exa...")
        for query in search_queries:
            print(f"  Query: {query}")
            results = search_web_exa(query)
            if results:
                formatted = "\n".join([
                    f"- {r.get('title', 'Untitled')}: {r.get('text', '')[:200]}... ({r.get('url', '')})"
                    for r in results[:2]
                ])
                search_results.append(f"Query: {query}\n{formatted}")

    # Build the prompt for story generation
    search_context = "\n\n---\n\n".join(search_results) if search_results else "No web search results available."

    system_prompt = f"""You are a personalized daily story generator for the Trace app.

Your goal is to create an engaging, insightful, and actionable daily story for a user based on:
1. Their professional profile and goals
2. Latest web search results about relevant topics
3. Real success stories and practical advice

**User Profile:**
{profile_context}

**Writing Style Guidelines:**
- Start with a friendly greeting
- Lead with an interesting discovery or trend
- Include a real or realistic success story (person who achieved something relevant)
- Provide 3-5 actionable takeaways
- End with an invitation to learn more or take action
- Keep it conversational and motivating
- Length: 300-500 words

**Web Search Results:**
{search_context}

Now generate a personalized daily story that feels like it's from a knowledgeable friend who's looking out for the user's career growth."""

    user_prompt = "Generate today's personalized story for this user."

    print("✍️  Generating story with OpenAI...")

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # or "gpt-4o" for better quality
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1500
        )

        story = response.choices[0].message.content

        # Add metadata
        metadata = f"""
---
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Profile:** {profile.get('role', 'N/A')} • {profile.get('seniority', 'N/A')} • {', '.join(profile.get('interests', []))}
**Search Method:** {search_method}
---
"""

        return story + "\n\n" + metadata

    except Exception as e:
        print(f"❌ Story generation error: {e}")
        return f"Error generating story: {str(e)}"


def main():
    """Test the story generator with sample profiles."""

    # Sample user profile (matching Trace onboarding structure)
    sample_profiles = [
        {
            "name": "Alex Chen",
            "role": "designer",
            "seniority": "mid",
            "interests": ["experience", "technology", "startups"],
            "careerGoals": ["get-promoted"],
            "summaryStyle": "practitioner"
        },
        {
            "name": "Jordan Smith",
            "role": "developer",
            "seniority": "early",
            "interests": ["technology", "engineering", "startups"],
            "careerGoals": ["build-something", "stay-sharp"],
            "summaryStyle": "casual"
        },
        {
            "name": "Sam Rodriguez",
            "role": "pm",
            "seniority": "senior",
            "interests": ["business-market", "startups", "leadership"],
            "careerGoals": ["lead-team"],
            "summaryStyle": "executive"
        }
    ]

    # Choose a profile
    profile = sample_profiles[0]

    print("=" * 60)
    print(f"🚀 Generating Daily Story for {profile['name']}")
    print("=" * 60)
    print()

    # Generate story (try perplexity first, fallback to no search)
    search_method = "perplexity" if os.getenv("PERPLEXITY_API_KEY") else "none"

    if search_method == "none":
        print("⚠️  No web search API keys configured. Generating without real-time data.")
        print("   Add PERPLEXITY_API_KEY or EXA_API_KEY to .env for web search.\n")

    story = generate_story(profile, search_method=search_method)

    print("\n" + "=" * 60)
    print("📖 Generated Story:")
    print("=" * 60)
    print()
    print(story)

    # Save to file
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    filename = f"{output_dir}/story_{profile['name'].lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(filename, "w") as f:
        f.write(f"# Daily Story for {profile['name']}\n\n")
        f.write(story)

    print(f"\n💾 Story saved to: {filename}")


if __name__ == "__main__":
    main()
