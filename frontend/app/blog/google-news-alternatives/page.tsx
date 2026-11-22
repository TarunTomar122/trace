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
  title: "Google News alternatives for tech readers: 5 options | Trace",
  description:
    "Techmeme, Feedly, Inoreader, Ground News and Hacker News compared on price, summaries and who each suits, plus Trace, which we make.",
  keywords: [
    "google news alternatives",
    "google news alternative app",
    "better than google news",
    "google news alternatives 2026",
    "tech news app alternative",
    "best news aggregator app",
    "google news vs feedly",
    "free news app alternative",
    "AI news aggregator",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/google-news-alternatives`,
  },
  openGraph: {
    type: "article",
    title: "Google News alternatives for tech readers: 5 options",
    description:
      "Techmeme, Feedly, Inoreader, Ground News and Hacker News compared on price, summaries and who each suits, plus Trace, which we make.",
    url: `${SITE_BASE_URL}/blog/google-news-alternatives`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-06-22T00:00:00Z",
    modifiedTime: "2026-10-19T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [
      {
        url: `${SITE_BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Google News Alternatives — Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Google News alternatives for tech readers: 5 options",
    description:
      "Techmeme, Feedly, Inoreader, Ground News and Hacker News compared on price, summaries and who each suits, plus Trace, which we make.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "Google News alternatives for tech readers: 5 options",
    description:
      "Techmeme, Feedly, Inoreader, Ground News and Hacker News compared on price, summaries and who each suits, plus Trace, which we make.",
    url: `${SITE_BASE_URL}/blog/google-news-alternatives`,
    datePublished: "2026-06-22T00:00:00Z",
    dateModified: "2026-10-19T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: `${SITE_BASE_URL}/about`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "Google News Alternatives", url: `${SITE_BASE_URL}/blog/google-news-alternatives` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What is a good alternative to Google News for tech?",
      answer:
        "For human-picked tech headlines, Techmeme. To choose every source yourself, Feedly or Inoreader. For comparing how outlets across the political spectrum cover a story, Ground News. For a short daily tech and AI brief, Trace, which we make: it reads 100+ tech sources, groups coverage of the same event into one story and summarizes it.",
    },
    {
      question: "Why would I switch from Google News?",
      answer:
        "Mostly because it is broad. Tech stories sit among general news, and Full Coverage groups an event's coverage but leaves you to read it outlet by outlet. A tech-focused reader or brief cuts that down.",
    },
    {
      question: "Is Google News free?",
      answer:
        "Yes, Google News is free. Most alternatives here are free or have free plans: Techmeme and Hacker News are free, Feedly has a free plan with 100 sources, Inoreader has a free plan with 150 feeds, and Trace is free and open source.",
    },
    {
      question: "Which of these summarize the news?",
      answer:
        "Feedly's AI assistant, Leo, is on its Pro+ plan, and Inoreader's article summaries are on its Pro plan. Ground News summarizes how left, center and right coverage differs on stories with enough sources. Trace writes one short summary per story from all the outlets that covered it, free.",
    },
  ]);

  return (
    <EditorialArticleShell slug="google-news-alternatives">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />

      <div className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li>
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">Google News Alternatives</li>
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
            Google News Alternatives for Tech Readers: 5 Options
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span><time dateTime="2026-06-22">June 22, 2026</time></span>
            <span>5 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Google News is free, comes with most Android phones, and covers
            everything. If you mainly follow tech, that breadth gets in the way:
            the stories you want sit among general news. Below are five
            alternatives that are narrower or give you more control, with what
            each costs.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            We make Trace, so it&apos;s listed separately below.
          </p>

          <BlogEmailCard slug="google-news-alternatives" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Why Look for Google News Alternatives?
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>Too broad:</strong> Google News covers everything from celebrity news to local sports, so tech stories sit among general news.</li>
            <li><strong>Grouping without a summary:</strong> Full Coverage collects every outlet&apos;s version of a launch, but you still read them one by one to find out what happened.</li>
            <li><strong>Picked for you:</strong> The feed is personalized by Google, and you have limited say over which sources appear.</li>
            <li><strong>Thin on developer news:</strong> Niche developer blogs and smaller tech sources rarely show up.</li>
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
                  <th className="border border-gray-200 dark:border-gray-800 px-4 py-2 text-left">AI Summaries</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Techmeme</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Industry Overview</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Human-curated</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Feedly</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">RSS Control</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Pro+ only</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Inoreader</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / Pro from €6.67/mo</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Power Users</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Pro only</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Ground News</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Bias-Aware Reading</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Coverage comparison</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Hacker News</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Community Picks</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">No</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Trace (ours)</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">A daily tech and AI brief</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">One per story, across outlets</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Techmeme — Best for Quick Industry Overview
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (ad-supported)
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Techmeme&apos;s front page is put together by human editors, who select and
            arrange the day&apos;s main tech stories. You can scan it in a few minutes.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>Picked by human editors</li>
            <li>Related coverage links under each headline</li>
            <li>Free, on the web</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Feedly — Best for Custom Source Control
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (100 sources) | paid Pro and Pro+ plans (AI on Pro+)
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            If you want to choose exactly which sources appear in your feed, Feedly
            gives you that control. Subscribe to 100 sources for free, organize into
            folders, and read in reverse chronological order.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. Inoreader — Best for Advanced Filtering
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (150 feeds) | Pro from €6.67/month billed yearly
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Inoreader&apos;s rules engine lets you create complex automation for filtering
            and routing news. Track specific keywords, competitors, or technologies
            across dozens of sources.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. Ground News — Best for Bias-Aware Reading
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free plan | paid plans
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Ground News compares coverage across 50,000+ sources and shows media bias
            ratings, blindspots, and ownership context. It is built for seeing how
            different outlets frame the same story.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. Hacker News — Best for Community-Picked Tech Links
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Hacker News ranks links by votes from a large developer and founder
            community, and the comment threads often add context the articles leave
            out. It is fast and text-only, but the front page leans toward a few
            topics and changes through the day. If that is too noisy, see our{" "}
            <Link href="/blog/developer-news-aggregator-guide" className="text-blue-600 dark:text-blue-400 hover:underline">guide to developer news aggregators</Link>.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The one we make: Trace
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free, open source
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Trace covers tech and AI only. It reads 100+ tech sources, such as
            TechCrunch, The Verge and Ars Technica, groups coverage of the same
            event into one story, and writes a short summary with links to each
            original report. You read it on the web or as a daily email at 08:30
            UK time.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>100+ tech sources instead of general news</li>
            <li>One summary per story, written from several outlets</li>
            <li>Links to each original report under the summary</li>
            <li>Choose your topics and 5, 10 or 15 stories, then you&apos;re done</li>
          </ul>
          <InlineTraceCTA
            slug="google-news-alternatives"
            blurb="Trace is a tech and AI brief that ends: model releases, company news and what changed, one story per event, with links to each original report. Free for everyone."
          />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Google News is fine for general browsing. For tech, <strong>Techmeme</strong>{" "}
            gives you human-picked industry headlines in a few minutes, and{" "}
            <strong>Feedly</strong> or <strong>Inoreader</strong> let you choose every
            source. <strong>Trace</strong> (ours) gives you one summary per story
            from 100+ tech sources. All of them can be used free.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Try one for a week alongside Google News and keep whichever you open
            more.
          </p>

          <BlogEmailCard slug="google-news-alternatives" placement="end" />

          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Read Next
            </h3>
            <ul className="space-y-2">
              <li><Link href="/blog/flipboard-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Flipboard alternatives →</Link></li>
              <li><Link href="/blog/smartnews-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">SmartNews alternatives →</Link></li>
              <li><Link href="/blog/ground-news-alternatives-for-tech" className="text-blue-600 dark:text-blue-400 hover:underline">Ground News alternatives for tech news →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
