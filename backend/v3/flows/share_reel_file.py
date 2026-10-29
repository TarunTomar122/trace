"""Post a finished reel file to Instagram through Buffer.

For reels made outside the automatic pipeline (built in HyperFrames each day):

  cd backend
  ../.venv/bin/python -m v3.flows.share_reel_file --slug 2026-10-29-anthropic-ipo \
      --video /tmp/reel.mp4 --cover /tmp/cover.jpg --caption-file /tmp/caption.txt \
      --title "Anthropic files for its IPO" --url https://...          # add --dry-run to stop before Buffer

The files are served from INSTAGRAM_MEDIA_DIR like the daily reel, shared as an
Instagram reel labelled AI-generated (the voice is), and logged in
`instagram_reels/{slug}` with the story, so post_reel's repeat check sees it.
A slug that already has a Buffer post is refused, so a rerun can't double-post.
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT.parent / ".env")

from v3.flows.post_instagram import instagram_channel, wait_until_sent  # noqa: E402
from v3.flows.post_reel import COLLECTION, host_reel, share_reel  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [reel-file] {message}", flush=True)


def run(args: argparse.Namespace) -> int:
    caption = Path(args.caption_file).read_text().strip()
    if not caption or len(caption) > 2200:
        _log(f"caption must be 1-2200 characters (got {len(caption)})")
        return 1
    store = V3Store()
    ref = store.db.collection(COLLECTION).document(args.slug)
    existing = ref.get().to_dict() or {}
    if existing.get("buffer_post_id"):
        _log(f"{args.slug} was already shared ({existing['buffer_post_id']}, {existing.get('status')}); not posting again")
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        shutil.copyfile(args.video, work / "reel.mp4")
        shutil.copyfile(args.cover, work / "cover.jpg")
        video_url, cover_url = host_reel(work, f"reels/{args.slug}")
    _log(f"hosted {video_url}")
    if args.dry_run:
        _log("dry run: not sharing")
        return 0
    now = datetime.now(timezone.utc)
    ref.set({"date": now.strftime("%Y-%m-%d"), "slug": args.slug, "kind": "hand-made", "status": "sharing",
             "caption": caption, "video_url": video_url, "created_at": now.isoformat(),
             "stories": [{"title": args.title, "url": args.url}], "buffer_post_id": None}, merge=True)
    post_id = share_reel(instagram_channel(), caption, video_url, cover_url)
    ref.set({"buffer_post_id": post_id, "status": "shared"}, merge=True)
    _log(f"shared to Buffer as {post_id}; waiting for Instagram")
    state = wait_until_sent(post_id)
    ref.set({"status": state.get("status") or "unknown", "external_link": state.get("externalLink") or "",
             "error": state.get("error") or ""}, merge=True)
    _log(f"Buffer says {state.get('status')} {state.get('externalLink') or ''}")
    return 0 if state.get("status") == "sent" else 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", required=True, help="unique id, e.g. 2026-10-29-anthropic-ipo")
    parser.add_argument("--video", required=True)
    parser.add_argument("--cover", required=True)
    parser.add_argument("--caption-file", required=True)
    parser.add_argument("--title", required=True, help="the story's headline (for the repeat check)")
    parser.add_argument("--url", default="", help="the story's main source URL")
    parser.add_argument("--dry-run", action="store_true")
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
