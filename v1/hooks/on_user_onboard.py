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
from v1.algorithm.interest_schema import get_interest_ids, get_interest_queries


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

    # Step 0: Ensure interest_ids / interest_queries are present
    if not args.skip_normalize:
        interest_ids = get_interest_ids(profile)
        interest_queries = get_interest_queries(profile)
        updates = {
            "interest_ids": interest_ids,
            "interest_queries": interest_queries,
            "interestQueries": interest_queries,
        }
        raw_interests = profile.get("interests", []) or []
        if raw_interests and raw_interests != interest_ids:
            updates["legacy_interests"] = raw_interests
            updates["interests"] = interest_ids
        elif interest_ids and not raw_interests:
            updates["interests"] = interest_ids

        store.db.collection("user_profiles").document(args.user_id).update(updates)
        print(f"  Updated interest schema for {args.user_id}")

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

