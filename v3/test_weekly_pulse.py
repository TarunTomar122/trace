#!/usr/bin/env python3
"""
Quick test: load 7 days of existing daily role briefs from Firebase
and generate a weekly pulse for each role.

Usage:
  python3 -m v3.test_weekly_pulse                    # dry run, print input only
  python3 -m v3.test_weekly_pulse --generate         # call OpenAI and print result
  python3 -m v3.test_weekly_pulse --role developer   # single role
  python3 -m v3.test_weekly_pulse --end-date 2026-03-22
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
load_dotenv(REPO_ROOT / ".env")

from v3.lib.store import V3Store, _today_ist  # noqa: E402

ROLE_ORDER = ["developer", "designer", "pm", "marketer", "founder"]

ROLE_PLURAL = {
    "developer": "engineers",
    "designer": "designers",
    "pm": "product managers",
    "marketer": "marketers",
    "founder": "founders",
}

ROLE_FOCUS = {
    "developer": "Focus on: cool new tools, HN drama, GitHub projects blowing up, infra shifts, AI/agent stuff, and things that make engineers go 'oh that's clever.'",
    "founder": "Focus on: what's changing in distribution, AI product wedges, startup tactics, competition moves, and things that help you build smarter or move faster.",
    "designer": "Focus on: design systems, product craft, AI in the design workflow, tools that are changing how things get built.",
    "pm": "Focus on: product strategy, new product patterns, execution tricks, user insights, and things that sharpen product sense.",
    "marketer": "Focus on: growth channels, positioning shifts, distribution plays, and concrete tactics that are actually working right now.",
}

WEEKLY_ROLE_PROMPT = """You're writing a "Week in Review" for a community of {role_plural}. Think Stratechery Saturday edition — synthesize what the week actually built toward, not just a list of articles.

This week: {week_range}

Audience: {role} — {role_focus}

---
DAILY BRIEFS FROM THIS WEEK:
{daily_briefs_block}

---
SOURCES CITED THIS WEEK (higher recurrence = came up multiple days):
{sources_block}

---

Your job:
- Read across all the daily briefs and identify 4-5 STORY THREADS — topics that kept coming up, built on each other, or reached a tipping point this week
- Write a "Week in Review". Each beat = one thread (not one article)
- For each beat: what happened, why it matters, did it resolve or is it still developing?
- Add a final beat: "## What to watch" — 2-3 threads worth following next week
- Use the recurrence counts to weight what was a real week-long story vs a one-day spike

Tone: Same Morning Brew energy but zoomed out. Confident synthesis. Have a take on what defined this week for {role_plural}.

Structure:
- Start with: # Week in Review — {week_range}
- One punchy subtitle line
- 4-5 ## beats (themes, not article titles)
- Each beat: 2-3 short paragraphs, **bold** key terms, then > Sources: Name1, Name2
- Final ## What to watch beat
- Short closing line

Do NOT:
- Recap each day individually — synthesize across days
- Use "lesson worth learning" or LinkedIn energy
- Hallucinate. Only use what's in the briefs above.
- Write dense paragraphs (2-3 sentences max)

Return markdown only."""


def _recent_dates(end_date: str, days: int) -> list[str]:
    base = datetime.strptime(end_date, "%Y-%m-%d")
    return [(base - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]


def _load_weekly_data(store: V3Store, role: str, end_date: str) -> dict:
    """Load 7 days of daily role brief data from Firebase."""
    dates = _recent_dates(end_date, 7)
    days_found = []
    source_counter: Counter = Counter()
    source_names: dict[str, str] = {}  # url -> name

    for date in reversed(dates):  # oldest first
        global_feed = store.load_global_feed(date)
        role_items = global_feed.get("for_you_roles", {}).get(role, [])
        if not role_items:
            continue

        item = role_items[0] if role_items else None
        if not item:
            continue

        body = (item.get("summary") or {}).get("short_article", {}).get("body", "")
        sources = item.get("sources", [])

        for src in sources:
            url = src.get("url", "")
            name = src.get("name", "")
            if url:
                source_counter[url] += 1
                if name:
                    source_names[url] = name

        days_found.append({
            "date": date,
            "body": body,
            "sources": sources,
        })

    return {
        "role": role,
        "end_date": end_date,
        "days": days_found,
        "source_counter": source_counter,
        "source_names": source_names,
    }


def _format_input(data: dict) -> str:
    """Format the daily briefs + source roster for the prompt."""
    role = data["role"]
    days = data["days"]
    source_counter = data["source_counter"]
    source_names = data["source_names"]

    # Daily briefs block
    briefs_parts = []
    for day in days:
        date_str = day["date"]
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        label = dt.strftime("%A, %b %d")
        body = day["body"] or "(no brief content)"
        briefs_parts.append(f"### {label}\n{body}")
    daily_briefs_block = "\n\n---\n\n".join(briefs_parts)

    # Sources block — sorted by recurrence desc
    source_lines = []
    for url, count in source_counter.most_common(30):
        name = source_names.get(url, url)
        recurrence = f"x{count}" if count > 1 else "x1"
        source_lines.append(f"- {name} ({recurrence}): {url}")
    sources_block = "\n".join(source_lines) if source_lines else "(none)"

    end_date = data["end_date"]
    start_date = _recent_dates(end_date, 7)[-1]
    week_range = f"{datetime.strptime(start_date, '%Y-%m-%d').strftime('%b %d')} – {datetime.strptime(end_date, '%Y-%m-%d').strftime('%b %d, %Y')}"

    prompt = WEEKLY_ROLE_PROMPT.format(
        role=role,
        role_plural=ROLE_PLURAL.get(role, f"{role}s"),
        role_focus=ROLE_FOCUS.get(role, ""),
        week_range=week_range,
        daily_briefs_block=daily_briefs_block,
        sources_block=sources_block,
    )
    return prompt


def run_test(role: str | None, end_date: str, generate: bool) -> None:
    store = V3Store()
    roles = [role] if role else ROLE_ORDER

    for r in roles:
        print(f"\n{'='*60}")
        print(f"ROLE: {r.upper()}")
        print(f"{'='*60}")

        data = _load_weekly_data(store, r, end_date)
        days_found = data["days"]

        print(f"Days with data: {len(days_found)}/7")
        for day in days_found:
            body_len = len(day["body"])
            src_count = len(day["sources"])
            print(f"  {day['date']}: {body_len} chars, {src_count} sources")

        if len(days_found) < 3:
            print(f"  [SKIP] Not enough data ({len(days_found)} days)")
            continue

        if not generate:
            prompt = _format_input(data)
            print(f"\n--- PROMPT PREVIEW ({len(prompt)} chars) ---")
            print(prompt[:2000])
            if len(prompt) > 2000:
                print(f"\n... [{len(prompt) - 2000} more chars]")
        else:
            from openai import OpenAI
            client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
            prompt = _format_input(data)
            print(f"\nCalling OpenAI ({len(prompt)} char prompt)...")
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1800,
            )
            result = resp.choices[0].message.content or ""
            print(f"\n--- RESULT ---\n{result}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", default="", choices=ROLE_ORDER + [""])
    parser.add_argument("--end-date", default="")
    parser.add_argument("--generate", action="store_true", help="Call OpenAI and print result")
    args = parser.parse_args()

    end_date = args.end_date.strip() or _today_ist()
    run_test(role=args.role or None, end_date=end_date, generate=args.generate)


if __name__ == "__main__":
    main()
