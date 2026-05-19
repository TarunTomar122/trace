import json
import os
import sys
import random
from datetime import datetime
from urllib.request import Request, urlopen

from openai import OpenAI
from characters import find_matching_character, random_fallback

API_BASE = "https://www.yourtrace.online"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("error: OPENAI_API_KEY env var not set")
    sys.exit(1)

STYLE_PREFIX = "Pixar 3D cartoon render, bold vibrant colors, dramatic lighting, 8k"

CAMERA_MOVES = [
    "slow push-in",
    "orbit around",
    "dolly zoom",
    "pan across",
    "crane up",
    "handheld shake",
]


def fetch_daily_feed(date: str = "today") -> dict:
    url = f"{API_BASE}/api/daily-feed?date={date}"
    req = Request(url, headers={"User-Agent": "hackathon-prototype/1.0"})
    with urlopen(req) as resp:
        return json.loads(resp.read())


def batch_detect_personas(trending: list[dict]) -> list[dict]:
    items_for_prompt = []
    for i, item in enumerate(trending[:20]):
        title = item.get("title", "")
        body = item.get("summary", {}).get("short_article", {}).get("body", "")[:300]
        items_for_prompt.append({
            "index": i,
            "title": title,
            "body": body,
        })

    prompt = f"""For each news item below, return a JSON array with:
1. person_or_company: the key person or company involved (e.g. "Elon Musk", "Nvidia", "Donald Trump", "Satya Nadella")
2. quote: a 3-10 word chaotic hot take in their voice, Silicon Mania style, unhinged
3. visual_hook: a specific visual action related to the news (e.g. "ripping a blacklist scroll in half", "pouring glowing compute juice between data centers")

Return ONLY valid JSON array, no other text:

Items:
{json.dumps(items_for_prompt, indent=2)}"""

    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You output ONLY valid JSON arrays. No markdown, no explanation.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=1.0,
        max_tokens=3000,
    )

    content = resp.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]
    return json.loads(content)


def pick_duration(index: int, total: int) -> int:
    if total <= 8:
        return 4
    if index < 4:
        return 5
    if index < 10:
        return 4
    return 3


def assemble_prompt(item: dict, persona: dict, index: int) -> str:
    title = item.get("title", "Untitled")

    person = persona.get("person_or_company", "")
    quote = persona.get("quote", "")
    visual_hook = persona.get("visual_hook", "")

    char = find_matching_character(person + " " + title)
    if char:
        char_desc = char["look"]
        setting = char["setting"]
    else:
        char_desc = random_fallback()
        setting = "chaotic startup scene"

    camera = random.choice(CAMERA_MOVES)

    prompt = f"{STYLE_PREFIX}, {char_desc} in {setting}, {visual_hook}, saying \"{quote}\", {camera}"
    return prompt


def main():
    args = sys.argv[1:]

    if "--from-feed" in args:
        idx = args.index("--from-feed")
        feed_path = args[idx + 1] if idx + 1 < len(args) else "feed_latest.json"
        print(f"[1/3] Loading cached feed from {feed_path}...")
        with open(feed_path) as f:
            feed = json.load(f)
    else:
        date = args[0] if args and not args[0].startswith("--") else "today"
        print(f"[1/3] Fetching daily feed for {date}...")
        feed = fetch_daily_feed(date)
        with open("feed_latest.json", "w") as f:
            json.dump(feed, f, indent=2)
        print("       cached to feed_latest.json")

    trending = feed.get("trending", [])
    topics = feed.get("trendingTopics", [])
    print(f"       {len(trending)} trending items, {len(topics)} topics")

    if "--raw" in args:
        return

    print(f"[2/3] Detecting personas...")
    personas = batch_detect_personas(trending)
    print(f"       got {len(personas)} personas")

    print(f"[3/3] Assembling Runway prompts...")

    date_str = feed.get("date", datetime.now().strftime("%Y-%m-%d"))
    total_items = min(len(trending), len(personas))

    combined = "--combined" in args
    scenes = []
    total_duration = 0

    for i in range(total_items):
        if total_duration >= 60:
            break

        item = trending[i]
        persona = personas[i]
        dur = pick_duration(i, total_items)
        title = item.get("title", "Untitled")
        prompt = assemble_prompt(item, persona, i)

        scenes.append({"title": title, "dur": dur, "prompt": prompt, "idx": i})
        total_duration += dur

    if combined:
        lines = [
            f"# Trace Daily — {date_str} — Full Video Script ({total_duration}s)\n",
            f"**Style:** {STYLE_PREFIX}\n",
        ]
        for s in scenes:
            lines.append(f"[Scene {s['idx']+1} - {s['dur']}s — {s['title']}]")
            lines.append(s["prompt"])
            lines.append("")
            lines.append("Clicky.")
            lines.append("")
        lines.pop()  # remove trailing "Clicky."
        lines.pop()
        lines.append(f"\n**Total: {total_duration}s — {len(scenes)} scenes**")

        out_path = f"script_{date_str}_combined.md"
        with open(out_path, "w") as f:
            f.write("\n".join(lines))

        print(f"\nDone! Saved to {out_path}\n")
        for l in lines:
            if l.startswith("[Scene") or l.startswith("Pixar") or l == "Clicky.":
                print(l)
    else:
        lines = [
            f"# Trace Daily — {date_str} — Runway Prompts\n",
            f"**Style:** {STYLE_PREFIX}\n",
        ]
        for s in scenes:
            lines.append(f"## {s['idx']+1}. {s['title']} ({s['dur']}s)")
            lines.append("")
            lines.append(s["prompt"])
            lines.append("")

        if total_duration >= 60:
            lines.append("*— clipped at 60s —*")
            lines.append("")

        lines.append(f"**Total: {total_duration}s — {len(scenes)} clips**")

        out_path = f"prompts_{date_str}.md"
        with open(out_path, "w") as f:
            f.write("\n".join(lines))

        print(f"\nDone! Saved to {out_path}\n")
        print(f"{len(scenes)} clips, ~{total_duration}s total\n")
        for l in lines:
            if l.startswith("## ") or l.startswith("Pixar"):
                print(l)


if __name__ == "__main__":
    main()
