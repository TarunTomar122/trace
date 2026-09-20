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
    shortDescription: "Know what competitors launched, what investors are talking about, and what's trending — all before standup.",
    whyItMatters: "Founders live and die by information asymmetry. Missing a competitor move or market shift costs weeks of runway. But you can't afford 2 hours of morning reading when you're running a company.",
    dailyRoutine: "Open Trace at 7:30 AM. Read the top 10 stories in your custom brief. Forward 2 items to your team. Done in under 10 minutes. You walk into standup knowing what happened in your market overnight.",
    keyFeatures: ["Competitor and market monitoring", "Investor sentiment tracking", "Custom topic groups for your sector", "One-tap sharing to Slack or email"],
  },
  {
    slug: "for-pms",
    title: "Trace for Product Managers",
    shortDescription: "Track competitor moves, user sentiment shifts, and market trends without 15 open tabs.",
    whyItMatters: "PMs need wide awareness: competitors, UX trends, user feedback on social platforms, regulatory changes. The surface area is huge and most PMs rely on whatever trickles in from their team.",
    dailyRoutine: "Morning: scan the daily brief for competitor updates and industry moves. Flag 2-3 items for deeper reading. Share relevant launches with design and engineering. Total time: 12 minutes.",
    keyFeatures: ["Competitor launch tracking", "User sentiment monitoring across platforms", "Industry trend detection", "Curated topic feeds for your product area"],
  },
  {
    slug: "for-developers",
    title: "Trace for Developers",
    shortDescription: "Stay on top of new libraries, language updates, and architectural shifts without the noise.",
    whyItMatters: "The developer ecosystem moves fast: new frameworks, breaking changes, CVEs, and paradigm shifts. Following it all means tracking GitHub, Reddit, HN, and dozens of blogs. Most devs fall behind and learn about things late.",
    dailyRoutine: "Quick morning scan: new releases, security advisories, hot GitHub repos, and interesting discussions. Deep-dive on 1-2 items that affect your stack. Done in 8 minutes. You stay current without the context-switching cost.",
    keyFeatures: ["GitHub trending and release tracking", "Programming language and framework news", "Security and CVE monitoring", "Community discussion summaries from Reddit and HN"],
  },
  {
    slug: "for-designers",
    title: "Trace for Designers",
    shortDescription: "Follow design system updates, UX research, and tool launches in one clean feed.",
    whyItMatters: "Design trends and tooling evolve fast. Following Figma updates, design systems, UX research, and community conversations across scattered sources means most designers rely on whatever crosses their Twitter feed.",
    dailyRoutine: "Morning coffee scan: what's new in design tools, what the community is discussing, and which products are launching with interesting UX. Forward inspiring examples to your team. 10 minutes, fully caught up.",
    keyFeatures: ["Design tool and plugin launch tracking", "UX research and case study aggregation", "Design system and framework news", "Community discussions from Designer Twitter and Reddit"],
  },
  {
    slug: "for-marketers",
    title: "Trace for Marketers",
    shortDescription: "Track brand mentions, competitor campaigns, and platform changes without monitoring 10 channels.",
    whyItMatters: "Marketers juggle brand listening, competitor campaigns, platform algorithm changes, and trending formats. Most teams cobble together Google Alerts, social listening tools, and manual scrolling — and still miss things.",
    dailyRoutine: "Morning: scan the brief for brand mentions, competitor launches, and platform news. Note 2-3 items for the weekly team sync. Afternoon: check trending topics for reactive content opportunities. 15 minutes total.",
    keyFeatures: ["Brand and competitor mention monitoring", "Platform and algorithm change tracking", "Trending topic detection for reactive content", "Campaign and launch aggregation"],
  },
  {
    slug: "for-investors",
    title: "Trace for Investors",
    shortDescription: "Track portfolio companies, spot emerging trends, and monitor market signals in one feed.",
    whyItMatters: "You track 40+ companies, 15 newsletters, and countless Twitter threads. The signal-to-noise ratio is brutal. Missing a key signal means missing a deal — or missing a warning sign on a portfolio company.",
    dailyRoutine: "Morning: scan the brief for portfolio mentions, emerging trends, and competitor fundraising. Afternoon: deep-dive on flagged items. Share relevant market signals with partners. 15 minutes, fully informed.",
    keyFeatures: ["Portfolio company monitoring", "Emerging trend and sector detection", "Competitor and market mapping", "Signal-ranked briefs that surface what matters"],
  },
  {
    slug: "for-students",
    title: "Trace for Students",
    shortDescription: "Keep up with tech while studying — one brief instead of 20 browser tabs.",
    whyItMatters: "Students in CS, design, or business need to stay current with industry trends alongside coursework. The default approach — following 30 people on Twitter and hoping — doesn't work when you're also studying for exams.",
    dailyRoutine: "Open Trace during your morning routine. 8-minute scan of what's happening in tech. Note 1-2 items to reference in class discussions or projects. You sound informed without spending an hour scrolling.",
    keyFeatures: ["Curated tech news for students", "Internship and job market trend alerts", "Industry discussions relevant to coursework", "Lightweight, low-commitment format"],
  },
  {
    slug: "for-remote-teams",
    title: "Trace for Remote Teams",
    shortDescription: "Keep distributed teams aligned on industry news without spamming Slack.",
    whyItMatters: "Remote teams lose the 'did you see this?' hallway conversations that help everyone stay calibrated. The alternative — sharing links in Slack — creates notification fatigue and nobody reads everything.",
    dailyRoutine: "Share the day's brief in your team channel. Everyone reads it async. Sync discussions happen around the top 2 stories. No more link spam, no more 'I missed that' moments in meetings.",
    keyFeatures: ["Team-wide daily brief sharing", "Topic curation for team interests", "Reduced Slack link spam", "Async industry alignment"],
  },
  {
    slug: "for-researchers",
    title: "Trace for Researchers",
    shortDescription: "Monitor paper releases, research trends, and community discussions across AI and CS.",
    whyItMatters: "Research moves fast — papers drop daily, new benchmarks emerge, and communities debate findings across Twitter, Reddit, and HN. Nobody has time to track all these surfaces manually.",
    dailyRoutine: "Morning: scan for new papers and research discussions. Flag relevant work for deeper reading. Check community sentiment on recent releases. 10 minutes, fully aware of the day's research landscape.",
    keyFeatures: ["Paper release and preprint tracking", "Research community discussion monitoring", "Benchmark and result comparison tracking", "Cross-platform research signal aggregation"],
  },
  {
    slug: "for-creators",
    title: "Trace for Creators",
    shortDescription: "Find content angles, track trending topics, and stay ahead of platform changes.",
    whyItMatters: "Creators need to know what's trending before it peaks — and which tech stories are worth covering. The traditional approach of monitoring multiple platforms is slow and unreliable. By the time you notice a trend, it's already saturated.",
    dailyRoutine: "Morning: scan the brief for trending tech stories and conversations. Identify 2-3 content angles for the day. Check community sentiment to see what's resonating. 10 minutes, content pipeline primed.",
    keyFeatures: ["Early trend detection for content angles", "Community sentiment and take aggregation", "Platform and algorithm change alerts", "Competing content gap identification"],
  },
];
