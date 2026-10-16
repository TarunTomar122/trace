#!/usr/bin/env python3
"""Morning X post on the founder's laptop, the first time it wakes each day.

  ~/.trace-xpost/venv/bin/python ~/.trace-xpost/trace_xpost.py           # what launchd runs: once a day, after 05:00
  ~/.trace-xpost/venv/bin/python ~/.trace-xpost/trace_xpost.py --force   # again today
  ~/.trace-xpost/venv/bin/python ~/.trace-xpost/trace_xpost.py --fresh   # again, with a newly written post

The VPS writes the post (backend/v3/flows/build_post_kit.py has the model,
the feed and the image). YouTube blocks the VPS but not a home connection, so
this machine downloads the clip:

1. ssh vps "build_post_kit --json": the post, the reply, the image and this
   week's YouTube videos of the first story.
2. The best ~30 seconds of the first video that downloads: YouTube's "most
   replayed" peak if it has one, else the chapter or stretch of captions that
   matches the story, else from a fifth of the way in. Re-encoded to H.264/AAC,
   which X takes.
3. ~/x-posts/{date}/index.html, with the clip and the image inside it:
   Copy post, Download video (then drag it from Chrome's download bubble into
   X: browsers can't copy a video), Copy image, Download image and Copy reply. post.txt,
   x-post.jpg and x-clip.mp4 sit beside it; ~/x-posts/latest points at the day.
4. A notification; clicking it opens index.html.

Nothing is posted anywhere. Setup and the launchd agent: backend/laptop/README.md.
The files live outside ~/Documents and ~/Desktop, which macOS keeps from
background jobs.
"""

from __future__ import annotations

import argparse
import base64
import fcntl
import html
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

SSH_HOST = os.getenv("TRACE_XPOST_SSH", "vps")
REMOTE = os.getenv("TRACE_XPOST_REMOTE", "cd ~/trace/backend && ../.venv/bin/python -u -m v3.flows.build_post_kit --json")
HOME = Path.home()
OUT_ROOT = Path(os.getenv("TRACE_XPOST_DIR", str(HOME / "x-posts")))
STATE_DIR = HOME / ".trace-xpost"
STATE = STATE_DIR / "last-run"
LOCK = STATE_DIR / "run.lock"
UPGRADED = STATE_DIR / "yt-dlp-upgraded"
UPGRADE_EVERY = 7 * 24 * 3600  # YouTube changes often; an old yt-dlp stops downloading
START_HOUR = 5  # local time: before this it is still last night
IST = timezone(timedelta(hours=5, minutes=30))  # the feed's days are India's: they turn over at 18:30 UTC
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CLIP_SECONDS = 30
MAX_HEIGHT = 720  # plenty for X; a 30 s clip is 3-10 MB, carried inside the page
MAX_VIDEO_TRIES = 3
EDGE = 0.07  # "most replayed" often peaks at the very start or end: not the moment we want
SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "ClearAllForwardings=yes",
               "-o", "ServerAliveInterval=30"]
STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "over", "after", "its", "his", "her", "their",
    "has", "have", "had", "was", "were", "are", "but", "not", "new", "just", "now", "out", "about", "will",
    "can", "you", "your", "they", "them", "what", "when", "who", "how", "why", "all", "more", "than", "one",
}


def log(message: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}", flush=True)


# ---------------------------------------------------------------------------
# The server's half
# ---------------------------------------------------------------------------


def server_reachable(tries: int = 6, pause: float = 30) -> bool:
    """Right after waking the Wi-Fi may not be up yet: give it a few minutes."""
    for attempt in range(tries):
        result = subprocess.run(["ssh", *SSH_OPTIONS, SSH_HOST, "true"], capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            return True
        if attempt < tries - 1:
            time.sleep(pause)
    log(f"can't reach {SSH_HOST}: {result.stderr.strip()[-200:]}")
    return False


def fetch_kit(fresh: bool = False, day: str = "") -> dict[str, Any] | None:
    command = REMOTE + (" --fresh" if fresh else "") + (f" --day {day}" if DATE.match(day) else "")
    result = subprocess.run(["ssh", *SSH_OPTIONS, SSH_HOST, command], capture_output=True, text=True, timeout=1200)
    for line in result.stdout.splitlines():
        if line.startswith("POSTKIT_JSON "):
            kit = json.loads(line[len("POSTKIT_JSON "):])
            if not DATE.match(str(kit.get("date") or "")):
                log(f"the server sent a bad date: {str(kit.get('date'))[:40]!r}")
                return None
            if not kit.get("post"):
                log(f"no post for {day or 'today'} yet (the feed is on {kit['date']})")
            return kit
    tail = (result.stdout + result.stderr).strip().splitlines()[-6:]
    log("the server gave no post:\n  " + "\n  ".join(tail))
    return None


# ---------------------------------------------------------------------------
# The clip
# ---------------------------------------------------------------------------


def words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) >= 3 and w not in STOPWORDS]


def _clamp(start: float, duration: float, length: float) -> float:
    return max(0.0, min(start, max(0.0, duration - length))) if duration else max(0.0, start)


def captions(info: dict[str, Any]) -> list[tuple[float, str]]:
    """English captions as (start second, text), from YouTube's json3 track."""
    tracks = {**(info.get("automatic_captions") or {}), **(info.get("subtitles") or {})}
    for lang in ("en", "en-orig", "en-US", "en-GB"):
        url = next((f.get("url") for f in tracks.get(lang) or [] if f.get("ext") == "json3"), None)
        if not url:
            continue
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                data = json.loads(response.read())
        except Exception:
            return []
        cues = []
        for event in data.get("events") or []:
            text = "".join(seg.get("utf8", "") for seg in event.get("segs") or []).strip()
            if text:
                cues.append((event.get("tStartMs", 0) / 1000, text))
        return cues
    return []


def pick_start(info: dict[str, Any], story_words: set[str], length: float = CLIP_SECONDS,
               cues: list[tuple[float, str]] | None = None) -> float:
    """Where the good part of the video starts."""
    duration = float(info.get("duration") or 0)
    if duration and duration <= length + 3:
        return 0.0
    heat = [p for p in info.get("heatmap") or [] if isinstance(p, dict) and p.get("value") is not None
            and (not duration or duration * EDGE <= p.get("start_time", 0) <= duration * (1 - EDGE))]
    if heat:
        peak = max(heat, key=lambda p: p["value"])
        return _clamp((peak["start_time"] + peak["end_time"]) / 2 - length / 2, duration, length)
    for chapter in info.get("chapters") or []:
        if story_words & set(words(chapter.get("title") or "")):
            return _clamp(float(chapter.get("start_time") or 0) + 2, duration, length)
    cues = captions(info) if cues is None else cues
    if cues:
        # Rare story words count most: "thrusters" beats "Tesla" in a Tesla event.
        cue_words = [(t, words(text)) for t, text in sorted(cues)]
        counts: dict[str, int] = {}
        for _, found in cue_words:
            for word in found:
                counts[word] = counts.get(word, 0) + 1
        scores = [sum(1 / counts[w] for w in found if w in story_words) for _, found in cue_words]
        best, best_score, total, right = None, 0.0, 0.0, 0
        for left, (start, _) in enumerate(cue_words):  # a sliding window: long streams stay quick
            while right < len(cue_words) and cue_words[right][0] < start + length:
                total += scores[right]
                right += 1
            if total > best_score:
                best, best_score = start, total
            total -= scores[left]
        if best is not None:
            return _clamp(best - 2, duration, length)
    # Polished ads and news clips both open slowly: skip the first fifth.
    return _clamp(duration * 0.2, duration, length)


class YtLog:
    """yt-dlp's warnings go to the log ("no JavaScript runtime" means formats may be missing)."""

    def debug(self, message: str) -> None:
        pass

    def info(self, message: str) -> None:
        pass

    def warning(self, message: str) -> None:
        log(f"yt-dlp: {message[:200]}")

    def error(self, message: str) -> None:
        log(f"yt-dlp: {message[:200]}")


def upgrade_yt_dlp(now: float | None = None) -> None:
    """Once a week: YouTube changes often enough that last month's yt-dlp stops working."""
    now = now or time.time()
    try:
        if now - UPGRADED.stat().st_mtime < UPGRADE_EVERY:
            return
    except OSError:
        pass
    try:
        result = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--upgrade", "yt-dlp[default]"],
                                capture_output=True, text=True, timeout=300)
    except Exception as exc:  # a slow PyPI must not cost the day's post
        log(f"couldn't upgrade yt-dlp: {type(exc).__name__}")
        return
    if result.returncode == 0:
        UPGRADED.parent.mkdir(parents=True, exist_ok=True)
        UPGRADED.touch()
    else:
        log(f"couldn't upgrade yt-dlp: {result.stderr.strip()[-200:]}")


def search_here(query: str, story_words: set[str], lead_title: str = "") -> list[dict[str, Any]]:
    """This week's YouTube results, searched from the laptop: for when the VPS's search comes back empty."""
    import yt_dlp
    from urllib.parse import urlencode

    url = "https://www.youtube.com/results?" + urlencode({"search_query": query, "sp": "EgIIAw=="})
    options = {"quiet": True, "skip_download": True, "extract_flat": True, "playlistend": 12,
               "socket_timeout": 20, "logger": YtLog()}
    with yt_dlp.YoutubeDL(options) as ydl:
        entries = (ydl.extract_info(url, download=False) or {}).get("entries") or []
    lead = set(words(lead_title))
    videos = [{"url": e.get("url"), "title": e.get("title") or "", "channel": e.get("channel") or "",
               "duration": int(e.get("duration") or 0),
               "official": bool(words(e.get("channel") or "")) and set(words(e.get("channel") or "")) <= lead}
              for e in entries if isinstance(e, dict)
              and str(e.get("url") or "").startswith(("https://www.youtube.com/watch?v=", "https://www.youtube.com/shorts/"))]
    videos.sort(key=lambda v: (-len(story_words & set(words(v["title"]))), not 0 < v["duration"] <= 240))
    return videos


def grab_clip(video: dict[str, Any], story_words: set[str], folder: Path) -> dict[str, Any] | None:
    """~30 s of the video as x-clip.mp4 (H.264/AAC, at most 720p), or None."""
    import yt_dlp
    from yt_dlp.utils import download_range_func

    with yt_dlp.YoutubeDL({"quiet": True, "socket_timeout": 20, "logger": YtLog()}) as ydl:
        info = ydl.extract_info(video["url"], download=False)
    if info.get("live_status") in {"is_live", "is_upcoming"}:
        return None
    duration = float(info.get("duration") or 0)
    start = pick_start(info, story_words)
    end = min(start + CLIP_SECONDS, duration) if duration else start + CLIP_SECONDS
    for old in folder.glob("clip-raw.*"):
        old.unlink()
    options = {
        "quiet": True, "socket_timeout": 20, "logger": YtLog(),
        "outtmpl": str(folder / "clip-raw.%(ext)s"),
        "format": (f"bv*[height<={MAX_HEIGHT}][vcodec^=avc1]+ba[ext=m4a]/b[height<={MAX_HEIGHT}][ext=mp4]/"
                   f"bv*[height<={MAX_HEIGHT}]+ba/b"),
        "merge_output_format": "mp4",
        "download_ranges": download_range_func(None, [(start, end)]),
        "force_keyframes_at_cuts": True,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([video["url"]])
    raw = next(iter(sorted(folder.glob("clip-raw.*"))), None)
    if not raw:
        return None
    clip = folder / "x-clip.mp4"
    encoded = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-vf", f"scale=-2:'min({MAX_HEIGHT},ih)'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "2500k", "-bufsize", "5000k",
         "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(clip)],
        capture_output=True, text=True, timeout=300,
    )
    raw.unlink(missing_ok=True)
    if encoded.returncode != 0 or not clip.exists():
        log(f"ffmpeg failed: {encoded.stderr.strip()[-200:]}")
        return None
    return {"channel": video.get("channel") or info.get("channel") or "", "title": video.get("title") or "",
            "official": bool(video.get("official")), "start": round(start), "seconds": round(end - start)}


def clip_for(kit: dict[str, Any], folder: Path) -> dict[str, Any] | None:
    lead = kit["post"]["lead"] or {}
    story_words = set(words(" ".join([lead.get("title") or "", *(lead.get("headlines") or []),
                                      kit["post"]["bullets"][0]["text"] if kit["post"]["bullets"] else ""])))
    tried: set[str] = set()

    def attempt(videos: list[dict[str, Any]]) -> dict[str, Any] | None:
        for video in [v for v in videos if v.get("url") not in tried][:MAX_VIDEO_TRIES]:
            tried.add(video.get("url"))
            try:
                clip = grab_clip(video, story_words, folder)
            except Exception as exc:  # private, age-gated, a changed page, no ffmpeg
                log(f"no clip from {video.get('url')}: {type(exc).__name__}: {str(exc)[:160]}")
                continue
            if clip:
                log(f"clip: {clip['seconds']}s from {clip['start']}s of {clip['channel']}: {clip['title']}")
                return clip
        return None

    clip = attempt(kit.get("videos") or [])
    if clip or not kit["post"].get("video_query"):
        return clip
    # The server's results were empty (YouTube may block its searches too) or none downloaded.
    try:
        return attempt(search_here(kit["post"]["video_query"], story_words, lead.get("title") or ""))
    except Exception as exc:
        log(f"no videos from searching here either: {type(exc).__name__}: {str(exc)[:160]}")
        return None


# ---------------------------------------------------------------------------
# The folder
# ---------------------------------------------------------------------------

PAGE = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>X post · {date}</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ margin: 0; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: Canvas; color: CanvasText; }}
  main {{ max-width: 640px; margin: 40px auto; padding: 0 20px 60px; }}
  .kicker {{ font-size: 12px; font-weight: 800; letter-spacing: .08em; color: #1d9bf0; }}
  h1 {{ margin: 4px 0 24px; font-size: 26px; }}
  h2 {{ margin: 32px 0 10px; font-size: 17px; }}
  .box {{ white-space: pre-wrap; padding: 16px 18px; border: 1px solid color-mix(in srgb, CanvasText 15%, transparent);
         border-radius: 14px; background: color-mix(in srgb, CanvasText 4%, Canvas); font-size: 17px; }}
  button {{ margin: 10px 6px 0 0; padding: 8px 16px; border: 0; border-radius: 999px; background: #1d9bf0; color: #fff;
            font: 600 14px -apple-system, sans-serif; cursor: pointer; }}
  .muted {{ color: color-mix(in srgb, CanvasText 55%, transparent); font-size: 14px; }}
  video, img {{ display: block; width: 100%; border-radius: 14px; margin-top: 8px; }}
  li {{ margin-bottom: 10px; }}
</style></head><body><main>
<div class="kicker">TRACE · X POST</div>
<h1>{date_label}</h1>
<div class="box" id="post">{post}</div>
<button onclick="copyText('post', this)">Copy post</button> <span class="muted">{count}</span>
{media}
<h2>Reply to your own post with</h2>
<div class="box" id="reply">{reply}</div>
<button onclick="copyText('reply', this)">Copy reply</button>
<h2>Where each line comes from</h2>
<ul>{sources}</ul>
<p class="muted">{note}</p>
</main>
<script>
// The clip and the image are inside this page, so it works on its own: no folder, no server.
const CLIP = "{clip_b64}", IMAGE = "{image_b64}";
function blob(b64, type) {{
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], {{ type }});
}}
function flash(button, text) {{
  const old = button.textContent; button.textContent = text; setTimeout(() => button.textContent = old, 1800);
}}
function copyText(id, button) {{
  const text = document.getElementById(id).innerText;
  const fallback = () => {{
    const range = document.createRange(); range.selectNodeContents(document.getElementById(id));
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.execCommand('copy'); selection.removeAllRanges(); flash(button, 'Copied');
  }};
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => flash(button, 'Copied'), fallback); else fallback();
}}
function download(b64, type, name, button) {{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob(b64, type)); a.download = name; a.click();
  flash(button, 'Downloaded: drag it into X');
}}
function copyImage(button) {{
  // Browsers only copy images as PNG; X takes a pasted PNG.
  if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {{
    flash(button, "This browser can't copy images: use Download image"); return;
  }}
  const png = new Promise((resolve, reject) => {{
    const img = new Image();
    img.onload = () => {{
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0); canvas.toBlob(resolve, 'image/png');
    }};
    img.onerror = reject; img.src = 'data:image/jpeg;base64,' + IMAGE;
  }});
  navigator.clipboard.write([new ClipboardItem({{ 'image/png': png }})])
    .then(() => flash(button, 'Copied: paste it in X'), () => flash(button, "Couldn't copy: use Download image"));
}}
if (CLIP) document.getElementById('clip').src = URL.createObjectURL(blob(CLIP, 'video/mp4'));
if (IMAGE) document.getElementById('image').src = 'data:image/jpeg;base64,' + IMAGE;
</script></body></html>
"""


def reply_text(kit: dict[str, Any], clip: dict[str, Any] | None) -> str:
    """Trace's link, plus a credit when the clip is someone else's footage (a name, not a link)."""
    if clip and not clip["official"] and clip["channel"]:
        return f"{kit['reply']}\n\nVideo: {clip['channel']}"
    return kit["reply"]


def render_page(kit: dict[str, Any], clip: dict[str, Any] | None, clip_bytes: bytes = b"") -> str:
    post = kit["post"]
    e = html.escape
    image = kit.get("image")
    day = datetime.strptime(kit["date"], "%Y-%m-%d")
    media = []
    if clip and clip_bytes:
        credit = clip["channel"] + (" (the company's own channel)" if clip["official"] else "")
        media.append(
            '<h2>Video</h2><video id="clip" controls playsinline></video>'
            f"<button onclick=\"download(CLIP, 'video/mp4', 'x-clip-{kit['date']}.mp4', this)\">Download video</button>"
            "<p class=\"muted\">Then drag it from your browser's downloads (top right in Chrome) into the post: "
            "browsers can't copy a video. "
            f'{clip["seconds"]}s from "{e(clip["title"])}" by {e(credit)}'
            + ("." if clip["official"] else ": the reply below credits the channel.") + "</p>")
    if image and image_base64(image):
        media.append(
            f'<h2>{"Or the image" if media else "Image"}</h2><img id="image" alt="">'
            '<button onclick="copyImage(this)">Copy image</button>'
            f"<button onclick=\"download(IMAGE, 'image/jpeg', 'x-post-{kit['date']}.jpg', this)\">Download image</button>"
            f'<p class="muted">{image["size"][0]}x{image["size"][1]}, from {e(image["from"] or "the first story")}. '
            "Copy, then paste it into the post.</p>")
    if not media:
        media.append('<p class="muted">No clip or image today: grab one from the first story.</p>')
    sources = "".join(
        f"<li>{e(b['text'])}<br><span class='muted'>{e(b['story']['title'])} · "
        f"{e(', '.join(s['name'] for s in b['story']['sources'][:3]))}</span></li>"
        for b in post["bullets"]
    )
    reply = reply_text(kit, clip if clip and clip_bytes else None)
    how = ("Written by the model from the feed's last 24 hours: check each line before posting."
           if post["written_by"] == "model" else
           "The model was unavailable, so these are the stories' own titles: tidy them up before posting.")
    return PAGE.format(
        date=kit["date"], date_label=f"{day:%A, %B} {day.day}", post=e(post["text"]),
        count=f"{post['length']}/{kit.get('limit') or 360} characters", media="".join(media), reply=e(reply),
        sources=sources,
        note=e(f"{how} From {kit['stories']} stories."),
        # base64 has no quotes or backslashes, so it is safe inside a JS string.
        clip_b64=base64.b64encode(clip_bytes).decode() if clip and clip_bytes else "",
        image_b64=image_base64(image),
    )


def image_base64(image: dict[str, Any] | None) -> str:
    """The server's base64, re-encoded: only real base64 goes inside the page's script."""
    if not image:
        return ""
    try:
        return base64.b64encode(base64.b64decode(image.get("base64") or "", validate=True)).decode()
    except ValueError:
        return ""


def write_folder(kit: dict[str, Any], folder: Path, clip: dict[str, Any] | None) -> Path:
    post = kit["post"]
    (folder / "post.txt").write_text(f"{post['text']}\n\n--- reply ---\n{reply_text(kit, clip)}\n")
    image = image_base64(kit.get("image"))
    if image:
        (folder / "x-post.jpg").write_bytes(base64.b64decode(image))
    clip_file = folder / "x-clip.mp4"
    clip_bytes = clip_file.read_bytes() if clip and clip_file.exists() else b""
    page = folder / "index.html"
    page.write_text(render_page(kit, clip, clip_bytes))
    latest = OUT_ROOT / "latest"
    if latest.is_symlink() or latest.exists():
        latest.unlink()
    latest.symlink_to(folder.name)
    return page


def notify(title: str, message: str, page: Path | None) -> None:
    notifier = shutil.which("terminal-notifier")
    if notifier:
        command = [notifier, "-title", title, "-message", message, "-group", "trace-xpost"]
        if page:
            command += ["-open", page.as_uri()]
        if subprocess.run(command, capture_output=True, timeout=30).returncode == 0:
            return
        log("terminal-notifier failed; a plain notification instead (clicking it won't open the page)")
    quoted = [json.dumps(text, ensure_ascii=False) for text in (message, title)]  # AppleScript takes JSON-style strings
    script = f"display notification {quoted[0]} with title {quoted[1]}"
    subprocess.run(["osascript", "-e", script], capture_output=True, timeout=30)


# ---------------------------------------------------------------------------


def already_ran(today: str) -> bool:
    try:
        return STATE.read_text().strip() == today
    except OSError:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="run even if today's post is already done")
    parser.add_argument("--fresh", action="store_true", help="ask the server for a newly written post (implies --force)")
    args = parser.parse_args()
    now = datetime.now()
    today = now.date().isoformat()
    forced = args.force or args.fresh
    if not forced and (now.hour < START_HOUR or already_ran(today)):
        return 0
    if not forced and datetime.now(IST).date().isoformat() != today:
        return 0  # India's day has already turned over (evenings): tomorrow's feed isn't ours yet
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOCK, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log("another run is going; leaving it to finish")
            return 0
        return make_post(args, today)


def make_post(args: argparse.Namespace, today: str) -> int:
    forced = args.force or args.fresh
    log(f"making today's X post (ssh {shlex.quote(SSH_HOST)})")
    if not server_reachable():
        return 1  # launchd tries again in 20 minutes
    kit = fetch_kit(fresh=args.fresh, day="" if forced else today)
    if not kit or not kit.get("post"):
        return 1  # the feed hasn't reached today yet: tried again in 20 minutes
    if not forced and not kit.get("final", True):
        log("the model failed, so the server will try again; waiting for its post")
        return 1
    folder = OUT_ROOT / kit["date"]
    folder.mkdir(parents=True, exist_ok=True)
    upgrade_yt_dlp()
    clip = clip_for(kit, folder)
    if not clip:
        (folder / "x-clip.mp4").unlink(missing_ok=True)
        log("no clip today; the image will have to do")
    page = write_folder(kit, folder, clip)
    STATE.write_text(today)  # before the notification: a failed notification mustn't redo the day
    first = kit["post"]["bullets"][0]["text"] if kit["post"]["bullets"] else kit["post"]["hook"]
    try:
        notify("Your X post is ready" + (" (with a clip)" if clip else ""), first, page)
    except Exception as exc:
        log(f"no notification ({type(exc).__name__}); the page is at {page}")
    log(f"done: {page}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
