#!/usr/bin/env python3
"""
Summarize article content from grouped content index JSON.

Input shape:
  Produced by v2/scripts/fetch_article_contents_from_index.py

Output:
  Same grouped shape, with per-article summary fields added:
    - summary
    - summary_model
    - summary_skill_level
    - summary_error
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from v1.tools.summary_prompts import get_prompt_for_skill_level  # noqa: E402

VALID_SKILL_LEVELS = ("beginner", "intermediate", "expert")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Summarize grouped article content one-by-one."
    )
    parser.add_argument(
        "--input",
        default="v2/output/recent_source_articles_with_content.json",
        help="Input JSON with fetched article content",
    )
    parser.add_argument(
        "--out",
        default="v2/output/recent_source_articles_with_summaries.json",
        help="Output JSON path with summaries attached",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="OpenAI model to use for summarization",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.3,
        help="Sampling temperature for the model",
    )
    parser.add_argument(
        "--skill-level",
        default="intermediate",
        choices=VALID_SKILL_LEVELS,
        help="Summary style skill level",
    )
    parser.add_argument(
        "--interest-id",
        action="append",
        default=[],
        help="Filter to one or more interest IDs. Repeat for multiple.",
    )
    parser.add_argument(
        "--subinterest-id",
        action="append",
        default=[],
        help="Filter to one or more subinterest IDs. Repeat for multiple.",
    )
    parser.add_argument(
        "--max-articles-per-source",
        type=int,
        default=0,
        help="Optional cap per source. 0 means no cap.",
    )
    return parser.parse_args()


def _build_user_context(
    interest_id: str,
    subinterest_id: str,
) -> dict[str, Any]:
    return {
        "interests": [interest_id],
        "subinterests": [subinterest_id],
        "skills": [],
        "goals_short_term": "",
        "learning_style": "",
        "content_depth": "high",
    }


def _parse_json_object(raw_text: str) -> tuple[dict[str, Any] | None, str]:
    cleaned = (raw_text or "").strip()
    if not cleaned:
        return None, "empty_response"

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None, "no_json_object_found"
        try:
            parsed = json.loads(match.group())
        except json.JSONDecodeError as exc:
            return None, f"json_parse_error:{exc}"

    if not isinstance(parsed, dict):
        return None, "response_not_object"

    if "short_article" not in parsed:
        return None, "missing_short_article"

    return parsed, ""


def _summarize_one(
    client: OpenAI,
    model: str,
    temperature: float,
    skill_level: str,
    interest_id: str,
    subinterest_id: str,
    article: dict[str, Any],
) -> tuple[dict[str, Any] | None, str]:
    title = article.get("title", "") or ""
    url = article.get("url", "") or ""
    content = article.get("content", "") or ""

    if not content.strip():
        return None, "missing_content"

    prompt = get_prompt_for_skill_level(
        skill_level=skill_level,
        title=title,
        content=content,
        user_context=_build_user_context(interest_id, subinterest_id),
        url=url,
        is_video=False,
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You return valid JSON only. "
                        "No markdown fences."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        raw = (response.choices[0].message.content or "").strip()
    except Exception as exc:
        return None, f"openai_error:{exc}"

    parsed, parse_error = _parse_json_object(raw)
    if not parsed:
        return None, parse_error
    return parsed, ""


def _should_process(
    interest_id: str,
    subinterest_id: str,
    allow_interest_ids: set[str],
    allow_subinterest_ids: set[str],
) -> bool:
    if allow_interest_ids and interest_id not in allow_interest_ids:
        return False
    if allow_subinterest_ids and subinterest_id not in allow_subinterest_ids:
        return False
    return True


def main() -> None:
    args = _parse_args()
    input_path = Path(args.input).resolve()
    out_path = Path(args.out).resolve()

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")

    client = OpenAI(api_key=api_key)
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    grouped = payload.get("grouped_articles", {})
    allow_interest_ids = set(args.interest_id)
    allow_subinterest_ids = set(args.subinterest_id)

    processed = 0
    succeeded = 0
    failed = 0
    skipped = 0

    for interest_id, sub_map in grouped.items():
        if not isinstance(sub_map, dict):
            continue

        for subinterest_id, source_entries in sub_map.items():
            if not _should_process(
                interest_id,
                subinterest_id,
                allow_interest_ids,
                allow_subinterest_ids,
            ):
                continue

            if not isinstance(source_entries, list):
                continue

            for source_entry in source_entries:
                articles = source_entry.get("articles", [])
                if not isinstance(articles, list):
                    continue

                limited_articles = articles
                if args.max_articles_per_source > 0:
                    limited_articles = articles[: args.max_articles_per_source]

                source_success = 0
                source_failed = 0
                source_skipped = 0

                for article in limited_articles:
                    if article.get("fetch_error"):
                        article["summary_error"] = "skipped_due_to_fetch_error"
                        source_skipped += 1
                        skipped += 1
                        continue

                    processed += 1
                    summary, error = _summarize_one(
                        client=client,
                        model=args.model,
                        temperature=args.temperature,
                        skill_level=args.skill_level,
                        interest_id=interest_id,
                        subinterest_id=subinterest_id,
                        article=article,
                    )
                    if error:
                        article["summary"] = {}
                        article["summary_model"] = args.model
                        article["summary_skill_level"] = args.skill_level
                        article["summary_error"] = error
                        source_failed += 1
                        failed += 1
                        continue

                    article["summary"] = summary
                    article["summary_model"] = args.model
                    article["summary_skill_level"] = args.skill_level
                    article["summary_error"] = ""
                    source_success += 1
                    succeeded += 1

                source_entry["summary_stats"] = {
                    "attempted": len(limited_articles),
                    "processed": len(limited_articles) - source_skipped,
                    "succeeded": source_success,
                    "failed": source_failed,
                    "skipped": source_skipped,
                }

    payload["summary_generation"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "settings": {
            "model": args.model,
            "temperature": args.temperature,
            "skill_level": args.skill_level,
            "interest_ids": sorted(allow_interest_ids),
            "subinterest_ids": sorted(allow_subinterest_ids),
            "max_articles_per_source": args.max_articles_per_source,
        },
        "stats": {
            "processed_articles": processed,
            "succeeded_articles": succeeded,
            "failed_articles": failed,
            "skipped_articles": skipped,
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "out": str(out_path),
                "processed_articles": processed,
                "succeeded_articles": succeeded,
                "failed_articles": failed,
                "skipped_articles": skipped,
            }
        )
    )


if __name__ == "__main__":
    main()
