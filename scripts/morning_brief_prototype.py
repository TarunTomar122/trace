#!/usr/bin/env python3
"""
Generate an experimental "morning coffee" brief using self-fetched content.

Fetches from HN, Reddit, and role-specific RSS, then passes to GPT.
No web_search tool — all content is pre-fetched.

Usage:
  python3 scripts/morning_brief_prototype.py --user-id <uid>
  python3 scripts/morning_brief_prototype.py --role developer --goal get-promoted
  python3 scripts/morning_brief_prototype.py --role designer --name Priya
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[1]
# The pipeline packages (v1/v2/v3) live in backend/.
for path in (REPO_ROOT / "backend", REPO_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

load_dotenv(REPO_ROOT / ".env")

from v3.build_for_you import (  # noqa: E402
    PROMPT,
    ROLE_FOCUS,
    ROLE_LABELS,
    GOAL_LABELS,
    FOR_YOU_BRIEF_MODEL,
    fetch_content_pool,
    _format_articles_block,
)
from v3.lib.store import V3Store  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate experimental morning brief")
    parser.add_argument("--user-id", default="")
    parser.add_argument("--role", default="")
    parser.add_argument("--goal", default="")
    parser.add_argument("--name", default="Tarun")
    parser.add_argument("--model", default=FOR_YOU_BRIEF_MODEL)
    return parser.parse_args()


def load_context(args: argparse.Namespace) -> tuple[str, str, str, str, list[str]]:
    """Returns (name, role_key, role_label, goal_label, interests)."""
    role = args.role.strip().lower()
    goal = args.goal.strip()
    name = args.name.strip() or "Tarun"
    interests: list[str] = []

    if args.user_id:
        store = V3Store()
        profile = store.get_user_profile(args.user_id) or {}
        name = (
            str(profile.get("name") or profile.get("displayName") or name).strip()
            or name
        )
        role = str(profile.get("role") or role).strip().lower()
        goals = profile.get("careerGoals") or []
        if not goal and goals:
            goal = str(goals[0]).strip()
        interests = [
            str(item).strip()
            for item in (profile.get("interests") or [])
            if str(item).strip()
        ]

    if not role:
        role = "developer"
    if not goal:
        goal = "get-promoted"

    role_label = ROLE_LABELS.get(role, role or "professional")
    goal_label = GOAL_LABELS.get(goal, goal.replace("-", " "))

    return name, role, role_label, goal_label, interests


def main() -> None:
    args = parse_args()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    name, role_key, role_label, goal_label, interests = load_context(args)

    print(f"Fetching content pool for role={role_key}...")
    pool = fetch_content_pool(roles=[role_key])
    articles = pool.get(role_key, [])
    print(f"Got {len(articles)} articles. Generating brief...\n")

    articles_block = _format_articles_block(articles, limit=20)

    prompt = PROMPT.format(
        name=name,
        today=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        role=role_label,
        goal=goal_label,
        interests=", ".join(interests) if interests else "engineering, tech, AI",
        role_focus=ROLE_FOCUS.get(role_key, "Lean into the most useful, timely signals for this person's work."),
        articles_block=articles_block,
    )

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=args.model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
    )
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
