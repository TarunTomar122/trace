# Daily Story AI - Usage Guide

## Quick Start

### 1. Install Dependencies

```bash
cd experiments/daily-story-ai
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Edit `.env`:
```
OPENAI_API_KEY=sk-...  # Required
PERPLEXITY_API_KEY=pplx-...  # Optional, for web search
EXA_API_KEY=...  # Optional, alternative web search
```

### 3. Run Quick Test (No Firebase, No Web Search)

This is the fastest way to see it in action:

```bash
python quick_test.py
```

This will:
- Let you choose a sample profile
- Generate a story using OpenAI (no web search needed)
- Save output to `output/` folder

## Advanced Usage

### Generate Story with Web Search

Using Perplexity API (recommended):

```bash
python story_generator.py
```

This will:
- Use sample profiles
- Search the web for latest information
- Generate personalized stories with real-time data
- Save to `output/` folder

### Firebase Integration

Generate stories for real users from Firestore:

#### For a specific user:
```bash
python firebase_integration.py --user-id <USER_ID>
```

#### For all users:
```bash
python firebase_integration.py --all --limit 10
```

#### Without saving to Firestore (local only):
```bash
python firebase_integration.py --user-id <USER_ID> --no-save
```

#### With web search:
```bash
python firebase_integration.py --user-id <USER_ID> --search perplexity
```

## Web Search Options

### 1. Perplexity API (Recommended)
- Real-time web search with citations
- Best for latest news and trends
- Sign up: https://www.perplexity.ai/settings/api

```bash
export PERPLEXITY_API_KEY="pplx-..."
python story_generator.py
```

### 2. Exa API
- Neural search engine
- Great for finding high-quality articles
- Sign up: https://exa.ai

```bash
export EXA_API_KEY="..."
python firebase_integration.py --search exa
```

### 3. No Web Search
- Falls back to OpenAI's knowledge (up to Jan 2025)
- Faster and cheaper
- Good for testing

```bash
python firebase_integration.py --search none
```

## Example Output

For a UX Designer profile:
- Role: Designer (mid-level, 3-7 years)
- Interests: UX Design, AI, Startups
- Goal: Get promoted

Generated story might include:
1. Latest AI tool for UX (e.g., Figma's new feature)
2. Success story of someone who got promoted
3. Actionable steps to implement
4. Resources to learn more

## Files Structure

```
daily-story-ai/
├── README.md              # Overview and concept
├── USAGE.md              # This file
├── requirements.txt      # Python dependencies
├── .env.example          # Environment template
├── story_generator.py    # Core story generation logic
├── firebase_integration.py  # Read profiles from Firestore
├── quick_test.py         # Quick test without Firebase
└── output/               # Generated stories
```

## Firestore Schema

### Input: User Profile
```
user_profiles/{uid}
{
  "name": "Alex Chen",
  "role": "designer",
  "seniority": "mid",
  "interests": ["experience", "technology", "startups"],
  "careerGoals": ["get-promoted"],
  "summaryStyle": "practitioner"
}
```

### Output: Daily Story
```
user_daily_stories/{uid}/stories/{date}
{
  "story": "Generated story text...",
  "generated_at": "2026-02-25T10:00:00Z",
  "profile_snapshot": {
    "role": "designer",
    "seniority": "mid",
    "interests": [...],
    "careerGoals": [...]
  },
  "metadata": {
    "version": "v1",
    "source": "daily-story-ai-experiment"
  }
}
```

## API Costs (Estimates)

### OpenAI
- Model: `gpt-4o-mini` (recommended for testing)
- Cost: ~$0.0001 per story
- Model: `gpt-4o` (better quality)
- Cost: ~$0.001-0.002 per story

### Perplexity
- Model: `llama-3.1-sonar-large-128k-online`
- Cost: ~$0.001-0.003 per search query
- ~3 queries per story = ~$0.003-0.009 per story

### Total per user per day
- With web search: ~$0.01 per user
- Without web search: ~$0.0001 per user

For 1000 users:
- With search: ~$10/day = ~$300/month
- Without search: ~$0.10/day = ~$3/month

## Next Steps

1. **Test locally**: Run `quick_test.py` to see output quality
2. **Try web search**: Add Perplexity API key and test with real-time data
3. **Test with real users**: Use Firebase integration with a few test users
4. **Evaluate quality**: Review generated stories, adjust prompts
5. **Schedule**: Set up cron job or cloud function to generate daily
6. **Deliver**: Add API endpoint or email/push notification

## Scheduling (Production)

### Option 1: Cloud Function (Firebase)
```javascript
exports.generateDailyStories = functions.pubsub
  .schedule('0 6 * * *')  // 6 AM daily
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    // Call Python script or reimplement in Node.js
  });
```

### Option 2: GitHub Actions
```yaml
name: Generate Daily Stories
on:
  schedule:
    - cron: '0 6 * * *'  # 6 AM UTC
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Generate stories
        run: |
          cd experiments/daily-story-ai
          pip install -r requirements.txt
          python firebase_integration.py --all
```

### Option 3: Cron (on server)
```bash
crontab -e

# Add:
0 6 * * * cd /path/to/claudia/experiments/daily-story-ai && python firebase_integration.py --all --limit 100
```

## Troubleshooting

### "OPENAI_API_KEY not found"
Make sure `.env` file exists and contains your API key:
```bash
export OPENAI_API_KEY="sk-..."
```

### "Firebase credentials not found"
Set the path to your service account JSON:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

Or place `service-account.json` in the repo root.

### Stories feel generic
Try:
1. Use `gpt-4o` instead of `gpt-4o-mini`
2. Enable web search (Perplexity or Exa)
3. Adjust the prompt in `story_generator.py` line ~200

### Web search not working
- Check API key is correct
- Verify API credits/quota
- Check network connection
- Try alternative search method (Exa vs Perplexity)

## FAQ

**Q: Can I use this in production?**
A: Yes, but test thoroughly first. Consider rate limits, costs, and quality.

**Q: How do I customize the story format?**
A: Edit the `system_prompt` in `story_generator.py` around line 200.

**Q: Can I add more data sources?**
A: Yes! Add more search queries in `generate_search_queries()` or integrate additional APIs.

**Q: How do I send stories to users?**
A: You can:
- Save to Firestore and display in the app
- Send via email (SendGrid, AWS SES)
- Send push notifications (Firebase FCM)
- Post to Slack/Discord

**Q: What if OpenAI is down?**
A: Add fallback logic or use alternative LLMs (Anthropic Claude, Google Gemini).
