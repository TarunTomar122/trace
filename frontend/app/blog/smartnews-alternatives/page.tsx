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
import { NOINDEX_ROBOTS } from "@/lib/indexing";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
  title: "SmartNews Alternatives: 6 News Apps Compared | Trace",
  description:
    "SmartNews is fast but thin on tech. Compare 6 alternatives with AI curation, grouped stories, and coverage founders actually need.",
  keywords: [
    "smartnews alternatives",
    "smartnews alternative app",
    "better than smartnews",
    "smartnews alternatives 2026",
    "news app like smartnews",
    "smartnews vs feedly",
    "AI news aggregator",
    "best news app android",
    "tech news app alternative",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/smartnews-alternatives`,
  },
  openGraph: {
    type: "article",
    title: "SmartNews Alternatives: 6 News Apps Compared",
    description:
      "SmartNews alternatives compared on price and coverage: Feedly, Inoreader, Flipboard, Apple News and Google News, plus Trace, which we make.",
    url: `${SITE_BASE_URL}/blog/smartnews-alternatives`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-06-22T00:00:00Z",
    modifiedTime: "2026-10-19T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [{ url: `${SITE_BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: "SmartNews Alternatives — Trace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SmartNews Alternatives: 6 News Apps Compared",
    description: "SmartNews alternatives compared on price and coverage, plus Trace, which we make.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "SmartNews Alternatives: 6 News Apps Compared",
    description: "SmartNews alternatives compared on price and coverage: Feedly, Inoreader, Flipboard, Apple News and Google News, plus Trace, which we make.",
    url: `${SITE_BASE_URL}/blog/smartnews-alternatives`,
    datePublished: "2026-06-22T00:00:00Z",
    dateModified: "2026-10-19T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: `${SITE_BASE_URL}/about`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "SmartNews Alternatives", url: `${SITE_BASE_URL}/blog/smartnews-alternatives` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What is a good alternative to SmartNews?",
      answer: "Feedly for choosing your own sources, Flipboard for casual visual browsing, and Google News or Apple News for general coverage. For tech news only, Trace, which we make, summarizes each story from 100+ tech sources with no setup.",
    },
    {
      question: "Why would I switch from SmartNews?",
      answer: "Usually because it is general news, with limited tech coverage, and the same event can appear once per outlet. A tech-focused reader or brief cuts that down.",
    },
    {
      question: "Is SmartNews free?",
      answer: "Yes, SmartNews is free with ads. Most alternatives also offer free tiers — Trace is free and open source, Feedly has a free plan with 100 sources, and Flipboard is free.",
    },
  ]);

  return (
    <EditorialArticleShell slug="smartnews-alternatives">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">SmartNews Alternatives</li>
          </ol>
        </nav>
        <Link href="/blog" className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">← Back to Blog</Link>

        <header className="mb-8">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Comparisons</span>
          <h1 className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            SmartNews Alternatives: 6 News Apps Compared
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span><time dateTime="2026-06-22">June 22, 2026</time></span>
            <span>10 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            SmartNews is a popular mobile news app known for fast loading and clean
            design. But it&apos;s a general-purpose news app — it doesn&apos;t have AI
            summaries, tech-specific curation, or the story grouping features that
            tech professionals need.
          </p>

          <BlogEmailCard slug="smartnews-alternatives" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Why Look for SmartNews Alternatives?
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>General coverage:</strong> Not tech-focused — lots of celebrity, sports, and politics content</li>
            <li><strong>No story grouping:</strong> Same news from 5 sources = 5 separate entries</li>
            <li><strong>Limited customization:</strong> Can&apos;t precisely control which sources appear</li>
            <li><strong>Thin on developer news:</strong> Niche developer blogs and smaller tech sources rarely show up</li>
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
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Trace (ours)</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free, open source</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Tech news only</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Multi-source</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Feedly</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">RSS Control</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Pro+ only</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Inoreader</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / Pro from €6.67/mo</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Power Users</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Pro only</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Flipboard</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Visual Browsing</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">No</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Apple News</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid Apple News+</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">iPhone, iPad and Mac</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">No</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Google News</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">General News</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">No</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Trace (ours) — For Tech News Only
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free, open source</p>
          <p className="text-gray-600 dark:text-gray-400">
            We make Trace. It covers tech and AI news only: it reads 100+ tech sources,
            groups coverage of the same event into one story, and writes a short summary
            with links to each original report.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>100+ tech sources, such as TechCrunch, The Verge and Ars Technica</li>
            <li>Multi-source AI summaries with source attribution</li>
            <li>Topic grouping — one story, multiple perspectives</li>
            <li>Choose 5, 10 or 15 stories, on the web or as a daily email</li>
            <li>Free, no ads, no infinite scroll</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Feedly — Best for RSS Power Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (100 sources) | paid Pro and Pro+ plans</p>
          <p className="text-gray-600 dark:text-gray-400">
            Feedly lets you choose exactly which sources to follow. Better customization
            than SmartNews, with its AI assistant, Leo, on the Pro+ plan.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. Inoreader — Best for Advanced Filtering
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (150 feeds) | Pro from €6.67/month billed yearly</p>
          <p className="text-gray-600 dark:text-gray-400">
            Inoreader&apos;s rules engine and permanent archiving make it the power-user
            choice. Track specific keywords and competitors across sources.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. Flipboard — Best for Visual Discovery
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free</p>
          <p className="text-gray-600 dark:text-gray-400">
            If you like SmartNews&apos;s visual approach but want better content discovery,
            Flipboard&apos;s magazine-style layout is a solid alternative. If Flipboard is
            what you are leaving, see our{" "}
            <Link href="/blog/flipboard-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Flipboard alternatives</Link>.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. Apple News — Best on iPhone, iPad and Mac
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free; Apple News+ is a paid subscription</p>
          <p className="text-gray-600 dark:text-gray-400">
            Already on your Apple devices, with editors picking the top stories and a
            cleaner layout than SmartNews. It is only available in some countries,
            including the US, UK, Canada and Australia, and there is no Android app.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            6. Google News — Best for General Coverage
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free</p>
          <p className="text-gray-600 dark:text-gray-400">
            Google News offers broader coverage than SmartNews and is pre-installed on
            most Android phones. It&apos;s the easiest switch, though still general news.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            SmartNews is fast and clean, but it&apos;s a general news app. For tech
            news only, <strong>Trace</strong> (ours) gives you one summary per story
            from 100+ tech sources. For RSS control, <strong>Feedly</strong> or <strong>Inoreader</strong>{" "}
            are better choices. All are free to try.
          </p>

          <BlogEmailCard slug="smartnews-alternatives" placement="end" />

          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>Read Next</h3>
            <ul className="space-y-2">
              <li><Link href="/blog/flipboard-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Flipboard alternatives →</Link></li>
              <li><Link href="/blog/google-news-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Google News alternatives →</Link></li>
              <li><Link href="/blog/newsbreak-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">NewsBreak alternatives →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
