# V2 Feed Prep Scripts

This folder contains the staged pipeline for building feed-ready article data:

1. discover recent links from accepted sources
2. fetch full article content (without truncation)
3. generate summaries one-by-one

## Scripts

### 1) Build recent article index

Script: `v2/scripts/build_recent_source_article_index.py`

What it does:
- reads `validated_sources` from `v2/config/interest_source_links.json`
- fetches links via `v2/utils/fetch_article_links.py`
- applies date windows by source type
  - RSS/Atom: 7 days (default)
  - HTML/Sitemap: 14 days (default)
- writes grouped output by `interest_id` and `subinterest_id`

Default output:
- `v2/output/recent_source_articles.json`

Run:

```bash
python3 v2/scripts/build_recent_source_article_index.py
```

Useful variants:

```bash
# Only one interest
python3 v2/scripts/build_recent_source_article_index.py --interest-id business-market

# Only one subinterest
python3 v2/scripts/build_recent_source_article_index.py \
  --interest-id business-market \
  --subinterest-id startups

# Include undated + enrich missing metadata
python3 v2/scripts/build_recent_source_article_index.py \
  --include-undated \
  --enrich-metadata
```

---

### 2) Fetch full article content from index

Script: `v2/scripts/fetch_article_contents_from_index.py`

What it does:
- reads grouped article list from step 1
- fetches each article page with `requests`
- extracts main body text with `BeautifulSoup`
- appends per-article fields:
  - `content`
  - `content_length`
  - `is_paywalled`
  - `fetch_error`
  - `http_status`

Important:
- this script does **not** truncate article content

Default input/output:
- input: `v2/output/recent_source_articles.json`
- output: `v2/output/recent_source_articles_with_content.json`

Run:

```bash
python3 v2/scripts/fetch_article_contents_from_index.py
```

Useful variants:

```bash
# Process a specific file pair
python3 v2/scripts/fetch_article_contents_from_index.py \
  --input v2/output/recent_startups_articles.json \
  --out v2/output/recent_startups_articles_with_content.json

# Limit processing per source for testing
python3 v2/scripts/fetch_article_contents_from_index.py \
  --max-articles-per-source 2
```

---

### 3) Summarize content one-by-one

Script: `v2/scripts/summarize_articles_from_content_index.py`

What it does:
- reads grouped content output from step 2
- summarizes each article sequentially with OpenAI
- uses `v1/tools/summary_prompts.py` skill-level prompts
- appends per-article fields:
  - `summary`
  - `summary_model`
  - `summary_skill_level`
  - `summary_error`

Default input/output:
- input: `v2/output/recent_source_articles_with_content.json`
- output: `v2/output/recent_source_articles_with_summaries.json`

Requirements:
- `OPENAI_API_KEY` must be set

Run:

```bash
python3 v2/scripts/summarize_articles_from_content_index.py
```

Useful variants:

```bash
# Use expert style
python3 v2/scripts/summarize_articles_from_content_index.py \
  --skill-level expert

# Process one segment only
python3 v2/scripts/summarize_articles_from_content_index.py \
  --interest-id business-market \
  --subinterest-id startups \
  --max-articles-per-source 1
```

---

## End-to-end sequence

```bash
# 1) Build recent links
python3 v2/scripts/build_recent_source_article_index.py

# 2) Fetch full content
python3 v2/scripts/fetch_article_contents_from_index.py

# 3) Summarize one-by-one
python3 v2/scripts/summarize_articles_from_content_index.py
```

## One-article-ish quick test

```bash
python3 v2/scripts/build_recent_source_article_index.py \
  --interest-id business-market \
  --subinterest-id startups \
  --limit-per-source 1 \
  --out v2/output/tiny_recent.json

python3 v2/scripts/fetch_article_contents_from_index.py \
  --input v2/output/tiny_recent.json \
  --out v2/output/tiny_content.json \
  --max-articles-per-source 1

python3 v2/scripts/summarize_articles_from_content_index.py \
  --input v2/output/tiny_content.json \
  --out v2/output/tiny_summary.json \
  --max-articles-per-source 1
```

---

## Firestore pipeline (production path)

This is the Firestore-first flow (no local JSON artifacts required for runtime):

- pool refresher every 3 days
- daily feed generation for subscribed users
- writes daily feed docs to existing `user_feeds/{uid}/daily/{date}`

### A) Refresh pool into Firestore

Script: `v2/flows/refresh_article_pool_firestore.py`

Writes:
- `article_pool_v2` (one doc per article URL)
- `pipeline_runs_v2/pool_refresh` (run metadata)

Run:

```bash
python3 v2/flows/refresh_article_pool_firestore.py
```

### B) Generate daily subscribed feeds from Firestore pool

Script: `v2/flows/generate_daily_subscribed_feeds_from_pool.py`

Reads:
- `article_pool_v2`
- subscribed users from `user_profiles`

Writes:
- `user_feeds/{uid}/daily/{date}` (merged)
- `pipeline_runs_v2/daily_subscribed_feeds`

Behavior:
- appends suggested items (up to 2) and trending items
- final curation hard-caps feed to max items per user (default 8)
- before generating today, promotes yesterday's feed URLs into `user_seen_urls`
  so repeated daily items are avoided
- promotion is idempotent per user/date, so re-running same day does not
  repeatedly shrink the available pool

Run:

```bash
python3 v2/flows/generate_daily_subscribed_feeds_from_pool.py
```

### C) Scheduler (pool every 3 days + daily feeds)

Script: `v2/scheduler_firestore.py`

Run both jobs:

```bash
python3 v2/scheduler_firestore.py --jobs all
```

With explicit cap:

```bash
python3 v2/scheduler_firestore.py --jobs all --items-per-user 8
```

Run only pool:

```bash
python3 v2/scheduler_firestore.py --jobs pool
```

Run only daily feeds:

```bash
python3 v2/scheduler_firestore.py --jobs feeds
```

Force pool refresh even if cadence not due:

```bash
python3 v2/scheduler_firestore.py --jobs pool --force-pool
```
