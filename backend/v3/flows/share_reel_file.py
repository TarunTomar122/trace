"""Post a finished reel file to Instagram through Buffer.

For reels made outside the automatic pipeline (built in HyperFrames each day):

  cd backend
  ../.venv/bin/python -m v3.flows.share_reel_file --slug 2026-10-29-anthropic-ipo \
      --video /tmp/reel.mp4 --cover /tmp/cover.jpg --caption-file /tmp/caption.txt \
      --cover-at 7.5 --title "Anthropic files for its IPO" --url https://...          # add --dry-run to stop before Buffer

The files are served from INSTAGRAM_MEDIA_DIR like the daily reel, shared as an
Instagram reel labelled AI-generated (the voice is), then as a YouTube Short when
a YouTube channel is connected in Buffer (and to TikTok with TIKTOK_REELS=1), and
logged in `instagram_reels/{slug}` with the story, so post_reel's repeat check sees it.
A slug that already has an Instagram post is never posted there again; a rerun
only tries the other channels that aren't up yet (e.g. once YouTube is connected).
--title is also the YouTube title (at most 100 characters).

--tiktok-video sends TikTok its own file instead of the Instagram one (e.g. the
reel without its music bed).

--tiktok-slides DIR --tiktok-caption-file FILE post the reel's story to TikTok
as a photo carousel (DIR's *.jpg in name order, 1080x1920, made by
trace-reels/tools/carousel.py) right after Instagram and YouTube. That's how
TikTok gets content since 2026-11-15 (videos posted through Buffer are muted).
On a rerun of a slug already on Instagram, the slides are (re)hosted and posted if
TikTok doesn't have this story yet. --tiktok-only posts only that carousel and
refuses (exit 1) when the reel isn't on Instagram yet, so a TikTok retry can
never post the reel itself (tools/post_tiktok.sh uses it).

--skip-instagram (test, 2026-11-15): host the files and post YouTube and TikTok,
but leave Instagram to a hand upload (a Codex agent in the owner's Chrome),
to see whether Buffer-posted reels are what Instagram won't recommend. The
record is marked instagram_manual, so a rerun never posts it through Buffer.
"""

from __future__ import annotations

import argparse
import os
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

from v3.flows.post_instagram import (  # noqa: E402
    create_post, host_slides, instagram_channel, share_to_tiktok, share_to_youtube, wait_until_sent,
)
from v3.flows.post_reel import COLLECTION, host_reel  # noqa: E402
from v3.lib.store import V3Store  # noqa: E402


# TikTok mutes every video this account posts through Buffer ("This sound isn't
# available"; tested 2026-10-31 with and without the AI label, music and voice
# only), so reels go to Instagram only and TikTok gets carousels instead.
# TIKTOK_REELS=1 sends them to TikTok again.
REELS_TO_TIKTOK = os.getenv("TIKTOK_REELS") == "1"


def _log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] [reel-file] {message}", flush=True)


def video_asset(video_url: str, cover_ms: int) -> dict:
    """Buffer takes no cover image for a video: it picks the frame at cover_ms."""
    return {"video": {"url": video_url, "metadata": {"thumbnailOffset": cover_ms}}}


TIKTOK_SLIDES_MIN, TIKTOK_SLIDES_MAX = 3, 12


def tiktok_slides(args: argparse.Namespace) -> tuple[list[Path], str] | None:
    """The carousel's slide files and caption, None when not asked for; raises on a bad set."""
    if not args.tiktok_slides:
        return None
    files = sorted(Path(args.tiktok_slides).glob("*.jpg"))
    if not TIKTOK_SLIDES_MIN <= len(files) <= TIKTOK_SLIDES_MAX:
        raise ValueError(f"--tiktok-slides needs {TIKTOK_SLIDES_MIN}-{TIKTOK_SLIDES_MAX} .jpg files (got {len(files)})")
    if not args.tiktok_caption_file:
        raise ValueError("--tiktok-slides needs --tiktok-caption-file")
    caption = Path(args.tiktok_caption_file).read_text().strip()
    if not caption or len(caption) > 2200:
        raise ValueError(f"TikTok caption must be 1-2200 characters (got {len(caption)})")
    return files, caption


def _title(text: str, limit: int = 90) -> str:
    """TikTok's title, cut at a word boundary."""
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0]


def share_tiktok_carousel(ref, slug: str, files: list[Path], caption: str, title: str, dry_run: bool) -> None:
    """Host the slides (the files given win over ones hosted earlier) and post them to TikTok once:
    share_to_tiktok never posts a record twice. Best effort like share_to_tiktok: never raises."""
    from PIL import Image

    try:
        record = ref.get().to_dict() or {}
        urls = record.get("tiktok_slide_urls")
        if files:
            slides = []
            for f in files:
                with Image.open(f) as im:
                    slides.append(im.convert("RGB"))
            urls = host_slides(slides, f"reels/{slug}/tiktok-slides")
            _log(f"hosted {len(urls)} TikTok slides")
        if dry_run:
            _log("dry run: not sharing the TikTok carousel")
            return
        if not urls:
            _log("no TikTok slides to post")
            return
        ref.set({"tiktok_slide_urls": urls, "tiktok_caption": caption}, merge=True)
        share_to_tiktok(ref, caption, [{"image": {"url": u}} for u in urls], _title(title), ai_generated=False)
        record = ref.get().to_dict() or {}
        _log(f"TikTok carousel: {record.get('tiktok_status') or 'not posted (no TikTok channel?)'} "
             f"{record.get('tiktok_external_link') or ''} {record.get('tiktok_error') or ''}".rstrip())
    except Exception as exc:  # Instagram and YouTube are already out; only TikTok is lost
        _log(f"TikTok carousel skipped after an error: {exc}")


def run(args: argparse.Namespace) -> int:
    try:
        carousel = tiktok_slides(args)
    except ValueError as exc:
        _log(str(exc))
        return 1
    store = V3Store()
    ref = store.db.collection(COLLECTION).document(args.slug)
    existing = ref.get().to_dict() or {}
    posted = existing.get("buffer_post_id") or existing.get("instagram_manual")
    if args.tiktok_only and not (posted and carousel):
        _log(f"--tiktok-only needs --tiktok-slides and a reel already on Instagram ({args.slug} has "
             f"{'no Instagram post' if not posted else 'no slides given'}); nothing posted")
        return 1
    if posted:
        _log(f"{args.slug} already has an Instagram post ({existing.get('buffer_post_id') or 'by hand'}, "
             f"{existing.get('status')}); only the other channels are tried")
        if existing.get("video_url") and existing.get("caption") and not args.dry_run:
            cover_ms = existing.get("cover_ms", int(args.cover_at * 1000))
            title = args.title or existing.get("youtube_title", "")
            if not args.tiktok_only:
                share_to_youtube(ref, existing["caption"], [video_asset(existing["video_url"], cover_ms)], title)
            if carousel or existing.get("tiktok_slide_urls"):
                files, tt_caption = carousel or ([], existing.get("tiktok_caption") or "")
                share_tiktok_carousel(ref, args.slug, files, tt_caption, existing.get("youtube_title") or title, dry_run=False)
            elif REELS_TO_TIKTOK:
                tiktok_url = existing.get("tiktok_video_url") or existing["video_url"]
                share_to_tiktok(ref, existing["caption"], [video_asset(tiktok_url, cover_ms)],
                                (existing.get("stories") or [{}])[0].get("title") or args.title, ai_generated=True)
        return 0
    # Checked after the rerun case: a rerun uses the stored caption and files.
    caption = Path(args.caption_file).read_text().strip()
    if not caption or len(caption) > 2200:
        _log(f"caption must be 1-2200 characters (got {len(caption)})")
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        shutil.copyfile(args.video, work / "reel.mp4")
        shutil.copyfile(args.cover, work / "cover.jpg")
        video_url, cover_url = host_reel(work, f"reels/{args.slug}")
        tiktok_url = video_url
        if args.tiktok_video:
            shutil.copyfile(args.tiktok_video, work / "reel.mp4")
            tiktok_url, _ = host_reel(work, f"reels/{args.slug}/tiktok")
    _log(f"hosted {video_url}")
    if tiktok_url != video_url:
        _log(f"hosted {tiktok_url} for TikTok")
    if args.dry_run:
        if carousel:
            share_tiktok_carousel(ref, args.slug, carousel[0], carousel[1], args.title, dry_run=True)
        _log("dry run: not sharing")
        return 0
    now = datetime.now(timezone.utc)
    ref.set({"date": now.strftime("%Y-%m-%d"), "slug": args.slug, "kind": "hand-made", "status": "sharing",
             "caption": caption, "video_url": video_url, "cover_ms": int(args.cover_at * 1000), "created_at": now.isoformat(),
             "tiktok_video_url": tiktok_url, "youtube_title": args.title, "stories": [{"title": args.title, "url": args.url}],
             "buffer_post_id": None}, merge=True)
    asset = video_asset(video_url, int(args.cover_at * 1000))
    if args.skip_instagram:
        ref.set({"instagram_manual": True, "status": "instagram-by-hand"}, merge=True)
        _log("Instagram skipped (--skip-instagram): it is posted by hand")
        share_to_youtube(ref, caption, [asset], args.title)
        if carousel:
            share_tiktok_carousel(ref, args.slug, carousel[0], carousel[1], args.title, dry_run=False)
        return 0
    post_id = create_post(instagram_channel(), caption, [asset],
                          {"instagram": {"type": "reel", "shouldShareToFeed": True, "isAiGenerated": True}})
    ref.set({"buffer_post_id": post_id, "status": "shared"}, merge=True)
    _log(f"shared to Buffer as {post_id}; waiting for Instagram")
    state = wait_until_sent(post_id)
    ref.set({"status": state.get("status") or "unknown", "external_link": state.get("externalLink") or "",
             "error": state.get("error") or ""}, merge=True)
    _log(f"Buffer says {state.get('status')} {state.get('externalLink') or ''}")
    share_to_youtube(ref, caption, [asset], args.title)
    if carousel:
        share_tiktok_carousel(ref, args.slug, carousel[0], carousel[1], args.title, dry_run=False)
    elif REELS_TO_TIKTOK:
        share_to_tiktok(ref, caption, [video_asset(tiktok_url, int(args.cover_at * 1000))], args.title, ai_generated=True)
    return 0 if state.get("status") == "sent" else 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", required=True, help="unique id, e.g. 2026-10-29-anthropic-ipo")
    parser.add_argument("--video", required=True)
    parser.add_argument("--cover", required=True)
    parser.add_argument("--caption-file", required=True)
    parser.add_argument("--title", required=True, help="the story's headline: the repeat check and the YouTube title (<= 100 chars)")
    parser.add_argument("--url", default="", help="the story's main source URL")
    parser.add_argument("--tiktok-video", help="a separate file for TikTok (e.g. voice only, no music)")
    parser.add_argument("--tiktok-slides", help="folder of 1080x1920 JPEGs: the story as a TikTok photo carousel")
    parser.add_argument("--tiktok-caption-file", help="the TikTok carousel's caption (with --tiktok-slides)")
    parser.add_argument("--tiktok-only", action="store_true",
                        help="only post the TikTok carousel of a reel already on Instagram (never the reel)")
    parser.add_argument("--skip-instagram", action="store_true",
                        help="post YouTube (and the TikTok carousel) only; Instagram is uploaded by hand")
    parser.add_argument("--cover-at", type=float, default=0.0, help="seconds into the video for the Instagram cover frame")
    parser.add_argument("--dry-run", action="store_true")
    sys.exit(run(parser.parse_args()))


if __name__ == "__main__":
    main()
