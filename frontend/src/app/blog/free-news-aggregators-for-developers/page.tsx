import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { StructuredDataList } from "@/components/StructuredData";
import {
  SITE_BASE_URL,
  generateBlogPostingSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
} from "@/lib/seo";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Free News Aggregators for Developers: The Complete Guide | Trace",
  description:
    "From RSS to AI-powered summaries, here are the best free tools to stay current on tech without paying a dime. A comprehensive guide for developers in 2026.",
  keywords: [
    "free news aggregator",
    "developer news tools",
    "RSS reader free",
    "AI news aggregator free",
    "tech news free",
    "developer productivity tools",
    "free tech news app",
    "best free RSS reader",
    "news aggregation tools",
    "Trace free app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/free-news-aggregators-for-developers`,
  },
  openGraph: {
    type: "article",
    title: "Free News Aggregators for Developers: The Complete Guide",
    description:
      "From RSS to AI-powered summaries, here are the best free tools to stay current on tech without paying a dime.",
    url: `${SITE_BASE_URL}/blog/free-news-aggregators-for-developers`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-04-28T00:00:00Z",
    modifiedTime: "2026-04-28T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [
      {
        url: `${SITE_BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Free News Aggregators for Developers — Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free News Aggregators for Developers: The Complete Guide",
    description:
      "From RSS to AI-powered summaries, here are the best free tools to stay current on tech.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "Free News Aggregators for Developers: The Complete Guide",
    description:
      "A comprehensive guide to the best free news aggregation tools for developers in 2026. Covers Trace, Feedly, Inoreader, Google News, and Techmeme with feature comparisons.",
    url: `${SITE_BASE_URL}/blog/free-news-aggregators-for-developers`,
    datePublished: "2026-04-28T00:00:00Z",
    dateModified: "2026-04-28T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: "https://x.com/tarat_211",
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "Free News Aggregators for Developers", url: `${SITE_BASE_URL}/blog/free-news-aggregators-for-developers` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What is the best free news aggregator for developers?",
      answer:
        "Trace is the best free news aggregator for developers who want AI-powered summaries without setup. It aggregates from 100+ sources and creates 30-second reads. Feedly is best for RSS power users (up to 100 sources free). Techmeme is best for tech-only news with human curation.",
    },
    {
      question: "Are there any completely free AI news aggregators?",
      answer:
        "Yes, Trace is a completely free AI news aggregator on Android with no ads. It uses AI to summarize news from 100+ sources into 30-second reads. Inshorts is also free and summarizes news into 60 words. Google News is free with broad coverage but lacks AI summaries.",
    },
    {
      question: "How do free news aggregators make money?",
      answer:
        "Many free news aggregators use a freemium model: basic features are free, premium features require a subscription. Trace is free on Android with no ads, building toward premium features. Feedly offers a free tier with 100 sources but charges for AI features. Google News is ad-supported.",
    },
    {
      question: "What features should developers look for in a news aggregator?",
      answer:
        "Developers should look for: AI-powered summaries to save time, RSS support for custom source control, topic clustering to group related stories, API access for integration, and role-based personalization. Trace excels at summaries and personalization. Feedly excels at RSS control.",
    },
  ]);

  return (
    <article className="min-h-screen bg-white dark:bg-gray-950">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />

      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li>
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Blog
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium truncate" aria-current="page">
              Free News Aggregators for Developers
            </li>
          </ol>
        </nav>

        <Link
          href="/blog"
          className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block"
        >
          ← Back to Blog
        </Link>

        <header className="mb-8">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Guides
          </span>
          <h1
            className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`}
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Free News Aggregators for Developers: The Complete Guide
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              <time dateTime="2026-04-28">April 28, 2026</time>
            </span>
            <span>6 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            You don&apos;t need to pay $10/month for a news app. Here are the best
            free tools to stay current on tech, from RSS readers to AI-powered
            summaries.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Why Free Tools Work
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Most news apps have free tiers that are more than enough for daily
            use. You don&apos;t need to pay for premium features unless you&apos;re a
            power user who needs advanced filtering.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Trace — Best AI-Powered Free Option
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (Android)
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Trace aggregates news from 100+ sources and creates 30-second AI
            summaries. The Android app is completely free with no ads.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>100+ trusted sources</li>
            <li>AI summaries in 30 seconds</li>
            <li>Personalized feed based on your role</li>
            <li>Story timelines across publications</li>
            <li>Streak tracker for daily reading</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400">
            <a href="https://play.google.com/store/apps/details?id=online.yourtrace.app" className="text-blue-600 dark:text-blue-400 hover:underline font-medium" rel="noopener noreferrer">
              Download Trace free on Android →
            </a>
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Feedly — Best for RSS Power Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free tier available
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Feedly has 15M+ users and offers deep source control. The free tier
            lets you follow up to 100 sources.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>Follow up to 100 sources for free</li>
            <li>AI-assisted article summaries</li>
            <li>Mobile and web apps</li>
            <li>Newsletter integration</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. Inoreader — Best for Power Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free tier available
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Inoreader is like Feedly but with more advanced filtering and rules.
            Great for developers who want fine-grained control.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>Advanced filtering rules</li>
            <li>Newsletter feeds</li>
            <li>AI summaries</li>
            <li>Power-user features</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. Google News — Best for General Coverage
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Google News is free and covers everything. It&apos;s not tech-specific
            but has good coverage of major tech stories.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>Completely free</li>
            <li>Full coverage of major stories</li>
            <li>Local and global news</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. Techmeme — Best for Tech-Specific
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Techmeme is a tech-only aggregator that&apos;s been around for years.
            It&apos;s simple but effective for staying on top of tech news.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>Tech-only focus</li>
            <li>Curated by humans + AI</li>
            <li>No account required</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don&apos;t need to pay for a news app. Start with Trace for
            AI-powered summaries, use Feedly for RSS, and add Techmeme for
            tech-specific coverage. That&apos;s everything you need, for free.
          </p>

          {/* Internal cross-linking */}
          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Read Next
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/blog/best-ai-news-apps-2026" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Best AI News Apps in 2026 (That Actually Respect Your Time) →
                </Link>
              </li>
              <li>
                <Link href="/blog/feedly-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Feedly Alternatives: 7 Free Options That Are Actually Better →
                </Link>
              </li>
              <li>
                <Link href="/blog/how-to-stay-updated-on-tech-without-doomscrolling" className="text-blue-600 dark:text-blue-400 hover:underline">
                  How to Stay Updated on Tech Without Doomscrolling →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}
