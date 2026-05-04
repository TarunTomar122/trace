import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blog — Trace | AI News & Tech Insights",
  description:
    "Stay informed with the latest AI news, tech trends, and productivity tips. Learn how to stay current without the information overload.",
  keywords: [
    "AI news blog",
    "tech news aggregator",
    "developer productivity",
    "stay updated tech",
    "news app blog",
    "AI news summary",
    "tech trends 2026",
  ],
  openGraph: {
    type: "website",
    title: "Blog — Trace | AI News & Tech Insights",
    description:
      "Stay informed with the latest AI news, tech trends, and productivity tips.",
    url: "https://www.yourtrace.online/blog",
  },
};

const blogPosts = [
  {
    slug: "best-ai-news-apps-2026",
    title: "Best AI News Apps in 2026 (That Actually Respect Your Time)",
    excerpt:
      "Looking for the best AI news app? We tested 10 options including Trace, Feedly, and Ground News. Find the right one for developers and founders.",
    date: "2026-05-04",
    readTime: "7 min read",
    category: "Reviews",
  },
  {
    slug: "feedly-alternatives",
    title: "Feedly Alternatives: 7 Free Options That Are Actually Better (2026)",
    excerpt:
      "Looking for Feedly alternatives? We tested 7 free options including Trace, Inoreader, and NewsBlur. Find the right RSS reader for you.",
    date: "2026-05-04",
    readTime: "8 min read",
    category: "Comparisons",
  },
  {
    slug: "how-to-stay-updated-on-tech-without-doomscrolling",
    title: "How to Stay Updated on Technology Without Doomscrolling",
    excerpt:
      "The average developer spends 2+ hours daily on news apps. Here's how to cut that to 30 minutes and still know everything that matters.",
    date: "2026-05-02",
    readTime: "4 min read",
    category: "Productivity",
  },
  {
    slug: "free-news-aggregators-for-developers",
    title: "Free News Aggregators for Developers: The Complete Guide",
    excerpt:
      "From RSS to AI-powered summaries, here are the best free tools to stay current on tech without paying a dime.",
    date: "2026-04-28",
    readTime: "6 min read",
    category: "Guides",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-12">
          <h1
            className={`text-4xl font-bold text-gray-900 dark:text-white mb-4 ${spaceGrotesk.variable}`}
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Blog
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Stay informed. Stay productive. No fluff.
          </p>
        </div>

        <div className="space-y-8">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {post.category}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-500">
                  {post.date}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-500">
                  {post.readTime}
                </span>
              </div>
              <Link href={`/blog/${post.slug}`}>
                <h2
                  className={`text-2xl font-semibold text-gray-900 dark:text-white mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${spaceGrotesk.variable}`}
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {post.title}
                </h2>
              </Link>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {post.excerpt}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Read more →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
