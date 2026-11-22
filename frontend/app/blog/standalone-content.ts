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
  /** Kept for readers and links, out of Google and the sitemap (lib/indexing.ts). */
  noindex?: boolean;
  image: string;
};

export const standaloneBlogPosts: StandaloneBlogPost[] = [
  {
    slug: "inoreader-alternatives",
    title: "Inoreader alternatives: 7 readers and their free plans",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Feedly, NewsBlur, FreshRSS, Miniflux, Feedbin, The Old Reader and NetNewsWire: free-plan limits, prices and which you can self-host. Plus Trace, which we make.",
    readTime: "10 min read",
    date: "June 22, 2026",
    updated: "October 29, 2026",
    image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "google-news-alternatives",
    title: "Google News alternatives for tech readers: 5 options",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Techmeme, Feedly, Inoreader, Ground News and Hacker News compared on price, summaries and who each suits, plus Trace, which we make.",
    readTime: "12 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "flipboard-alternatives",
    title: "Flipboard alternatives: 6 news apps and what they cost",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Google News, Apple News, SmartNews, Ground News and Feedly for general news, plus Trace if you only want tech. Who each suits and what it costs.",
    readTime: "8 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "smartnews-alternatives",
    noindex: true,
    title: "SmartNews Alternatives: 6 News Apps Compared",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "SmartNews is fast but thin on tech. Compare 6 alternatives with AI curation, grouped stories, and coverage founders actually need.",
    readTime: "10 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "newsblur-alternatives",
    title: "NewsBlur alternatives: 5 RSS readers and their free plans",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Feedly, Inoreader, Miniflux, FreshRSS and The Old Reader: free-plan limits, prices and which you can self-host. Plus Trace, which we make.",
    readTime: "10 min read",
    date: "June 22, 2026",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "artifact-alternatives",
    title: "Artifact alternatives: 5 AI news apps after the shutdown",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Artifact closed in 2024. Particle, Perplexity, Feedly, Inoreader and Ground News compared on price and summaries, plus Trace, which we make.",
    readTime: "11 min read",
    date: "June 22, 2026",
    updated: "October 19, 2026",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "best-ai-news-apps-2026",
    title: "AI news apps: 6 compared on price and platforms",
    tag: "AI & Tech",
    category: "ai-tools",
    excerpt: "Trace, Feedly, Ground News, Inshorts, Particle and NewsX side by side: what each costs, where it runs, and how it summarizes. We make Trace.",
    readTime: "8 min read",
    date: "June 22, 2026",
    updated: "October 28, 2026",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "newsbreak-alternatives",
    noindex: true,
    title: "NewsBreak Alternatives: 6 Cleaner News Apps",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Tired of NewsBreak ads? Compare 6 cleaner apps — Trace, Ground News, SmartNews — for higher-signal news without the clutter.",
    readTime: "10 min read",
    date: "September 4, 2026",
    image: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "pocket-alternatives",
    noindex: true,
    title: "Pocket Alternatives: 5 Read-It-Later Apps and Trace",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Pocket shut down in 2025. Compare 5 read-it-later and briefing apps — Trace, Instapaper, Raindrop — so saved articles actually get read.",
    readTime: "10 min read",
    date: "September 4, 2026",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&h=630&fit=crop&auto=format",
  },
];
