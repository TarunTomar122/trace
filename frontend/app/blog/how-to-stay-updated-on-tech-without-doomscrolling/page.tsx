import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { StructuredDataList } from "@/components/StructuredData";
import EditorialArticleShell from "@/components/EditorialArticleShell";
import { BlogEmailCard } from "@/components/BlogCTA";
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
  title: "How to Stay Updated on Tech Without Doomscrolling | Trace",
  description:
    "The average developer spends 2+ hours daily on news apps. Here's how to cut that to 30 minutes and still know what matters — without the anxiety.",
  keywords: [
    "stay updated tech",
    "developer productivity",
    "news consumption habits",
    "avoid doomscrolling",
    "tech news efficiency",
    "information overload",
    "how to stay informed without anxiety",
    "reduce screen time news",
    "productive news reading",
    "Trace AI summaries",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/how-to-stay-updated-on-tech-without-doomscrolling`,
  },
  openGraph: {
    type: "article",
    title: "How to Stay Updated on Tech Without Doomscrolling",
    description:
      "Cut your news consumption from 2 hours to 30 minutes without missing anything important. Practical strategies for developers.",
    url: `${SITE_BASE_URL}/blog/how-to-stay-updated-on-tech-without-doomscrolling`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-05-02T00:00:00Z",
    modifiedTime: "2026-05-02T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [
      {
        url: `${SITE_BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "How to Stay Updated on Tech Without Doomscrolling — Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Stay Updated on Tech Without Doomscrolling",
    description:
      "Cut your news consumption from 2 hours to 30 minutes without missing anything important.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "How to Stay Updated on Tech Without Doomscrolling",
    description:
      "Practical strategies for developers and tech professionals to stay informed without falling into the doomscrolling trap. Covers the 30-minute rule, AI summaries, source curation, and habit building.",
    url: `${SITE_BASE_URL}/blog/how-to-stay-updated-on-tech-without-doomscrolling`,
    datePublished: "2026-05-02T00:00:00Z",
    dateModified: "2026-05-02T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: "https://x.com/tarat_211",
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "How to Stay Updated on Tech Without Doomscrolling", url: `${SITE_BASE_URL}/blog/how-to-stay-updated-on-tech-without-doomscrolling` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "How do I stop doomscrolling news?",
      answer:
        "Set a hard 30-minute daily limit for news consumption. Use AI-powered news apps like Trace that give you 30-second summaries instead of full articles. Schedule specific check-in times (e.g., 9 AM and 5 PM) and never check news outside those windows. Remove infinite-scroll news apps from your phone.",
    },
    {
      question: "How can developers stay updated on tech without wasting time?",
      answer:
        "Use AI news aggregators like Trace that summarize tech news from 100+ sources into 30-second reads. Curate 5-10 high-quality sources instead of following 50. Set specific reading times. Use streak trackers to build a consistent habit without overdoing it.",
    },
    {
      question: "What is the best app to avoid doomscrolling?",
      answer:
        "Trace is designed specifically to prevent doomscrolling. It delivers AI-powered summaries from trusted sources and has no infinite scroll, no clickbait, and no algorithmic rabbit holes. You get informed in 30 seconds and move on with your day.",
    },
    {
      question: "How much time should I spend on tech news daily?",
      answer:
        "30 minutes per day is the sweet spot for staying informed without information overload. Two 15-minute sessions (morning and evening) work well. Use AI summaries to get the key points from 10 articles in the time it would normally take to read 2.",
    },
  ]);

  return (
    <EditorialArticleShell slug="how-to-stay-updated-on-tech-without-doomscrolling">
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
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">
              Stay Updated Without Doomscrolling
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
            Productivity
          </span>
          <h1
            className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`}
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            How to Stay Updated on Tech Without Doomscrolling
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              <time dateTime="2026-05-02">May 2, 2026</time>
            </span>
            <span>4 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            You open Twitter &quot;for 5 minutes&quot; and suddenly it&apos;s been an hour.
            Sound familiar? The average developer spends 2+ hours daily on news
            apps. Here&apos;s how to cut that to 30 minutes.
          </p>

          <BlogEmailCard slug="how-to-stay-updated-on-tech-without-doomscrolling" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Problem
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            News apps are designed to keep you scrolling. They use infinite
            scroll, clickbait headlines, and algorithmic feeds to maximize
            engagement. The result? You spend hours scrolling and still don&apos;t
            know what actually happened.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The 30-Minute Rule
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Set a hard limit: 30 minutes per day for news. Here&apos;s how to make
            it work:
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            1. Use AI Summaries
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Instead of reading 10 articles, read 10 summaries. Apps like Trace
            aggregate news from 100+ sources and create 30-second AI summaries.
            You get the gist without the fluff.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            2. Set Specific Times
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Check news at 9 AM and 5 PM. No checking in between. This prevents
            the &quot;I&apos;ll just check one more thing&quot; spiral.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            3. Curate Your Sources
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Follow 5-10 high-quality sources instead of 50 mediocre ones. Quality
            beats quantity every time.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            4. Use Streak Trackers
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Build a reading habit with streak trackers. The goal isn&apos;t to read
            everything—it&apos;s to read the right things consistently.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            5. Set a Timer
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Literally set a 30-minute timer. When it goes off, close the app.
            No exceptions.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Tools That Help
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            We built Trace specifically for this problem. It gets you informed
            in 30 seconds, not 30 minutes. No infinite scroll, no clickbait,
            no algorithmic rabbit holes.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            <a href="https://play.google.com/store/apps/details?id=online.yourtrace.app" className="text-blue-600 dark:text-blue-400 hover:underline font-medium" rel="noopener noreferrer">
              Get the daily brief on Android, free and open source →
            </a>
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Staying informed doesn&apos;t have to mean doomscrolling. Set limits,
            use AI summaries, curate your sources, and build a reading habit.
            Your time is worth more than infinite scroll.
          </p>

          <BlogEmailCard slug="how-to-stay-updated-on-tech-without-doomscrolling" placement="end" />

          {/* Internal cross-linking */}
          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Read Next
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/blog/stay-on-top-of-ai-news-without-twitter" className="text-blue-600 dark:text-blue-400 hover:underline">
                  How founders stay on top of AI news without Twitter →
                </Link>
              </li>
              <li>
                <Link href="/blog/replace-tech-newsletters-with-a-5-minute-briefing" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Replace tech newsletters with a 5-minute briefing →
                </Link>
              </li>
              <li>
                <Link href="/blog/feedly-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Best Feedly alternatives for tech news →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
