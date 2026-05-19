"""Step runner for YouTube → Character pipeline. Each step outputs JSON."""
import base64, json, os, sys, time, urllib.request, subprocess
from typing import Any, Dict, List
import cv2
from runwayml import RunwayML
from openai import OpenAI
from youtube_transcript_api import YouTubeTranscriptApi

def _load_env_file(path: str):
    if not os.path.exists(path):
        return
    try:
        with open(path, "r") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'").strip('"')
                if k and not os.environ.get(k):
                    os.environ[k] = v
    except Exception:
        pass

# Load local env fallbacks when process env is empty (common in extension/python exec).
_load_env_file(os.path.join(os.getcwd(), ".env"))
_load_env_file(os.path.join(os.getcwd(), "..", ".env"))

RW = RunwayML(api_key=os.environ.get("RUNWAYML_API_SECRET", ""))
OAI = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
OUT = "outputs"

os.makedirs(OUT, exist_ok=True)
step = sys.argv[1] if len(sys.argv) > 1 else ""
video_id = sys.argv[2] if len(sys.argv) > 2 else ""
out_dir = f"{OUT}/{video_id}"
os.makedirs(out_dir, exist_ok=True)
video_url = f"https://www.youtube.com/watch?v={video_id}"


def _float_or_none(v: Any):
    try:
        return float(v)
    except Exception:
        return None


def _response_to_dict(resp: Any) -> Dict[str, Any]:
    if hasattr(resp, "model_dump"):
        return resp.model_dump()
    if isinstance(resp, dict):
        return resp
    try:
        return dict(resp)
    except Exception:
        return {}


def _pick_diarized_speaker_id(speaker_name: str, profile_text: str, segments: List[Dict[str, Any]]) -> str:
    if not segments:
        return ""

    diarized_transcript = "\n".join([
        f"{seg.get('speaker', 'UNKNOWN')}: {seg.get('text', '').strip()}"
        for seg in segments
        if seg.get("text")
    ])[:14000]

    if not diarized_transcript.strip():
        return ""

    prompt = (
        "You are mapping diarized speakers to a specific target person.\n"
        f"Target person: {speaker_name}\n"
        "Target profile excerpt:\n"
        f"{profile_text[:2500]}\n\n"
        "Diarized transcript (speaker labels + text):\n"
        f"{diarized_transcript}\n\n"
        "Return strict JSON only: {\"speaker_id\":\"...\"}. "
        "Pick the label that most likely matches the target person."
    )

    try:
        resp = OAI.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=60,
        )
        content = (resp.choices[0].message.content or "").strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(content)
        return str(data.get("speaker_id") or "").strip()
    except Exception:
        return ""


def _write_clip(input_audio: str, output_audio: str, start_sec: float, duration_sec: float):
    # Normalize + denoise lightly for better cloning consistency.
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", str(max(0, start_sec)),
            "-t", str(max(1, duration_sec)),
            "-i", input_audio,
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-af", "highpass=f=80,lowpass=f=7600,afftdn,loudnorm",
            "-acodec", "libmp3lame",
            "-ab", "128k",
            output_audio,
        ],
        capture_output=True,
        timeout=45,
    )

# ── transcript ─────────────────────────────────────────────
if step == "transcript":
    try:
        ts = YouTubeTranscriptApi().fetch(video_id)
        segs = list(ts)
        text = "\n".join([f"[{e.start:.1f}s] {e.text}" for e in segs])
        with open(f"{out_dir}/transcript.txt", "w") as f: f.write(text)

        # Detect speakers
        resp = OAI.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Identify ALL speakers in this transcript. Return JSON: {\"speakers\": [{\"name\":\"...\"}, ...], \"main\": 0}. main is the INDEX of the primary speaker in the array. Only JSON, no markdown."},
                {"role": "user", "content": text[:8000]},
            ],
            temperature=0, max_tokens=300,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"): content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        info = json.loads(content)

        speakers = info.get("speakers", [])
        main = info.get("main", "")

        print(json.dumps({
            "ok": True, "segments": len(segs),
            "speakers": speakers, "main_speaker": main,
            "transcript_preview": text[:1000],
        }))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

# ── frames ──────────────────────────────────────────────────
elif step == "frames":
    try:
        # Download video if not cached
        dl_path = f"{out_dir}/video"
        video_file = None
        for ext in [".mp4", ".webm", ".mkv"]:
            if os.path.exists(f"{dl_path}{ext}"):
                video_file = f"{dl_path}{ext}"
                break
        if not video_file:
            subprocess.run(
                ["yt-dlp", "-f", "bestvideo[height<=480]+bestaudio/bestvideo+bestaudio/best", "-o", f"{dl_path}.%(ext)s", video_url],
                capture_output=True, timeout=300,
            )
            for ext in [".mp4", ".webm", ".mkv"]:
                if os.path.exists(f"{dl_path}{ext}"):
                    video_file = f"{dl_path}{ext}"
                    break
        if not video_file:
            raise Exception("Video download failed")

        # Get video duration
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", video_file],
            capture_output=True, text=True, timeout=10,
        )
        duration = float(probe.stdout.strip())

        # Scan frames every N seconds, skipping intro, looking for solo faces
        # and preferring medium framing (not extreme close-up) for avatar quality.
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        candidates = []

        for t in range(30, min(int(duration), 600), 10):  # skip 0-30s intro, check every 10s
            frame_path = f"{out_dir}/_scan_{t}.jpg"
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(t), "-i", video_file,
                 "-vframes", "1", "-q:v", "5", frame_path],
                capture_output=True, timeout=10,
            )
            if not os.path.exists(frame_path):
                continue

            img = cv2.imread(frame_path)
            if img is None:
                continue
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 3)

            # Filter: exactly 1 face, and not too tiny / not too large.
            if len(faces) == 1:
                x, y, w, h = faces[0]
                frame_h, frame_w = img.shape[:2]
                face_ratio = w / max(1, frame_w)
                face_center_x = (x + (w / 2)) / max(1, frame_w)
                face_center_y = (y + (h / 2)) / max(1, frame_h)

                # Keep medium framing roughly 14% - 32% of frame width.
                if 0.14 <= face_ratio <= 0.32:
                    # Score by closeness to target face ratio + center positioning.
                    target_ratio = 0.22
                    ratio_penalty = abs(face_ratio - target_ratio)
                    center_penalty = abs(face_center_x - 0.5) + abs(face_center_y - 0.45)
                    score = ratio_penalty + (0.55 * center_penalty)
                    candidates.append({
                        "timestamp": t,
                        "face_size": w * h,
                        "face_ratio": face_ratio,
                        "score": score,
                        "path": frame_path
                    })

            # Clean up non-candidate frames
            if not candidates or candidates[-1]["timestamp"] != t:
                os.remove(frame_path)

        # Pick best 3 frames by composition score (lower is better), not largest face.
        candidates.sort(key=lambda c: c["score"])
        best = candidates[:3]
        frames = []
        for i, c in enumerate(best):
            final_path = f"{out_dir}/frame_{i}.jpg"
            if c["path"] != final_path:
                os.rename(c["path"], final_path) if os.path.exists(c["path"]) else None
            frames.append({"index": i, "timestamp": c["timestamp"],
                          "path": f"outputs/{video_id}/frame_{i}.jpg"})

        # Remove scan frames that weren't selected
        for fname in os.listdir(out_dir):
            if fname.startswith("_scan_"):
                os.remove(os.path.join(out_dir, fname))

        print(json.dumps({"ok": True, "frames": frames, "duration": duration}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

# ── analyze ────────────────────────────────────────────────
elif step == "analyze":
    speaker = sys.argv[3] if len(sys.argv) > 3 else ""
    with open(f"{out_dir}/transcript.txt") as f: transcript = f.read()
    try:
        resp = OAI.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"""Analyze this transcript. The speaker you are analyzing IS {speaker}. Write everything from THEIR first-person perspective — you ARE them, this is your own voice.

Return JSON:
{{
  "profile": "Write a first-person character description. Start with 'I am {speaker}.' Then describe: my speaking style, my beliefs, my motivations, how I handle pushback, my favorite analogies. I NEVER apologize, I speak with absolute conviction, I am always the expert. 2-3 paragraphs in first person.",
  "knowledge": "First-person bullet points of everything I discussed in this conversation: my arguments, my quotes, my claims, my pushbacks against the other person. Write as 'I said...' or 'I believe...' — never 'He said' or '{speaker} said'. Be thorough.",
  "voice_start": 0.0,
  "voice_end": 0.0
}}

CRITICAL: Write 100% in first person. 'I think', 'I said', 'I believe'. Never use third person. The knowledge is MY own words from this conversation.
CRITICAL: voice_start and voice_end MUST be the timestamp (in seconds) of a 20-30 second segment where {speaker} speaks clearly and alone. Pick a segment from the transcript where {speaker} is talking uninterrupted. If unsure, use voice_start=30, voice_end=50."""},
                {"role": "user", "content": f"This is a conversation featuring {speaker}. Extract what {speaker} said as if {speaker} is talking about themselves.\n\n{transcript[:12000]}"},
            ],
            temperature=0.7, max_tokens=3000,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"): content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(content)
        profile_raw = data.get("profile", "")
        knowledge_raw = data.get("knowledge", "")
        if isinstance(knowledge_raw, list): knowledge_raw = "\n".join(knowledge_raw)
        with open(f"{out_dir}/profile.md", "w") as f: f.write(str(profile_raw))
        with open(f"{out_dir}/knowledge.md", "w") as f: f.write(str(knowledge_raw))
        print(json.dumps({"ok": True, "profile": str(profile_raw), "knowledge": str(knowledge_raw), "voice_start": data.get("voice_start", 0), "voice_end": data.get("voice_end", 0)}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

# ── voice ──────────────────────────────────────────────────
elif step == "voice":
    # Supports both old arg order: voiceStart voiceEnd
    # and new order: speaker voiceStart voiceEnd
    speaker = "Speaker"
    start = 30.0
    end = 50.0
    if len(sys.argv) > 3:
        maybe_start = _float_or_none(sys.argv[3])
        if maybe_start is None:
            speaker = sys.argv[3]
            if len(sys.argv) > 4:
                start = _float_or_none(sys.argv[4]) or start
            if len(sys.argv) > 5:
                end = _float_or_none(sys.argv[5]) or end
        else:
            start = maybe_start
            if len(sys.argv) > 4:
                end = _float_or_none(sys.argv[4]) or end

    # Ensure at least 12 seconds of audio (Runway requires 10s minimum)
    if end - start < 12:
        end = start + 15
    try:
        if not os.path.exists(f"{out_dir}/audio.mp3"):
            subprocess.run(["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "128k", "-o", f"{out_dir}/audio.%(ext)s", video_url], capture_output=True, timeout=120)

        chosen_start = max(0, start)
        chosen_end = end
        selected_speaker_id = ""
        diarized_segments = 0

        # Smart speaker isolation with diarization on a bounded window
        # (keeps file size small while handling multi-speaker podcasts).
        window_pad = 75
        window_start = max(0, start - window_pad)
        window_end = end + window_pad
        window_dur = min(240, max(45, window_end - window_start))
        window_path = f"{out_dir}/voice_window.mp3"

        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(window_start), "-t", str(window_dur), "-i", f"{out_dir}/audio.mp3", "-acodec", "libmp3lame", "-ab", "128k", window_path],
            capture_output=True, timeout=40
        )

        if os.path.exists(window_path):
            diarized = OAI.audio.transcriptions.create(
                file=open(window_path, "rb"),
                model="gpt-4o-transcribe-diarize",
                response_format="diarized_json",
                chunking_strategy="auto",
            )
            diarized_data = _response_to_dict(diarized)
            segments = diarized_data.get("segments") or []
            diarized_segments = len(segments)

            profile_text = ""
            if os.path.exists(f"{out_dir}/profile.md"):
                with open(f"{out_dir}/profile.md") as f:
                    profile_text = f.read()

            selected_speaker_id = _pick_diarized_speaker_id(speaker, profile_text, segments)

            if selected_speaker_id:
                speaker_segments = [s for s in segments if str(s.get("speaker", "")).strip() == selected_speaker_id]
                if speaker_segments:
                    # Pick longest continuous turn from target speaker.
                    best = max(
                        speaker_segments,
                        key=lambda s: float(s.get("end", 0)) - float(s.get("start", 0))
                    )
                    local_start = float(best.get("start", 0))
                    local_end = float(best.get("end", 0))
                    if local_end - local_start < 12:
                        local_end = local_start + 15
                    chosen_start = max(0, window_start + local_start)
                    chosen_end = window_start + local_end

        pad = 2
        clip_start = max(0, chosen_start - pad)
        clip_duration = max(12, chosen_end - chosen_start + pad * 2)
        _write_clip(f"{out_dir}/audio.mp3", f"{out_dir}/voice_clip.mp3", clip_start, clip_duration)

        # Backup clip from requested window in case diarized mapping is wrong.
        req_clip_start = max(0, start - pad)
        req_clip_duration = max(12, end - start + pad * 2)
        _write_clip(f"{out_dir}/audio.mp3", f"{out_dir}/voice_clip_backup.mp3", req_clip_start, req_clip_duration)

        size = os.path.getsize(f"{out_dir}/voice_clip.mp3")
        print(json.dumps({
            "ok": True,
            "size_kb": size // 1024,
            "start": chosen_start,
            "end": chosen_end,
            "requested_start": start,
            "requested_end": end,
            "speaker": speaker,
            "selected_speaker_id": selected_speaker_id,
            "diarized_segments": diarized_segments,
            "backup_clip": True,
        }))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

# ── clone ──────────────────────────────────────────────────
elif step == "clone":
    try:
        hardcoded_demo_clip = "/Users/ttomar/Documents/personal/claudia/hackathon/outputs/f4Lj8nucm-A/voice_clip_backup.mp3"
        clip_candidates = [
            hardcoded_demo_clip,
            f"{out_dir}/voice_clip.mp3",
            f"{out_dir}/voice_clip_backup.mp3",
        ]
        clip_candidates = [p for p in clip_candidates if os.path.exists(p)]
        if not clip_candidates:
            raise Exception("Missing voice clips. Run voice step first.")

        errors = []
        for idx, clip_path in enumerate(clip_candidates):
            try:
                with open(clip_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()

                voice = RW.voices.create(
                    name=f"Voice {video_id}_{idx}",
                    from_={"type": "audio", "audio": f"data:audio/mp3;base64,{b64}"}
                )
                for _ in range(40):
                    v = RW.voices.retrieve(id=voice.id)
                    if v.status == "READY":
                        print(json.dumps({
                            "ok": True,
                            "voice_id": v.id,
                            "preview_url": getattr(v, "preview_url", ""),
                            "clip_used": os.path.basename(clip_path),
                        }))
                        sys.exit(0)
                    if v.status == "FAILED":
                        raise Exception(f"Voice clone failed for {os.path.basename(clip_path)}")
                    time.sleep(5)
                errors.append(f"{os.path.basename(clip_path)} timed out")
            except Exception as inner:
                errors.append(str(inner))

        print(json.dumps({"ok": False, "error": " | ".join(errors) or "Voice clone failed"}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

# ── avatar ─────────────────────────────────────────────────
elif step == "avatar":
    speaker = sys.argv[3] if len(sys.argv) > 3 else "Speaker"
    voice_id = sys.argv[4] if len(sys.argv) > 4 else ""
    frame_index = "0"
    with open(f"{out_dir}/profile.md") as f: profile = f.read()
    with open(f"{out_dir}/knowledge.md") as f: knowledge = f.read()
    try:
        if not voice_id or len(voice_id) <= 10:
            raise Exception("Missing cloned voice_id. Run clone step successfully before avatar step.")

        knowledge_full = f"# {speaker}\n\n## Character\n{profile}\n\n## Knowledge\n{knowledge}"
        doc = RW.documents.create(name=f"{speaker}", content=knowledge_full)

        # Get source image: use speaker frame if available, else thumbnail
        frame_path = f"{out_dir}/frame_{frame_index}.jpg"
        if os.path.exists(frame_path):
            source_img = frame_path
        else:
            source_img = f"{out_dir}/thumbnail.jpg"
            if not os.path.exists(source_img):
                urllib.request.urlretrieve(f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg", source_img)

        with open(source_img, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()

        voice_cfg = {"type": "custom", "id": voice_id}
        safe_name = speaker.split()[0]
        identity_personality = f"You are {speaker}. {profile}"
        avatar = RW.avatars.create(
            name=safe_name, reference_image=f"data:image/jpeg;base64,{b64}",
            personality=identity_personality,
            start_script="Hi.",
            voice=voice_cfg,
        )
        try:
            RW.avatars.update(avatar.id, personality=identity_personality, document_ids=[doc.id])
        except Exception:
            pass

        # Return avatar_id immediately so caller doesn't timeout
        with open(f"{out_dir}/avatar_info.json", "w") as f:
            json.dump({"avatarId": avatar.id, "name": safe_name, "videoId": video_id, "voiceId": voice_id, "documentId": doc.id}, f)
        print(json.dumps({"ok": True, "avatar_id": avatar.id, "name": safe_name, "status": "processing"}))
        # NOTE: Do not poll here. This step is called synchronously via API and
        # should return quickly after avatar creation. Readiness is handled later.
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

# ── chat ───────────────────────────────────────────────────
elif step == "chat":
    user_message = sys.argv[3] if len(sys.argv) > 3 else ""
    try:
        profile = ""
        knowledge = ""
        if os.path.exists(f"{out_dir}/profile.md"):
            with open(f"{out_dir}/profile.md") as f: profile = f.read()
        if os.path.exists(f"{out_dir}/knowledge.md"):
            with open(f"{out_dir}/knowledge.md") as f: knowledge = f.read()

        speaker = profile.split(".")[0].replace("I am ", "") if profile else "the character"

        resp = OAI.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"""You are {speaker}. Respond in first person as this character.

## Personality
{profile}

## Knowledge
{knowledge}

Stay in character at all times. Speak with conviction. Never break character or mention being an AI."""},
                {"role": "user", "content": user_message},
            ],
            temperature=0.8, max_tokens=500,
        )
        reply = resp.choices[0].message.content.strip()
        print(json.dumps({"ok": True, "response": reply}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
