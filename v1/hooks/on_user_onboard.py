"""
Onboarding/Subscription hook (topics-based).

Usage:
    python v1/hooks/on_user_onboard.py --user_id abc123
"""
import argparse
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore
from v1.flows.build_feed_from_topics import build_feed_from_topics
from v1.flows.build_topics_for_user import build_topics_for_user
from v1.flows.build_unsubscribed_feed_from_topics import build_unsubscribed_feed
from v1.flows.build_suggested_items_for_user import build_suggested_items_for_user
from v1.flows.normalize_user_interests import (
    normalize_user_interests,
    update_user_profile_interests,
)


def main():
    parser = argparse.ArgumentParser(
        description="Onboard user using topics-based pipeline"
    )
    parser.add_argument("--user_id", required=True, help="User ID to onboard")
    parser.add_argument(
        "--skip-normalize",
        action="store_true",
        help="Skip interest normalization step",
    )
    args = parser.parse_args()

    store = FirestoreStore()
    profile = store.get_user_profile(args.user_id)
    if not profile:
        print({"error": "User not found", "user_id": args.user_id})
        sys.exit(1)

    status = profile.get("subscriptionStatus", "none")
    is_subscribed = status in ["trial", "active"]

    print(f"Onboarding user {args.user_id} (status: {status})")

    # Step 0: Normalize interests to prevent duplicate topics
    if not args.skip_normalize:
        print("\nNormalizing user interests...")
        raw_interests = profile.get("interests", []) or []
        raw_hobbies = profile.get("hobbies", []) or []

        if raw_interests or raw_hobbies:
            normalized = normalize_user_interests(
                interests=raw_interests,
                hobbies=raw_hobbies,
                store=store,
            )

            # Update profile with normalized interests
            if normalized["interests"] or normalized["hobbies"]:
                update_user_profile_interests(
                    user_id=args.user_id,
                    normalized_interests=normalized["interests"],
                    normalized_hobbies=normalized["hobbies"],
                    store=store,
                )
                print(
                    f"  Normalized: {len(raw_interests)} → {len(normalized['interests'])} interests, "
                    f"{len(raw_hobbies)} → {len(normalized['hobbies'])} hobbies"
                )

    if is_subscribed:
        print("\nBuilding topics for subscribed user...")
        build_topics_for_user(args.user_id)

        print("\nBuilding personalized feed from topics...")
        build_feed_from_topics(args.user_id)

        print("\nAdding suggested items...")
        build_suggested_items_for_user(args.user_id)
    else:
        print("\nBuilding preview feed from topics...")
        build_unsubscribed_feed(args.user_id)

    print({"user_id": args.user_id, "status": status, "ok": True})


if __name__ == "__main__":
    main()

