#!/usr/bin/env python3
"""
Firebase Integration - Read user profiles and generate stories

This script reads user profiles from Firestore and generates personalized stories.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Add parent directory to path to import story generator
sys.path.insert(0, str(Path(__file__).parent))
from story_generator import generate_story

# Load .env from root directory
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# Initialize Firebase Admin
def init_firebase():
    """Initialize Firebase Admin SDK."""
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    # If it's a relative path, make it absolute from root
    if cred_path and cred_path.startswith("./"):
        cred_path = str(ROOT_DIR / cred_path[2:])
    elif not cred_path:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not cred_path:
        # Try to find service account in repo root
        possible_paths = [
            ROOT_DIR / "anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json",
            ROOT_DIR / "service-account.json",
            ROOT_DIR / "firebase-credentials.json",
        ]

        for path in possible_paths:
            if path.exists():
                cred_path = str(path)
                break

    if not cred_path or not Path(cred_path).exists():
        print("❌ Firebase credentials not found!")
        print(f"   Tried path: {cred_path}")
        print(f"   Looked in: {ROOT_DIR}")
        print("   Set FIREBASE_SERVICE_ACCOUNT_PATH in .env")
        sys.exit(1)

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    return firestore.client()


def get_user_profile(db: firestore.Client, uid: str) -> Optional[Dict[str, Any]]:
    """Fetch user profile from Firestore."""
    try:
        doc = db.collection("user_profiles").document(uid).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None


def get_all_onboarded_users(db: firestore.Client, limit: int = 10) -> List[Dict[str, Any]]:
    """Fetch all onboarded users from Firestore."""
    try:
        docs = (
            db.collection("user_profiles")
            .where("onboarded", "==", True)
            .limit(limit)
            .stream()
        )

        profiles = []
        for doc in docs:
            data = doc.to_dict()
            data["uid"] = doc.id
            profiles.append(data)

        return profiles

    except Exception as e:
        print(f"Error fetching users: {e}")
        return []


def save_story_to_firestore(
    db: firestore.Client,
    uid: str,
    story: str,
    profile: Dict[str, Any]
) -> bool:
    """Save generated story to Firestore."""
    try:
        story_doc = {
            "story": story,
            "generated_at": datetime.utcnow().isoformat(),
            "profile_snapshot": {
                "role": profile.get("role"),
                "seniority": profile.get("seniority"),
                "interests": profile.get("interests", []),
                "careerGoals": profile.get("careerGoals", []),
            },
            "metadata": {
                "version": "v1",
                "source": "daily-story-ai-experiment",
            }
        }

        # Save to user_daily_stories/{uid}/stories/{date}
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        db.collection("user_daily_stories").document(uid).collection("stories").document(date_str).set(story_doc)

        print(f"✅ Story saved to Firestore for user {uid}")
        return True

    except Exception as e:
        print(f"❌ Error saving story to Firestore: {e}")
        return False


def generate_for_user(db: firestore.Client, uid: str, search_method: str = "perplexity", save_to_db: bool = True):
    """Generate and optionally save story for a specific user."""
    print(f"\n{'='*60}")
    print(f"📖 Generating story for user: {uid}")
    print(f"{'='*60}\n")

    # Fetch user profile
    profile = get_user_profile(db, uid)

    if not profile:
        print(f"❌ User profile not found for {uid}")
        return

    if not profile.get("onboarded"):
        print(f"⚠️  User {uid} has not completed onboarding")
        return

    # Display profile summary
    print(f"👤 {profile.get('name', 'User')}")
    print(f"   Role: {profile.get('role')}")
    print(f"   Seniority: {profile.get('seniority')}")
    print(f"   Interests: {', '.join(profile.get('interests', []))}")
    print(f"   Career Goals: {', '.join(profile.get('careerGoals', []))}")
    print()

    # Generate story
    story = generate_story(profile, search_method=search_method)

    print("\n" + "="*60)
    print("📖 Generated Story:")
    print("="*60)
    print()
    print(story)
    print()

    # Save to Firestore
    if save_to_db:
        save_story_to_firestore(db, uid, story, profile)

    # Save to local file
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    filename = f"{output_dir}/story_{uid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(filename, "w") as f:
        f.write(f"# Daily Story for {profile.get('name', 'User')}\n\n")
        f.write(story)

    print(f"💾 Story saved locally to: {filename}")


def generate_for_all_users(db: firestore.Client, limit: int = 10, search_method: str = "perplexity"):
    """Generate stories for all onboarded users."""
    print(f"\n{'='*60}")
    print(f"🚀 Generating stories for all users (limit: {limit})")
    print(f"{'='*60}\n")

    users = get_all_onboarded_users(db, limit=limit)

    if not users:
        print("❌ No onboarded users found")
        return

    print(f"Found {len(users)} onboarded users\n")

    for i, profile in enumerate(users, 1):
        print(f"\n[{i}/{len(users)}] Processing user: {profile.get('name', 'Unknown')}")
        try:
            story = generate_story(profile, search_method=search_method)

            # Save to Firestore
            save_story_to_firestore(db, profile["uid"], story, profile)

            print(f"✅ Story generated and saved for {profile.get('name')}")

        except Exception as e:
            print(f"❌ Error generating story for {profile.get('name')}: {e}")

    print(f"\n{'='*60}")
    print(f"✨ Completed! Generated stories for {len(users)} users")
    print(f"{'='*60}\n")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate daily stories for Trace users")
    parser.add_argument("--user-id", help="Generate for specific user ID")
    parser.add_argument("--all", action="store_true", help="Generate for all users")
    parser.add_argument("--limit", type=int, default=10, help="Limit number of users (with --all)")
    parser.add_argument("--search", choices=["perplexity", "exa", "none"], default="perplexity", help="Web search method")
    parser.add_argument("--no-save", action="store_true", help="Don't save to Firestore")

    args = parser.parse_args()

    # Initialize Firebase
    db = init_firebase()

    search_method = args.search

    # Check for API keys
    if search_method == "perplexity" and not os.getenv("PERPLEXITY_API_KEY"):
        print("⚠️  PERPLEXITY_API_KEY not found, falling back to 'none'")
        search_method = "none"
    elif search_method == "exa" and not os.getenv("EXA_API_KEY"):
        print("⚠️  EXA_API_KEY not found, falling back to 'none'")
        search_method = "none"

    if search_method == "none":
        print("⚠️  Running without web search (add API keys to .env for real-time data)\n")

    # Generate stories
    if args.user_id:
        generate_for_user(db, args.user_id, search_method=search_method, save_to_db=not args.no_save)
    elif args.all:
        generate_for_all_users(db, limit=args.limit, search_method=search_method)
    else:
        print("❌ Please specify --user-id or --all")
        parser.print_help()


if __name__ == "__main__":
    main()
