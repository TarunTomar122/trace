# Daily Story AI - Experiment

## Concept
Use user profile data from onboarding to generate personalized daily stories using OpenAI's API with web search capabilities.

## User Profile Data We Have
From the onboarding flow, we collect:
- **Role**: designer, developer, pm, marketer, founder, other
- **Seniority**: early (0-3y), mid (3-7y), senior (7-12y), executive (12+y)
- **Interests**: 3-5 topics (AI, Design & UX, Product Strategy, Startups, Leadership, etc.)
- **Career Goals**: get-promoted, switch-careers, build-something, lead-team, stay-sharp, grow-network
- **Summary Style**: executive, practitioner, casual

## Example User Profile
```json
{
  "role": "designer",
  "seniority": "mid",
  "interests": ["experience", "technology", "startups"],
  "careerGoals": ["get-promoted"],
  "summaryStyle": "practitioner"
}
```

## Goal
Generate a personalized daily story that:
1. Searches the web for latest relevant content (AI in UX design, new tools, success stories)
2. Crafts a narrative tailored to the user's profile
3. Provides actionable insights and inspiration

## Example Output
"Hey there! 👋

This morning, I came across something perfect for you. Figma just released a new AI-powered auto-layout feature that's getting UX designers promoted at top startups.

Here's the story: Sarah Chen, a mid-level designer at a Y-Combinator startup, used this exact feature to redesign their onboarding flow. She cut design time by 60% and increased user activation by 23%. Her team promoted her to Lead Designer within 3 months.

The tool works by analyzing your existing designs and suggesting optimal layouts based on thousands of high-converting patterns. What makes it special? It learns from your design system, so suggestions feel native to your brand.

**How you can use this:**
1. Start with your most-visited screens
2. Let the AI suggest 3-5 layout variations
3. A/B test them with real users
4. Document the wins in your portfolio

The beta is live now, and early adopters are seeing 2-3x faster iteration cycles.

Want to dive deeper? I found a detailed walkthrough from Nielsen Norman Group that breaks down the UX principles behind why this works..."
```

## Technical Approach
- Use OpenAI API with `gpt-4o` or `gpt-4o-mini` for story generation
- Web search options:
  - **Perplexity API** (recommended): Real-time search with citations
  - **Exa API**: Neural search for high-quality content
  - **None**: Falls back to OpenAI's training data (cheaper, faster)
- Generate stories daily based on user profile
- Store generated stories in Firestore for history

## Features Implemented

✅ **Core Story Generator** (`story_generator.py`)
- Profile-based context building
- Dynamic search query generation
- Web search integration (Perplexity/Exa)
- OpenAI story generation with customizable prompts
- Multiple sample profiles for testing

✅ **Firebase Integration** (`firebase_integration.py`)
- Read user profiles from Firestore
- Generate stories for specific users or all users
- Save stories back to Firestore
- Batch processing with rate limiting

✅ **Quick Test** (`quick_test.py`)
- Test without Firebase setup
- No web search needed (uses OpenAI only)
- Interactive profile selection
- Instant feedback

## Quick Start

```bash
# 1. Install dependencies
cd experiments/daily-story-ai
pip install -r requirements.txt

# 2. Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# 3. Run quick test
python quick_test.py
```

See [USAGE.md](./USAGE.md) for detailed instructions.

## What Makes This Interesting?

1. **Personalized at Scale**: Each story is unique to the user's profile
2. **Real-time Data**: Web search brings in latest trends and news
3. **Actionable Content**: Not just news, but practical advice and success stories
4. **Engaging Format**: Conversational tone that motivates action
5. **Career-focused**: Tied to user's goals (promotion, building, learning)

## Potential Use Cases

1. **Daily Digest Feature**: Replace or complement the newsletter
2. **Push Notifications**: Send personalized story as a notification
3. **In-app Feed**: Display as a special "Daily Story" card
4. **Email Campaigns**: Send weekly collection of stories
5. **Premium Feature**: Offer as part of paid tier
