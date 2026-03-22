from __future__ import annotations

import hashlib
import json
import math
import os
import re
from datetime import datetime, timedelta
from typing import Any, Callable

from openai import OpenAI

from v3.lib.store import V3Store

ROLE_ORDER = ["developer", "designer", "pm", "founder"]

ROLE_FALLBACK_IMAGES = {
    "developer": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop",
    "designer": "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=500&fit=crop",
    "pm": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
    "founder": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=500&fit=crop",
}

ROLE_LABELS = {
    "developer": "engineer",
    "designer": "designer",
    "pm": "product manager",
    "founder": "founder",
}

ROLE_ALIASES = {
    "developer": "developer",
    "engineer": "developer",
    "software engineer": "developer",
    "software developer": "developer",
    "full stack developer": "developer",
    "full-stack developer": "developer",
    "frontend engineer": "developer",
    "backend engineer": "developer",
    "designer": "designer",
    "product designer": "designer",
    "ux designer": "designer",
    "ui designer": "designer",
    "product manager": "pm",
    "pm": "pm",
    # former marketer roles fall back to founder (closest match)
    "marketer": "founder",
    "marketing": "founder",
    "growth marketer": "founder",
    "creator": "founder",
    "founder": "founder",
    "co-founder": "founder",
    "startup founder": "founder",
    "data scientist": "developer",
}

ROLE_FEED_INTEREST = {
    "developer": "engineering",
    "designer": "experience",
    "pm": "business-market",
    "founder": "startups",
}

ROLE_KEYWORDS = {
    "developer": {
        "api", "sdk", "cli", "database", "infra", "infrastructure", "devops",
        "open source", "github", "repository", "framework", "javascript",
        "typescript", "python", "rust", "go", "compiler", "agent", "llm",
        "model", "terminal", "backend", "frontend", "cloud", "kubernetes",
        "show hn", "hacker news", "release", "programming",
    },
    "designer": {
        "figma", "ux", "ui", "design system", "design systems", "typography",
        "prototype", "prototyping", "accessibility", "visual", "layout",
        "interaction", "interaction design", "product design", "wireframe",
        "component library", "brand", "creative", "motion", "design agent",
    },
    "pm": {
        "product", "roadmap", "prioritization", "retention", "onboarding",
        "user research", "experiment", "conversion", "launch", "feature",
        "product management", "metrics", "activation", "customer feedback",
    },
    "founder": {
        "startup", "startups", "saas", "pricing", "fundraising", "venture",
        "founder", "cofounder", "go-to-market", "gtm", "sales", "mrr",
        "acquisition", "market", "competition", "seed", "series a",
        "product-market fit", "pmf",
    },
}


def normalize_role(role: Any) -> str:
    normalized = str(role or "").strip().lower()
    if normalized in ROLE_ALIASES:
        return ROLE_ALIASES[normalized]
    if not normalized or normalized in {"other", "student", "none", "null"}:
        return "developer"
    return normalized


def role_label(role: str) -> str:
    normalized = normalize_role(role)
    return ROLE_LABELS.get(normalized, normalized or "professional")


def role_plural_label(role: str) -> str:
    normalized = normalize_role(role)
    mapping = {
        "developer": "engineers",
        "designer": "designers",
        "pm": "product managers",
        "marketer": "marketers",
        "founder": "founders",
    }
    return mapping.get(normalized, f"{role_label(normalized)}s")


def make_pool_article(
    *,
    title: str,
    url: str,
    source: str,
    signal: str = "",
    role_hints: list[str] | None = None,
    source_kind: str,
    snippet: str = "",
    lane_hints: list[str] | None = None,
    thumbnail: str = "",
    published_date: str = "",
) -> dict[str, Any]:
    return {
        "title": title,
        "url": url,
        "source": source,
        "signal": signal,
        "role_hints": sorted({
            normalize_role(role)
            for role in (role_hints or [])
            if str(role or "").strip()
        }),
        "source_kind": source_kind,
        "snippet": snippet,
        "thumbnail": str(thumbnail or "").strip(),
        "published_date": str(published_date or "").strip(),
        "lane_hints": sorted({
            str(lane).strip().lower()
            for lane in (lane_hints or [])
            if str(lane).strip()
        }),
    }


def signal_score(article: dict[str, Any]) -> int:
    sig = str(article.get("signal", "")).strip()
    match = re.search(r"(\d+)", sig)
    return int(match.group(1)) if match else 0


def normalize_title_signature(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()
    tokens = [token for token in normalized.split() if token]
    return " ".join(tokens[:10])


def recent_dates_before(target_date: str, days: int) -> list[str]:
    try:
        base = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        return []
    return [
        (base - timedelta(days=offset)).strftime("%Y-%m-%d")
        for offset in range(1, max(0, days) + 1)
    ]


def load_recent_role_history(
    store: V3Store,
    role: str,
    target_date: str,
    *,
    section_prefix: str = "for_you",
    lookback_days: int = 5,
) -> tuple[set[str], set[str]]:
    role = normalize_role(role)
    section_key = f"{section_prefix}_roles"
    recent_urls: set[str] = set()
    recent_titles: set[str] = set()

    for date_key in recent_dates_before(target_date, lookback_days):
        global_feed = store.load_global_feed(date_key)
        role_map = global_feed.get(section_key, {})
        if not isinstance(role_map, dict):
            continue
        items = role_map.get(role, [])
        iterable_items: list[dict[str, Any]] = []
        if isinstance(items, list):
            iterable_items = [item for item in items if isinstance(item, dict)]
        elif isinstance(items, dict):
            for section_items in items.values():
                if isinstance(section_items, list):
                    iterable_items.extend(
                        item for item in section_items if isinstance(item, dict)
                    )
        else:
            continue
        for item in iterable_items:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url", "")).strip()
            if url:
                recent_urls.add(url)
            title_sig = normalize_title_signature(str(item.get("title", "")))
            if title_sig:
                recent_titles.add(title_sig)
            sources = item.get("sources", [])
            if isinstance(sources, list):
                for source in sources:
                    if not isinstance(source, dict):
                        continue
                    source_url = str(source.get("url", "")).strip()
                    if source_url:
                        recent_urls.add(source_url)
                    source_sig = normalize_title_signature(str(source.get("title", "")))
                    if source_sig:
                        recent_titles.add(source_sig)
    return recent_urls, recent_titles


def _score_roles_by_rules(article: dict[str, Any]) -> dict[str, int]:
    text = " ".join([
        str(article.get("title", "")),
        str(article.get("source", "")),
        str(article.get("signal", "")),
        str(article.get("snippet", "")),
    ]).lower()
    scores = {role: 0 for role in ROLE_ORDER}

    for hint in article.get("role_hints", []) or []:
        normalized_hint = normalize_role(hint)
        if normalized_hint in scores:
            scores[normalized_hint] += 4

    source_name = str(article.get("source", "")).strip().lower()
    if source_name == "show hn":
        scores["developer"] += 3
        scores["founder"] += 2
    elif source_name == "hacker news":
        scores["developer"] += 2
        scores["founder"] += 1
    elif source_name == "product hunt":
        scores["developer"] += 2
        scores["designer"] += 2
        scores["pm"] += 2
        scores["founder"] += 1
    elif "taaft" in source_name:
        scores["developer"] += 2
        scores["founder"] += 2
        scores["designer"] += 1
        scores["pm"] += 1
    elif "github" in source_name:
        scores["developer"] += 3
        scores["pm"] += 1
    elif "y combinator" in source_name or "techcrunch startups" in source_name:
        scores["founder"] += 3
        scores["pm"] += 2
        scores["marketer"] += 1
    elif "figma" in source_name:
        scores["designer"] += 3
        scores["pm"] += 1

    for role, keywords in ROLE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                scores[role] += 3 if " " in keyword else 2

    return scores


def _classifier_cache_url(article: dict[str, Any], bucket: str) -> str:
    raw = "|".join([
        bucket,
        str(article.get("title", "")).strip(),
        str(article.get("source", "")).strip(),
        str(article.get("url", "")).strip(),
        str(article.get("snippet", "")).strip(),
        ",".join(sorted(str(hint).strip() for hint in article.get("role_hints", []) or [])),
    ])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"trace://role-classifier/{bucket}/{digest}"


def classify_roles_with_llm(
    store: V3Store,
    article: dict[str, Any],
    *,
    bucket: str,
    model: str,
    log_fn: Callable[[str], None] | None = None,
) -> tuple[list[str], bool]:
    cache_url = _classifier_cache_url(article, bucket)
    cached = store.get_cached_summary_v2(cache_url, bucket)
    if cached:
        cached_summary = cached.get("summary")
        if isinstance(cached_summary, dict):
            cached_roles = [
                normalize_role(role)
                for role in (cached_summary.get("roles") or [])
                if normalize_role(role) in ROLE_ORDER
            ]
            return cached_roles[:2], True

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return [], False

    prompt = (
        "Classify this content item for Trace's professional audience buckets.\n"
        "Return JSON only with keys roles and reject.\n"
        "roles must be an array containing up to 2 values chosen from "
        f"{', '.join(ROLE_ORDER)}.\n"
        "Use reject=true if the item does not clearly belong to any of those buckets.\n\n"
        f"Title: {str(article.get('title', '')).strip()}\n"
        f"Source: {str(article.get('source', '')).strip()}\n"
        f"Signal: {str(article.get('signal', '')).strip()}\n"
        f"Snippet: {str(article.get('snippet', '')).strip()}\n"
        f"Role hints from source list: {', '.join(article.get('role_hints', []) or []) or 'none'}\n"
        f"Source type: {str(article.get('source_kind', '')).strip()}\n"
    )

    client = OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            timeout=30,
        )
        raw = json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:
        if log_fn:
            log_fn(f"classifier fallback failed for {article.get('title', '')[:50]}: {exc}")
        return [], False

    roles = [
        normalize_role(role)
        for role in (raw.get("roles") or [])
        if normalize_role(role) in ROLE_ORDER
    ][:2]
    summary = {"roles": roles, "reject": bool(raw.get("reject"))}
    store.save_cached_summary_v2(
        cache_url,
        bucket,
        summary,
        model,
    )
    if summary["reject"]:
        return [], False
    return roles, False


def assign_roles_to_article(
    store: V3Store,
    article: dict[str, Any],
    *,
    bucket: str,
    model: str,
    log_fn: Callable[[str], None] | None = None,
) -> tuple[list[str], str]:
    scores = _score_roles_by_rules(article)
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_role, top_score = ranked[0]
    second_role, second_score = ranked[1]
    role_hints = [
        normalize_role(role)
        for role in (article.get("role_hints") or [])
        if normalize_role(role) in ROLE_ORDER
    ]

    if top_score >= 6 and second_score >= 5 and (top_score - second_score) <= 1:
        return [top_role, second_role], "rules"
    if top_score >= 4:
        return [top_role], "rules"
    if len(role_hints) == 1:
        return [role_hints[0]], "rules"
    if len(role_hints) >= 2:
        return role_hints[:2], "rules"
    if top_score > 0:
        return [top_role], "rules"

    roles, cached = classify_roles_with_llm(
        store,
        article,
        bucket=bucket,
        model=model,
        log_fn=log_fn,
    )
    if roles:
        return roles, "cache" if cached else "llm"

    return [], "reject"


def classify_content_pool(
    store: V3Store,
    articles: list[dict[str, Any]],
    *,
    bucket: str,
    model: str,
    log_fn: Callable[[str], None] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    stats = {
        "classified_with_rules": 0,
        "classified_with_cache": 0,
        "classified_with_llm": 0,
        "rejected": 0,
    }
    classified: list[dict[str, Any]] = []
    for article in articles:
        roles, method = assign_roles_to_article(
            store,
            article,
            bucket=bucket,
            model=model,
            log_fn=log_fn,
        )
        if not roles:
            stats["rejected"] += 1
            continue
        record = dict(article)
        record["roles"] = roles
        classified.append(record)
        if method == "cache":
            stats["classified_with_cache"] += 1
        elif method == "llm":
            stats["classified_with_llm"] += 1
        else:
            stats["classified_with_rules"] += 1
    return classified, stats


def score_article_for_role(
    role: str,
    article: dict[str, Any],
    recent_urls: set[str],
    recent_titles: set[str],
    *,
    lane: str = "community",
) -> float:
    role = normalize_role(role)
    score = 0.0
    title = str(article.get("title", "")).strip().lower()
    source_name = str(article.get("source", "")).strip().lower()
    if role in (article.get("roles") or []):
        score += 24.0
    if role in (article.get("role_hints") or []):
        score += 8.0

    source_kind = str(article.get("source_kind", "")).strip().lower()
    if lane == "build":
        if source_kind == "build":
            score += 18.0
        elif source_kind == "community":
            score += 10.0
        elif source_kind == "editorial":
            score += 8.0
        elif source_kind == "support":
            score += 5.0
    else:
        if source_kind == "community":
            score += 18.0
        elif source_kind == "editorial":
            score += 8.0
        elif source_kind == "build":
            score += 6.0
        elif source_kind == "support":
            score += 4.0

    if lane == "build":
        if source_name == "product hunt":
            score += 8.0
        elif source_name.startswith("taaft"):
            score += 7.0
        elif source_name == "show hn":
            score += 5.0
        elif source_name == "github trending":
            score += 4.0
        elif source_name.startswith("tldr "):
            score += 6.0
        elif source_name in {"techcrunch startups", "y combinator blog"}:
            score += 2.5
    else:
        if source_name in {
            "pragmatic engineer",
            "leaddev",
            "nielsen norman group",
            "mind the product",
            "lenny's newsletter",
            "first round review",
            "techcrunch startups",
            "y combinator blog",
        }:
            score += 4.0
        elif source_name.startswith("tldr "):
            score += 3.0

    score += min(12.0, math.log1p(max(signal_score(article), 0)))

    if lane == "community":
        if title.startswith(("how do i", "how to ", "anyone else", "i want to", "dear ")):
            score -= 10.0
        if title.startswith(("i built ", "if you're ", "share your startup", "dealing with ", "what is the best ")):
            score -= 7.0
        if "nothing outside of saas/ai" in title or "show and tell" in title:
            score -= 12.0
        if title.endswith("?") and signal_score(article) < 100:
            score -= 5.0
        if len(title) > 120:
            score -= 4.0
        if source_name in {"r/experienceddevs", "r/productmanagement", "r/entrepreneur"}:
            score -= 4.0

    if lane == "build":
        if "imagines" in title or "10 years from now" in title:
            score -= 10.0
        if title.startswith("if "):
            score -= 6.0

    title_sig = normalize_title_signature(article.get("title", ""))
    if str(article.get("url", "")).strip() in recent_urls:
        score -= 60.0
    if title_sig and title_sig in recent_titles:
        score -= 35.0
    return score


def select_role_articles(
    role: str,
    articles: list[dict[str, Any]],
    recent_urls: set[str],
    recent_titles: set[str],
    *,
    total_limit: int = 36,
    lane: str = "community",
) -> list[dict[str, Any]]:
    role = normalize_role(role)
    candidates = [
        dict(
            article,
            _rank_score=score_article_for_role(
                role,
                article,
                recent_urls,
                recent_titles,
                lane=lane,
            ),
        )
        for article in articles
        if role in (article.get("roles") or [])
    ]
    candidates.sort(
        key=lambda article: (article.get("_rank_score", 0), signal_score(article)),
        reverse=True,
    )

    diverse: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    for article in candidates:
        source = str(article.get("source", "")).strip().lower()
        source_kind = str(article.get("source_kind", "")).strip().lower()
        if lane == "build":
            if source in {"product hunt", "show hn", "github trending"}:
                limit_per_source = 3
            else:
                limit_per_source = 2 if source_kind in {"build", "community"} else 1
        else:
            limit_per_source = 2 if source_kind == "community" else 1
        if source and source_counts.get(source, 0) >= limit_per_source:
            continue
        diverse.append(article)
        if source:
            source_counts[source] = source_counts.get(source, 0) + 1
        if len(diverse) >= max(total_limit * 2, total_limit):
            break
    return diverse
