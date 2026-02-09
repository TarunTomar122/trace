"""
Fetch article thumbnails for all feed items across all users.

Strategy:
1. Check og_image_cache (populated by summary generation's Exa call for free)
2. Direct HTTP og:image scraping for uncached URLs
3. Pastel fallback — handled on frontend for items with no image

Note: For subscribed users, images are captured from the SAME Exa contents
API call used for summaries (zero extra cost). This script picks up whatever
the summary step cached, then fills gaps with direct HTTP for all users.

Usage:
  python v1/flows/fetch_og_images_for_feeds.py
  python v1/flows/fetch_og_images_for_feeds.py --date 2026-02-09
  python v1/flows/fetch_og_images_for_feeds.py --user-id USER_ID
"""
import argparse
import hashlib
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import requests

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from v1.storage import FirestoreStore

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REQUEST_TIMEOUT = 8  # seconds per URL for direct HTTP
MAX_CONCURRENT = 15  # parallel direct HTTP fetches
MAX_HEAD_BYTES = 32_000  # only read first 32KB for <head> parsing
OG_IMAGE_CACHE_COLLECTION = "og_image_cache"

# Regex to find og:image / twitter:image in HTML head
_OG_IMAGE_RE = re.compile(
    r'<meta\s+[^>]*?property\s*=\s*["\']og:image["\'][^>]*?content\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE | re.DOTALL,
)
_OG_IMAGE_RE_ALT = re.compile(
    r'<meta\s+[^>]*?content\s*=\s*["\']([^"\']+)["\'][^>]*?property\s*=\s*["\']og:image["\']',
    re.IGNORECASE | re.DOTALL,
)
_TWITTER_IMAGE_RE = re.compile(
    r'<meta\s+[^>]*?(?:name|property)\s*=\s*["\']twitter:image["\'][^>]*?content\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE | re.DOTALL,
)
_TWITTER_IMAGE_RE_ALT = re.compile(
    r'<meta\s+[^>]*?content\s*=\s*["\']([^"\']+)["\'][^>]*?(?:name|property)\s*=\s*["\']twitter:image["\']',
    re.IGNORECASE | re.DOTALL,
)

# Image URLs to reject
_JUNK_IMAGE_PATTERNS = [
    "1x1", "pixel", "spacer", "blank", "tracking",
    "gravatar.com/avatar",
    "wp-content/plugins",
]
_MEDIUM_TINY_RE = re.compile(r"resize:\w+:(\d+):(\d+)")


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def _is_valid_image_url(url: str) -> bool:
    """Validate this looks like a real article image, not junk."""
    if not url or len(url) < 10:
        return False
    if not url.startswith(("http://", "https://")):
        return False
    url_lower = url.lower()
    for pattern in _JUNK_IMAGE_PATTERNS:
        if pattern in url_lower:
            return False
    if "miro.medium.com" in url_lower:
        m = _MEDIUM_TINY_RE.search(url)
        if m:
            w, h = int(m.group(1)), int(m.group(2))
            if w <= 128 or h <= 128:
                return False
    if url_lower.endswith(".svg"):
        return False
    return True


def _get_today_ist_date() -> str:
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Cache layer (og_image_cache)
# ---------------------------------------------------------------------------

def _get_cached_image(store: FirestoreStore, url: str) -> Optional[str]:
    """Returns image URL, empty string (no image found), or None (not cached)."""
    doc = store.db.collection(OG_IMAGE_CACHE_COLLECTION).document(_url_hash(url)).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    return data.get("image_url", "")


def _save_cached_image(store: FirestoreStore, url: str, image_url: str) -> None:
    store.db.collection(OG_IMAGE_CACHE_COLLECTION).document(_url_hash(url)).set({
        "url": url,
        "image_url": image_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }, merge=True)


# ---------------------------------------------------------------------------
# Also check article_content_cache (populated by summary Exa call)
# ---------------------------------------------------------------------------

def _get_image_from_content_cache(store: FirestoreStore, url: str) -> Optional[str]:
    """Check if the Exa content cache has an image for this URL."""
    doc = store.db.collection("article_content_cache").document(_url_hash(url)).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    image = data.get("image", "")
    if image and _is_valid_image_url(image):
        return image
    return None


# ---------------------------------------------------------------------------
# Direct HTTP og:image scraping
# ---------------------------------------------------------------------------

def _fetch_og_image_direct(url: str) -> str:
    """Fetch og:image from a URL via direct HTTP. Returns image URL or empty string."""
    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            stream=True,
            allow_redirects=True,
        )
        if resp.status_code >= 400:
            return ""

        content = b""
        for chunk in resp.iter_content(chunk_size=MAX_HEAD_BYTES):
            content += chunk
            break
        resp.close()

        html = content.decode("utf-8", errors="ignore")

        # Try og:image first
        match = _OG_IMAGE_RE.search(html) or _OG_IMAGE_RE_ALT.search(html)
        if match and _is_valid_image_url(match.group(1)):
            return match.group(1).strip()

        # Fallback to twitter:image
        match = _TWITTER_IMAGE_RE.search(html) or _TWITTER_IMAGE_RE_ALT.search(html)
        if match and _is_valid_image_url(match.group(1)):
            return match.group(1).strip()

        return ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Combined fetcher: cache → content_cache → direct HTTP
# ---------------------------------------------------------------------------

def fetch_images_for_urls(
    store: FirestoreStore,
    urls: list[str],
    force: bool = False,
) -> dict[str, str]:
    """Fetch images for a list of URLs. No Exa API calls — just cache + HTTP."""
    if not urls:
        return {}

    results: dict[str, str] = {}
    need_http: list[str] = []

    for url in urls:
        # Step 1: Check og_image_cache
        if not force:
            cached = _get_cached_image(store, url)
            if cached is not None:
                if cached:
                    results[url] = cached
                continue  # empty string = already tried, no image

        # Step 2: Check article_content_cache (image from Exa summary call)
        content_image = _get_image_from_content_cache(store, url)
        if content_image:
            results[url] = content_image
            _save_cached_image(store, url, content_image)
            continue

        # Step 3: Need direct HTTP
        need_http.append(url)

    # Parallel direct HTTP for remaining URLs
    if need_http:
        def fetch_one(url: str) -> tuple[str, str]:
            return url, _fetch_og_image_direct(url)

        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
            futures = {executor.submit(fetch_one, u): u for u in need_http}
            for future in as_completed(futures):
                try:
                    url, image = future.result()
                    _save_cached_image(store, url, image)
                    if image:
                        results[url] = image
                except Exception:
                    pass

    return results


# ---------------------------------------------------------------------------
# Feed enrichment
# ---------------------------------------------------------------------------

def enrich_feed_with_images(
    user_id: str,
    date: str,
    store: FirestoreStore | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Fetch images for all items in a user's feed and update the feed."""
    if store is None:
        store = FirestoreStore()

    feed_ref = (
        store.db.collection("user_feeds")
        .document(user_id)
        .collection("daily")
        .document(date)
    )
    feed_doc = feed_ref.get()
    if not feed_doc.exists:
        return {"user_id": user_id, "images_added": 0, "reason": "no_feed"}

    feed_data = feed_doc.to_dict() or {}
    items = feed_data.get("items", []) or []
    if not items:
        return {"user_id": user_id, "images_added": 0, "reason": "no_items"}

    # Collect URLs that need images
    urls_needing_images: list[str] = []
    url_to_indices: dict[str, list[int]] = {}

    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        if not force and item.get("thumbnail"):
            continue
        url = item.get("url", "")
        if url and not url.startswith("https://www.youtube.com"):
            urls_needing_images.append(url)
            url_to_indices.setdefault(url, []).append(idx)

    if not urls_needing_images:
        return {"user_id": user_id, "images_added": 0, "reason": "all_have_images"}

    unique_urls = list(dict.fromkeys(urls_needing_images))

    # Fetch images (cache + direct HTTP, no Exa API calls)
    image_map = fetch_images_for_urls(store, unique_urls, force=force)

    # Update items
    images_added = 0
    for url, image_url in image_map.items():
        for idx in url_to_indices.get(url, []):
            items[idx]["thumbnail"] = image_url
            images_added += 1

    if images_added > 0:
        feed_data["items"] = items
        feed_ref.set(feed_data, merge=True)

    return {"user_id": user_id, "images_added": images_added, "total_items": len(items)}


def enrich_all_feeds_with_images(
    date: str | None = None,
    limit: int | None = None,
    user_id: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Fetch images for all users' feeds."""
    store = FirestoreStore()
    if not date:
        date = _get_today_ist_date()

    if user_id:
        users = [{"uid": user_id}]
    else:
        all_docs = store.db.collection("user_profiles").where("onboarded", "==", True).stream()
        users = [{"uid": doc.id} for doc in all_docs]
        if limit:
            users = users[:limit]

    total_images = 0
    users_processed = 0

    print(f"Fetching article images for {len(users)} user(s) on {date}...")

    for user in users:
        uid = user.get("uid")
        if not uid:
            continue

        result = enrich_feed_with_images(uid, date, store=store, force=force)
        added = result.get("images_added", 0)
        total_images += added
        users_processed += 1

        if added > 0:
            print(f"  [{users_processed}/{len(users)}] {uid}: +{added} images")
        else:
            reason = result.get("reason", "")
            if reason and reason != "all_have_images":
                print(f"  [{users_processed}/{len(users)}] {uid}: skipped ({reason})")

    print(f"Done. Images added: {total_images} across {users_processed} users.")
    return {
        "users_processed": users_processed,
        "images_added": total_images,
        "date": date,
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch article images for feed items")
    parser.add_argument("--date", help="Date (YYYY-MM-DD), defaults to today IST")
    parser.add_argument("--user-id", help="Run for a single user")
    parser.add_argument("--limit", type=int, help="Limit users to process")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if thumbnail exists or cached")
    args = parser.parse_args()

    enrich_all_feeds_with_images(
        date=args.date,
        limit=args.limit,
        user_id=args.user_id,
        force=args.force,
    )


if __name__ == "__main__":
    main()
