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
  title: "Flipboard alternatives: 6 faster news apps (2026) | Trace",
  description:
    "Quicker than Flipboard's magazine: Google News, Apple News, SmartNews, Ground News, Feedly and Trace compared, with who each one suits and what it costs.",
  keywords: [
    "flipboard alternatives",
    "flipboard alternative",
    "apps like flipboard",
    "news apps like flipboard",
    "better than flipboard",
    "flipboard replacement",
    "flipboard vs google news",
    "flipboard vs apple news",
    "best news app 2026",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/flipboard-alternatives`,
  },
  openGraph: {
    type: "article",
    title: "Flipboard alternatives: 6 faster news apps (2026)",
    description:
      "Google News, Apple News, SmartNews, Ground News, Feedly and Trace compared, with who each one suits and what it costs.",
    url: `${SITE_BASE_URL}/blog/flipboard-alternatives`,
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
        alt: "Flipboard Alternatives — Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flipboard alternatives: 6 faster news apps (2026)",
    description:
      "Google News, Apple News, SmartNews, Ground News, Feedly and Trace compared, with who each one suits and what it costs.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "Flipboard alternatives: 6 faster news apps (2026)",
    description:
      "Six Flipboard alternatives for 2026: Google News, Apple News, SmartNews, Ground News, Feedly and Trace, with who each one suits and what it costs.",
    url: `${SITE_BASE_URL}/blog/flipboard-alternatives`,
    datePublished: "2026-06-22T00:00:00Z",
    dateModified: "2026-10-19T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: "https://x.com/tarat_211",
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "Flipboard Alternatives", url: `${SITE_BASE_URL}/blog/flipboard-alternatives` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What is the best alternative to Flipboard?",
      answer:
        "It depends on what you read. For general news, Google News is the closest free swap, and its Full Coverage view puts every outlet's version of a story on one page. On an iPhone, iPad or Mac, Apple News is already installed. For a quick daily catch-up on tech and AI, Trace. If you want to choose every source yourself, Feedly.",
    },
    {
      question: "What are the best Flipboard alternatives for tech news?",
      answer:
        "Trace, if you want a short daily briefing: it reads 100+ tech sources, groups coverage of the same story and summarizes it. Feedly, if you would rather pick every source yourself.",
    },
    {
      question: "Why would I switch from Flipboard?",
      answer:
        "Flipboard's magazine layout is good for browsing but slow when you just want to know what happened. The same story can appear as several separate cards, and you open articles to find out what they say. If you read news daily, a list-style app gets you through it faster.",
    },
    {
      question: "Is Flipboard still good in 2026?",
      answer:
        "Yes, for relaxed browsing and discovering magazines and topics. If you want to get through the day's news quickly, the apps on this list are faster.",
    },
    {
      question: "Are there free Flipboard alternatives?",
      answer:
        "Yes. Google News, SmartNews and Trace are free, and Trace is also open source. Apple News is free, with a paid Apple News+ tier. Feedly and Ground News have free plans with paid upgrades.",
    },
  ]);

  const h2Class = `text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`;
  const h2Style = { fontFamily: "var(--font-space-grotesk)" };
  const cell = "border border-gray-200 dark:border-gray-800 px-4 py-2";

  return (
    <EditorialArticleShell slug="flipboard-alternatives">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />

      <div className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">Flipboard Alternatives</li>
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
            Flipboard Alternatives: 6 Faster News Apps (2026)
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>Updated <time dateTime="2026-10-19">October 19, 2026</time></span>
            <span>8 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Flipboard&apos;s magazine layout is nice for browsing. It is slow when you
            just want to know what happened today. These six apps get you there
            faster, whether you read general news or mostly tech.
          </p>

          <BlogEmailCard slug="flipboard-alternatives" placement="intro" />

          <h2 className={h2Class} style={h2Style}>
            Why Look for Flipboard Alternatives?
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>Slow to scan:</strong> big magazine cards fit fewer stories on a screen than a list</li>
            <li><strong>Same story, many cards:</strong> one event shows up once for every outlet that covered it</li>
            <li><strong>No summaries:</strong> you open each article to find out what it says</li>
            <li><strong>Hard to tune:</strong> following a topic brings in a lot you did not ask for</li>
            <li><strong>Light on tech detail:</strong> fine for headlines, thin on developer and AI news</li>
          </ul>

          <h2 className={h2Class} style={h2Style}>
            Quick Comparison Table
          </h2>
          <div className="overflow-x-auto mb-8">
            <table className="min-w-full border border-gray-200 dark:border-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className={`${cell} text-left`}>App</th>
                  <th className={`${cell} text-left`}>Price</th>
                  <th className={`${cell} text-left`}>Best for</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className={`${cell} font-medium`}><Link href="/feed?utm_source=blog&utm_medium=comparison_table&utm_campaign=flipboard-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Trace</Link></td><td className={cell}>Free, open source</td><td className={cell}>A daily tech and AI briefing</td></tr>
                <tr><td className={`${cell} font-medium`}>Google News</td><td className={cell}>Free</td><td className={cell}>General news from many outlets</td></tr>
                <tr><td className={`${cell} font-medium`}>Apple News</td><td className={cell}>Free / paid Apple News+</td><td className={cell}>iPhone, iPad and Mac</td></tr>
                <tr><td className={`${cell} font-medium`}>SmartNews</td><td className={cell}>Free</td><td className={cell}>Quick reading on your phone</td></tr>
                <tr><td className={`${cell} font-medium`}>Ground News</td><td className={cell}>Free / paid plans</td><td className={cell}>Seeing how different outlets cover a story</td></tr>
                <tr><td className={`${cell} font-medium`}>Feedly</td><td className={cell}>Free / $8/mo</td><td className={cell}>Choosing every source yourself</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className={h2Class} style={h2Style}>
            1. Trace — Best for a Daily Tech and AI Briefing
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free, open source
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            If most of what you read on Flipboard is tech and AI, Trace is the quicker
            swap. It reads 100+ tech sources, groups coverage of the same story, and
            writes one summary from all of them. The morning catch-up takes about 10
            minutes, and the list ends, so you know when you are done. Trace only covers
            tech and AI, so keep a general app for everything else.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>One story per event, with every outlet that covered it</li>
            <li>Summaries written from several sources, not one article</li>
            <li>Reddit and Hacker News discussion linked under each story</li>
            <li>A list you can scan instead of magazine cards</li>
          </ul>

          <InlineTraceCTA
            slug="flipboard-alternatives"
            blurb="Switching from Flipboard takes no setup: Trace already reads 100+ tech sources every morning and gives you one ranked briefing. Good if most of what you read on Flipboard is tech and AI."
          />

          <h2 className={h2Class} style={h2Style}>
            2. Google News — Best Free All-Round App
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            The closest like-for-like swap for general news. It is free on the web,
            Android and iPhone, and its Full Coverage view puts every outlet&apos;s
            version of a story on one page. It learns from what you follow and read.
            If you already use it and want something more focused, see our{" "}
            <Link href="/blog/google-news-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Google News alternatives</Link>.
          </p>

          <h2 className={h2Class} style={h2Style}>
            3. Apple News — Best on iPhone, iPad and Mac
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free; Apple News+ is a paid subscription
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Already on your Apple devices, with a clean layout and editors picking the
            top stories. Apple News+ adds paywalled magazines and newspapers. It is only
            available in some countries, including the US, UK, Canada and Australia,
            and there is no Android app.
          </p>

          <h2 className={h2Class} style={h2Style}>
            4. SmartNews — Best for Quick Reading on Your Phone
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            SmartNews loads articles fast and is good for scanning headlines on mobile.
            It is quicker than Flipboard, though it leans toward general news rather
            than tech.
          </p>

          <h2 className={h2Class} style={h2Style}>
            5. Ground News — Best for Seeing How Outlets Differ
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free, with paid plans
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Ground News groups each story with coverage from across the political
            spectrum and labels each outlet&apos;s leaning, so you can see who is
            covering what. Useful if you liked Flipboard for its wide mix of sources.
          </p>

          <h2 className={h2Class} style={h2Style}>
            6. Feedly — Best if You Want to Pick Every Source
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (100 sources) | Pro $8/month
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Feedly is an RSS reader: you choose exactly which sites and blogs appear,
            instead of following broad topics. It takes more setup than Flipboard, and
            in return you get full control.
          </p>

          <p className="text-gray-600 dark:text-gray-400">
            Artifact used to appear on lists like this one. It closed in 2024, and Yahoo
            folded its technology into Yahoo News; if you used it, see our{" "}
            <Link href="/blog/artifact-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Artifact alternatives</Link>.
          </p>

          <h2 className={h2Class} style={h2Style}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Flipboard is still nice for relaxed browsing. For a quicker daily read,
            Google News is the closest free swap for general news, and Apple News is
            the easy choice on Apple devices. For tech and AI,{" "}
            <Link href="/feed?utm_source=blog&utm_medium=verdict&utm_campaign=flipboard-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Trace&apos;s daily briefing</Link>{" "}
            is the 10-minute version. Pick Feedly if you want to choose every source
            yourself.
          </p>

          <BlogEmailCard slug="flipboard-alternatives" placement="end" />

          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={h2Style}>
              Read Next
            </h3>
            <ul className="space-y-2">
              <li><Link href="/blog/google-news-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Google News alternatives →</Link></li>
              <li><Link href="/blog/smartnews-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">SmartNews alternatives →</Link></li>
              <li><Link href="/blog/best-tech-news-aggregator-apps" className="text-blue-600 dark:text-blue-400 hover:underline">7 tech news aggregators compared →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
