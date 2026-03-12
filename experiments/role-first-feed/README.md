# Role-First Feed Direction

## Goal

Define the next feed model while we build it safely in `v3`.

- `Trending` stays interest-driven and current.
- `For You` becomes role-driven and experience-aware.
- The experiment uses new Firestore keys and new config files.
- Existing users and existing feed keys stay untouched.
- The experiment will be built inside `v3`, not `v4`.
- `Deep Dives` are out of scope and stay unchanged.

This direction is meant to answer one question:

Can we make the product feel more valuable by letting `Trending` do the broad news heavy lifting, while `For You` delivers only 2-3 work-relevant reads per day?

## Product Definition

### Trending

Purpose:
- cover what is happening now
- personalize primarily by `interests`
- include some major suggested stories outside the user's interests

What it should answer:
- what changed today in the areas I care about?

Examples:
- new AI model release
- new product launch
- important startup or funding move
- major industry move in fitness, fintech, climate, design, etc.

### For You

Purpose:
- help the user get better at their work
- route primarily by `role + seniority`
- keep volume very low

What it should answer:
- what should someone like me read today to improve judgment, workflow, or execution?

Examples:
- early-career engineer: how AI can improve code review workflow
- senior PM: how to make better portfolio-level product bets
- founder: how to find a wedge before overbuilding
- designer: how to turn research signals into clearer product decisions

## Why This Is Different From Current V3

Current V3 `For You` is mostly:
- interest-matched
- partially role-boosted
- too close to a second topic feed

This direction changes that:
- `Trending` handles subject-matter freshness
- `For You` handles professional relevance

That means:
- no need to summarize 8-10 evergreen items per user
- no need for `For You` to cover every interest every day
- lower summary volume and lower model cost

## Onboarding Inputs And Their New Jobs

### Interests

Use for:
- `Trending` personalization
- interest filter pills
- suggested outside-interest stories

Do not use as the main selector for experimental `For You`.

### Role

Use for:
- primary `For You` source family
- first half of the source-routing key

### Seniority

Use for:
- second half of the source-routing key
- deciding which version of a role lane someone belongs to
- choosing more tactical vs more strategic sources

### Career Goals

Use lightly for:
- tie-breaking after source routing
- ranking inside a chosen role-seniority lane

Example:
- `build-something` should slightly favor practical execution content
- `get-promoted` should slightly favor judgment, communication, and leverage

Important constraint:
- `careerGoals` should not be the primary personalization mechanism
- summaries should not be responsible for manufacturing relevance
- relevance should come upstream from the selected source set

## Feed Shape

### Trending

No major product change in this phase.

Experimental backend idea later:
- `interest-matched trending`
- `suggested_trending`

But the existing app experience can remain unchanged for now.

### For You

Daily volume:
- `2-3` items max

Selection:
- driven by `role + seniority`
- lightly adjusted by `careerGoals` after source routing

Cadence:
- one clean daily batch
- no need to refresh constantly

Quality bar:
- fewer items
- much higher trust
- more article-like
- more work-relevant

## Summary Direction

The experimental `For You` summary should:
- feel easy to read on mobile
- preserve real examples and specifics
- avoid article-commentary language
- avoid learning cards
- stay balanced, not too technical and not too abstract

What summaries should NOT do:
- they should not be the main source of personalization
- they should not fake relevance through tone or "why this matters to you"
- they should not try to compensate for weak source selection

Current preferred direction:
- `4-6` short paragraphs
- `1-2` sentences per paragraph
- no headers
- no bullets in the main body
- no em dashes
- no phrases like `this article`, `the author`, `the piece`

## Source Strategy

### Trending Sources

Principle:
- use strong editorial or already-curated sources
- prioritize high-signal reporting and launch coverage

Trending should cover:
- AI
- product launches
- startup/company moves
- industry developments inside user interests

### For You Sources

Principle:
- source by `role + seniority`, not by broad interest bucket
- prefer readable article-style publications
- avoid company-first blogs unless unusually strong
- prefer pieces that still make sense months later

Core rule:
- source routing should carry most of the personalization burden
- summaries only make chosen content easier to consume
- if a user gets the right source family, the summary can stay mostly stable

What we are trying to avoid:
- infra-heavy engineering blogs for general engineers
- soft news overlap with `Trending`
- launch posts
- update posts
- swipe-card summaries

## Proposed Experimental Config Files

Create new files inside `v3` only when needed, but the goal is to replace the live direction, not maintain a parallel product forever:

- `v3/config/trending_sources_experiment.json`
- `v3/config/for_you_sources_experiment.json`

Suggested meaning:

### `trending_sources_experiment.json`
- same core idea as current trending
- cleaned up around interest coverage
- remains interest-first

### `for_you_sources_experiment.json`
- grouped by `role + seniority`
- role-seniority combination is the primary routing key

Example shape:

```json
{
  "items_per_user": 3,
  "role_seniority_sources": {
    "developer": {
      "early": ["...sources..."],
      "mid": ["...sources..."],
      "senior": ["...sources..."]
    },
    "pm": {
      "early": ["...sources..."],
      "mid": ["...sources..."],
      "senior": ["...sources..."]
    },
    "founder": {
      "all": ["...sources..."]
    },
    "designer": {
      "all": ["...sources..."]
    }
  }
}
```

Notes:
- `all` can be used only when we truly do not need a seniority split
- but the preferred shape is explicit `role + seniority` routing
- we should not rely on prompt style to create early vs senior differentiation

We do not need to support every role perfectly on day one.

The experiment should focus on 4-5 target user types first:
- early-career engineer
- senior engineer
- PM
- founder / indie hacker
- designer / UX person

## Proposed New Firestore Keys

Keep all current collections and feed sections intact.

Add new keys while this is under construction so current users are unaffected.

### New collections

- `v3_for_you_experiment_pool`
- `v3_summary_cache_experiment`
- `v3_user_feeds_experiment`

### New feed section names

Inside experiment docs:
- `trending_experiment`
- `for_you_experiment`

Or, if we want one doc shape:

```json
{
  "uid": "...",
  "date": "YYYY-MM-DD",
  "experiment": "role-first-feed-v1",
  "trending_experiment": [...],
  "for_you_experiment": [...]
}
```

The simplest safe path is:
- keep `v3_user_feeds` unchanged
- write experiment output into `v3_user_feeds_experiment`

## V3 Implementation Boundary

This work should live in `v3`.

That means:
- no `v4` directory for now
- no migration of `deep_dives`
- no production behavior change for current users

Safe areas to change in `v3`:
- new config files
- new builder mode or new experimental builder path
- new Firestore collection names
- new mobile/frontend dev-only reads later if needed

Unsafe in this phase:
- replacing the live `trending` pipeline
- replacing the live `deep_dives` pipeline
- changing current production feed keys for all users

## Proposed Build Strategy

### Phase 1

Do the smallest useful version.

- leave live `Trending` untouched
- leave live `For You` untouched
- build experiment only for selected test users
- generate only `2-3` `For You` items per test user
- summarize only those selected items

This is the main cost-saving move.

### Phase 2

Use the experiment doc in the mobile app behind a local/dev path.

- keep production tabs reading current keys
- allow the test user to read `for_you_experiment`
- keep UI breakage acceptable during testing

## Open Questions

1. Should experimental `Trending` also move to new keys immediately, or can we keep current trending and only experiment on `For You` first?
2. Do we want one new user document per day, or one long-lived new doc per user?
3. Should `careerGoals` affect only ranking, or also source inclusion/exclusion within a lane?
4. Which 4-5 target user types do we want to lock first?

## Immediate Next Steps

1. Lock the new data model and Firestore keys.
2. Create experimental config files inside `v3`.
3. Define the first target roles:
   - developer
   - pm
   - founder
   - designer
4. Pick sources for each `role + seniority` lane.
5. Build this only for a few test users first.
6. Compare outputs before touching production feed behavior.
