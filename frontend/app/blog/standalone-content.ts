export type StandaloneBlogPost = {
  slug: string;
  title: string;
  tag: string;
  category: "comparisons" | "guides" | "ai-tools" | "research";
  excerpt: string;
  readTime: string;
  date: string;
  /** Last substantial edit; drives the sitemap's lastmod. */
  updated?: string;
  image: string;
};

export const standaloneBlogPosts: StandaloneBlogPost[] = [
  {
    slug: "inoreader-alternatives",
    title: "Inoreader Alternatives: 8 Options Compared (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "8 Inoreader alternatives compared for 2026: Feedly, NewsBlur, FreshRSS, Miniflux, Feedbin, The Old Reader, NetNewsWire and Trace, with prices and free plans.",
    readTime: "10 min read",
    date: "June 22, 2026",
    updated: "October 29, 2026",
    image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "google-news-alternatives",
    title: "Google News Alternatives: 6 Better Options for Tech News (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Google News is too noisy for AI and startups. Compare six alternatives with grouped stories, AI summaries, and a free 5-minute briefing.",
    readTime: "12 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "flipboard-alternatives",
    title: "Flipboard alternatives: 6 faster news apps (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Quicker than Flipboard's magazine: Google News, Apple News, SmartNews, Ground News, Feedly and Trace compared, with who each one suits and what it costs.",
    readTime: "8 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "smartnews-alternatives",
    title: "SmartNews Alternatives: 6 Better News Apps for 2026",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Compare six SmartNews alternatives with stronger tech coverage, less noise, and more useful context.",
    readTime: "10 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "newsblur-alternatives",
    title: "NewsBlur Alternatives: 6 Options for Every Use Case (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Compare six NewsBlur alternatives, including Trace, Feedly, Inoreader, and Miniflux, for different reading workflows.",
    readTime: "10 min read",
    date: "June 22, 2026",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "artifact-alternatives",
    title: "Artifact News Alternatives: 6 Apps That Do AI News Better (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Compare six Artifact alternatives, including Trace, Feedly, and Particle, for AI-assisted news discovery.",
    readTime: "11 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "best-ai-news-apps-2026",
    title: "Best AI News Apps in 2026: 6 Apps Compared",
    tag: "AI & Tech",
    category: "ai-tools",
    excerpt: "6 AI news apps compared for 2026: Trace, Feedly, Ground News, Inshorts, Particle and NewsX. What each costs, where it runs, and who it suits.",
    readTime: "8 min read",
    date: "June 22, 2026",
    updated: "October 28, 2026",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "free-news-aggregators-for-developers",
    title: "Free News Aggregators for Developers: 8 Useful Options (2026)",
    tag: "Tools & Comparisons",
    category: "comparisons",
    excerpt: "Compare eight free ways for developers to follow engineering news, releases, community discussions, and technical writing.",
    readTime: "12 min read",
    date: "June 22, 2026",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "how-to-stay-updated-on-tech-without-doomscrolling",
    title: "How to Stay Updated on Tech Without Doomscrolling",
    tag: "Guides",
    category: "guides",
    excerpt: "Build a practical tech-news routine that separates daily scanning, deliberate deep reading, and community discovery.",
    readTime: "10 min read",
    date: "June 22, 2026",
    image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "newsbreak-alternatives",
    title: "NewsBreak Alternatives: 6 Cleaner News Apps for 2026",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Compare six cleaner NewsBreak alternatives, including Trace, Ground News, and SmartNews, for fewer ads and higher signal news.",
    readTime: "10 min read",
    date: "September 4, 2026",
    image: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "pocket-alternatives",
    title: "Pocket Alternatives: 6 Better Read-It-Later Apps for 2026",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Pocket shut down in July 2025. Compare six Pocket alternatives, including Trace, Instapaper, and Raindrop.io, and pick a faster reading workflow.",
    readTime: "10 min read",
    date: "September 4, 2026",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&h=630&fit=crop&auto=format",
  },
];
