# Reddit drafts

Drafts for the owner to post. On Reddit, views come from the size of the
subreddit, not your follower count, but most subreddits remove self-promotion.
Read each subreddit's rules first, post from an account with some karma, reply
to every comment, and never post the same text to several subreddits on the
same day.

## r/selfhosted (each open-source release)

r/selfhosted readers assume a project isn't really self-hostable or isn't fully
open source, so say both plainly, up front. Repost on each release with the
version and what's new, roughly monthly at most; don't spam.

**Title:** Trace v{VERSION}: self-hosted daily tech news brief that groups stories across 100+ sources (AGPL, Docker Compose)

**Body:**

> Trace reads tech and AI news from 100+ feeds, groups the articles about the
> same event into one card, ranks them, and writes a short summary with every
> source linked. You get a feed, a daily email you configure, and an MCP server
> for your AI assistant.
>
> It is fully open source (AGPL-3.0) and the whole stack self-hosts with one
> `docker compose up --build`: a SQLite document store, the Python pipeline and
> the Next.js web app. You need an OpenAI API key and a free Firebase project
> for sign-in.
>
> New in v{VERSION}:
> - {change 1}
> - {change 2}
>
> Repo: https://github.com/TarunTomar122/trace
> Hosted version if you just want to see it: https://www.yourtrace.online
>
> Happy to answer questions about the grouping or the setup.

## r/opensource (first post, then major releases only)

**Title:** I open-sourced Trace, the daily tech news brief I built to stop opening 20 tabs every morning

**Body:**

> Trace reads 100+ tech news sources every 20 minutes, groups articles about the
> same event into one card (embeddings to find candidates, a small model to judge
> "same event / update / different / unrelated"), ranks them and summarises each
> with all sources attached. It sends a daily email you can shape.
>
> AGPL-3.0, self-hostable with Docker Compose:
> https://github.com/TarunTomar122/trace
>
> I'd especially like contributors for new sources and for the ranking rubric.
> CONTRIBUTING.md has the setup.

## r/SideProject

**Title:** I built a daily brief that reads 100+ tech sources so I don't have to

**Body:**

> Every morning I was opening Hacker News, Techmeme, TLDR and a dozen blogs and
> still missing things. So I built Trace: it reads 100+ sources, puts every
> outlet covering the same story into one card, ranks the cards and sends me the
> top 10 with short summaries. It takes about 5 minutes to read.
>
> It's free and open source: https://www.yourtrace.online
>
> The thing I'd most like feedback on: is 10 stories the right number, and is
> anything important missing from your morning?

## AI subreddits (r/OpenAI, r/ClaudeAI, r/LocalLLaMA): only with something useful

These are less strict about self-promotion but punish low effort. Only post
when there's a genuinely useful angle, for example the MCP server:

**Title:** Gave Claude a daily tech news feed through MCP: it now briefs me every morning

**Body:**

> I run a daily tech brief (Trace) and added an MCP server, so Claude, ChatGPT
> and Cursor can pull today's grouped, ranked stories instead of searching the
> open web. Paste one URL to connect: https://www.yourtrace.online/agents
>
> Example prompt: "What happened in AI today that matters for someone building
> agents? Give me sources."
>
> Free and open source. Curious what prompts people find useful with it.
