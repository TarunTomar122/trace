# Interest/Query Feed Plan

## Backend Plan

1. Define canonical interests + schema
   1. Add constants for the 14 interest IDs + labels.
   2. User profile fields:
      1. `interest_ids: string[]` (canonical 14)
      2. `interest_queries: Record<interest_id, string[]>` (0–2 query strings)
      3. `legacy_interests: string[]` (preserve old free‑text)
      4. Keep existing `skills`, `sourcePreferences`, `contentDepth`

2. Topic storage layout
   1. Umbrella pool:
      1. `topics/{interest_id}`
      2. `latest.blogs|discussions|videos`
      3. `generations[date]`
   2. Query pools (only when query exists):
      1. `topics/{interest_id}__q/{query_id}`
      2. `query_text`, `latest`, `generations[date]`

3. Subscribed topic generation (Exa)
   1. For each `interest_id`:
      1. If `interest_queries[interest_id]` has entries:
         1. Use up to 2 query strings
         2. Fetch Exa results per query
         3. Write to `topics/{interest_id}__q/{query_id}`
      2. Else:
         1. Use umbrella query (`interest_id`) + skill modifier
         2. Write to `topics/{interest_id}`
   2. Refresh cadence: keep `MIN_REFRESH_DAYS_DEFAULT = 4`

4. Unsubscribed feed generation
   1. Ignore old `umbrella_ids` and `interest_umbrella_map`
   2. Select items:
      1. Prefer query pools for `interest_queries` if present
      2. Fallback to umbrella pools
   3. Keep deterministic selection + caching
   4. Preserve `MAX_FEED_ITEMS` cap

5. Profile migration
   1. Map old `interests` into 14 canonical IDs
   2. Store:
      1. `interest_ids`
      2. `legacy_interests` (original list)
   3. No backfill of `interest_queries` unless provided by users

6. Data cleanup
   1. Remove `umbrella_ids`, `interest_umbrella_map`, `hobby_umbrella_map` from code paths
   2. Optional: write a cleanup script to delete these from Firestore after migration

7. Quality safeguards
   1. If query pool returns < N items, fallback to umbrella pool
   2. Dedupe by URL across pools
   3. If both are thin, top up from trending/news injection

## Algorithm Summary

1. Use `interest_queries` if present → query pools
2. Fallback to umbrella pool if thin or missing
3. Keep Exa frequency at 4 days
4. News injection remains daily and independent

## Subtopic Taxonomy (5 max per interest)

All subtopics are fixed IDs so query pools can be reused across users.

{
  "categories": [
    {
      "id": "technology",
      "label": "Technology",
      "subcategories": ["ai", "automation", "software", "productivity-tools", "future-tech"]
    },
    {
      "id": "science",
      "label": "Science",
      "subcategories": ["space", "biology", "physics", "climate", "explained"]
    },
    {
      "id": "psychology",
      "label": "Psychology",
      "subcategories": ["mental-health", "habits", "learning", "relationships", "emotions"]
    },
    {
      "id": "ideas",
      "label": "Ideas",
      "subcategories": ["philosophy", "essays", "creativity", "meaning", "big-ideas"]
    },
    {
      "id": "business",
      "label": "Business",
      "subcategories": ["startups", "product", "marketing", "operations", "leadership"]
    },
    {
      "id": "money",
      "label": "Money",
      "subcategories": ["personal-finance", "investing", "income", "markets", "crypto"]
    },
    {
      "id": "design",
      "label": "Design",
      "subcategories": ["visual-design", "ux", "branding", "creative-process", "tools"]
    },
    {
      "id": "career",
      "label": "Career",
      "subcategories": ["job-search", "skills", "portfolio", "career-growth", "workplace"]
    },
    {
      "id": "self-development",
      "label": "Self development",
      "subcategories": ["focus", "routines", "mindset", "confidence", "life-design"]
    },
    {
      "id": "health",
      "label": "Health",
      "subcategories": ["workouts", "nutrition", "sleep", "recovery", "fitness"]
    },
    {
      "id": "cooking",
      "label": "Cooking",
      "subcategories": ["recipes", "healthy-meals", "baking", "drinks", "food-culture"]
    },
    {
      "id": "culture",
      "label": "Culture",
      "subcategories": ["movies", "music", "games", "books", "internet"]
    },
    {
      "id": "relationships",
      "label": "Relationships",
      "subcategories": ["dating", "family", "friendships", "communication", "conflict"]
    },
    {
      "id": "society",
      "label": "Society",
      "subcategories": ["politics", "economics", "history", "media", "technology-impact"]
    }
  ]
}
