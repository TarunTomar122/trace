"""
Unsubscribe flow wrapper (keeps legacy unmap logic isolated).

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

from v1.algorithm.unmap_user import unmap_user


def main():
    parser = argparse.ArgumentParser(description="Unsubscribe user flow")
    parser.add_argument("--user_id", required=True, help="User ID to unsubscribe")
    args = parser.parse_args()

    result = unmap_user(args.user_id)
    print(result)


if __name__ == "__main__":
    main()

