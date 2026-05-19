"""
Full pipeline: YouTube URL → talking character.
Outputs JSON progress lines for SSE streaming.
Usage: python3 pipeline.py <youtube-url> [--output-dir dir]
"""
import base64
import json
import os
import re
import sys
import time
import urllib.request
import subprocess
from runwayml import RunwayML
from openai import OpenAI
from youtube_transcript_api import YouTubeTranscriptApi

CLIENT_RW = RunwayML(api_key=os.environ.get("RUNWAYML_API_SECRET", ""))
CLIENT_OAI = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


def progress(step: str, status: str, **kwargs):
    msg = {"step": step, "status": status}
    msg.update(kwargs)
    print(json.dumps(msg), flush=True)


VIDEO_URL = sys.argv[1] if len(sys.argv) > 1 else None
if not VIDEO_URL:
    progress("init", "error", message="No YouTube URL provided")
    sys.exit(1)

VIDEO_ID = re.search(r"(?:v=|\/)([a-zA-Z0-9_-]{11})", VIDEO_URL).group(1)
OUT_DIR = f"outputs/{VIDEO_ID}"
os.makedirs(OUT_DIR, exist_ok=True)

progress("init", "running", video_id=VIDEO_ID)

# ── 1. Transcript ──────────────────────────────────────────
progress("transcript", "running", message="Extracting transcript...")
try:
    ts = YouTubeTranscriptApi().fetch(VIDEO_ID)
    segments = list(ts)
    transcript = "\n".join([f"[{e.start:.1f}s] {e.text}" for e in segments])
    with open(f"{OUT_DIR}/transcript.txt", "w") as f:
        f.write(transcript)
    progress("transcript", "done", segments=len(segments), message=f"{len(segments)} segments extracted")
except Exception as e:
    progress("transcript", "error", message=str(e))
    sys.exit(1)

# ── 2. Audio + Thumbnail ───────────────────────────────────
progress("download", "running", message="Downloading audio...")
try:
    subprocess.run(
        ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "128k",
         "-o", f"{OUT_DIR}/audio.%(ext)s", VIDEO_URL],
        capture_output=True, timeout=120,
    )
    thumbnail_url = f"https://img.youtube.com/vi/{VIDEO_ID}/maxresdefault.jpg"
    urllib.request.urlretrieve(thumbnail_url, f"{OUT_DIR}/thumbnail.jpg")
    progress("download", "done", message="Audio + thumbnail downloaded")
except Exception as e:
    progress("download", "error", message=f"Download failed: {e}")
    # continue anyway — thumbnail might still work

# ── 3. AI Analysis ─────────────────────────────────────────
progress("analysis", "running", message="Analyzing transcript with AI...")
try:
    resp = CLIENT_OAI.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Analyze this transcript and return JSON:
{
  "main_speaker": "primary speaker name",
  "profile": "sensationalized character profile. Include: they NEVER apologize, speak with absolute confidence, use vivid analogies, push back on ideas, are always the expert. 2 paragraphs.",
  "knowledge": "detailed bullet points of everything discussed: topics, arguments, quotes, claims. Be comprehensive.",
  "voice_start": 0.0, "voice_end": 0.0
}
voice_start/end: pick the most vocally expressive 15-25s segment of the MAIN speaker. Return ONLY valid JSON."""},
            {"role": "user", "content": transcript[:12000]},
        ],
        temperature=0.7, max_tokens=3000,
    )
    content = resp.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]
    data = json.loads(content)

    speaker = data.get("main_speaker", "Speaker")
    profile = data.get("profile", "")
    knowledge = data.get("knowledge", "")
    voice_start = data.get("voice_start", 30)
    voice_end = data.get("voice_end", 50)

    with open(f"{OUT_DIR}/profile.md", "w") as f: f.write(profile)
    with open(f"{OUT_DIR}/knowledge.md", "w") as f: f.write(knowledge)

    progress("analysis", "done", speaker=speaker, voice_clip=f"{voice_start}s-{voice_end}s",
             message=f"Analyzed: {speaker}")
except Exception as e:
    progress("analysis", "error", message=str(e))
    sys.exit(1)

# ── 4. Voice Clip ──────────────────────────────────────────
progress("voice", "running", message=f"Extracting voice at {voice_start}s...")
try:
    pad = 2
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(max(0, voice_start - pad)),
         "-t", str(voice_end - voice_start + pad * 2),
         "-i", f"{OUT_DIR}/audio.mp3",
         "-acodec", "libmp3lame", "-ab", "128k",
         f"{OUT_DIR}/voice_clip.mp3"],
        capture_output=True, timeout=30,
    )
    progress("voice", "done", message=f"Voice clip: {voice_end - voice_start:.0f}s")
except Exception as e:
    progress("voice", "error", message=f"ffmpeg failed: {e}")
    sys.exit(1)

# ── 5. Knowledge Document ──────────────────────────────────
progress("knowledge", "running", message="Creating knowledge base...")
knowledge_full = f"# {speaker} — Knowledge Base\n\n## Character\n{profile}\n\n## Discussion Topics\n{knowledge}"
doc = CLIENT_RW.documents.create(name=f"{speaker} Knowledge", content=knowledge_full)
progress("knowledge", "done", doc_id=doc.id, message="Knowledge doc created")

# ── 6. Clone Voice ─────────────────────────────────────────
progress("voice_clone", "running", message="Cloning voice...")
voice_id = None
try:
    with open(f"{OUT_DIR}/voice_clip.mp3", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    voice = CLIENT_RW.voices.create(
        name=f"Voice {speaker}",
        from_={"type": "audio", "audio": f"data:audio/mp3;base64,{b64}"},
    )
    for _ in range(40):
        v = CLIENT_RW.voices.retrieve(id=voice.id)
        if v.status == "READY":
            voice_id = v.id
            progress("voice_clone", "done", voice_id=voice_id, message="Voice cloned successfully")
            break
        if v.status == "FAILED":
            raise Exception("Voice clone processing failed")
        time.sleep(5)
except Exception as e:
    progress("voice_clone", "warning", message=f"Voice clone failed ({e}), using preset")
    voice_id = None

# ── 7. Create Avatar ───────────────────────────────────────
progress("avatar", "running", message="Creating character...")
try:
    with open(f"{OUT_DIR}/thumbnail.jpg", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    avatar_name = speaker.split()[-1][:15]
    voice_config = (
        {"type": "custom", "id": voice_id} if voice_id
        else {"type": "runway-live-preset", "preset_id": "adam"}
    )

    avatar = CLIENT_RW.avatars.create(
        name=avatar_name,
        reference_image=f"data:image/jpeg;base64,{b64}",
        personality=profile,
        start_script="Ask me anything. I have opinions.",
        voice=voice_config,
        document_ids=[doc.id],
    )
    avatar_id = avatar.id
    progress("avatar", "processing", avatar_id=avatar_id, message="Avatar created, waiting...")

    for _ in range(60):
        av = CLIENT_RW.avatars.retrieve(id=avatar_id)
        if av.status == "READY":
            progress("avatar", "done",
                     avatar_id=avatar_id,
                     name=av.name,
                     image_url=getattr(av, "processed_image_uri", "") or "",
                     message="Character is ready!")
            break
        if av.status == "FAILED":
            raise Exception(f"Avatar failed: {getattr(av, 'failure_reason', 'unknown')}")
        time.sleep(8)
    else:
        progress("avatar", "done", avatar_id=avatar_id, message="Avatar may still be processing, check later")

except RunwayML.BadRequestError as e:
    progress("avatar", "error", message=f"Avatar rejected (try a different video): {e}")

progress("complete", "done", avatar_id=avatar_id if 'avatar_id' in dir() else "",
         speaker=speaker, output_dir=OUT_DIR, message="Pipeline complete")
