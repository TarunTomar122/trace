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
    shortDescription: "Too many sources, same stories rehashed — cut through the noise with one daily brief.",
    whoItsFor: "Anyone tracking 10+ blogs, newsletters, Twitter accounts, and GitHub repos who feels buried by volume.",
    painPoint: "You open 15 tabs every morning. By the time you finish scanning, 45 minutes have passed and you're not sure what actually matters. Story duplication across sources makes it worse — the same launch appears in five places with marginal differences.",
    howTraceHelps: "Trace groups coverage of the same event from 100+ tech sources into one story. A short summary gives the core facts, and links to each original report let you go deeper on what matters. You pick 5, 10 or 15 stories, so the scan has an end.",
  },
  {
    slug: "duplicate-coverage",
    title: "Stop reading the same story five times",
    shortDescription: "When every newsletter covers the same launch, Trace collapses duplicates into one brief.",
    whoItsFor: "Tech readers subscribed to multiple overlapping newsletters and feeds that cover the same stories.",
    painPoint: "OpenAI launches something. You see it in a newsletter, The Verge, and three other outlets. Each adds a little, but you spend 20 minutes on one story. Multiply this by 10 stories a day and you're reading duplicates for hours.",
    howTraceHelps: "Trace groups coverage of the same event into one story with a short summary and links to each original report. Instead of reading five versions, you read one summary and open the originals you care about.",
  },
  {
    slug: "doomscroll-fatigue",
    title: "End doomscroll fatigue",
    shortDescription: "Stop the endless scroll. Get a daily brief instead and reclaim your attention.",
    whoItsFor: "Anyone who opens a social feed for the news and loses 30 minutes to the scroll before realizing nothing stuck.",
    painPoint: "You open a social feed to check what's happening. An hour later you've scrolled past 200 posts, reacted to 3 things, and retained nothing actionable. The platforms are designed to keep you scrolling, not to keep you informed.",
    howTraceHelps: "Trace replaces the scroll with a structured daily brief. Stories are grouped and summarized — you see what matters, skip what doesn't, and close the tab in under 10 minutes. No algorithms trying to keep you engaged.",
  },
  {
    slug: "morning-briefing-workflow",
    title: "Build a morning briefing workflow",
    shortDescription: "Replace chaotic morning scanning with a structured briefing routine that takes 10 minutes.",
    whoItsFor: "Professionals who start their day scanning news and want a repeatable, efficient routine.",
    painPoint: "Your morning currently looks like: open 8 tabs, scan headlines, read 2 articles, realize 20 minutes passed, feel rushed, skip the rest. Some days you miss important stories. Other days you waste time on fluff.",
    howTraceHelps: "Trace gives you one morning tab, or an email at 08:30 UK time. Open it, read the 5, 10 or 15 stories you chose, and you're done. Each story has the same shape every day: a short summary and links to the original reports. You build a reliable habit instead of a chaotic scramble.",
  },
  {
    slug: "daily-digest-workflow",
    title: "Create a daily digest workflow",
    shortDescription: "Get one daily tech brief instead of piecing together five newsletters.",
    whoItsFor: "People who subscribe to multiple newsletters and still feel like they're missing something.",
    painPoint: "You subscribe to TLDR, Morning Brew, The Hustle, and two niche newsletters. Each covers different angles. Stitching them together takes time. Some days you miss the newsletter entirely and feel out of the loop.",
    howTraceHelps: "Trace can replace part of the newsletter stack with one daily brief. It reads 100+ tech sources, many of them the outlets those newsletters link to, and groups each event into one story. Keep the newsletters you read for their voice.",
  },
  {
    slug: "curated-reading-stack",
    title: "Build a curated reading stack",
    shortDescription: "Keep up with tech news without the overhead of managing an RSS reader.",
    whoItsFor: "People who tried RSS, got overwhelmed by unread counts, and gave up.",
    painPoint: "You set up an RSS reader with 30 feeds. Within a week, the unread count hits 500. You feel guilty, mark all as read, and stop checking. RSS is powerful but requires constant pruning and time investment you don't have.",
    howTraceHelps: "Trace reads its own set of 100+ tech sources. You pick topics and a length, and it orders the day's stories around them. No feeds to manage and no unread counts. It does not follow your own feeds, so keep an RSS reader for the niche sources you must see.",
  },
  {
    slug: "trend-tracking-workflow",
    title: "Track trends without Twitter addiction",
    shortDescription: "Stay on top of what's trending in tech without getting sucked into the feed.",
    whoItsFor: "People who need to know what's moving in tech but don't want to live on Twitter.",
    painPoint: "Twitter is where trends surface first — but it's also a time sink. You open it to check what's trending, get pulled into threads, arguments, and memes. An hour later, you've tracked some trends and wasted a lot of attention.",
    howTraceHelps: "Trace reads 100+ tech sources and puts the day's biggest stories in one short brief, each with a summary and links to the original reports. Pulse adds trending GitHub repos and the day's top links from Hacker News and Lobsters. You see what is moving without the infinite scroll.",
  },
  {
    slug: "ai-news-monitoring",
    title: "Monitor AI news efficiently",
    shortDescription: "Keep up with the pace of AI without drowning in it. One brief covers the day's AI landscape.",
    whoItsFor: "Anyone trying to follow AI developments across research, product launches, and policy.",
    painPoint: "AI moves faster than any tech beat before. Models drop daily, startups launch hourly, and papers pile up. Following it all means tracking 20+ sources. Most people just give up and rely on whatever drifts into their feed.",
    howTraceHelps: "Trace groups AI stories across sources and summarizes each one. You see the day's model releases, funding rounds and policy news in one place, with links to each original report.",
  },
  {
    slug: "launch-tracking",
    title: "Track launches without checking five sites",
    shortDescription: "See the day's launches from tech media, plus trending GitHub repos, in one place.",
    whoItsFor: "Builders, investors, and PMs who need to know what's launching without the manual tracking.",
    painPoint: "You check Product Hunt daily, scan GitHub trending, and follow launch threads on X. Each platform shows a different slice. Stitching them together manually means you still miss things — and spend 30 minutes doing it.",
    howTraceHelps: "Launches that tech media cover show up in the brief as one story each, with links to the reports. Pulse lists trending GitHub repos with star counts and the day's top links from Hacker News and Lobsters, including Show HN.",
  },
  {
    slug: "hot-takes-vs-real-signal",
    title: "Filter hot takes from real signal",
    shortDescription: "Separate the noise from the signal. Know which stories actually matter beyond the takes.",
    whoItsFor: "People tired of outrage-driven tech news who want to know what actually happened and why.",
    painPoint: "A company announces something. Within hours, your feed is full of hot takes, reaction threads, and counter-reactions. Sifting through to understand what actually happened — and what it means — takes longer than reading the original news.",
    howTraceHelps: "Trace starts with what happened: a short summary of the key facts, written from the reports that covered it, with a link to each one. You get the facts first and decide which originals to read.",
  },
];
