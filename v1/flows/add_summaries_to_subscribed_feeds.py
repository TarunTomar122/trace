"""
Generate personalized summaries for subscribed user feeds.

Flow:
1. Load subscribed users
2. Fetch feed items for date
3. Fetch/cached article content from Exa contents
4. Summarize with OpenAI and attach to feed items
"""
import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
import re

from dotenv import load_dotenv  # noqa: E402
from openai import OpenAI  # noqa: E402
import requests  # noqa: E402

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore  # noqa: E402
from v1.algorithm.interest_schema import (  # noqa: E402
    get_interest_ids,
    get_interest_label,
)


EXA_API_URL = "https://api.exa.ai/contents"
EXA_TEXT_MAX_CHARS = 6000
EXA_BATCH_SIZE = 20
REQUEST_TIMEOUT = 30

SUMMARY_MODEL = "gpt-4o-mini"
SUMMARY_TEMPERATURE = 0.3
MIN_CONTENT_LENGTH = 300
MAX_CONCURRENT_SUMMARIES = 10  # Parallel GPT calls per user

OG_IMAGE_CACHE_COLLECTION = "og_image_cache"


def _cache_og_image(store: FirestoreStore, url: str, image_url: str) -> None:
    """Cache an image in og_image_cache so other users (incl. unsubscribed) benefit."""
    import hashlib
    url_hash = hashlib.sha256(url.encode()).hexdigest()[:32]
    store.db.collection(OG_IMAGE_CACHE_COLLECTION).document(url_hash).set({
        "url": url,
        "image_url": image_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }, merge=True)


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


def _chunks(items: list[str], size: int) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def _build_user_context(profile: dict[str, Any]) -> dict[str, Any]:
    interest_ids = get_interest_ids(profile)
    return {
        "skills": profile.get("skills", [])[:5],
        "interests": [get_interest_label(i) for i in interest_ids[:5]],
        "goals_short_term": profile.get("goals", {}).get("shortTerm", ""),
        "learning_style": profile.get("learningStyle", ""),
        "content_depth": profile.get("contentDepth", ""),
    }


def _estimate_reading_time_minutes(text: str) -> int:
    word_count = len((text or "").split())
    if word_count <= 0:
        return 0
    return max(1, int(round(word_count / 220)))


def _fetch_exa_contents(
    store: FirestoreStore,
    urls: list[str],
    max_chars: int = EXA_TEXT_MAX_CHARS,
) -> tuple[dict[str, str], dict[str, str]]:
    """Fetch article content (and images) from Exa contents API.

    Returns:
        (content_map, image_map) — url→text and url→image_url
    """
    api_key = os.getenv("EXA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("EXA_API_KEY not set")

    cached_map: dict[str, str] = {}
    image_map: dict[str, str] = {}
    missing = []
    for url in urls:
        cached = store.get_cached_content(url)
        if cached and cached.get("content"):
            cached_map[url] = cached["content"]
            # Check if image was cached alongside content
            if cached.get("image"):
                image_map[url] = cached["image"]
        else:
            missing.append(url)

    if not missing:
        return cached_map, image_map

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
    }

    for batch in _chunks(missing, EXA_BATCH_SIZE):
        payload = {
            "urls": batch,
            "text": {
                "maxCharacters": max_chars,
            },
        }
        try:
            response = requests.post(
                EXA_API_URL,
                json=payload,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            if response.status_code >= 400:
                error_msg = f"exa_contents_http_{response.status_code}"
                for url in batch:
                    store.save_cached_content(
                        url=url,
                        content="",
                        error=error_msg,
                    )
                continue

            data = response.json() or {}
            results = data.get("results", []) or []
            for item in results:
                url = item.get("url")
                text = (item.get("text") or "").strip()
                image = (item.get("image") or "").strip()
                if url and text:
                    cached_map[url] = text
                    store.save_cached_content(
                        url=url,
                        content=text,
                        error=None,
                        image=image,
                    )
                if url and image and _is_valid_exa_image(image):
                    image_map[url] = image

            statuses = data.get("statuses", []) or []
            for status in statuses:
                url = status.get("id")
                if not url or url in cached_map:
                    continue
                if status.get("status") == "error":
                    tag = (
                        (status.get("error") or {}).get("tag")
                        or "unknown_error"
                    )
                    store.save_cached_content(
                        url=url,
                        content="",
                        error=f"exa_{tag}",
                    )
        except Exception as exc:
            for url in batch:
                store.save_cached_content(
                    url=url,
                    content="",
                    error=f"exa_exception:{exc}",
                )

    return cached_map, image_map


# Tiny Medium avatars (64x64 etc.) aren't useful as article images
_MEDIUM_TINY_RE = re.compile(r"resize:\w+:(\d+):(\d+)")


def _is_valid_exa_image(url: str) -> bool:
    """Check if an Exa-returned image URL is a real article image."""
    if not url or len(url) < 10:
        return False
    # Reject tiny Medium avatars
    if "miro.medium.com" in url:
        m = _MEDIUM_TINY_RE.search(url)
        if m:
            w, h = int(m.group(1)), int(m.group(2))
            if w <= 128 or h <= 128:
                return False
    if url.endswith(".svg"):
        return False
    return True

    return cached_map


def _summarize_with_openai(
    client: OpenAI,
    title: str,
    content: str,
    user_context: dict[str, Any],
    url: str,
) -> tuple[dict[str, Any] | None, str | None]:
    if not content or len(content) < MIN_CONTENT_LENGTH:
        return None, "content_too_short"

    prompt = f"""You are writing a personalized mini-article for a reader.

FIRST: Decide whether this is a real standalone article. Only return
{{"is_not_article": true, "reason": "brief reason"}} if the page is CLEARLY
not an article, such as:
- tag/category listing pages
- homepages or newsletters with link roundups
- product/marketing landing pages
- signup or promotional pages with no real article text

IMPORTANT: News articles, opinion pieces, and announcements ARE valid articles.
If you are unsure, treat it as an article and write the mini-article.

USER CONTEXT:
{json.dumps(user_context, indent=2)}

SOURCE CONTENT:
Title: {title}
URL: {url}
Content:
{content}

If this IS a real article, return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One compelling lede sentence that feels human",
    "outline": ["3-5 concrete, specific bullets pulled from the article"],
    "body": "A narrative mini-article in markdown"
  }}
}}

CRITICAL FORMATTING RULES for body:
- Use markdown headings: ## for main sections, ### for subsections
- ALWAYS put a blank line between paragraphs (two newlines: \\n\\n)
- ALWAYS put a blank line after headings before the paragraph
- Write 4-8 paragraphs (2-4 sentences each) — be generous with content
- Each paragraph should be separated by a blank line
- The result must render nicely with proper spacing

CONTENT RULES:
- Write like a sharp human editor, not an AI summary
- Do NOT say "The core insight", "The details", "In summary", or similar meta labels
- Mimic the source article's tone and voice
- Be specific to facts in the source - no invented information
- Prioritize concrete details: names, numbers, dates, programs, quotes
- Include at least 5 specific entities, examples, or data points from the source
- If the article lists multiple items/sections, preserve that structure with detail
- Retain interesting anecdotes, surprising stats, and notable quotes from the source
- Focus on what's most relevant to the user's interests/skills
- Keep outline bullets under 12 words each, and make them concrete
- Avoid generic closing statements, future-looking platitudes, or filler
- Prefer tight, specific insights over broad commentary
- Use bullet lists when the article itself lists items, steps, or comparisons

DEPTH GUIDANCE:
- Cover the article thoroughly — the reader should feel they got the full picture
- Don't just skim the surface; include supporting evidence, context, and examples
- If the article has multiple angles or arguments, represent them
- When there are numbers or data, include them — readers value specifics

SECTION GUIDANCE:
- Use 3-5 sections with headings that read like editorial headings
- At least two sections must surface concrete details (numbers, names, programs)
- Do NOT use a heading called "Key examples"

Example body formatting (notice the blank lines):
## What's happening

First paragraph explaining the main point. This has 2-3 sentences that flow
naturally and cover the key idea.

Second paragraph with more detail. Notice the blank line above separating it
from the first paragraph.

### The details

A paragraph diving into specifics — names, numbers, timelines, and context
that make this story concrete and useful.

### What this changes

Another paragraph here after the heading. The blank line after the heading
is important for proper rendering.
"""

    try:
        response = client.chat.completions.create(
            model=SUMMARY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You return valid JSON only. No markdown fences.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=SUMMARY_TEMPERATURE,
            response_format={"type": "json_object"},
        )
        raw_text = (response.choices[0].message.content or "").strip()
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()
        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if not match:
                snippet = cleaned[:160].replace("\n", " ")
                return None, f"json_parse_failed:{snippet}"
            result = json.loads(match.group())
        if not isinstance(result, dict):
            return None, "non_dict_response"

        # Check if model detected this is not an article
        if result.get("is_not_article"):
            reason = result.get("reason", "not_an_article")
            return None, f"not_article:{reason}"

        # Validate we got the short_article
        if "short_article" not in result:
            return None, "missing_short_article"

        return result, None
    except Exception as exc:
        return None, f"openai_error:{exc}"


def add_summaries_to_subscribed_feeds(
    date: str | None = None,
    limit: int | None = None,
    user_id: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    store = FirestoreStore()
    if not date:
        date = _get_today_ist_date()

    if user_id:
        users = [{"uid": user_id}]
    else:
        # get_onboarded_users() returns only trial/active subscribed users
        users = store.get_onboarded_users()
        if not users:
            print("  No subscribed users found, skipping summaries.")
            return {"users_processed": 0, "items_summarized": 0, "errors": 0}
        print(f"  Found {len(users)} subscribed users to process.")
        if limit:
            users = users[:limit]

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("  Warning: OPENAI_API_KEY not set, skipping summaries")
        return {"users_processed": 0, "items_summarized": 0, "errors": 0}

    client = OpenAI(api_key=api_key)

    users_processed = 0
    items_summarized = 0
    errors = 0

    mode = "FORCE regenerate" if force else "Generate new"
    print(f"{mode} summaries for {len(users)} user(s) on {date}...")

    for user in users:
        user_id = user.get("uid")
        if not user_id:
            continue

        print(f"Processing user: {user_id}")

        feed_ref = (
            store.db.collection("user_feeds")
            .document(user_id)
            .collection("daily")
            .document(date)
        )
        feed_doc = feed_ref.get()
        if not feed_doc.exists:
            print("  No feed found for date, skipping.")
            continue

        feed_data = feed_doc.to_dict() or {}
        items = feed_data.get("items", []) or []
        if not items:
            print("  Feed has no items, skipping.")
            continue

        user_profile = store.get_user_profile(user_id) or {}
        user_context = _build_user_context(user_profile)

        eligible = []
        skipped_video = 0
        skipped_has_summary = 0
        skipped_no_url = 0
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "video" or item.get("source") == "youtube":
                skipped_video += 1
                continue
            # Skip items with existing summary unless force=True
            if not force:
                if item.get("summary"):
                    skipped_has_summary += 1
                    continue
                if item.get("metadata", {}).get("summary"):
                    skipped_has_summary += 1
                    continue
            url = item.get("url")
            if url:
                eligible.append(url)
            else:
                skipped_no_url += 1

        if not eligible:
            print(f"  No eligible items (total={len(items)}, videos={skipped_video}, "
                  f"has_summary={skipped_has_summary}, no_url={skipped_no_url}), skipping.")
            users_processed += 1
            continue

        print(f"  Eligible items: {len(eligible)}")
        content_map, image_map = _fetch_exa_contents(store, eligible)
        print(f"  Content fetched: {len(content_map)} | Images from Exa: {len(image_map)}")

        # Build list of items to summarize
        items_to_summarize = []
        item_index_map = {}  # url -> index in items list
        
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            if not url or url not in content_map:
                continue
            # Skip items with existing summary unless force=True
            if not force:
                if item.get("summary") or item.get("metadata", {}).get("summary"):
                    continue
            items_to_summarize.append(item)
            item_index_map[url] = idx

        if not items_to_summarize:
            print("  All items already have summaries, skipping.")
            users_processed += 1
            continue

        print(f"  Summarizing {len(items_to_summarize)} items concurrently...")
        user_summaries = 0
        user_errors = 0

        # Summarize in parallel using ThreadPoolExecutor
        def summarize_item(item: dict) -> tuple[str, dict | None, str | None]:
            url = item.get("url", "")
            content = content_map.get(url, "")
            summary, error = _summarize_with_openai(
                client=client,
                title=item.get("title", ""),
                content=content[:EXA_TEXT_MAX_CHARS],
                user_context=user_context,
                url=url,
            )
            return url, summary, error

        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_SUMMARIES) as executor:
            futures = {
                executor.submit(summarize_item, item): item
                for item in items_to_summarize
            }
            for future in as_completed(futures):
                item = futures[future]
                url = item.get("url", "")
                try:
                    _, summary, summary_error = future.result()
                    if not summary:
                        if summary_error:
                            print(f"  Summary failed: {summary_error} | url={url}")
                        errors += 1
                        user_errors += 1
                        continue

                    summary_payload = {
                        **summary,
                        "reading_time_minutes": _estimate_reading_time_minutes(
                            content_map.get(url, "")
                        ),
                        "generated_at": datetime.utcnow().isoformat(),
                        "model": SUMMARY_MODEL,
                    }
                    # Update item in place
                    idx = item_index_map.get(url)
                    if idx is not None:
                        items[idx]["summary"] = summary_payload
                    items_summarized += 1
                    user_summaries += 1
                except Exception as exc:
                    print(f"  Summary exception: {exc} | url={url}")
                    errors += 1
                    user_errors += 1

        # Attach Exa images to feed items (free — came from the same API call)
        images_set = 0
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            url = item.get("url", "")
            if url and url in image_map and not item.get("thumbnail"):
                items[idx]["thumbnail"] = image_map[url]
                images_set += 1
                # Also cache in og_image_cache so unsubscribed users benefit
                _cache_og_image(store, url, image_map[url])

        # items list was updated in place
        feed_data["items"] = items
        feed_data.setdefault("metadata", {})
        feed_data["metadata"]["summaries_generated_at"] = (
            datetime.utcnow().isoformat()
        )
        feed_ref.set(feed_data, merge=True)

        print(
            f"  Summaries added: {user_summaries} | "
            f"Images set: {images_set} | "
            f"Errors: {user_errors}"
        )

        users_processed += 1

    return {
        "users_processed": users_processed,
        "items_summarized": items_summarized,
        "errors": errors,
        "date": date,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate personalized summaries for subscribed user feeds"
    )
    parser.add_argument(
        "--date",
        help="Date string (YYYY-MM-DD), defaults to today IST",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of users to process",
    )
    parser.add_argument(
        "--user-id",
        help="Run for a single user instead of all users",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate summaries even if they already exist",
    )
    args = parser.parse_args()

    result = add_summaries_to_subscribed_feeds(
        date=args.date,
        limit=args.limit,
        user_id=args.user_id,
        force=args.force,
    )
    print(
        f"Done. Users processed: {result['users_processed']} | "
        f"Items summarized: {result['items_summarized']} | "
        f"Errors: {result['errors']}"
    )


if __name__ == "__main__":
    main()
