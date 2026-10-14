# Show HN draft

Drafts for the owner to post. Numbers and thresholds below are read from the
code (`backend/v3/build_trending.py`, `backend/v3/enrich_coverage.py`,
`backend/vps/trace-pipeline.timer`); re-check them if those files change.

HN rewards the technical bits (how it works, what broke, real numbers) and
punishes marketing language. Post from your own account, answer every comment
for the first few hours, and don't ask anyone to upvote.

## Title (pick one, 80 characters max)

- Show HN: Trace – one card per tech story, grouped from 100+ sources
- Show HN: Trace – an open-source daily tech brief that groups stories across outlets
- Show HN: I built an open-source Techmeme with summaries and a daily email

URL: https://www.yourtrace.online (put the GitHub link in the first comment).

## Text (the box under the URL)

> Hi HN. I got tired of opening 20 tabs every morning to find out what actually
> happened in tech and AI, so I built Trace. Every 20 minutes it reads about 70
> news feeds plus Hacker News, a few dozen subreddits and blogs, groups the
> articles that are about the same event into one card, ranks the cards, and
> summarises each one with every source attached. Once a day it sends the top
> 10 as an email; you can pick topics and 5, 10 or 15 stories.
>
> The interesting part was grouping. Title-word overlap kept merging unrelated
> stories that shared a company name, so now each article gets an embedding
> (text-embedding-3-small), pairs above 0.65 cosine similarity (top 8 neighbours,
> at most 240 pairs per run) go to a small model that labels the relationship as
> same event, an update to the same story, related but different, or unrelated.
> Same-event pairs collapse into one card; updates are linked as a thread instead
> of merged. Every decision is cached, so re-runs are nearly free.
>
> Ranking puts source diversity first (four outlets beat six articles from one),
> then a five-question rubric the model scores per story: importance, novelty,
> usefulness, general interest and evidence quality. A separate "would a busy
> builder learn anything from this in an email?" check keeps out puzzle answers,
> deals posts, exec moves and other filler.
>
> It's free, AGPL-3.0, and self-hostable with Docker Compose (it needs an OpenAI
> key). There's also an MCP server so Claude, Cursor and ChatGPT can read the
> feed. I'd love feedback on the grouping and the ranking: when it gets a story
> wrong, it's usually instructive.

## First comment (yours, right after posting)

> Code: https://github.com/TarunTomar122/trace
> How it works in more detail: https://www.yourtrace.online/how-it-works
> Today's edition, no signup: https://www.yourtrace.online/brief

## Longer write-up (for a blog post or DEV.to, linked from comments if asked)

### How Trace turns 100+ feeds into ten stories

**Ingest.** A systemd timer runs the pipeline every 20 minutes on one VPS. It
pulls about 70 news and company feeds, Hacker News (front page, Show HN and
Algolia search on a few discovery topics), YouTube for the same topics, and the
role feeds (about 30 blogs and 20 subreddits). Items older than 12 hours are
dropped, and keyword filters take out promos, deal posts and off-topic news
before anything costs a model call.

**Group.** For each candidate the pipeline builds a short "state" (title, source,
summary), embeds it, and finds each item's nearest neighbours. Only pairs above
0.65 cosine similarity are judged, at most 240 per run. The judge answers one
question: is this the same concrete event, a new development in the same
ongoing story, a related but different event, or unrelated? Same-event pairs
with a confidence of 0.70 or more collapse into one card through connected
components; ongoing-story pairs become a linked thread, so "X launches" and "X
pulls the launch two days later" stay separate but connected. Results are
cached by a hash of the inputs, model and thresholds.

What didn't work: grouping by shared title words. A company name plus a common
verb was enough to merge unrelated Google stories, and every stopword patch
broke something else.

**Thicken.** For the top 10 cards with thin coverage, a search step looks for
more outlets reporting the same event and attaches up to 4, because a story
told by one source is hard to trust and hard to summarise fairly.

**Rank.** Cards sort by number of distinct sources, then article count, then a
model-scored rubric (importance 30%, novelty 20%, general interest 20%,
usefulness 15%, evidence quality 15%), then a popularity score that rewards
source diversity and recency. A separate send-worthiness score decides what may
reach the email at all.

**Summarise.** Each card gets an overview and key points written from all of its
sources, with every source linked. Summaries are cached by URL, so a story that
stays on the front page all day is summarised once.

**Deliver.** The web app is Next.js on Vercel. The store is a self-hosted SQLite
document database with a Firestore-compatible API (we moved off Firestore). The
daily email goes out from our own mail server. The same feed is available as an
MCP server, a Chrome new-tab extension and an Android app.

Fill in before posting, if you want: monthly running cost, number of readers,
and one story the grouping got wrong and how you fixed it. HN responds to all
three.
