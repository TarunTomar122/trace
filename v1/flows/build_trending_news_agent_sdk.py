"""
Build daily trending news using OpenAI Agent SDK + 2 tools:
1) Tavily search for URL discovery
2) Exa contents fetch for selective deep reads

The agent is constrained to use Exa fetch <= N times (default 5).
Output is saved to Firestore in trending_news/{date}/topics/{topic_id}.
"""

import argparse
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from pydantic import BaseModel, Field

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from agents import (  # noqa: E402
    Agent,
    ModelSettings,
    RunContextWrapper,
    Runner,
    function_tool,
)
from v1.algorithm.tavily_search import tavily_search  # noqa: E402
from v1.storage import FirestoreStore  # noqa: E402


IST_TZ = timezone(timedelta(hours=5, minutes=30))
OPENAI_MODEL = os.getenv("OPENAI_TRENDING_MODEL", "gpt-4.1-mini")
TRENDING_MAX_AGE_HOURS = 36  # generous window so we don't miss yesterday's news
EXA_API_URL = "https://api.exa.ai/contents"
EXA_FETCH_MAX_CHARS = 3000
TAVILY_RESULTS_PER_CALL = 5
MAX_NEWS_PER_TOPIC_DEFAULT = 10
SNIPPET_MAX_CHARS = 200  # truncate snippets sent to agent
MAX_EXA_FETCH_CALLS_DEFAULT = 5

TRUSTED_NEWS_DOMAINS = [
    "reuters.com",
    "apnews.com",
    "bloomberg.com",
    "ft.com",
    "wsj.com",
    "theverge.com",
    "techcrunch.com",
    "wired.com",
    "arstechnica.com",
    "venturebeat.com",
    "axios.com",
    "cnbc.com",
    "nytimes.com",
    "bbc.com",
    "economist.com",
    "openai.com",
    "anthropic.com",
    "googleblog.com",
    "deepmind.google",
    "github.blog",
    "aws.amazon.com",
    "cloud.google.com",
    "engineering.fb.com",
    "netflixtechblog.com",
    "microsoft.com",
]
NOISY_DOMAINS = [
    "prnewswire.com",
    "globenewswire.com",
    "businesswire.com",
    "einpresswire.com",
    "openpr.com",
    "newswire.com",
    "medium.com/tag",
]


TOPIC_CONFIGS: list[dict[str, Any]] = [
    {
        "id": "ai-tech",
        "name": "AI Tech",
        "scope": "AI model releases, AI product launches, AI research",
        "keywords": ["ai", "llm", "ai agents", "tech"],
        "sample_queries": [
            "AI technology news today",
            "artificial intelligence industry update",
            "machine learning latest news",
        ],
    },
    {
        "id": "software-engineering",
        "name": "Software Engineering",
        "scope": "dev tools, framework releases, cloud updates, APIs",
        "keywords": ["software", "developer", "api", "cloud"],
        "sample_queries": [
            "software engineering news today",
            "developer tools and cloud news",
            "programming and open source update",
        ],
    },
    {
        "id": "productivity-tools",
        "name": "Productivity Tools",
        "scope": "work tools, collaboration apps, workflow automation",
        "keywords": ["productivity", "workflow", "automation", "tools"],
        "sample_queries": [
            "productivity software news today",
            "workplace tools and apps update",
            "collaboration and automation news",
        ],
    },
    {
        "id": "future-tech",
        "name": "Future Tech",
        "scope": "chips, robotics, quantum, hardware, autonomous systems",
        "keywords": ["future tech", "robotics", "chips", "quantum"],
        "sample_queries": [
            "robotics and chips news today",
            "hardware and semiconductor update",
            "quantum computing and autonomous tech news",
        ],
    },
    {
        "id": "startups",
        "name": "Startups",
        "scope": "funding rounds, acquisitions, launches, valuations",
        "keywords": ["startup", "funding", "series a", "vc"],
        "sample_queries": [
            "startup and venture capital news today",
            "tech startup funding and acquisitions",
            "startup ecosystem news",
        ],
    },
    {
        "id": "markets",
        "name": "Markets",
        "scope": "stock moves, interest rates, crypto, earnings",
        "keywords": ["markets", "stocks", "rates", "crypto"],
        "sample_queries": [
            "financial markets news today",
            "stock market and crypto update",
            "economy and earnings news",
        ],
    },
    {
        "id": "health",
        "name": "Health",
        "scope": "drug approvals, health advisories, clinical studies",
        "keywords": ["health", "medical", "public health"],
        "sample_queries": [
            "health and medical news today",
            "public health and pharma update",
            "healthcare industry news",
        ],
    },
    {
        "id": "society-politics",
        "name": "Society Politics",
        "scope": "policy changes, regulation, elections, legislation",
        "keywords": ["politics", "policy", "regulation", "governance"],
        "sample_queries": [
            "politics and policy news today",
            "government regulation and legislation update",
            "society and governance news",
        ],
    },
    {
        "id": "habits-relationships",
        "name": "Habits Relationships",
        "scope": "social trends, digital habits, culture shifts",
        "keywords": ["habits", "relationships", "social trends"],
        "sample_queries": [
            "social trends and culture news today",
            "digital habits and lifestyle update",
            "workplace culture and relationships news",
        ],
    },
]
TOPIC_BY_ID = {t["id"]: t for t in TOPIC_CONFIGS}


class AgentNewsItem(BaseModel):
    topic_id: str
    title: str
    url: str
    published_date: str = ""
    summary: str
    why_important: str
    source: str = ""
    subtopic: str = ""
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class AgentNewsOutput(BaseModel):
    articles: list[AgentNewsItem]
    notes: str = ""


@dataclass
class NewsAgentContext:
    reference_date: str
    max_exa_fetch_calls: int
    max_tavily_calls: int = 32
    exa_fetch_calls_used: int = 0
    tavily_calls_used: int = 0
    verbose: bool = False


def _get_today_ist_date() -> str:
    return datetime.now(IST_TZ).strftime("%Y-%m-%d")


def _validate_date(date_value: str) -> str:
    parsed = datetime.strptime((date_value or "").strip(), "%Y-%m-%d")
    return parsed.strftime("%Y-%m-%d")


def _reference_cutoff_utc(reference_date: str) -> datetime:  # noqa: ARG001
    """Cutoff = now minus TRENDING_MAX_AGE_HOURS.

    We ignore reference_date for the cutoff and just use current time,
    so running mid-day doesn't accidentally create a 6-hour window.
    """
    return datetime.now(timezone.utc) - timedelta(
        hours=TRENDING_MAX_AGE_HOURS
    )


def _is_recent_enough(published_date: str, reference_date: str) -> bool:
    # If no date provided, trust it — Tavily already filtered to days=2
    if not published_date:
        return True
    try:
        cutoff = _reference_cutoff_utc(reference_date)
        raw = published_date.strip().replace("Z", "+00:00")
        if "T" in raw:
            pub_dt = datetime.fromisoformat(raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            pub_dt = pub_dt.astimezone(timezone.utc)
        else:
            pub_dt = datetime.strptime(raw[:10], "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
        return pub_dt >= cutoff
    except Exception:
        # Can't parse date — trust Tavily's recency filter
        return True


def _is_junk_url(url: str) -> bool:
    if not url:
        return True
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        path = (parsed.path or "").lower()
        if not host or not path or path in {"/", "/index.html"}:
            return True
        if any(
            marker in path
            for marker in (
                "/tag/",
                "/tags/",
                "/category/",
                "/categories/",
                "/search",
                "/author/",
                "/archive/",
                "/feed/",
                "/rss/",
                "/about",
                "/contact",
            )
        ):
            return True
        blocked = {
            "prnewswire.com",
            "globenewswire.com",
            "businesswire.com",
            "einpresswire.com",
            "openpr.com",
            "newswire.com",
        }
        if any(host == d or host.endswith(f".{d}") for d in blocked):
            return True
        return False
    except Exception:
        return True


def _dedupe_by_url(items: list[AgentNewsItem]) -> list[AgentNewsItem]:
    seen: set[str] = set()
    out: list[AgentNewsItem] = []
    for item in items:
        url = item.url.strip()
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(item)
    return out


@function_tool
def tavily_news_search(
    ctx: RunContextWrapper[NewsAgentContext],
    topic_id: str,
    query: str,
    max_results: int = TAVILY_RESULTS_PER_CALL,
) -> dict[str, Any]:
    """Search Tavily for recent news URLs for one topic.

    Queries MUST be short (2-6 words), natural language, specific.
    Good: "OpenAI new model release"
    Bad:  "major AI model updates OR AI platform launches"
    Tavily handles recency and news filtering automatically.
    """
    if topic_id not in TOPIC_BY_ID:
        return {
            "ok": False,
            "error": f"unknown_topic_id:{topic_id}",
            "results": [],
        }
    if ctx.context.tavily_calls_used >= ctx.context.max_tavily_calls:
        return {
            "ok": False,
            "error": "tavily_call_budget_exceeded",
            "results": [],
        }
    ctx.context.tavily_calls_used += 1
    if ctx.context.verbose:
        print(
            f"[tool:tavily] call={ctx.context.tavily_calls_used}/"
            f"{ctx.context.max_tavily_calls} "
            f"topic={topic_id} query=\"{query}\""
        )

    results = tavily_search(
        query=query,
        max_results=max(1, min(max_results, 10)),
        days=2,
        topic="news",
        search_depth="advanced",
        exclude_domains=list(NOISY_DOMAINS),
    )
    cleaned = []
    for item in results:
        url = str(item.get("url", "")).strip()
        if not url or _is_junk_url(url):
            continue
        snippet = str(item.get("content", "")).strip()
        if len(snippet) > SNIPPET_MAX_CHARS:
            snippet = snippet[:SNIPPET_MAX_CHARS] + "…"
        cleaned.append(
            {
                "title": str(item.get("title", "")).strip(),
                "url": url,
                "content": snippet,
                "published_date": str(
                    item.get("published_date", "")
                ).strip(),
                "score": item.get("score"),
            }
        )
    if ctx.context.verbose:
        print(
            f"[tool:tavily] results={len(results)} "
            f"cleaned={len(cleaned)}"
        )
        for c in cleaned[:3]:
            print(
                f"  -> {c['title'][:60]} | {c['url'][:60]}"
            )
    return {
        "ok": True,
        "topic_id": topic_id,
        "query": query,
        "calls_used": ctx.context.tavily_calls_used,
        "results": cleaned,
    }


@function_tool
def exa_fetch_content(
    ctx: RunContextWrapper[NewsAgentContext],
    url: str,
    max_chars: int = EXA_FETCH_MAX_CHARS,
) -> dict[str, Any]:
    """Fetch article text from a URL using Exa contents API.

    Use only for top candidate URLs when snippet context is weak.
    """
    if ctx.context.exa_fetch_calls_used >= ctx.context.max_exa_fetch_calls:
        return {"ok": False, "error": "exa_fetch_budget_exceeded"}

    api_key = os.getenv("EXA_API_KEY", "").strip()
    if not api_key:
        return {"ok": False, "error": "missing_EXA_API_KEY"}
    clean_url = re.sub(r"[)\].,;:]+$", "", (url or "").strip())
    if not clean_url or _is_junk_url(clean_url):
        return {"ok": False, "error": "invalid_or_junk_url"}

    ctx.context.exa_fetch_calls_used += 1
    if ctx.context.verbose:
        print(
            f"[tool:exa] call={ctx.context.exa_fetch_calls_used}/"
            f"{ctx.context.max_exa_fetch_calls} url={clean_url}"
        )
    payload = {"urls": [clean_url], "text": {"maxCharacters": max_chars}}
    headers = {"Content-Type": "application/json", "x-api-key": api_key}

    try:
        resp = requests.post(
            EXA_API_URL,
            json=payload,
            headers=headers,
            timeout=35,
        )
        if resp.status_code >= 400:
            return {"ok": False, "error": f"exa_http_{resp.status_code}"}
        data = resp.json() or {}
        results = data.get("results", []) or []
        if not results:
            return {"ok": False, "error": "exa_no_results"}
        first = results[0] or {}
        text = str(first.get("text", "")).strip()
        if not text:
            return {"ok": False, "error": "exa_empty_text"}
        if ctx.context.verbose:
            print(
                f"[tool:exa] success chars={len(text)} "
                f"published={first.get('publishedDate', '')}"
            )
        return {
            "ok": True,
            "url": clean_url,
            "title": str(first.get("title", "")).strip(),
            "published_date": str(first.get("publishedDate", "")).strip(),
            "text": text,
            "chars": len(text),
            "calls_used": ctx.context.exa_fetch_calls_used,
        }
    except Exception as exc:
        if ctx.context.verbose:
            print(f"[tool:exa] error={exc}")
        return {"ok": False, "error": f"exa_exception:{exc}"}


def _build_agent(
    reference_date: str,
    max_per_topic: int,
) -> Agent[NewsAgentContext]:
    topic_lines = []
    for topic in TOPIC_CONFIGS:
        topic_lines.append(
            f"- {topic['id']}: {topic['name']} | scope: {topic['scope']}"
        )
    topics_text = "\n".join(topic_lines)
    cutoff = _reference_cutoff_utc(reference_date).isoformat()

    sample_queries_block = ""
    for topic in TOPIC_CONFIGS:
        samples = topic.get("sample_queries", [])
        if samples:
            sample_queries_block += (
                f"\n  {topic['id']}:\n"
            )
            for sq in samples:
                sample_queries_block += f"    - \"{sq}\"\n"

    instructions = f"""
You are a daily news curation agent. Today is {reference_date}.

TOOLS:
1) tavily_news_search(topic_id, query, max_results)
   - Tavily handles recency (last 24h) and news source filtering.
   - Your job is ONLY to provide a SHORT, SPECIFIC query.
2) exa_fetch_content(url, max_chars)
   - Use sparingly to read full article text when snippet is unclear.

QUERY RULES (critical for good results):
- Queries MUST be 3-8 words, natural language.
- Go BROAD — cover the whole topic area, not one niche.
- Each query for a topic should cast a wide net so Tavily
  returns diverse results across the category.
- Never use OR/AND boolean operators.
- GOOD: "AI technology news today",
        "financial markets news today",
        "startup and venture capital news"
- BAD:  "OpenAI GPT-5 release" (too narrow, one company),
        "new AI model released" (too narrow, misses rest of AI),
        "AI model updates OR platform launches" (boolean)

TOPIC BUCKETS with example queries:
{sample_queries_block}
PROCESS:
- You MUST search ALL {len(TOPIC_CONFIGS)} topics. Do NOT stop early.
- For each topic, make 2-3 tavily_news_search calls with
  different short specific queries to cover breadth.
- You have plenty of Tavily calls — use them generously
  across ALL topics before producing output.
- Use exa_fetch_content only if a top candidate has weak
  snippet text (budget: <=5 calls total).
- Collect the best, most important articles per topic.
- If a topic genuinely has no results after 2-3 searches, skip it.

HARD CONSTRAINTS:
- Only include items published in last {TRENDING_MAX_AGE_HOURS}h
  (>= {cutoff} UTC).
- Max {max_per_topic} articles per topic.
- Avoid press-release wires, listicles, SEO content.
- Prefer reputable sources (Reuters, AP, Bloomberg, TechCrunch,
  The Verge, Wired, Ars Technica, official company blogs).

Return structured output matching schema.
""".strip()

    return Agent(
        name="DailyNewsAgent",
        model=OPENAI_MODEL,
        instructions=instructions,
        tools=[tavily_news_search, exa_fetch_content],
        output_type=AgentNewsOutput,
        model_settings=ModelSettings(temperature=0.2),
    )


def _post_process(
    output: AgentNewsOutput,
    reference_date: str,
    max_per_topic: int,
    verbose: bool = False,
) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[AgentNewsItem]] = {
        t["id"]: [] for t in TOPIC_CONFIGS
    }
    deduped = _dedupe_by_url(output.articles or [])

    for item in deduped:
        if item.topic_id not in grouped:
            if verbose:
                print(f"[post] DROP unknown topic: {item.topic_id}")
            continue
        if _is_junk_url(item.url):
            if verbose:
                print(f"[post] DROP junk url: {item.url[:60]}")
            continue
        if not _is_recent_enough(item.published_date, reference_date):
            if verbose:
                print(
                    f"[post] DROP stale: {item.title[:50]} "
                    f"date={item.published_date}"
                )
            continue
        if verbose:
            print(
                f"[post] KEEP: {item.topic_id} | "
                f"{item.title[:50]} | {item.published_date}"
            )
        grouped[item.topic_id].append(item)

    result: dict[str, dict[str, Any]] = {}
    for topic in TOPIC_CONFIGS:
        tid = topic["id"]
        items = grouped[tid][:max_per_topic]
        result[tid] = {
            "name": topic["name"],
            "keywords": topic["keywords"],
            "search_query": f"agent_sdk_daily_news_{tid}_{reference_date}",
            "articles": [
                {
                    "title": i.title,
                    "url": i.url,
                    "content": i.summary,
                    "published_date": i.published_date,
                    "score": i.confidence,
                    "source": i.source or "agent_sdk",
                    "subtopic": i.subtopic,
                    "why_important": i.why_important,
                }
                for i in items
            ],
        }
    return result


def _save_trending_news(
    store: FirestoreStore,
    date: str,
    news_by_topic: dict[str, dict[str, Any]],
) -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    total_articles = sum(len(v["articles"]) for v in news_by_topic.values())

    store.db.collection("trending_news").document(date).set(
        {
            "date": date,
            "generated_at": generated_at,
            "topic_count": len(news_by_topic),
            "total_articles": total_articles,
            "source": "agent_sdk_tavily_exa",
        }
    )

    for topic_id, data in news_by_topic.items():
        (
            store.db.collection("trending_news")
            .document(date)
            .collection("topics")
            .document(topic_id)
            .set(
                {
                    "topic_id": topic_id,
                    "name": data["name"],
                    "search_query": data["search_query"],
                    "keywords": data["keywords"],
                    "articles": data["articles"],
                    "article_count": len(data["articles"]),
                    "generated_at": generated_at,
                    "source": "agent_sdk_tavily_exa",
                }
            )
        )


def build_trending_news_agentic(
    date: str | None = None,
    max_per_topic: int = MAX_NEWS_PER_TOPIC_DEFAULT,
    max_exa_fetch_calls: int = MAX_EXA_FETCH_CALLS_DEFAULT,
    dry_run: bool = False,
    verbose: bool = False,
) -> dict[str, Any]:
    ref_date = _get_today_ist_date() if not date else _validate_date(date)
    if not os.getenv("OPENAI_API_KEY", "").strip():
        raise ValueError("OPENAI_API_KEY not set")

    agent = _build_agent(ref_date, max_per_topic=max_per_topic)
    context = NewsAgentContext(
        reference_date=ref_date,
        max_exa_fetch_calls=max_exa_fetch_calls,
        verbose=verbose,
    )

    if verbose:
        print("=" * 60)
        print("[agent] starting agentic trending build")
        print(f"[agent] date={ref_date}")
        print(f"[agent] model={OPENAI_MODEL}")
        print(f"[agent] max_per_topic={max_per_topic}")
        print(f"[agent] max_exa_fetch_calls={max_exa_fetch_calls}")
        print(f"[agent] max_tavily_calls={context.max_tavily_calls}")
        print(
            f"[agent] cutoff_utc={_reference_cutoff_utc(ref_date).isoformat()}"
        )
        print("[agent] topics:")
        for t in TOPIC_CONFIGS:
            print(f"  - {t['id']}: {t['name']}")

    run_input = (
        "Build today's daily-news digest. Use tools to discover and verify "
        "articles, then return final structured output."
    )
    result = Runner.run_sync(agent, run_input, context=context, max_turns=30)
    if verbose:
        print("[agent] run completed")
        print(f"[agent] last_response_id={result.last_response_id}")
        print(f"[agent] run_items={len(result.new_items)}")
        for idx, item in enumerate(result.new_items, start=1):
            print(f"[agent:item {idx}] type={item.__class__.__name__}")
    final = result.final_output_as(
        AgentNewsOutput,
        raise_if_incorrect_type=True,
    )
    if verbose:
        print(f"[agent] model_output_articles={len(final.articles)}")
    news_by_topic = _post_process(
        final,
        reference_date=ref_date,
        max_per_topic=max_per_topic,
        verbose=verbose,
    )

    total_articles = sum(len(v["articles"]) for v in news_by_topic.values())
    topics_with_news = sum(1 for v in news_by_topic.values() if v["articles"])
    if verbose:
        for topic in TOPIC_CONFIGS:
            tid = topic["id"]
            print(
                f"[agent:post] topic={tid} "
                f"articles={len(news_by_topic[tid]['articles'])}"
            )
        print(
            f"[agent:usage] tavily_calls={context.tavily_calls_used} "
            f"exa_fetch_calls={context.exa_fetch_calls_used}"
        )

    if not dry_run:
        store = FirestoreStore()
        _save_trending_news(store, ref_date, news_by_topic)
        if verbose:
            print("[agent] saved to Firestore")
    elif verbose:
        print("[agent] dry-run enabled, nothing saved")

    return {
        "date": ref_date,
        "topics": len(news_by_topic),
        "topics_with_news": topics_with_news,
        "total_articles": total_articles,
        "tavily_calls_used": context.tavily_calls_used,
        "exa_fetch_calls_used": context.exa_fetch_calls_used,
        "dry_run": dry_run,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build daily trending news with OpenAI Agent SDK"
    )
    parser.add_argument("--date", help="Reference date (YYYY-MM-DD)")
    parser.add_argument(
        "--max-per-topic",
        type=int,
        default=MAX_NEWS_PER_TOPIC_DEFAULT,
        help="Max articles per topic in final output",
    )
    parser.add_argument(
        "--max-exa-fetch-calls",
        type=int,
        default=MAX_EXA_FETCH_CALLS_DEFAULT,
        help="Hard cap for Exa content fetch tool calls",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not save to Firestore; print stats only",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed execution logs for tool usage and filtering",
    )
    args = parser.parse_args()

    summary = build_trending_news_agentic(
        date=args.date,
        max_per_topic=max(1, min(args.max_per_topic, 8)),
        max_exa_fetch_calls=max(1, min(args.max_exa_fetch_calls, 10)),
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    print("=" * 60)
    print("AGENTIC TRENDING NEWS RUN")
    print("=" * 60)
    for key in (
        "date",
        "topics",
        "topics_with_news",
        "total_articles",
        "tavily_calls_used",
        "exa_fetch_calls_used",
        "dry_run",
    ):
        print(f"{key}: {summary[key]}")


if __name__ == "__main__":
    main()
