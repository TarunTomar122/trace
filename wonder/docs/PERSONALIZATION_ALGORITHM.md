# Personalization Algorithm

## Overview
This document describes how we personalize the daily content feed based on user onboarding data and behavior.

---

## Data Sources

### 1. Onboarding Inputs

**Focus (single choice)**
| ID | Label | Maps to Interests |
|---|---|---|
| `social` | Replace social media | relationships, culture, psychology |
| `reading` | Develop a reading habit | self-development, psychology |
| `ideas` | Discover new ideas | ideas, technology, science |
| `growth` | Work on personal growth | self-development, psychology, health |

**Life Goals (multi-select)**
| ID | Label | Maps to Interests |
|---|---|---|
| `productivity` | Increase Productivity | self-development, technology |
| `career` | Develop Your Career | career, business |
| `habits` | Build Better Habits | self-development, health |
| `money` | Earn More Money | money, business |
| `smarter` | Become Smarter | science, psychology, ideas |
| `social` | Improve Social Life | relationships, culture |

**Topics** - Direct selection from 14 interests

**Time Goal** - 10/20/30+ min/day

**Swipe Picks** - Likes/dislikes on sample content cards

### 2. Behavioral Data

- `seenContent[]` - IDs of content user has viewed
- `completedContent[]` - IDs of content user finished
- `likedContent[]` - Content explicitly liked
- `lastSeenDate` - For freshness calculations

---

## Scoring Algorithm

Each content item receives a score based on:

```
score = baseScore (0)
  + 10  if topic is explicitly selected
  +  5  if topic derived from focus
  +  3  if topic derived from any goal (per goal)
  +  8  if content type/topic matches swiped-like
  -  5  if content type/topic matches swiped-dislike
  + 15  if content is unseen (freshness bonus)
  -  3  per time seen in last 7 days (repetition penalty)
```

### Weights (v1.0)
```javascript
const WEIGHTS = {
  EXPLICIT_TOPIC: 10,
  FOCUS_DERIVED: 5,
  GOAL_DERIVED: 3,
  SWIPE_LIKE_MATCH: 8,
  SWIPE_DISLIKE_MATCH: -5,
  UNSEEN_BONUS: 15,
  REPETITION_PENALTY: -3,
};
```

---

## Daily Feed Selection

### Process
1. Get all available content items
2. Calculate score for each item
3. Sort by score (descending)
4. Apply diversity constraint: **max 2 items per topic**
5. Pick top N items (default: 7 for pro users)
6. Light shuffle within score tiers for variety

### Diversity Rules
- No more than 2 items from same topic in daily feed
- Mix content types (books, articles, videos)
- Prefer unseen content over high-scoring repeats

---

## Time Goal Impact

| Time Goal | Content Strategy |
|---|---|
| 10 min/day | Favor articles, short videos (< 5 cards) |
| 20 min/day | Balanced mix of all types |
| 30+ min/day | Include longer book summaries |

---

## Storage Schema

### User Preferences (local)
```javascript
{
  onboarding: {
    focus: 'growth',
    goals: ['productivity', 'habits'],
    topics: ['psychology', 'self-development', 'health'],
    timeGoal: '20 min/day',
    swipeLikes: ['book-psychology', 'article-health'],
    swipeDislikes: ['video-cooking'],
  },
  completedAt: '2024-01-15T...'
}
```

### Activity Data (local)
```javascript
{
  seenContent: ['book-psychology', 'article-money', ...],
  completedContent: ['book-psychology'],
  likedContent: [],
  lastActivity: '2024-01-15T...',
  dailyHistory: {
    '2024-01-15': ['book-psychology', 'article-money', ...]
  }
}
```

---

## Future Enhancements (v2.0)

- [ ] Collaborative filtering (users like you also liked...)
- [ ] Time-of-day preferences
- [ ] Reading speed adaptation
- [ ] Topic fatigue detection
- [ ] A/B test weight configurations
- [ ] Supabase sync for cross-device

---

## Changelog

### v1.0 (Initial)
- Basic scoring with explicit topics, focus, goals
- Swipe preference matching
- Freshness bonus
- Diversity constraints
