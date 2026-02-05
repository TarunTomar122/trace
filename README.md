# Claudia - AI-Powered Content Discovery Platform

Claudia is an intelligent content curation platform that delivers personalized daily feeds, newsletters, and insights based on user interests, skills, and goals.

## 🏗️ Architecture Overview

```
claudia/
├── frontend/          # Next.js web application
├── trace/            # React Native mobile app
├── v1/               # Python backend (feeds, newsletters, AI agents)
├── analysis/         # User analytics and reporting
└── README.md         # This file
```

## 📚 Documentation

Each component has its own detailed README:

- **[Frontend (Web App)](./frontend/README.md)** - Next.js application with onboarding, feed, and profile management
- **[Trace (Mobile App)](./trace/README.md)** - React Native iOS/Android application
- **[V1 Backend](./v1/README.md)** - Python flows for content fetching, feed generation, and newsletters
- **[Analysis](./analysis/README.md)** - User behavior analysis and audience insights

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend/mobile)
- **Python** 3.11+ (for backend)
- **Firebase** project with Firestore
- **API Keys**: OpenAI, Exa, Tavily, SendGrid, PostHog

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd claudia
```

### 2. Backend Setup

```bash
cd v1
python3 -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt

# Copy and configure .env
cp .env.example .env
# Add your API keys to .env
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Copy and configure .env
cp env.template .env.local
# Add your Firebase config and API keys
```

### 4. Run Development

```bash
# Backend (daily pipeline)
python3 v1/scheduler.py --jobs morning

# Frontend (web)
cd frontend && npm run dev

# Mobile (iOS)
cd trace && npx expo start
```

## 🔑 Required API Keys

| Service | Purpose | Where to Get |
|---------|---------|--------------|
| **Firebase** | Database, Auth | [console.firebase.google.com](https://console.firebase.google.com) |
| **OpenAI** | AI summaries, selections | [platform.openai.com](https://platform.openai.com) |
| **Exa** | Content search | [exa.ai](https://exa.ai) |
| **Tavily** | News search | [tavily.com](https://tavily.com) |
| **SendGrid** | Email newsletters | [sendgrid.com](https://sendgrid.com) |
| **PostHog** | Analytics | [posthog.com](https://posthog.com) |

## 📊 System Flow

### Daily Pipeline (Automated)

```
4:00 AM  → Build Topics (Exa search for 14 canonical interests)
         → Fetch Trending News (8 news-heavy interests)
         
5:00 AM  → Generate Feeds (25 items subscribed, 10 items unsubscribed)
         → Add Suggested Items (4 discovery items for subscribed)
         → Add Trending News (2-3 news items to all feeds)
         
6:00 AM  → Build Newsletters (AI-selected items, 2-sentence summaries)
         → Send Newsletters (via SendGrid to opted-in users)
         
11:00 PM → Run Daily Reflection (process user interactions)
```

### User Onboarding Flow

```
1. Select 4 Interests (from 14 canonical options)
2. Choose Subtopics (2 per interest, optional)
3. Add Skills (optional, for content personalization)
4. Generate Initial Feed (uses subtopic-specific content)
```

### Content Architecture

```
Firestore:
  topics/
    {interest_id}/                    # Umbrella topic pool
      __q/
        {query_id}/                   # Subtopic-specific pool
          latest: {blogs, discussions, videos}
  
  user_feeds/
    {user_id}/
      daily/
        {date}/                       # Daily feed (25 or 10 items)
          items: [...]
  
  newsletters/
    {user_id}/
      {date}/                         # Newsletter draft
        items: [...]                  # AI-selected + summarized
```

## 🎯 Key Features

### For Users
- **Personalized Feeds**: 25 items/day (subscribed) or 10 items/day (unsubscribed)
- **Smart Discovery**: AI suggests 4 new topics based on profile
- **Trending News**: Relevant news from 8 canonical interests
- **Daily Newsletters**: Best 6-8 items with AI summaries
- **Progress Tracking**: See items read, interests explored

### For Admins
- **Canonical Interest Model**: 14 fixed interests with subtopics
- **Scalable Content Pools**: Shared pools across users
- **Cost Optimization**: Fetch only for subscribed users
- **Flexible Scheduling**: Run jobs individually or in groups

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Firebase SDK** for auth & data

### Mobile
- **React Native** (Expo)
- **TypeScript**
- **Firebase** for auth & data

### Backend
- **Python 3.11+**
- **Firebase Admin SDK**
- **OpenAI API** (GPT-4o-mini)
- **Exa API** (content search)
- **Tavily API** (news search)

## 📖 Development Guides

### Adding a New Interest

1. Update `v1/algorithm/interest_schema.py`:
   ```python
   CANONICAL_INTERESTS.append({
       "id": "new-interest",
       "label": "New Interest"
   })
   ```

2. Add subtopics to `SUBTOPIC_LABELS`

3. Add to trending news (if news-relevant):
   ```python
   # v1/flows/build_trending_news_for_day.py
   TRENDING_TOPICS.append({...})
   ```

4. Update frontend options:
   ```typescript
   // frontend/app/onboarding/page.tsx
   const INTERESTS = [...]
   ```

### Running Migrations

```bash
# Migrate all users to new schema
python3 v1/scripts/migrate_interest_schema.py

# Infer subtopics for subscribed users
python3 v1/scripts/infer_subtopics_for_users.py

# Clean up orphaned topics
python3 v1/scripts/delete_orphaned_topics.py
```

### Testing Individual Flows

```bash
# Test for one user
python3 v1/flows/build_topics_for_all_users.py --user-id USER_ID
python3 v1/flows/build_feed_from_topics.py --user_id USER_ID
python3 v1/flows/build_newsletter_for_user.py --user-id USER_ID

# Force refresh (ignore caching)
python3 v1/flows/build_topics_for_all_users.py --min-refresh-days 0
python3 v1/flows/build_feed_from_topics_for_all_users.py --force
```

## 📈 Monitoring & Analytics

### Key Metrics
- **Daily Active Users** (PostHog)
- **Feed Engagement** (items clicked, time spent)
- **Newsletter Open Rates** (SendGrid)
- **Subscription Conversion** (free → paid)

### Cost Tracking
- **Exa API**: ~$0.36/day (360 searches for 15 subscribed users)
- **OpenAI API**: ~$0.20/day (summaries + selections)
- **Tavily API**: ~$0.06/day (64 news searches)
- **Total**: ~$0.62/day for 15 subscribed + 120 unsubscribed users

## 🤝 Contributing

Each component has its own development workflow. See component-specific READMEs for details:

- [Frontend Contributing Guide](./frontend/README.md#development)
- [Backend Contributing Guide](./v1/README.md#development)

## 📄 License

[Your License Here]

## 🆘 Support

For issues or questions:
1. Check component-specific README
2. Review error logs in `v1/logs/`
3. Check Firebase console for data issues
4. Review API usage in respective dashboards

---

**Last Updated**: February 2026
**Version**: 1.0.0
