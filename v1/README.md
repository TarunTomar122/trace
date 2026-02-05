# V1 Backend - Content Pipeline & AI Agents

Python backend for Claudia's content discovery engine. Handles daily content fetching, feed generation, newsletter creation, and user personalization.

## 📁 Directory Structure

```
v1/
├── algorithm/              # Core algorithms and schemas
│   ├── interest_schema.py  # 14 canonical interests + subtopic mapping
│   ├── pool_utils.py       # Content pool management
│   └── tavily_search.py    # News search via Tavily API
│
├── core_agents/            # AI agents for content analysis
│   └── reflection.py       # Daily reflection agent
│
├── flows/                  # Main orchestration flows
│   ├── build_topics_for_*.py          # Topic pool generation
│   ├── build_feed_from_*.py           # Feed generation
│   ├── build_newsletter_*.py          # Newsletter creation
│   ├── build_suggested_items_*.py     # Discovery recommendations
│   ├── build_trending_news_*.py       # News fetching
│   └── add_trending_news_*.py         # News integration
│
├── hooks/                  # Event-triggered flows
│   └── on_user_onboard.py  # New user onboarding flow
│
├── scripts/                # Admin utilities and migrations
│   ├── migrate_interest_schema.py     # Schema migration
│   ├── infer_subtopics_for_users.py   # LLM-based subtopic inference
│   ├── delete_orphaned_topics.py      # Cleanup script
│   └── cleanup_user_interests.py      # Data consistency
│
├── tools/                  # Utility modules
│   ├── smart_reflection.py            # Reflection tools
│   └── [other utilities]
│
├── templates/              # Email HTML templates
│   ├── newsletter.html     # Newsletter template
│   └── onboarding.html     # Welcome email template
│
├── logs/                   # Execution logs (gitignored)
├── storage.py              # Firebase Firestore interface
├── scheduler.py            # Master scheduler (cron entry point)
├── run_daily_batch.py      # 4 AM job (topics + news)
├── run_user_feeds.py       # 5 AM job (generate feeds)
└── run_daily_reflection.py # 11 PM job (process interactions)
```

## 🚀 Setup

### 1. Install Dependencies

```bash
cd v1
python3 -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
```

### 2. Environment Variables

Create `.env` in project root:

```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=./your-firebase-adminsdk.json

# OpenAI
OPENAI_API_KEY=sk-...

# Exa (Content Search)
EXA_API_KEY=...

# Tavily (News Search)
TAVILY_API_KEY=...

# SendGrid (Email)
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=newsletters@yourdomain.com
SENDGRID_FROM_NAME=Claudia

# PostHog (Analytics)
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com
```

### 3. Firebase Setup

1. Download Firebase Admin SDK JSON from Firebase Console
2. Place it in project root
3. Update `FIREBASE_CREDENTIALS_PATH` in `.env`

## 📊 Core Concepts

### Canonical Interest Model

**14 Fixed Interests** (no user-generated interests):

1. Technology
2. Science  
3. Psychology
4. Ideas
5. Business
6. Money
7. Design
8. Career
9. Self-development
10. Health
11. Cooking
12. Culture
13. Relationships
14. Society

Each interest has **predefined subtopics** (e.g., Technology → AI, Automation, Software).

### Content Pool Architecture

```
Firestore:
  topics/
    technology/                         # Umbrella topic (main interest)
      latest: {
        blogs: [...],                   # 10 items from Exa
        discussions: [...],             # 10 items from Exa
        videos: []
      }
      __q/                              # Query pools (subtopics)
        ai-11fb682b/                    # Query-specific pool
          latest: {
            blogs: [...],               # 10 items
            discussions: [...]          # 10 items
          }
          query_text: "AI"
        automation-d909750b/
          latest: {...}
```

**Key Design Decisions:**
- **Shared Pools**: Multiple users with same interests share pools (cost-efficient)
- **Subtopic Specificity**: Users get `interest_id` + `interest_queries` for focused content
- **4-Day Refresh**: Pools refresh every 4 days (configurable)
- **Subscribed Only**: Only fetch for subscribed users (15 users vs 120+)

### Feed Tiers

| Tier | Items/Day | Pool Access | Suggested Items | Trending News |
|------|-----------|-------------|-----------------|---------------|
| **Subscribed** | 25 | Subtopic + Umbrella | ✅ 4 items | ✅ 2-3 items |
| **Unsubscribed** | 10 | Shared pools only | ❌ | ✅ 2-3 items |

## 🔄 Daily Pipeline

### Master Command

```bash
# Run full daily pipeline
python3 v1/scheduler.py --jobs all

# Or run in groups
python3 v1/scheduler.py --jobs morning    # 4 AM - 6:30 AM
python3 v1/scheduler.py --jobs evening    # 11 PM
```

### Detailed Flow

#### **4:00 AM - Daily Batch** (`run_daily_batch.py`)

```bash
python3 v1/run_daily_batch.py
```

**What it does:**
1. **Build Topics** (`build_topics_for_all_users.py`)
   - Fetches content from Exa for subscribed users only
   - Creates umbrella topics (4 per user)
   - Creates query pools (8 subtopic pools per user)
   - **Cost**: ~$0.36 (360 Exa searches for 15 users)
   - **Cadence**: Auto-refreshes every 4 days

2. **Fetch Trending News** (`build_trending_news_for_day.py`)
   - Searches Tavily for news in 8 canonical interests
   - Creates `trending_news/{date}` collection
   - **Cost**: ~$0.06 (64 Tavily searches)
   - **Interests**: Technology, Science, Business, Money, Psychology, Ideas, Society, Health

#### **5:00 AM - User Feeds** (`run_user_feeds.py`)

```bash
python3 v1/run_user_feeds.py
```

**What it does:**
1. **Generate Subscribed Feeds** (`build_feed_from_topics_for_all_users.py`)
   - 25 items per user from subtopic-specific pools
   - Prioritizes query pools over umbrella topics
   - Tracks `seen_urls` to avoid repeats

2. **Generate Unsubscribed Feeds** (`build_unsubscribed_feeds_for_all_users.py`)
   - 10 items per user from shared pools
   - Deterministic topic selection for consistency

3. **Add Suggested Items** (`build_suggested_items_for_all_users.py`)
   - AI-selects 4 discovery items from topics user hasn't picked
   - Only for subscribed users
   - **Cost**: ~$0.05 (OpenAI GPT-4o-mini)

4. **Add Trending News** (`add_trending_news_to_all_feeds.py`)
   - Adds 2-3 relevant news items to all feeds
   - Matches news topics to user interests
   - **Cost**: $0 (uses cached news from 4 AM)

#### **6:00 AM - Newsletters** (`scheduler.py --jobs newsletters`)

```bash
python3 v1/scheduler.py --jobs newsletters
```

**What it does:**
1. **Build Newsletters** (`build_newsletters_for_all_users.py`)
   - Selects best 6-8 items using OpenAI GPT-4o-mini
   - Generates 2-sentence summaries for each item
   - Only for subscribed + opted-in users
   - **Cost**: ~$0.15 (OpenAI API)

2. **Send Newsletters** (`send_newsletter_for_user.py`)
   - Sends HTML emails via SendGrid
   - Only to users with `newsletterOptIn: true`
   - **Cost**: SendGrid pricing (free up to 100/day)

#### **11:00 PM - Reflection** (`run_daily_reflection.py`)

```bash
python3 v1/run_daily_reflection.py
```

**What it does:**
- Processes day's interactions (clicks, bookmarks, time spent)
- Updates user profiles with learned preferences
- Adjusts future content recommendations

## 📝 Flow Details

### Topics Generation

**File**: `v1/flows/build_topics_for_user.py`

```bash
# For one user
python3 v1/flows/build_topics_for_all_users.py --user-id USER_ID

# For all subscribed users
python3 v1/flows/build_topics_for_all_users.py

# Force refresh (ignore 4-day cadence)
python3 v1/flows/build_topics_for_all_users.py --min-refresh-days 0
```

**Logic:**
1. Gets user's `interest_ids` and `interest_queries`
2. For each interest:
   - Creates umbrella topic (main interest pool)
   - Creates 2 query pools (subtopic-specific)
3. Exa searches:
   - 2 searches per pool (blogs + discussions)
   - ~20 items per pool
4. Stores in Firestore:
   ```
   topics/{interest_id}/latest
   topics/{interest_id}/__q/{query_id}/latest
   ```

### Feed Generation

**Files**: 
- `v1/flows/build_feed_from_topics.py` (subscribed)
- `v1/flows/build_unsubscribed_feed_from_topics.py` (unsubscribed)

```bash
# Subscribed (25 items)
python3 v1/flows/build_feed_from_topics.py --user_id USER_ID

# Unsubscribed (10 items)
python3 v1/flows/build_unsubscribed_feed_from_topics.py --user_id USER_ID

# Regenerate today's feed
python3 v1/flows/build_feed_from_topics_for_all_users.py --force
```

**Logic:**
1. Loads user's interest pools (query pools → umbrella → fallback)
2. Selects items:
   - Prioritizes subtopic-specific content
   - Deduplicates by URL
   - Excludes `seen_urls`
3. Adds metadata:
   - `why_relevant`: "Matches your interest in X · Y"
   - `feed_category`: "topics" or "discovery"
4. Shuffles and limits to 25 (subscribed) or 10 (unsubscribed)
5. Stores in `user_feeds/{user_id}/daily/{date}`

### Newsletter Creation

**File**: `v1/flows/build_newsletter_for_user.py`

```bash
# For one user
python3 v1/flows/build_newsletter_for_user.py --user-id USER_ID

# For all opted-in users
python3 v1/flows/build_newsletters_for_all_users.py
```

**Logic:**
1. **Item Selection** (OpenAI GPT-4o-mini):
   - Loads feed items
   - AI selects 6-8 best items based on user profile
   - Falls back to rule-based selection if AI fails

2. **Content Fetching** (Exa):
   - Fetches full article content for each item
   - Truncates to 3000 chars to save tokens

3. **Summarization** (OpenAI GPT-4o-mini):
   - Generates EXACTLY 2 sentences per item
   - Engaging, insight-focused summaries
   - Batch processing for efficiency

4. **Storage**:
   - Saves to `newsletters/{user_id}/{date}`
   - Status: `draft` → ready for sending

### Trending News

**File**: `v1/flows/build_trending_news_for_day.py`

```bash
python3 v1/flows/build_trending_news_for_day.py
python3 v1/flows/build_trending_news_for_day.py --date 2026-02-06
```

**Logic:**
1. Searches Tavily for news in 8 interests:
   - Technology, Science, Business, Money
   - Psychology, Ideas, Society, Health
2. 8 results per interest (max 64 searches)
3. Stores in `trending_news/{date}/topics/{topic_id}`
4. News is added to feeds via `add_trending_news_to_all_feeds.py`

## 🛠️ Admin Scripts

### Migration Scripts

#### Migrate Interest Schema
```bash
# Migrate all users to canonical model
python3 v1/scripts/migrate_interest_schema.py

# Dry run first
python3 v1/scripts/migrate_interest_schema.py --dry-run

# Single user
python3 v1/scripts/migrate_interest_schema.py --user-id USER_ID
```

**What it does:**
- Maps old free-form interests to canonical IDs
- Creates `interest_ids`, `interests`, `legacy_interests`
- Initializes empty `interest_queries`

#### Infer Subtopics
```bash
# Infer subtopics for subscribed users using LLM
python3 v1/scripts/infer_subtopics_for_users.py

# Dry run
python3 v1/scripts/infer_subtopics_for_users.py --dry-run

# Single user
python3 v1/scripts/infer_subtopics_for_users.py --user-id USER_ID
```

**What it does:**
- Uses OpenAI to match `legacy_interests` to canonical subtopics
- Populates `interest_queries` dict
- Only for subscribed users with empty `interest_queries`

### Cleanup Scripts

#### Delete Orphaned Topics
```bash
# Find and delete topics not referenced by any user
python3 v1/scripts/delete_orphaned_topics.py

# Dry run
python3 v1/scripts/delete_orphaned_topics.py --dry-run
```

#### Clean User Interests
```bash
# Ensure all user interests are canonical
python3 v1/scripts/cleanup_user_interests.py
```

## 🔧 Development

### Testing Individual Users

```bash
# Full flow for one user
python3 v1/flows/build_topics_for_all_users.py --user-id USER_ID
python3 v1/flows/build_feed_from_topics.py --user_id USER_ID
python3 v1/flows/build_newsletter_for_user.py --user-id USER_ID
```

### Debugging

```bash
# Enable verbose logging
export LOG_LEVEL=DEBUG

# Check Firestore data
python3 -c "
from v1.storage import FirestoreStore
store = FirestoreStore()
profile = store.get_user_profile('USER_ID')
print(profile)
"
```

### Cost Analysis

```bash
# Analyze user data (topics, pools, feeds)
python3 -c "
from v1.storage import FirestoreStore
store = FirestoreStore()
# [Your analysis code]
"
```

## 📈 Performance & Scale

### Current Metrics (15 subscribed, 120 unsubscribed)
- **Topics Build**: ~2-3 min, $0.36/day
- **Feed Generation**: ~1-2 min, $0
- **Newsletter Creation**: ~3-5 min, $0.15/day
- **Total Daily Cost**: ~$0.62/day

### Scale Projections (1,000 subscribed)
- **Topics Build**: ~120 min, $24/day
- **Pool Items**: ~148,000 items stored
- **Feed Generation**: ~15 min, $0
- **Newsletter Creation**: ~30 min, $10/day
- **Total Daily Cost**: ~$34/day

### Optimization Strategies
1. **Batch Operations**: Process users in parallel
2. **Pool Sharing**: Shared pools reduce API calls
3. **Smart Refresh**: Only refresh stale pools
4. **Caching**: Cache LLM responses for similar queries

## 🚨 Troubleshooting

### Common Issues

**"No topics found"**
- Run `build_topics_for_all_users.py` first
- Check Firebase credentials
- Verify Exa API key

**"Feed already exists"**
- Use `--force` flag to regenerate
- Or delete existing feed in Firestore

**"OpenAI rate limit"**
- Reduce batch size
- Add delays between requests
- Upgrade OpenAI tier

**"Empty pools"**
- Check Exa API quota
- Verify search queries
- Check `interest_ids` mapping

## 📊 Monitoring

### Key Logs
- `v1/logs/scheduler.log` - Daily pipeline execution
- `v1/logs/errors.log` - Error tracking
- Firebase Console - Data inspection

### Metrics to Track
- Pool refresh rate
- Feed generation success rate
- Newsletter open rates
- API cost per user
- Average items per feed

## 🔐 Security

- **API Keys**: Never commit `.env` to git
- **Firebase Rules**: Restrict read/write access
- **Rate Limiting**: Implement for public endpoints
- **User Data**: GDPR-compliant data handling

## 📞 Support

For backend issues:
1. Check execution logs in `v1/logs/`
2. Verify API quotas (Exa, OpenAI, Tavily)
3. Inspect Firestore collections
4. Review error traces in Firebase Console

---

**Last Updated**: February 2026
**Maintained By**: Engineering Team

