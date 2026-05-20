export type SolutionPage = {
  slug: string;
  title: string;
  shortDescription: string;
  whoItsFor: string;
  painPoint: string;
  howTraceHelps: string;
};

export const solutionsContent: SolutionPage[] = [
  {
    slug: "info-overload",
    title: "Stop information overload",
    shortDescription: "Too many sources, same stories rehashed — cut through the noise with one daily pulse.",
    whoItsFor: "Anyone tracking 10+ blogs, newsletters, Twitter accounts, and GitHub repos who feels buried by volume.",
    painPoint: "You open 15 tabs every morning. By the time you finish scanning, 45 minutes have passed and you're not sure what actually matters. Story duplication across sources makes it worse — the same launch appears in five places with marginal differences.",
    howTraceHelps: "Trace groups identical stories across sources into one item. AI summaries capture the core facts, community signal surfaces what's worth your attention, and source links let you go deep on what matters. Your 45-minute scan becomes a 5-minute read.",
  },
  {
    slug: "duplicate-coverage",
    title: "Stop reading the same story five times",
    shortDescription: "When every newsletter covers the same launch, Trace collapses duplicates into one brief.",
    whoItsFor: "Tech readers subscribed to multiple overlapping newsletters and feeds that cover the same stories.",
    painPoint: "OpenAI launches something. You see it in Hacker News, TLDR, The Verge, and three Substack writers. Each adds marginal insight but you spend 20 minutes on one story. Multiply this by 10 stories a day and you're reading duplicates for hours.",
    howTraceHelps: "Trace's grouping engine identifies duplicate coverage and presents one unified brief with the key facts, quotes, and the best source link. Instead of reading five versions, you get one clear picture with links to go deeper.",
  },
  {
    slug: "doomscroll-fatigue",
    title: "End doomscroll fatigue",
    shortDescription: "Stop the endless scroll. Get a daily brief instead and reclaim your attention.",
    whoItsFor: "Anyone who opens Twitter, Reddit, or HN and loses 30 minutes to the scroll before realizing nothing stuck.",
    painPoint: "You open a social feed to check what's happening. An hour later you've scrolled past 200 posts, reacted to 3 things, and retained nothing actionable. The platforms are designed to keep you scrolling, not to keep you informed.",
    howTraceHelps: "Trace replaces the scroll with a structured daily brief. Stories are grouped and summarized — you see what matters, skip what doesn't, and close the tab in under 10 minutes. No algorithms trying to keep you engaged.",
  },
  {
    slug: "morning-briefing-workflow",
    title: "Build a morning briefing workflow",
    shortDescription: "Replace chaotic morning scanning with a structured briefing routine that takes 10 minutes.",
    whoItsFor: "Professionals who start their day scanning news and want a repeatable, efficient routine.",
    painPoint: "Your morning currently looks like: open 8 tabs, scan headlines, read 2 articles, realize 20 minutes passed, feel rushed, skip the rest. Some days you miss important stories. Other days you waste time on fluff.",
    howTraceHelps: "Trace gives you one morning tab. Open it, read the day's brief in 10 minutes, and you're done. The brief is structured the same way every day: top stories, community take, launches. You build a reliable habit instead of a chaotic scramble.",
  },
  {
    slug: "daily-digest-workflow",
    title: "Create a daily digest workflow",
    shortDescription: "Get a single daily digest covering everything — no more piecing together five newsletters.",
    whoItsFor: "People who subscribe to multiple newsletters and still feel like they're missing something.",
    painPoint: "You subscribe to TLDR, Morning Brew, The Hustle, and two niche newsletters. Each covers different angles. Stitching them together takes time. Some days you miss the newsletter entirely and feel out of the loop.",
    howTraceHelps: "Trace replaces the newsletter stack with one daily digest. It pulls from the same sources those newsletters curate — plus community platforms like HN and Reddit. One digest, everything covered, no FOMO.",
  },
  {
    slug: "curated-reading-stack",
    title: "Build a curated reading stack",
    shortDescription: "Follow the sources you care about without the overhead of managing an RSS reader.",
    whoItsFor: "People who tried RSS, got overwhelmed by unread counts, and gave up.",
    painPoint: "You set up an RSS reader with 30 feeds. Within a week, the unread count hits 500. You feel guilty, mark all as read, and stop checking. RSS is powerful but requires constant pruning and time investment you don't have.",
    howTraceHelps: "Trace curates for you. You pick topics and interests — it surfaces the top stories from relevant sources. No feeds to manage, no unread counts, no guilt. Just a daily brief with what matters from the sources you trust.",
  },
  {
    slug: "trend-tracking-workflow",
    title: "Track trends without Twitter addiction",
    shortDescription: "Stay on top of what's trending in tech without getting sucked into the feed.",
    whoItsFor: "People who need to know what's moving in tech but don't want to live on Twitter.",
    painPoint: "Twitter is where trends surface first — but it's also a time sink. You open it to check what's trending, get pulled into threads, arguments, and memes. An hour later, you've tracked some trends and wasted a lot of attention.",
    howTraceHelps: "Trace monitors trending topics across X, Reddit, HN, and more — then distills them into a clean brief. You see the trend, the key takes, and the signal, without the infinite scroll. Stay informed without the addiction.",
  },
  {
    slug: "ai-news-monitoring",
    title: "Monitor AI news efficiently",
    shortDescription: "Keep up with the pace of AI without drowning in it. One brief covers the day's AI landscape.",
    whoItsFor: "Anyone trying to follow AI developments across research, product launches, and policy.",
    painPoint: "AI moves faster than any tech beat before. Models drop daily, startups launch hourly, and papers pile up. Following it all means tracking 20+ sources. Most people just give up and rely on whatever drifts into their feed.",
    howTraceHelps: "Trace groups AI stories across sources and summarizes the key developments. You see the day's top model releases, research breakthroughs, funding rounds, and community takes — all in one place, prioritized by signal.",
  },
  {
    slug: "launch-tracking",
    title: "Track launches without checking Product Hunt hourly",
    shortDescription: "Know what launched today across Product Hunt, GitHub, and tech media — in one view.",
    whoItsFor: "Builders, investors, and PMs who need to know what's launching without the manual tracking.",
    painPoint: "You check Product Hunt daily, scan GitHub trending, and follow launch threads on X. Each platform shows a different slice. Stitching them together manually means you still miss things — and spend 30 minutes doing it.",
    howTraceHelps: "Trace aggregates launches from Product Hunt, GitHub, and tech media into a single launch view. You see what shipped today, who's talking about it, and why it matters. One tab, all launches, no manual stitching.",
  },
  {
    slug: "hot-takes-vs-real-signal",
    title: "Filter hot takes from real signal",
    shortDescription: "Separate the noise from the signal. Know which stories actually matter beyond the takes.",
    whoItsFor: "People tired of outrage-driven tech news who want to know what actually happened and why.",
    painPoint: "A company announces something. Within hours, your feed is full of hot takes, reaction threads, and counter-reactions. Sifting through to understand what actually happened — and what it means — takes longer than reading the original news.",
    howTraceHelps: "Trace surfaces the core story first — what happened, key facts, timeline. Then it layers on community signal: what smart people are saying, which takes have substance, and where consensus is forming. You get the full picture without the drama.",
  },
];
