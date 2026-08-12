export type StandaloneBlogPost = {
  slug: string;
  title: string;
  tag: string;
  category: "comparisons" | "guides" | "ai-tools" | "research";
  excerpt: string;
  readTime: string;
  date: string;
  image: string;
};

export const standaloneBlogPosts: StandaloneBlogPost[] = [
  {
    slug: "inoreader-alternatives",
    title: "Inoreader Alternatives: 6 Better Options for Every Use Case (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Compare six Inoreader alternatives, including Trace, Feedly, and NewsBlur, and choose the right news reader for your workflow.",
    readTime: "11 min read",
    date: "June 22, 2026",
    image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "google-news-alternatives",
    title: "Google News Alternatives: 6 Better Options for Tech News (2026)",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Compare six Google News alternatives with stronger tech curation, concise summaries, and developer-focused coverage.",
    readTime: "12 min read",
    date: "June 22, 2026",
    image: "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "flipboard-alternatives",
    title: "Best Flipboard Alternative in 2026: 6 Apps Compared",
    tag: "Comparisons",
    category: "comparisons",
    excerpt: "Looking for a Flipboard alternative? Compare Trace, Feedly, Inoreader, NewsBlur, SmartNews, and Artifact by price, control, AI summaries, and reading style.",
    readTime: "10 min read",
    date: "June 22, 2026",
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
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&auto=format",
  },
  {
    slug: "best-ai-news-apps-2026",
    title: "Best AI News Apps in 2026: 10 Tools Compared",
    tag: "AI & Tech",
    category: "ai-tools",
    excerpt: "Compare ten AI news apps by source coverage, summarization, story grouping, and the reading workflow each one serves best.",
    readTime: "14 min read",
    date: "June 22, 2026",
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
];
