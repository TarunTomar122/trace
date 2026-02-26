#!/usr/bin/env python3
"""
Generate podcast script from user's For You feed
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List
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
        "for_you": latest.get("for_you", []),
        "deep_dives": latest.get("deep_dives", []),
        "trending": latest.get("trending", []),
    }


def generate_podcast_script(profile: Dict[str, Any], feed: Dict[str, Any]) -> str:
    """Generate podcast script from feed items."""

    # Get top 5 For You items
    for_you_items = feed.get("for_you", [])[:5]

    if not for_you_items:
        return "❌ No feed items found"

    # Build context from feed items
    feed_context = []
    for i, item in enumerate(for_you_items, 1):
        title = item.get("title", "Untitled")
        summary = item.get("summary", {})

        # Extract summary text
        short_article = summary.get("short_article", {})
        body = short_article.get("body", "")
        key_takeaways = short_article.get("key_takeaways", [])
        why_matters = short_article.get("why_it_matters", "")

        feed_context.append(f"""
Article {i}: {title}
Summary: {body[:300] if body else "No summary"}
Key Takeaways: {', '.join(key_takeaways[:3]) if key_takeaways else "None"}
Why It Matters: {why_matters}
""")

    # Build profile context
    name = profile.get("name", "there")
    role = profile.get("role", "professional")
    seniority = profile.get("seniority", "mid")
    interests = profile.get("interests", [])
    career_goals = profile.get("careerGoals", [])

    system_prompt = f"""You are a podcast host creating a personalized daily briefing for a professional.

**Listener Profile:**
- Name: {name}
- Role: {role}
- Experience: {seniority}
- Interests: {', '.join(interests)}
- Goals: {', '.join(career_goals)}

**Today's Feed Items:**
{chr(10).join(feed_context)}

Create a 3-5 minute podcast script that:
1. Opens with a warm, energetic greeting
2. Connects 2-3 articles into a cohesive narrative
3. Explains why these matter for the listener's career
4. Provides actionable insights
5. Ends with motivation and next steps

Style:
- Conversational and engaging (like a friend sharing insights)
- Natural speech patterns (contractions, pauses)
- Include [PAUSE] markers for dramatic effect
- Use storytelling techniques
- Keep it personal and relevant

Format:
[INTRO MUSIC]
Host: [Opening]
Host: [Main content with stories]
Host: [Closing with action items]
[OUTRO MUSIC]
"""

    print("🎙️  Generating podcast script...")

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Generate today's podcast script."}
        ],
        temperature=0.8,
        max_tokens=2000
    )

    return response.choices[0].message.content


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate podcast script from feed")
    parser.add_argument("--user-id", required=True, help="User ID")
    parser.add_argument("--save", action="store_true", help="Save to Firestore")
    args = parser.parse_args()

    print("="*60)
    print("🎙️  Podcast Script Generator")
    print("="*60)
    print()

    # Initialize
    db = init_firebase()

    # Get user profile
    print(f"📖 Fetching profile for {args.user_id}...")
    profile = get_user_profile(db, args.user_id)

    print(f"👤 {profile.get('name', 'User')}")
    print(f"   Role: {profile.get('role')}")
    print(f"   Interests: {', '.join(profile.get('interests', []))}")
    print()

    # Get latest feed
    print("📰 Fetching latest feed...")
    feed = get_latest_feed(db, args.user_id)

    print(f"📅 Feed date: {feed['date']}")
    print(f"📊 For You items: {len(feed['for_you'])}")
    print(f"📊 Deep Dives: {len(feed['deep_dives'])}")
    print(f"📊 Trending: {len(feed['trending'])}")
    print()

    # Generate script
    script = generate_podcast_script(profile, feed)

    print("="*60)
    print("🎙️  PODCAST SCRIPT")
    print("="*60)
    print()
    print(script)
    print()

    # Save locally
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{output_dir}/podcast_{args.user_id}_{timestamp}.txt"

    with open(filename, "w") as f:
        f.write(f"Podcast Script for {profile.get('name', 'User')}\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Feed Date: {feed['date']}\n")
        f.write(f"\n{'='*60}\n\n")
        f.write(script)

    print(f"💾 Saved to: {filename}")

    # Optionally save to Firestore
    if args.save:
        doc = {
            "script": script,
            "generated_at": datetime.utcnow().isoformat(),
            "feed_date": feed["date"],
            "profile_snapshot": {
                "name": profile.get("name"),
                "role": profile.get("role"),
                "interests": profile.get("interests", []),
            }
        }

        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        db.collection("user_podcasts").document(args.user_id).collection("episodes").document(date_str).set(doc)
        print(f"✅ Saved to Firestore: user_podcasts/{args.user_id}/episodes/{date_str}")


if __name__ == "__main__":
    main()
