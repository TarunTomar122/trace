#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from v3.lib.content import fetch_og_image

USER_AGENT = "TraceSocialPost/1.0"
TIMEOUT = 20


def _looks_like_image_url(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _download_image(url: str, out_path: Path) -> bool:
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
            allow_redirects=True,
        )
        resp.raise_for_status()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(resp.content)
        # Verify image is decodable.
        with Image.open(out_path) as img:
            img.verify()
        return True
    except (requests.RequestException, UnidentifiedImageError, OSError):
        return False


def resolve_image(story_path: Path, output_image: Path) -> tuple[bool, str]:
    story = json.loads(story_path.read_text(encoding="utf-8"))
    source_url = (story.get("source_url") or "").strip()
    direct_image = (story.get("image_url") or "").strip()

    candidates = []
    if _looks_like_image_url(direct_image):
        candidates.append(("feed_thumbnail", direct_image))

    if _looks_like_image_url(source_url):
        og = fetch_og_image(source_url).strip()
        if _looks_like_image_url(og):
            candidates.append(("og_image", og))

    for label, url in candidates:
        if _download_image(url, output_image):
            return True, f"{label}:{url}"

    return False, "none"


def main() -> None:
    parser = argparse.ArgumentParser(description="Resolve/download story background image.")
    parser.add_argument("--story", default="input/story_001.json")
    parser.add_argument("--output-image", default="assets/resolved_story_001.jpg")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    story_path = root / args.story
    output_path = root / args.output_image
    ok, source = resolve_image(story_path, output_path)
    if ok:
        print(f"Resolved image: {output_path} ({source})")
    else:
        print("No image resolved. Keep using fallback background.")


if __name__ == "__main__":
    main()
