export type UseCasePage = {
  slug: string;
  title: string;
  shortDescription: string;
  whyItMatters: string;
  dailyRoutine: string;
  keyFeatures: string[];
};

export const useCasesContent: UseCasePage[] = [
  {
    slug: "for-founders",
    title: "Trace for Founders",
    shortDescription: "See what happened in tech and AI overnight, in one short brief, before standup.",
    whyItMatters: "Founders need to know when a competitor ships, a platform changes its terms or a new model lands, but can't spend two hours reading every morning. Most of that news is covered by many outlets at once, so reading it source by source repeats the same story.",
    dailyRoutine: "Open Trace or the 08:30 UK email. Read the 5, 10 or 15 stories you chose, each with a short summary. Open the original reports for the one or two that touch your market. Then close it.",
    keyFeatures: ["One story per event, grouped from 100+ tech sources", "Topics you pick move to the front", "Links to each original report under the summary", "Optional daily email at 08:30 UK time"],
  },
  {
    slug: "for-pms",
    title: "Trace for Product Managers",
    shortDescription: "Keep up with product launches and industry news without 15 open tabs.",
    whyItMatters: "PMs need wide awareness of launches, platform changes and AI tools that might change their roadmap. The surface area is large, and the same launch shows up in many places.",
    dailyRoutine: "Morning: scan the brief for launches and industry moves. Open the original reports for the two or three that matter and share those links with design and engineering.",
    keyFeatures: ["One story per launch, however many outlets cover it", "Topics for your product area", "A brief of 5, 10 or 15 stories that ends", "Archive of past briefs at /brief"],
  },
  {
    slug: "for-developers",
    title: "Trace for Developers",
    shortDescription: "Keep up with releases, language updates and AI tools without the noise.",
    whyItMatters: "The developer ecosystem moves fast: new frameworks, releases, model launches and tooling changes. Following it all means checking many blogs and sites, and most devs hear about things late.",
    dailyRoutine: "Quick morning scan of the brief. Check Pulse for trending GitHub repos and the day's top links from Hacker News and Lobsters. Read more on the one or two items that affect your stack.",
    keyFeatures: ["Tech and AI news grouped into one story per event", "Trending GitHub repos with star counts in Pulse", "Top articles: the day's best links from Hacker News and Lobsters", "Read-only access for your AI assistant through MCP (/agents)"],
  },
  {
    slug: "for-designers",
    title: "Trace for Designers",
    shortDescription: "Follow design tool news, AI tools and product launches in one short brief.",
    whyItMatters: "Design tools are changing quickly, especially with AI. Following tool updates and launches across scattered sources means most designers rely on whatever crosses their social feed.",
    dailyRoutine: "Morning coffee scan of the stories in your topics, plus the design links in Top articles. Open the original reports for anything worth sharing with your team.",
    keyFeatures: ["A Design topic you can pick", "Design links in the Top articles tab", "One story per launch, with links to each report", "A brief that ends, instead of a feed"],
  },
  {
    slug: "for-marketers",
    title: "Trace for Marketers",
    shortDescription: "Keep up with the tech and AI news that changes your tools and channels.",
    whyItMatters: "Marketers depend on platforms and AI tools that change often. Following that news across many sites takes time, and general news apps mix it with everything else.",
    dailyRoutine: "Morning: scan the brief for platform and AI tool news in your topics. Note two or three items for the weekly team sync and keep the source links.",
    keyFeatures: ["Tech and AI news grouped into one story per event", "Topics you pick move to the front", "Links to each original report", "Optional daily email at 08:30 UK time"],
  },
  {
    slug: "for-investors",
    title: "Trace for Investors",
    shortDescription: "A short daily read on what happened in tech and AI, with links to every report.",
    whyItMatters: "Investors read across many newsletters and sites to stay current on tech. Much of it repeats the same few stories, which makes it slow to see what actually changed.",
    dailyRoutine: "Morning: read the brief, then open the original reports on the stories that touch your sectors. Revisit past days in the archive when you need context.",
    keyFeatures: ["One story per event, grouped from 100+ tech sources", "Topics such as AI, Startups, Markets and Robotics", "Archive of past briefs at /brief", "Free and open source"],
  },
  {
    slug: "for-students",
    title: "Trace for Students",
    shortDescription: "Keep up with tech while studying — one brief instead of 20 browser tabs.",
    whyItMatters: "Students in CS, design or business want to stay current with the industry alongside coursework. Following dozens of accounts and hoping the important news turns up doesn't work during exams.",
    dailyRoutine: "Open Trace during your morning routine and read the five-story brief. Note one or two items to bring up in class or use in a project.",
    keyFeatures: ["A five-story option for short days", "Summaries with links to the original reports", "A Chrome extension for the new tab page", "Free, with no paid tiers"],
  },
  {
    slug: "for-remote-teams",
    title: "Trace for Remote Teams",
    shortDescription: "Give a distributed team one shared read on industry news.",
    whyItMatters: "Remote teams lose the 'did you see this?' hallway conversations that keep everyone calibrated. Pasting links into a team chat adds noise, and nobody reads them all.",
    dailyRoutine: "Everyone reads the same brief async, on the web or by email. Discussion happens around the one or two stories that matter to the team, using the story's source links.",
    keyFeatures: ["The same brief for everyone, on the web or by email", "Topics for the team's interests", "Story pages with links to each report", "Archive of past briefs at /brief"],
  },
  {
    slug: "for-researchers",
    title: "Trace for Researchers",
    shortDescription: "Keep up with AI and CS news from industry, alongside your own reading.",
    whyItMatters: "Research moves fast, and model releases, benchmarks and lab announcements are covered across many outlets. Trace is not a paper index, but it keeps you current on what the industry shipped.",
    dailyRoutine: "Morning: scan the brief for model releases and lab news, then open the original reports. Use your usual tools for papers.",
    keyFeatures: ["AI news grouped into one story per event", "Links to each original report", "Read-only access for your AI assistant through MCP (/agents)", "Archive of past briefs at /brief"],
  },
  {
    slug: "for-creators",
    title: "Trace for Creators",
    shortDescription: "Find tech stories worth covering, in one short daily brief.",
    whyItMatters: "Creators who cover tech need to know which stories are worth a video or post. Checking many sites is slow, and the same story appears everywhere.",
    dailyRoutine: "Morning: scan the brief and Top articles for stories worth covering. Open the original reports to check facts before you write.",
    keyFeatures: ["One story per event, with links to each report", "Top articles: the day's best links from Hacker News and Lobsters", "Topics you pick move to the front", "Free and open source"],
  },
];
