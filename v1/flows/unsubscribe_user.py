"""
Unsubscribe flow wrapper (topics-based).

Usage:
  python v1/flows/unsubscribe_user.py --user_id USER_ID
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


def main():
    parser = argparse.ArgumentParser(description="Unsubscribe user flow")
    parser.add_argument("--user_id", required=True, help="User ID to unsubscribe")
    args = parser.parse_args()

    store = FirestoreStore()
    profile = store.get_user_profile(args.user_id)
    if not profile:
        result = {"error": "User not found", "user_id": args.user_id}
    else:
        result = {
            "user_id": args.user_id,
            "webStatus": profile.get("subscriptionStatus", "none"),
            "appStatus": profile.get("appSubscriptionStatus", "none"),
            "message": "Topics-based system: no legacy unmap required.",
        }
    print(result)


if __name__ == "__main__":
    main()

