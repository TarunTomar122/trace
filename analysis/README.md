# Analysis - User & Audience Analytics

Data analysis tools for understanding user behavior, content performance, and audience insights for Claudia.

## 🎯 Purpose

- Analyze user interests and engagement patterns
- Generate audience reports for content strategy
- Track feature adoption and user journeys
- Inform product decisions with data

## 📁 Contents

```
analysis/
├── user_analysis.ipynb       # Jupyter notebook for user analysis
├── audience_analysis.py       # Audience segmentation script
├── audience_report.md         # Generated audience insights
├── interest_plan.md           # Interest taxonomy design doc
│
└── data/                      # Cached analysis data
    ├── user_profiles.json     # User profile snapshots
    ├── user_summary.csv       # Aggregated user stats
    ├── topics.json            # Topic distribution
    ├── umbrella_map.json      # Interest mappings
    └── umbrella_counts.csv    # Interest frequency
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Jupyter Notebook or JupyterLab
- Firebase access (for user data)
- Pandas, matplotlib for analysis

### 1. Install Dependencies

```bash
# From project root
pip install -r requirements.txt
pip install jupyter pandas matplotlib seaborn
```

### 2. Environment Setup

Use the same `.env` as backend (v1):

```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=./your-firebase-adminsdk.json
```

### 3. Run Analysis

```bash
# Start Jupyter
cd analysis
jupyter notebook

# Open user_analysis.ipynb
# Or run Python scripts:
python audience_analysis.py
```

## 📊 Key Analyses

### User Analysis (`user_analysis.ipynb`)

**What it does:**
- Loads all user profiles from Firestore
- Analyzes interest distribution
- Identifies popular topics
- Tracks subscription rates
- Generates visualizations

**Key Metrics:**
- Total users (onboarded vs not)
- Interest distribution (which are most popular)
- Subscription status (trial, active, churned)
- Skills distribution
- Newsletter opt-in rate

**Outputs:**
- `data/user_profiles.json` - Raw user data
- `data/user_summary.csv` - Aggregated stats
- Charts: Interest distribution, subscription funnel

### Audience Analysis (`audience_analysis.py`)

**What it does:**
- Segments users by interests
- Maps interests to umbrella categories
- Generates audience personas
- Exports reports for content strategy

**Usage:**
```bash
python audience_analysis.py
```

**Outputs:**
- `audience_report.md` - Detailed audience breakdown
- `data/umbrella_counts.csv` - Interest frequency
- `data/umbrella_map.json` - Interest → Category mapping

**Example Output:**
```
Audience Segments:
- Tech Enthusiasts: 45% (technology, design, career)
- Knowledge Seekers: 30% (science, psychology, ideas)
- Business Professionals: 25% (business, money, career)
```

### Interest Planning (`interest_plan.md`)

**What it contains:**
- 14 canonical interests taxonomy
- Subtopic definitions per interest
- User profile schema design
- Migration strategy from old to new schema

**Purpose:**
- Reference doc for interest model
- Design rationale for canonical approach
- Implementation guide for backend

## 📈 Common Analysis Tasks

### Analyze Interest Distribution

```python
import pandas as pd
from v1.storage import FirestoreStore

store = FirestoreStore()
profiles = store.get_all_user_profiles()

# Count interest frequency
interest_counts = {}
for profile in profiles:
    for interest_id in profile.get('interest_ids', []):
        interest_counts[interest_id] = interest_counts.get(interest_id, 0) + 1

df = pd.DataFrame(interest_counts.items(), columns=['Interest', 'Count'])
df.sort_values('Count', ascending=False, inplace=True)
print(df)
```

### Track Subscription Conversion

```python
onboarded = [p for p in profiles if p.get('onboarded')]
subscribed = [p for p in onboarded if p.get('subscriptionStatus') in ['trial', 'active']]

conversion_rate = len(subscribed) / len(onboarded) * 100
print(f"Conversion rate: {conversion_rate:.1f}%")
```

### Analyze Feed Engagement

```python
from datetime import datetime, timezone

today = datetime.now(timezone.utc).date().isoformat()

for profile in subscribed_users:
    user_id = profile['uid']
    feed_ref = store.db.collection('user_feeds').document(user_id).collection('daily').document(today).get()
    
    if feed_ref.exists:
        data = feed_ref.to_dict()
        items = data.get('items', [])
        seen_ids = data.get('seen_item_ids', [])
        
        engagement_rate = len(seen_ids) / len(items) * 100 if items else 0
        print(f"{user_id}: {engagement_rate:.1f}% engagement ({len(seen_ids)}/{len(items)} items)")
```

### Newsletter Performance

```python
# Newsletter open rates (requires SendGrid webhook integration)
newsletters = store.db.collection('newsletters').where('date', '==', today).stream()

opened = 0
sent = 0

for nl in newsletters:
    data = nl.to_dict()
    sent += 1
    if data.get('email_opened'):
        opened += 1

open_rate = opened / sent * 100 if sent else 0
print(f"Newsletter open rate: {open_rate:.1f}% ({opened}/{sent})")
```

## 📊 Visualization Examples

### Interest Distribution (Bar Chart)

```python
import matplotlib.pyplot as plt

interests = df['Interest'].tolist()
counts = df['Count'].tolist()

plt.figure(figsize=(12, 6))
plt.bar(interests, counts, color='#7C3AED')
plt.xlabel('Interest')
plt.ylabel('Number of Users')
plt.title('Interest Distribution')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()
```

### Subscription Funnel

```python
import matplotlib.pyplot as plt

stages = ['Total Users', 'Onboarded', 'Trial', 'Active']
counts = [len(all_users), len(onboarded), len(trial), len(active)]

plt.figure(figsize=(10, 6))
plt.plot(stages, counts, marker='o', linewidth=2, markersize=10)
plt.xlabel('Stage')
plt.ylabel('Users')
plt.title('Subscription Funnel')
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()
```

## 🔍 Insights & Reporting

### Monthly Report Template

```markdown
# Monthly User Report - [Month Year]

## Overview
- Total Users: X
- New Users: +Y
- Active Users (30d): Z
- Subscription Rate: A%

## Popular Interests
1. Technology - 45%
2. Business - 30%
3. Science - 25%

## Engagement Metrics
- Avg items read per user: X
- Newsletter open rate: Y%
- Bookmark rate: Z%

## Insights
- [Key finding 1]
- [Key finding 2]
- [Recommendation]
```

### Cohort Analysis

Track user behavior by signup date:

```python
# Group users by signup month
cohorts = {}
for profile in profiles:
    created = profile.get('createdAt', '')
    month = created[:7]  # YYYY-MM
    
    if month not in cohorts:
        cohorts[month] = []
    cohorts[month].append(profile)

# Analyze retention per cohort
for month, users in cohorts.items():
    subscribed = [u for u in users if u.get('subscriptionStatus') in ['trial', 'active']]
    retention = len(subscribed) / len(users) * 100
    print(f"{month}: {len(users)} users, {retention:.1f}% subscribed")
```

## 🛠️ Tools & Libraries

### Core Libraries

```python
import pandas as pd              # Data manipulation
import matplotlib.pyplot as plt  # Visualization
import seaborn as sns           # Statistical plots
from v1.storage import FirestoreStore  # Firebase access
```

### Optional Libraries

```python
import numpy as np              # Numerical operations
from sklearn.cluster import KMeans  # User clustering
import plotly.express as px     # Interactive charts
```

## 📦 Exporting Data

### CSV Export

```python
df.to_csv('data/user_summary.csv', index=False)
```

### JSON Export

```python
import json

with open('data/user_profiles.json', 'w') as f:
    json.dump(profiles, f, indent=2, default=str)
```

### Excel Export (requires openpyxl)

```python
df.to_excel('data/user_report.xlsx', index=False)
```

## 🔒 Privacy & Security

- **Data Access**: Limit to authorized team members only
- **PII Handling**: Anonymize user data in reports
- **Data Retention**: Delete cached data after analysis
- **Compliance**: Follow GDPR/CCPA guidelines

```python
# Anonymize user data
def anonymize_profile(profile):
    anon = profile.copy()
    anon['uid'] = hash(anon['uid'])  # Hash user ID
    anon.pop('email', None)          # Remove email
    anon.pop('name', None)           # Remove name
    return anon

anon_profiles = [anonymize_profile(p) for p in profiles]
```

## 📞 Support

For analysis questions:
1. Review existing notebooks for examples
2. Check Firebase console for data structure
3. Consult `v1/storage.py` for data access methods
4. Review PostHog dashboards for real-time metrics

---

**Tools**: Jupyter Notebook, Pandas, Matplotlib, Firebase
**Purpose**: Product analytics, user insights, content strategy
**Last Updated**: February 2026

