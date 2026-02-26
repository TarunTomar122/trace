#!/usr/bin/env python3
"""
Interactive Research Agent - Go deep on any trending story
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv
import openai
import requests
import firebase_admin
from firebase_admin import credentials, firestore

# Load root .env
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def init_firebase():
    """Initialize Firebase."""
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if cred_path and cred_path.startswith("./"):
        cred_path = str(ROOT_DIR / cred_path[2:])

    if not cred_path:
        cred_path = str(ROOT_DIR / "anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json")

    if not Path(cred_path).exists():
        print(f"❌ Firebase credentials not found: {cred_path}")
        sys.exit(1)

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    return firestore.client()


def get_user_feed(db: firestore.Client, uid: str) -> List[Dict[str, Any]]:
    """Get user's trending feed items."""
    feed_ref = db.collection("v3_user_feeds").document(uid).collection("daily")
    docs = list(feed_ref.stream())

    if not docs:
        raise ValueError(f"No feed found for user {uid}")

    docs.sort(key=lambda d: d.id, reverse=True)
    latest = docs[0].to_dict()

    return latest.get("trending", [])


def search_with_exa(query: str, num_results: int = 10) -> List[Dict[str, Any]]:
    """Search using Exa API."""
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        print("⚠️  No EXA_API_KEY found")
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
            "numResults": num_results,
            "contents": {
                "text": {"maxCharacters": 2000}
            }
        }

        print(f"🔍 Searching Exa for: {query}")
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()

        results = response.json().get("results", [])
        print(f"   Found {len(results)} results")
        return results

    except Exception as e:
        print(f"❌ Exa search error: {e}")
        return []


def generate_deep_dive(
    article: Dict[str, Any],
    user_context: str,
    research_results: List[Dict[str, Any]]
) -> str:
    """Generate deep dive article based on user's context."""

    title = article.get("title", "Article")
    summary = article.get("summary", {})
    short_article = summary.get("short_article", {})
    original_body = short_article.get("body", "")
    original_url = article.get("url", "")

    # Format research results
    research_context = []
    for i, result in enumerate(research_results[:8], 1):
        text = result.get("text", "")[:500]
        research_context.append(f"""
Source {i}: {result.get('title', 'Untitled')}
{text}...
URL: {result.get('url', '')}
""")

    system_prompt = f"""You are a research assistant. Answer the user's question directly.

**Article:**
{title}
{original_body[:300]}

**User's Question:**
{user_context}

**Research:**
{chr(10).join(research_context)}

Answer in 100-150 words max.

CRITICAL RULES:
- NO meta-commentary ("I can't", "I don't have", "let me explain")
- NO disclaimers or apologies
- JUST ANSWER THE QUESTION
- Use facts from research
- Be direct and conversational
- If comparing: state the differences directly
- If they ask what to build: give specific ideas
- If not relevant: say so honestly

Start your answer immediately. No preamble.
"""

    print("✍️  Generating deep dive analysis...")

    response = client.chat.completions.create(
        model="gpt-4o",  # Use better model for deep analysis
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Answer the question directly."}
        ],
        temperature=0.5,
        max_tokens=500
    )

    return response.choices[0].message.content


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Interactive research agent")
    parser.add_argument("--user-id", required=True, help="User ID")
    parser.add_argument("--article-index", type=int, help="Article index (0-based)")
    parser.add_argument("--angle", help="Your context/situation/question about the article")
    args = parser.parse_args()

    print("="*60)
    print("🔬 Interactive Research Agent")
    print("="*60)
    print()

    # Initialize
    db = init_firebase()

    # Get trending feed
    print(f"📰 Fetching trending feed for user {args.user_id}...")
    trending_items = get_user_feed(db, args.user_id)

    if not trending_items:
        print("❌ No trending items found")
        return

    print(f"   Found {len(trending_items)} trending articles")
    print()

    # Show articles
    if args.article_index is None:
        print("="*60)
        print("📋 YOUR TRENDING HEADLINES")
        print("="*60)
        print()
        for i, item in enumerate(trending_items):
            title = item.get("title", "Untitled")
            url = item.get("url", "")
            print(f"{i}. {title}")
            print(f"   {url}")
            print()

        print("To dive deep into an article, run:")
        print(f'python research_agent.py --user-id {args.user_id} --article-index 0')
        print()
        print("Or pass your context directly:")
        print(f'python research_agent.py --user-id {args.user_id} --article-index 0 --angle "your context/question"')
        return

    # Validate index
    if args.article_index < 0 or args.article_index >= len(trending_items):
        print(f"❌ Invalid index. Choose 0-{len(trending_items)-1}")
        return

    selected = trending_items[args.article_index]
    title = selected.get("title", "Untitled")

    print("="*60)
    print(f"🎯 SELECTED: {title}")
    print("="*60)
    print()

    # Get user's context
    if not args.angle:
        print("💬 Tell me about yourself and what you want to know:")
        print()
        print("   Examples:")
        print("   - 'I build with open source models, what can I explore with this?'")
        print("   - 'I'm a designer who doesn't do AI much, how is this relevant to me?'")
        print("   - 'I want to understand the technical implementation details'")
        print("   - 'I'm considering using this for my startup, what should I know?'")
        print()
        user_context = input("   Your context: ").strip()
        if not user_context:
            user_context = "Give me a comprehensive overview with technical details"
    else:
        user_context = args.angle

    print()
    print(f"🎯 Got it: {user_context}")
    print()

    # Do research
    search_query = f"{title} detailed analysis technical implementation"
    research_results = search_with_exa(search_query, num_results=10)

    if not research_results:
        print("⚠️  No additional research found, using original article only")

    print()

    # Generate deep dive
    deep_dive = generate_deep_dive(selected, user_context, research_results)

    print("="*60)
    print("📖 DEEP DIVE ANALYSIS")
    print("="*60)
    print()
    print(deep_dive)
    print()

    # Save
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_title = "".join(c for c in title[:50] if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
    filename = f"{output_dir}/deepdive_{safe_title}_{timestamp}.txt"

    with open(filename, "w") as f:
        f.write(f"Deep Dive: {title}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"User Context: {user_context}\n")
        f.write(f"Sources analyzed: {len(research_results)}\n")
        f.write(f"\n{'='*60}\n\n")
        f.write(deep_dive)

    print(f"💾 Saved to: {filename}")


if __name__ == "__main__":
    main()
