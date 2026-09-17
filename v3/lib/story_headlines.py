"""Group distinct topics under a headline when they share a storyline.

Topics are already same-event cards. A headline is 2–3 of those cards that
are one unfolding story. Labels come from the cards, not a catalog.

TODO: title-token overlap is brittle (company + pronoun once grouped
unrelated Google stories). Revisit with a real storyline signal instead of
more stopword patches. Mirror: frontend/lib/story-headlines.ts.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any

HEADLINE_PROMPT_VERSION = "story-headlines-v3"
MAX_INPUT_TOPICS = 48
MAX_HEADLINES = 6
MIN_GROUP = 2
MAX_GROUP = 3
MAX_RELATED = 2
MAX_LABEL = 96
MIN_HEADLINE_WORDS = 4

_WORD_RE = re.compile(r"[a-z0-9]+")
_LABEL_RE = re.compile(r"[^a-z0-9]+")

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
    "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were",
    "what", "when", "where", "who", "why", "with", "this", "new", "says",
    "after", "over", "into", "just", "more", "than", "will", "can", "may",
    "has", "have", "had", "not", "but", "about", "up", "out", "one", "two",
    "first", "latest", "today", "report", "reports", "update", "updates",
    "they", "them", "their", "we", "you", "he", "she", "his", "her",
    "our", "your", "or", "if", "so", "do", "does", "did", "been", "being",
    "would", "should", "could", "get", "got", "then",
    "launch", "launches", "launched", "announce", "announces", "announced",
    "release", "releases", "released", "introduces", "introduced",
    "unveils", "unveiled", "reveals", "revealed", "enhances", "enhanced",
    "feature", "features", "beta",
}

COMPANY_TOKENS = {
    "openai", "anthropic", "google", "meta", "apple", "nvidia", "microsoft",
    "amazon", "tesla", "xai", "huggingface", "hugging", "deepmind", "mistral",
    "claude", "chatgpt", "gemini", "grok", "copilot", "siri", "iphone",
    "android", "pixel", "tsmc", "samsung", "intel", "amd",
}

GENERIC = {"ai", "tech", "app", "apps", "model", "models"}

WEAK = {
    "chip", "chips", "gpu", "gpus", "job", "jobs", "million", "billion",
    "trillion", "market", "markets", "stock", "stocks", "deal", "deals",
    "data", "cloud", "server", "servers", "tool", "tools", "product",
    "products", "user", "users", "company", "companies", "startup", "startups",
    "software", "hardware", "platform", "price", "prices", "news", "raise",
    "raises", "cut", "cuts", "plan", "plans", "secure", "secures", "secured",
    "expansion", "expands", "expanded", "expand", "explore", "explores",
    "call", "calls", "take", "takes", "learn", "learns", "amid", "insight",
    "insights", "reject", "rejects", "regulation", "regulations", "capability",
    "capabilities", "challenge", "challenges", "framework", "development",
    "media", "health", "chief", "chiefs", "memory",
    "ban", "bans", "production", "manufacturing", "agent", "agents",
}

COSTUME_LABELS = {
    "also today", "more today", "other news", "more news", "the rest",
    "rest of today", "leftover", "everything else", "also", "today",
}

HEADLINE_PROMPT = """These cards are already distinct events (same-event duplicates collapsed).

A HEADLINE is 2 or 3 cards that are the same unfolding storyline.
Write the storyline as a real news headline a paper would print:
6–12 words, a full phrase with a verb. Never a one-word tag,
never a two-token dump ("Ban", "Charles King", "Chip supply").

Good: "King Charles presses AI labs on safety"
Good: "OpenAI hunts a trillion-dollar funding round"
Good: "Labs race to ship new model safety evals"
Bad: the same company having unrelated news (Apple server + Apple photos).
Bad: the same industry (any two chip stories, any two funding rounds).
Bad: "Also today", "More news", filling a quota of sections.
Bad: "Safety", "Glasses", "Jobs chips".

If nothing clearly groups, return an empty list.

CARDS:
{stories}

Return JSON:
{{
  "headlines": [
    {{ "label": "A real news headline covering the cards", "topic_ids": ["tt_aaa", "tt_bbb"] }}
  ]
}}
"""


def _tokens(text: str) -> set[str]:
    out: set[str] = set()
    for raw in _WORD_RE.findall((text or "").lower()):
        if raw in STOPWORDS or len(raw) < 3:
            continue
        out.add(raw)
        if len(raw) > 4 and raw.endswith("s") and not raw.endswith("ss"):
            out.add(raw[:-1])
    return out


def _normalize_label(label: str) -> str:
    return _LABEL_RE.sub(" ", (label or "").lower()).strip()


def _is_costume_label(label: str) -> bool:
    normalized = _normalize_label(label)
    if not normalized:
        return True
    if normalized in COSTUME_LABELS:
        return True
    return bool(re.match(r"^(also|more|other|rest|leftover)\b", normalized))


def _is_digest_title(title: str) -> bool:
    text = (title or "").strip()
    if not text:
        return False
    lower = text.lower()
    if re.search(r"\b(and more|morning squawk|round-?up|wrap-?up|recap|in brief|what we know)\b", lower):
        return True
    return lower.count(",") >= 2 and bool(re.search(r"\band\b", lower))


def _content_tokens(tok: set[str]) -> set[str]:
    return _collapse_stems({
        word for word in tok if word not in COMPANY_TOKENS and word not in GENERIC
    })


def _collapse_stems(tok: set[str]) -> set[str]:
    out = set(tok)
    for word in tok:
        if word in out and f"{word}s" in out:
            out.discard(word)
    return out


def _specific_tokens(tok: set[str]) -> set[str]:
    return {word for word in _content_tokens(tok) if word not in WEAK}


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall((text or "").lower()))


def _is_thin_label(label: str) -> bool:
    return _word_count(label) < MIN_HEADLINE_WORDS


def _clip_headline(text: str) -> str:
    trimmed = re.sub(r"\s+", " ", (text or "").strip())
    if len(trimmed) <= MAX_LABEL:
        return trimmed
    cut = trimmed[:MAX_LABEL]
    at = cut.rfind(" ")
    clipped = cut[:at] if at >= 24 else cut
    return re.sub(r"[-–—,;:]+$", "", clipped)


def _label_from_titles(titles: list[str]) -> str:
    usable = [
        clipped
        for title in titles
        for clipped in [_clip_headline(title)]
        if not _is_thin_label(clipped) and not _is_costume_label(clipped)
    ]
    if not usable:
        return ""
    return sorted(usable, key=len)[0]


def shared_story_tokens(
    a: set[str] | str,
    b: set[str] | str,
    df: dict[str, int] | None = None,
) -> set[str] | None:
    _ = df
    left = _tokens(a) if isinstance(a, str) else a
    right = _tokens(b) if isinstance(b, str) else b
    shared = left & right
    specific = _specific_tokens(shared)
    companies = {word for word in shared if word in COMPANY_TOKENS}
    if len(specific) >= 2:
        return shared
    if companies and any(len(word) >= 5 for word in specific):
        return shared
    return None


def headline_grounded(label: str, titles: list[str]) -> bool:
    trimmed = (label or "").strip()
    if not trimmed or len(titles) < MIN_GROUP:
        return False
    if _is_costume_label(trimmed) or _is_thin_label(trimmed) or _is_digest_title(trimmed):
        return False
    if any(_is_digest_title(title) for title in titles):
        return False
    label_tok = _tokens(trimmed)
    if not _specific_tokens(label_tok):
        return False
    supports = []
    for title in titles:
        overlap = _tokens(title) & label_tok
        if not overlap:
            return False
        supports.append(overlap)
    common = set.intersection(*supports) if supports else set()
    return bool(_specific_tokens(common))


def pack_headlines(topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pool = [
        t for t in topics
        if str(t.get("id") or "").strip()
        and str(t.get("title") or "").strip()
        and not _is_digest_title(str(t.get("title") or ""))
    ]
    if not pool:
        return []

    token_map = {str(t.get("id")): _tokens(str(t.get("title") or "")) for t in pool}
    df: dict[str, int] = {}
    for tok in token_map.values():
        for word in tok:
            df[word] = df.get(word, 0) + 1

    placed: set[str] = set()
    headlines: list[dict[str, Any]] = []

    for lead in pool:
        if len(headlines) >= MAX_HEADLINES:
            break
        lead_id = str(lead.get("id"))
        if lead_id in placed:
            continue
        lead_tok = token_map.get(lead_id, set())
        group = [lead]
        shared: set[str] | None = None
        for other in pool:
            oid = str(other.get("id"))
            if oid == lead_id or oid in placed:
                continue
            pair = shared_story_tokens(lead_tok, token_map.get(oid, set()), df)
            if not pair:
                continue
            if shared is not None:
                nxt = shared & pair
                if not shared_story_tokens(nxt, nxt, df):
                    continue
                shared = nxt
            else:
                shared = pair
            group.append(other)
            if len(group) >= MAX_GROUP:
                break
        if not shared or len(group) < MIN_GROUP:
            continue
        titles = [str(item.get("title") or "") for item in group]
        label = _label_from_titles(titles)
        if not label or not headline_grounded(label, titles):
            continue
        ids = [str(item.get("id")) for item in group]
        placed.update(ids)
        headlines.append({"id": f"hl_{ids[0]}", "label": label, "topic_ids": ids})

    return _merge_by_label(headlines)[:MAX_HEADLINES]


def _merge_by_label(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = _normalize_label(str(row.get("label") or ""))
        existing = index.get(key)
        if existing is not None:
            ids = list(existing.get("topic_ids") or [])
            for sid in row.get("topic_ids") or []:
                if sid not in ids:
                    ids.append(sid)
            existing["topic_ids"] = ids[:MAX_GROUP]
            continue
        copy = {
            "id": row.get("id"),
            "label": row.get("label"),
            "topic_ids": list(row.get("topic_ids") or [])[:MAX_GROUP],
        }
        index[key] = copy
        out.append(copy)
    return out[:MAX_HEADLINES]


def _normalize_llm_headlines(
    raw: Any,
    allowed_ids: list[str],
    title_by_id: dict[str, str],
) -> list[dict[str, Any]] | None:
    if not isinstance(raw, dict):
        return None
    rows = raw.get("headlines")
    if not isinstance(rows, list):
        return None
    allowed = set(allowed_ids)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if row.get("leftover") is True:
            continue
        label = str(row.get("label") or "").strip()
        ids_raw = row.get("topic_ids") or row.get("story_ids")
        if not label or not isinstance(ids_raw, list) or _is_costume_label(label) or _is_thin_label(label) or _is_digest_title(label):
            continue
        ids: list[str] = []
        for item in ids_raw:
            sid = str(item or "").strip()
            if sid in allowed and sid not in seen and sid not in ids and not _is_digest_title(title_by_id.get(sid, "")):
                ids.append(sid)
        ids = ids[:MAX_GROUP]
        if len(ids) < MIN_GROUP:
            continue
        titles = [title_by_id.get(sid, "") for sid in ids]
        if not headline_grounded(label, titles):
            continue
        for sid in ids:
            seen.add(sid)
        out.append({
            "id": f"hl_{ids[0]}",
            "label": label[:MAX_LABEL],
            "topic_ids": ids,
        })
        if len(out) >= MAX_HEADLINES:
            break
    return _merge_by_label(out)


def _headline_cache_key(states: list[dict[str, str]]) -> str:
    payload = {
        "v": HEADLINE_PROMPT_VERSION,
        "ids": [s["id"] for s in states],
        "titles": [s["title"] for s in states],
        "summaries": [s.get("summary", "") for s in states],
    }
    digest = hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:40]
    return f"story_headlines:{digest}"


def _llm_pack(states: list[dict[str, str]]) -> list[dict[str, Any]] | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or not states:
        return None
    listing = "\n".join(
        f"- {s['id']}: {s['title']}"
        + (f" — {s['summary'][:180]}" if s.get("summary") else "")
        for s in states
    )
    try:
        from openai import OpenAI as _OpenAI

        client = _OpenAI(api_key=api_key)
        model = (
            os.getenv("HEADLINE_MODEL", "").strip()
            or os.getenv("HOME_BRIEFING_MODEL", "gpt-4o-mini").strip()
            or "gpt-4o-mini"
        )
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": HEADLINE_PROMPT.format(stories=listing)},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
            timeout=45,
        )
        parsed = json.loads(resp.choices[0].message.content or "{}")
        title_by_id = {s["id"]: s["title"] for s in states}
        normalized = _normalize_llm_headlines(parsed, [s["id"] for s in states], title_by_id)
        return [] if normalized is None else normalized
    except Exception:
        return None


def build_headlines(
    store: Any,
    topics: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    states = []
    for topic in topics:
        tid = str(topic.get("id") or "").strip()
        title = str(topic.get("title") or "").strip()
        if not tid or not title:
            continue
        states.append({
            "id": tid,
            "title": title,
            "summary": str(topic.get("summary") or "").strip()[:400],
        })
        if len(states) >= MAX_INPUT_TOPICS:
            break
    if not states:
        return []

    cache_key = _headline_cache_key(states)
    title_by_id = {s["id"]: s["title"] for s in states}
    ids = [s["id"] for s in states]
    try:
        cached = store.get_cached_synthesis(cache_key) if store is not None else None
    except Exception:
        cached = None
    if isinstance(cached, dict):
        cached_rows = cached.get("headlines")
        if isinstance(cached_rows, list):
            normalized = _normalize_llm_headlines({"headlines": cached_rows}, ids, title_by_id)
            if normalized is not None:
                used = {sid for row in normalized for sid in row.get("topic_ids") or []}
                rest = [topic for topic in topics[:MAX_INPUT_TOPICS] if str(topic.get("id")) not in used]
                return (normalized + pack_headlines(rest))[:MAX_HEADLINES]

    packed = _llm_pack(states)
    if packed is None:
        packed = pack_headlines(topics[:MAX_INPUT_TOPICS])
    else:
        used = {sid for row in packed for sid in row.get("topic_ids") or []}
        rest = [topic for topic in topics[:MAX_INPUT_TOPICS] if str(topic.get("id")) not in used]
        packed = (packed + pack_headlines(rest))[:MAX_HEADLINES]

    if store is not None:
        try:
            store.cache_synthesis(cache_key, {"headlines": packed})
        except Exception:
            pass
    return packed
