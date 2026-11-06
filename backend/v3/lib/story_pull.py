"""Which stories our audience will actually watch, learned from our own numbers.

Coverage (how many outlets ran a story) says what the press thinks matters,
not what people stop for. So the social picks (Instagram/TikTok carousels in
post_instagram, and the reel shortlist in ~/Documents/trace-reels/tools/
candidates.py) rank stories with one model call that sees:

- who the audience is (the owner's words, AUDIENCE);
- fresh evidence of what this audience did with our recent stories: the public
  view counts of recent YouTube Shorts (one reel = one story; the best and
  worst when there are many), and the stories several email readers opened
  (`email_events`, `story=` links; click-everything readers ignored);
- the owner's own calls on past stories ("too boring", "this is what we want"),
  kept in `story_pull/owner_calls` and added with
  `python -m v3.lib.story_pull --call bad "<story>" "<why>"`;
- the candidate stories.

There is no fixed list of good and bad topics: the model reads the evidence,
so the ranking follows what the numbers show as they come in. The evidence is
cached for EVIDENCE_HOURS in `story_pull/evidence`, so a run costs one model
call and, at most every few hours, a few public page reads.

The story editor (newsletter_editor) writes for the same AUDIENCE and sees the
same evidence when it rates importance, so an owner call also steers the
email's order and the feed (for stories edited after the call).
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit

import requests

AUDIENCE = (
    "people who are into tech but mostly not software developers: they follow AI news, the big tech "
    "companies, new model launches, new product launches, big stock market moves, big acquisitions and layoffs"
)
MODEL = os.getenv("TRACE_PULL_MODEL", "gpt-6.1-terra")
EFFORT = os.getenv("TRACE_PULL_EFFORT", "low")
EVIDENCE_DAYS = 21
# A Short this new hasn't had its views yet and would read as a flop.
MIN_SHORT_AGE_DAYS = 1.0
EVIDENCE_HOURS = 6
# After a failed or partial read, try again sooner.
RETRY_HOURS = 0.5
# The best and the worst this many Shorts: the flops teach as much as the hits.
SHORTS_EACH_END = 15
MAX_CLICKED = 15
# One reader opening this many stories from one email is a link checker or a
# click-everything habit, not interest; their clicks are ignored.
CLICK_EVERYTHING = 5
MIN_READERS = 2
MAX_OWNER_CALLS = 40
TIMEOUT = 90

PROMPT = """You pick stories for Trace's short videos and Instagram/TikTok carousels. The audience: {audience}.

Rank the candidate stories by how many of these people would stop to watch, read and send the post to a friend. All of them are real news; how many outlets covered a story does not matter here, only what this audience wants.

Learn what this audience wants from the evidence below, which is how they actually responded to our recent stories. The samples are small and other things varied too (video style, posting time), so look for patterns that repeat across several stories rather than reading much into one result; the owner's calls are the most direct signal.

{evidence}

Candidates:
{stories}

Return every candidate index once, best first, each with a reason of at most 15 words that names the pattern from the evidence it fits or breaks."""

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["ranking"],
    "properties": {
        "ranking": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["index", "reason"],
                "properties": {"index": {"type": "integer"}, "reason": {"type": "string"}},
            },
        }
    },
}


def _log(message: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] [story-pull] {message}", flush=True)


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------

def short_views(link: str) -> int | None:
    """The public view count on a YouTube Short's page (the cookie skips the EU consent page)."""
    try:
        html = requests.get(link, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en"},
                            cookies={"SOCS": "CAI", "CONSENT": "YES+1"}, timeout=20).text
    except Exception:
        return None
    match = re.search(r'"viewCount":"(\d+)"', html)
    return int(match.group(1)) if match else None


def recent_shorts(now: datetime, views: Callable[[str], int | None] = short_views) -> tuple[list[dict[str, Any]], int]:
    """(Shorts from the last EVIDENCE_DAYS that are at least a day old, most
    viewed first, with hook, age and views; how many had no readable count).
    Past 2 x SHORTS_EACH_END, only the best and the worst are kept."""
    from v3.flows.post_instagram import buffer, youtube_channel

    channel = youtube_channel()
    if not channel:
        return [], 0
    query = ("query($o: OrganizationId!, $c: [ChannelId!]) { posts(first: 100, input: {organizationId: $o, "
             "filter: {channelIds: $c, status: [sent]}}) { edges { node { sentAt externalLink text } } } }")
    nodes = []
    for org in buffer("{ account { organizations { id } } }")[0]["account"]["organizations"]:
        data, _ = buffer(query, {"o": org["id"], "c": [channel]})
        nodes += [e.get("node") or {} for e in ((data or {}).get("posts") or {}).get("edges") or []]
    since = now - timedelta(days=EVIDENCE_DAYS)
    wanted = []
    for node in nodes:
        if not node.get("sentAt") or not node.get("externalLink"):
            continue
        sent = datetime.fromisoformat(node["sentAt"].replace("Z", "+00:00"))
        age = (now - sent).total_seconds() / 86400
        if sent >= since and age >= MIN_SHORT_AGE_DAYS:
            wanted.append((node, age))
    with ThreadPoolExecutor(max_workers=8) as pool:
        counts = list(pool.map(lambda item: views(item[0]["externalLink"]), wanted))
    out = [{"hook": (node.get("text") or "").split("\n")[0][:140], "views": count, "age_days": round(age, 1)}
           for (node, age), count in zip(wanted, counts) if count is not None]
    out.sort(key=lambda s: -s["views"])
    if len(out) > 2 * SHORTS_EACH_END:
        out = out[:SHORTS_EACH_END] + out[-SHORTS_EACH_END:]
    return out, len(wanted) - sum(c is not None for c in counts)


def _url_key(url: str) -> str:
    parts = urlsplit(url or "")
    return (parts.netloc.lower().removeprefix("www.") + parts.path.rstrip("/")).lower()


def clicked_stories(store: Any, now: datetime) -> list[dict[str, Any]]:
    """Stories at least MIN_READERS email readers opened (story= links on /feed),
    most readers first. A reader who opened CLICK_EVERYTHING or more stories
    from one email counts for none of them: that is a bot or a habit, and one
    such address once made 87% of all clicks."""
    since = (now - timedelta(days=EVIDENCE_DAYS)).strftime("%Y-%m-%d")
    opened: dict[tuple[str, str], set[str]] = defaultdict(set)
    for doc in store.db.collection("email_events").where("date", ">=", since).stream():
        event = doc.to_dict() or {}
        if event.get("kind") != "click":
            continue
        story = (parse_qs(urlsplit(event.get("target") or "").query).get("story") or [""])[0]
        if story:
            opened[(str(event.get("email") or ""), str(event.get("message_id") or ""))].add(_url_key(story))
    readers: dict[str, set[str]] = defaultdict(set)
    for (email, _), keys in opened.items():
        if len(keys) < CLICK_EVERYTHING:
            for key in keys:
                readers[key].add(email)
    if not readers:
        return []
    titles: dict[str, str] = {}
    for back in range(EVIDENCE_DAYS + 1):
        day = (now - timedelta(days=back)).strftime("%Y-%m-%d")
        for topic in store.load_global_feed(day).get("trending_topics") or []:
            if not isinstance(topic, dict) or not topic.get("title"):
                continue
            for article in topic.get("articles") or []:
                if isinstance(article, dict):
                    titles.setdefault(_url_key(article.get("url", "")), str(topic["title"]))
    by_title: dict[str, set[str]] = defaultdict(set)
    for key, who in readers.items():
        if key in titles:
            by_title[titles[key]] |= who
    ranked = sorted(((t, len(w)) for t, w in by_title.items() if len(w) >= MIN_READERS), key=lambda x: -x[1])
    return [{"title": t, "readers": n} for t, n in ranked[:MAX_CLICKED]]


def owner_calls(store: Any) -> list[dict[str, Any]]:
    """The owner's calls on past stories, newest first (read fresh, never cached)."""
    calls = (store.db.collection("story_pull").document("owner_calls").get().to_dict() or {}).get("calls") or []
    return [c for c in calls if isinstance(c, dict) and c.get("story")][:MAX_OWNER_CALLS]


def add_owner_call(store: Any, verdict: str, story: str, why: str = "", now: datetime | None = None) -> None:
    verdict = verdict.strip().lower()
    if verdict not in ("good", "bad"):
        raise ValueError("verdict must be good or bad")
    if not story.strip():
        raise ValueError("say which story")
    now = now or datetime.now(timezone.utc)
    calls = [{"story": story.strip(), "verdict": verdict, "why": why.strip(), "at": now.strftime("%Y-%m-%d")}]
    calls += owner_calls(store)
    store.db.collection("story_pull").document("owner_calls").set({"calls": calls[:MAX_OWNER_CALLS]})


def evidence(store: Any, now: datetime | None = None, refresh: bool = False) -> dict[str, Any]:
    """Shorts views and email clicks (cached for EVIDENCE_HOURS) plus the owner's
    calls (always fresh). Each part is best effort."""
    found = _measured(store, now or datetime.now(timezone.utc), refresh)
    try:
        found["owner"] = owner_calls(store)
    except Exception as exc:
        _log(f"no owner calls: {exc}")
    return found


def _measured(store: Any, now: datetime, refresh: bool) -> dict[str, Any]:
    ref = store.db.collection("story_pull").document("evidence")
    if not refresh:
        try:
            cached = ref.get().to_dict() or {}
            at = datetime.fromisoformat(cached.get("at", ""))
            # Entries without ttl_hours predate the reader counts: read again.
            if "ttl_hours" in cached and now - at < timedelta(hours=float(cached["ttl_hours"])):
                return {k: v for k, v in cached.items() if k != "owner"}
        except Exception:
            pass
    found: dict[str, Any] = {"at": now.isoformat(), "ttl_hours": EVIDENCE_HOURS, "shorts": [], "clicked": []}
    try:
        found["shorts"], missing = recent_shorts(now)
        if missing:
            _log(f"{missing} Shorts had no readable view count")
            if missing > len(found["shorts"]):
                found["ttl_hours"] = RETRY_HOURS
    except Exception as exc:
        _log(f"no Shorts evidence: {exc}")
        found["ttl_hours"] = RETRY_HOURS
    try:
        found["clicked"] = clicked_stories(store, now)
    except Exception as exc:
        _log(f"no email click evidence: {exc}")
        found["ttl_hours"] = RETRY_HOURS
    try:
        ref.set(found)
    except Exception as exc:
        _log(f"couldn't cache evidence: {exc}")
    return found


def evidence_text(found: dict[str, Any]) -> str:
    lines = []
    if found.get("owner"):
        lines.append("The owner's own calls on past stories. They know this audience; weigh these heavily and "
                     "generalise them to similar stories:")
        lines += [f"- {c['verdict'].upper()}: {c['story']}" + (f" ({c['why']})" if c.get("why") else "")
                  for c in found["owner"]]
        lines.append("")
    if found.get("shorts"):
        lines.append("YouTube Shorts we posted (one story each), most viewed first. Same channel; the video style "
                     "and posting time varied, and younger ones have had less time:")
        lines += [f"- {s['views']} views ({s['age_days']} days old): {s['hook']}" for s in found["shorts"]]
    if found.get("clicked"):
        if lines:
            lines.append("")
        lines.append("Stories several email readers opened (distinct readers; small numbers, and the email's "
                     "lead story gets extra readers):")
        lines += [f"- {c['readers']} readers: {c['title']}" for c in found["clicked"]]
    return "\n".join(lines) or "(No evidence yet: judge from the audience alone.)"


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def rank(stories: list[dict[str, Any]], found: dict[str, Any], client: Any = None) -> list[tuple[int, str]] | None:
    """[(index into stories, reason)], best first, covering every story; None if the call fails.

    `stories` items need "title" and may have "text" (a short summary).
    """
    if len(stories) < 2:
        return [(i, "") for i in range(len(stories))]
    blocks = "\n\n".join(f"[{i}] {s['title']}\n{str(s.get('text') or '')[:400]}" for i, s in enumerate(stories))
    tuning = ({"reasoning_effort": EFFORT} if MODEL.startswith(("gpt-5", "gpt-6", "o1", "o3", "o4"))
              else {"temperature": 0.2})
    try:
        if client is None:
            from openai import OpenAI

            client = OpenAI()
        response = client.chat.completions.create(
            model=MODEL,
            timeout=TIMEOUT,
            messages=[{"role": "user", "content": PROMPT.format(
                audience=AUDIENCE, evidence=evidence_text(found), stories=blocks)}],
            response_format={"type": "json_schema", "json_schema": {"name": "pull", "strict": True, "schema": SCHEMA}},
            **tuning,
        )
        rows = json.loads(response.choices[0].message.content or "{}").get("ranking") or []
    except Exception as exc:
        _log(f"ranking failed: {exc}")
        return None
    out: list[tuple[int, str]] = []
    seen: set[int] = set()
    for row in rows:
        index = row.get("index") if isinstance(row, dict) else None
        if isinstance(index, int) and 0 <= index < len(stories) and index not in seen:
            seen.add(index)
            out.append((index, str(row.get("reason") or "")[:200]))
    if not out:
        return None
    return out + [(i, "") for i in range(len(stories)) if i not in seen]


def main() -> None:
    parser = argparse.ArgumentParser(description="Show the pull evidence, or record an owner call.")
    parser.add_argument("--call", nargs="+", metavar="ARG",
                        help='good|bad, the story, and optionally why: --call bad "Apple scans iCloud links" "boring"')
    parser.add_argument("--refresh", action="store_true", help="re-read Shorts views and email clicks now")
    args = parser.parse_args()
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
    from v3.lib.store import V3Store

    store = V3Store()
    if args.call:
        if len(args.call) not in (2, 3):
            parser.error("--call takes VERDICT STORY [WHY]")
        try:
            add_owner_call(store, *args.call)
        except ValueError as exc:
            parser.error(str(exc))
        print(f"recorded: {args.call[0]} {args.call[1]}")
    print(evidence_text(evidence(store, refresh=args.refresh)))


if __name__ == "__main__":
    main()
