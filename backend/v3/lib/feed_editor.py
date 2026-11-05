"""The feed's editor pass: the daily email's judgement and copy on every feed story.

annotate_feed() runs newsletter_editor.edit_stories over a global feed doc's
trending topics and rows and stores the result on each as `editor`:
importance (1-100), event key, release flag, headline, blurb, one_line,
"Why it matters" take, and `outlier_urls`, coverage articles about a
different event (a Snap earnings report grouped under Figma's). The web feed
ranks, merges and shows copy from these fields; a story without `editor`
keeps the pipeline's copy, so the feed degrades to what it was before.
"""

from __future__ import annotations

from typing import Any

from v3.lib import newsletter_editor

# The feed rebuilds every 20 minutes: a story keeps its write-up this long unless a new outlet
# picks it up, and a slow model call gives up well before the next rebuild.
REUSE_HOURS = 3
TIMEOUT = 360
# "Why it matters" stays rare on the feed too: only the most important few keep one.
MAX_TAKES = 2


def annotate_feed(v3_store: Any, feed: dict[str, Any], limit: int | None = None) -> dict[str, Any]:
    """`feed` with an `editor` dict on the topics and rows the editor judged: the first `limit`
    in the pipeline's ranking (all of them when None, none when 0)."""
    # Imported here: the send flow imports the editor module at load time.
    from v3.flows.send_audience_newsletter import _candidates, _ranked

    candidates = _candidates(feed)
    ranked = _ranked(candidates)
    count = len(ranked) if limit is None else max(0, min(limit, len(ranked)))
    if not count:
        return feed
    edits = newsletter_editor.edit_stories(
        v3_store, ranked, limit=count, reuse_hours=REUSE_HOURS, timeout=TIMEOUT,
    )
    with_take = sorted((tid for tid, e in edits.items() if e.get("take")),
                       key=lambda tid: -int(edits[tid].get("importance") or 0))
    edits = {tid: ({**e, "take": ""} if tid in with_take[MAX_TAKES:] else e) for tid, e in edits.items()}
    by_id = {c["topic_id"]: c for c in candidates}

    def editor_for(candidate_id: str) -> dict[str, Any] | None:
        edit = edits.get(candidate_id)
        if not edit:
            return None
        urls = by_id.get(candidate_id, {}).get("coverage_urls") or []
        outliers = [urls[i] for i in edit.get("outliers") or [] if i < len(urls)]
        superseded = [urls[i] for i in edit.get("superseded") or [] if i < len(urls)]
        rest = {k: v for k, v in edit.items() if k not in ("outliers", "superseded")}
        return {**rest, "outlier_urls": outliers, "superseded_urls": superseded}

    for topic in feed.get("trending_topics") or []:
        if isinstance(topic, dict) and (ed := editor_for(str(topic.get("id", "")))):
            topic["editor"] = ed
    for row in feed.get("trending") or []:
        if isinstance(row, dict) and (ed := editor_for(f"row_{str(row.get('url', '')).strip()}")):
            row["editor"] = ed
    return feed
