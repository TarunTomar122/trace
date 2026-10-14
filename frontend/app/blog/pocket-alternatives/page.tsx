import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { StructuredDataList } from "@/components/StructuredData";
import EditorialArticleShell from "@/components/EditorialArticleShell";
import { BlogEmailCard, InlineTraceCTA } from "@/components/BlogCTA";
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
  title: "Pocket Alternatives: 6 Better Apps for 2026 | Trace",
  description:
    "Pocket shut down in 2025. Compare 6 read-it-later and briefing apps — Trace, Instapaper, Raindrop — so saved articles actually get read.",
  keywords: [
    "pocket alternatives",
    "pocket alternative app",
    "better than pocket",
    "pocket alternatives 2026",
    "read it later app",
    "pocket shutdown replacement",
    "pocket vs instapaper",
    "best read later app",
    "save articles app",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/pocket-alternatives`,
  },
  openGraph: {
    type: "article",
    title: "Pocket Alternatives: 6 Better Read-It-Later Apps for 2026",
    description:
      "Pocket is gone. We compare 6 Pocket alternatives for saving articles, catching up on tech news, and clearing your reading pile.",
    url: `${SITE_BASE_URL}/blog/pocket-alternatives`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-09-04T00:00:00Z",
    modifiedTime: "2026-09-04T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [
      {
        url: `${SITE_BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Pocket Alternatives: Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Alternatives: 6 Better Read-It-Later Apps for 2026",
    description:
      "Pocket is gone. Here are 6 better read-it-later apps and workflows for 2026.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "Pocket Alternatives: 6 Better Read-It-Later Apps for 2026",
    description:
      "Comprehensive comparison of the best Pocket alternatives for 2026. Covers Trace, Instapaper, Raindrop.io, Readwise Reader, Matter, and Wallabag with feature comparisons.",
    url: `${SITE_BASE_URL}/blog/pocket-alternatives`,
    datePublished: "2026-09-04T00:00:00Z",
    dateModified: "2026-09-04T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: "https://x.com/tarat_211",
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "Pocket Alternatives", url: `${SITE_BASE_URL}/blog/pocket-alternatives` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What is the best Pocket replacement?",
      answer:
        "For most former Pocket users, the best replacement depends on the habit. If your saved pile was mostly tech news, Trace is the best fit because it summarizes 50+ tech sources into a 10-minute briefing, so there is less to save. If you want a classic save-for-later queue, Instapaper and Raindrop.io are strong free options.",
    },
    {
      question: "What happened to Pocket?",
      answer:
        "Mozilla discontinued Pocket in July 2025 and shut down the service, including its apps and browser extensions. Former users needed to export saved articles and move to a new read-it-later app or a different news workflow.",
    },
    {
      question: "Are there free Pocket alternatives?",
      answer:
        "Yes. Trace is free and covers the daily tech catch-up without a reading queue. Instapaper, Raindrop.io, and Wallabag all have free or self-hosted options. Readwise Reader and Matter use free trials plus premium tiers for power features like highlights sync and audio.",
    },
    {
      question: "How is Trace different from a read-it-later app?",
      answer:
        "Read-it-later apps store articles for you to read in full later. Trace replaces that habit for tech news: it reads across 50+ tech sources, groups related coverage by topic, and gives you multi-source summaries. You get the key points in about 10 minutes instead of building a pile of unread saves.",
    },
  ]);

  return (
    <EditorialArticleShell slug="pocket-alternatives">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />

      <div className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">Pocket Alternatives</li>
          </ol>
        </nav>

        <Link href="/blog" className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">
          ← Back to Blog
        </Link>

        <header className="mb-8">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Comparisons</span>
          <h1
            className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`}
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Pocket Alternatives: 6 Better Read-It-Later Apps for 2026
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span><time dateTime="2026-09-04">September 4, 2026</time></span>
            <span>10 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Mozilla discontinued Pocket in July 2025, and with it went the
            internet&apos;s favorite save-for-later drawer. If you&apos;re a former
            Pocket user staring at an export file, you don&apos;t just need a new
            place to stash links. You need a workflow that keeps you informed
            without growing another pile of unread saves.
          </p>

          <BlogEmailCard slug="pocket-alternatives" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Why Look for Pocket Alternatives?
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>Pocket is gone:</strong> The apps, extensions, and sync shut down after the July 2025 discontinuation</li>
            <li><strong>Unread piles grow:</strong> Saving is easy, returning is hard, and most queues become archives of good intentions</li>
            <li><strong>Tech news expires fast:</strong> A launch story saved on Monday is stale context by Friday</li>
            <li><strong>No synthesis:</strong> Classic queues store one article at a time instead of grouping coverage across sources</li>
            <li><strong>Reading takes too long:</strong> Full articles for every story means the daily catch-up never fits the day</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Quick Comparison Table
          </h2>
          <div className="overflow-x-auto mb-8">
            <table className="min-w-full border border-gray-200 dark:border-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="border border-gray-200 dark:border-gray-800 px-4 py-2 text-left">App</th>
                  <th className="border border-gray-200 dark:border-gray-800 px-4 py-2 text-left">Price</th>
                  <th className="border border-gray-200 dark:border-gray-800 px-4 py-2 text-left">Best For</th>
                  <th className="border border-gray-200 dark:border-gray-800 px-4 py-2 text-left">Standout Feature</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium"><Link href="/feed?utm_source=blog&utm_medium=comparison_table&utm_campaign=pocket-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Trace</Link></td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free, open source</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Replacing the queue</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Multi-source summaries</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Instapaper</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / premium tiers</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Classic read-it-later</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Distraction-free reading</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Raindrop.io</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Bookmarks manager</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Collections and search</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Readwise Reader</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Power users</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Highlights sync</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Matter</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / premium tiers</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Premium reading</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Audio and newsletters</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Wallabag</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Open source</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Self-hostable</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Trace: Best for Never Needing Read-It-Later
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free, open source
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            To be honest, Trace replaces the habit, not the feature. Instead of
            saving ten tabs about the same launch, it scans 50+ tech sources,
            groups related coverage by topic, and gives you multi-source
            summaries. The daily tech briefing takes about 10 minutes, so there
            is far less left to save for later.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>AI briefing from 50+ tech sources in about 10 minutes</li>
            <li>Multi-source summaries with grouped topics, not single links</li>
            <li>Free and open source, with zero setup or import required</li>
            <li>Natural endpoint, you know when you are caught up</li>
            <li>Best for tech news (keep a classic queue for longform essays)</li>
          </ul>

          <InlineTraceCTA
            slug="pocket-alternatives"
            blurb="Still sitting on a Pocket export? Skip rebuilding the pile: Trace turns 50+ tech sources into one 10-minute briefing you can actually finish."
          />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Instapaper: Best Classic Read-It-Later
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free / premium tiers
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Instapaper is the closest direct swap for Pocket loyalists. Save
            articles from the browser or app, then read them in a clean,
            distraction-free view with text-to-speech for listening on the go.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. Raindrop.io: Best Bookmarks Manager
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free / paid plans
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            If your Pocket was really a library, Raindrop.io fits better than a
            plain queue. Organize saves into collections, add tags, and use
            full-text search to find that article you saved months ago.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. Readwise Reader: Best Power-User Read-It-Later
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free / paid plans
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Readwise Reader combines feeds, PDFs, newsletters, and saved
            articles in one inbox built for highlights. Notes and highlights
            sync out to tools like Notion and Obsidian, which suits researchers
            and heavy annotators.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. Matter: Best Premium Reading Experience
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free / premium tiers
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Matter turns your queue into a polished reading list. Pipe
            newsletters straight into the app, listen with natural audio, and
            highlight passages worth keeping. It is a good pick if you read
            longform daily and care about craft.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            6. Wallabag: Best Open-Source Option
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Wallabag is the open-source answer to Pocket. Save pages for later,
            read them in a clean view, and self-host for full control of your
            data. Setup takes more effort, but privacy and ownership are the payoff.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            If your Pocket was mostly tech news, stop rebuilding the queue and
            change the workflow. <Link href="/feed?utm_source=blog&utm_medium=verdict&utm_campaign=pocket-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Trace</Link> gives
            you the day&apos;s tech coverage in about 10 minutes, free and open source. Keep <strong>Instapaper</strong> for
            longform essays and <strong>Raindrop.io</strong> for bookmarks you truly want to keep.
          </p>

          <BlogEmailCard slug="pocket-alternatives" placement="end" />

          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Read Next
            </h3>
            <ul className="space-y-2">
              <li><Link href="/blog/best-tech-news-aggregator-apps" className="text-blue-600 dark:text-blue-400 hover:underline">The Best Tech News Aggregator Apps in 2026 →</Link></li>
              <li><Link href="/blog/feedly-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Feedly Alternatives: 7 Free Options Worth Trying →</Link></li>
              <li><Link href="/blog/google-news-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Google News Alternatives: 6 Better Options for Tech News →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
