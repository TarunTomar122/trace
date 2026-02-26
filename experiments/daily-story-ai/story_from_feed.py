#!/usr/bin/env python3
"""
Generate story from user's trending feed
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from dotenv import load_dotenv
import openai
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


def get_user_profile(db: firestore.Client, uid: str) -> Dict[str, Any]:
    """Get user profile."""
    doc = db.collection("user_profiles").document(uid).get()
    if not doc.exists:
        raise ValueError(f"User {uid} not found")
    return doc.to_dict()


def get_latest_feed(db: firestore.Client, uid: str) -> Dict[str, Any]:
    """Get user's latest v3 feed."""
    feed_ref = db.collection("v3_user_feeds").document(uid).collection("daily")
    docs = list(feed_ref.stream())

    if not docs:
        raise ValueError(f"No feed found for user {uid}")

    # Sort by date descending
    docs.sort(key=lambda d: d.id, reverse=True)
    latest = docs[0].to_dict()

    return {
        "date": docs[0].id,
        "trending": latest.get("trending", []),
    }


def generate_story(profile: Dict[str, Any], feed: Dict[str, Any]) -> str:
    """Generate story from trending feed items."""

    trending_items = feed.get("trending", [])[:5]

    if not trending_items:
        return "❌ No trending items found"

    # Build context from trending items
    articles_context = []
    for i, item in enumerate(trending_items, 1):
        title = item.get("title", "Untitled")
        summary = item.get("summary", {})
        url = item.get("url", "")

        short_article = summary.get("short_article", {})
        body = short_article.get("body", "")
        key_takeaways = short_article.get("key_takeaways", [])

        articles_context.append(f"""
Article {i}: {title}
Summary: {body[:400] if body else "No summary available"}
Key Points: {', '.join(key_takeaways[:3]) if key_takeaways else "N/A"}
URL: {url}
""")

    # Profile context
    name = profile.get("name", "there").split()[0]  # First name only
    role = profile.get("role", "professional")
    interests = profile.get("interests", [])
    career_goals = profile.get("careerGoals", [])

    system_prompt = f"""You are creating a personalized news digest for a professional.

**Reader Profile:**
- Name: {name}
- Role: {role}
- Interests: {', '.join(interests)}

**Today's Trending Articles:**
{chr(10).join(articles_context)}

Create a news digest (300-400 words) that:
1. Covers 2-3 of the most relevant trending articles
2. Presents the key facts and details from each article
3. Connects the stories in an interesting narrative
4. Focuses on what actually happened, the numbers, the players involved

Style:
- Conversational and engaging
- Stick to the facts and details from the articles
- No generic advice or "takeaways"
- No "what this means for you" conclusions
- No motivational endings
- Just present the news in an interesting way
- No emojis

Write like a smart friend briefing you on what happened today - just the facts, made interesting.
"""

    print("✍️  Generating story from trending feed...")

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Generate today's story."}
        ],
        temperature=0.7,
        max_tokens=1500
    )

    return response.choices[0].message.content


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate story from trending feed")
    parser.add_argument("--user-id", required=True, help="User ID")
    args = parser.parse_args()

    print("="*60)
    print("📖 Story Generator (Trending Feed)")
    print("="*60)
    print()

    # Initialize
    db = init_firebase()

    # Get user profile
    print(f"👤 Fetching profile for {args.user_id}...")
    profile = get_user_profile(db, args.user_id)

    print(f"   Name: {profile.get('name', 'User')}")
    print(f"   Role: {profile.get('role')}")
    print(f"   Interests: {', '.join(profile.get('interests', []))}")
    print()

    # Get latest feed
    print("📰 Fetching trending feed...")
    feed = get_latest_feed(db, args.user_id)

    print(f"   Date: {feed['date']}")
    print(f"   Trending items: {len(feed['trending'])}")
    print()

    # Generate story
    story = generate_story(profile, feed)

    print("="*60)
    print("📖 YOUR DAILY STORY")
    print("="*60)
    print()
    print(story)
    print()

    # Save locally
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{output_dir}/story_{args.user_id}_{timestamp}.txt"

    with open(filename, "w") as f:
        f.write(f"Daily Story for {profile.get('name', 'User')}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Feed Date: {feed['date']}\n")
        f.write(f"\n{'='*60}\n\n")
        f.write(story)

    print(f"💾 Saved to: {filename}")


if __name__ == "__main__":
    main()
