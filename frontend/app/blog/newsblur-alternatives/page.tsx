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

const TITLE = "NewsBlur alternatives: 5 RSS readers and their free plans";
const DESCRIPTION =
  "Feedly, Inoreader, Miniflux, FreshRSS and The Old Reader: free-plan limits, prices and which you can self-host. Plus Trace, which we make.";

export const metadata: Metadata = {
  title: `${TITLE} | Trace`,
  description: DESCRIPTION,
  keywords: [
    "newsblur alternatives",
    "newsblur alternative free",
    "open source RSS reader",
    "newsblur vs feedly",
    "self hosted RSS reader",
    "RSS reader alternative",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/newsblur-alternatives`,
  },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_BASE_URL}/blog/newsblur-alternatives`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-06-22T00:00:00Z",
    modifiedTime: "2026-06-22T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [{ url: `${SITE_BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: "NewsBlur Alternatives — Trace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

const cell = "border border-gray-200 dark:border-gray-800 px-4 py-2";

const faqs = [
  {
    question: "Is NewsBlur still maintained?",
    answer:
      "Yes. NewsBlur is open source (MIT) and still has a hosted service, with a free plan of 64 sites and paid plans at $36 and $99 a year.",
  },
  {
    question: "What is the best self-hosted alternative to NewsBlur?",
    answer:
      "Miniflux is a fast, minimal self-hosted reader (Apache 2.0). FreshRSS (AGPL) supports several users and extensions. Both are free to run on your own server, and NewsBlur itself can also be self-hosted.",
  },
  {
    question: "Which NewsBlur alternatives have a free plan?",
    answer:
      "Feedly (100 sources), Inoreader (150 feeds) and The Old Reader all have free plans. Miniflux and FreshRSS are free if you host them yourself. Trace, which we make, is free and open source, but it is a daily tech news brief rather than an RSS reader.",
  },
];

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: TITLE,
    description: DESCRIPTION,
    url: `${SITE_BASE_URL}/blog/newsblur-alternatives`,
    datePublished: "2026-06-22T00:00:00Z",
    dateModified: "2026-06-22T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: `${SITE_BASE_URL}/about`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "NewsBlur Alternatives", url: `${SITE_BASE_URL}/blog/newsblur-alternatives` },
  ]);

  const faqSchema = generateFAQSchema(faqs);

  return (
    <EditorialArticleShell slug="newsblur-alternatives">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">NewsBlur Alternatives</li>
          </ol>
        </nav>
        <Link href="/blog" className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">← Back to Blog</Link>

        <header className="mb-8">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Comparisons</span>
          <h1 className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            NewsBlur Alternatives: 5 RSS Readers and Their Free Plans
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span><time dateTime="2026-06-22">June 22, 2026</time></span>
            <span>6 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            NewsBlur is an open-source RSS reader (MIT) with a hosted service and
            a free plan of 64 sites. People look elsewhere when they want a larger
            free plan, a simpler interface, or something they can run on their own
            server. Here are five RSS readers to compare. We make Trace, so it&apos;s
            listed separately below.
          </p>

          <BlogEmailCard slug="newsblur-alternatives" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Why Look for NewsBlur Alternatives?
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>Small free plan:</strong> 64 sites; Premium is $36/year for 1,024 sites</li>
            <li><strong>AI features are on the top plan:</strong> Ask AI and Daily Briefing come with Premium Archive at $99/year</li>
            <li><strong>Self-hosting takes some setup:</strong> it runs as a set of Docker services</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Quick Comparison Table
          </h2>
          <div className="overflow-x-auto mb-8">
            <table className="min-w-full border border-gray-200 dark:border-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className={`${cell} text-left`}>App</th>
                  <th className={`${cell} text-left`}>Price</th>
                  <th className={`${cell} text-left`}>Best For</th>
                  <th className={`${cell} text-left`}>Self-Hosted</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${cell} font-medium`}>Feedly</td>
                  <td className={cell}>Free (100 sources) / paid plans</td>
                  <td className={cell}>Beginners</td>
                  <td className={cell}>No</td>
                </tr>
                <tr>
                  <td className={`${cell} font-medium`}>Inoreader</td>
                  <td className={cell}>Free (150 feeds) / Pro</td>
                  <td className={cell}>Power users</td>
                  <td className={cell}>No</td>
                </tr>
                <tr>
                  <td className={`${cell} font-medium`}>Miniflux</td>
                  <td className={cell}>Free (self-hosted) / $15/yr hosted</td>
                  <td className={cell}>Minimalists</td>
                  <td className={cell}>Yes</td>
                </tr>
                <tr>
                  <td className={`${cell} font-medium`}>FreshRSS</td>
                  <td className={cell}>Free</td>
                  <td className={cell}>Self-hosting, several users</td>
                  <td className={cell}>Yes</td>
                </tr>
                <tr>
                  <td className={`${cell} font-medium`}>The Old Reader</td>
                  <td className={cell}>Free / paid plan</td>
                  <td className={cell}>Plain RSS reading</td>
                  <td className={cell}>No</td>
                </tr>
                <tr>
                  <td className={`${cell} font-medium`}>Trace (ours)</td>
                  <td className={cell}>Free, open source (AGPL)</td>
                  <td className={cell}>Tech news, no feeds</td>
                  <td className={cell}>No</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Feedly — Best for Beginners
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (100 sources, 3 folders) | paid plans add search and AI. Check feedly.com for current prices.</p>
          <p className="text-gray-600 dark:text-gray-400">
            Feedly has a cleaner, simpler interface than NewsBlur, polished iOS and
            Android apps, and a large library of suggested sources. Its AI
            assistant, Leo, is on the Pro+ plan.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Inoreader — Best for Power Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (150 feeds, search included) | Pro from €6.67/month billed yearly</p>
          <p className="text-gray-600 dark:text-gray-400">
            Inoreader&apos;s free plan allows more feeds than NewsBlur&apos;s 64 sites. Rules,
            filters, newsletter feeds and AI summaries are on Pro. The interface has
            more settings than many people need.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. Miniflux — Best for Minimalists
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (self-hosted, Apache 2.0) | Hosted $15/year</p>
          <p className="text-gray-600 dark:text-gray-400">
            Miniflux is a fast, keyboard-driven reader with a plain interface and
            little JavaScript. Run it yourself for free, or pay $15 a year for the
            developer&apos;s hosted version.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. FreshRSS — Best Free Self-Hosted Reader
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (open source, AGPL)</p>
          <p className="text-gray-600 dark:text-gray-400">
            FreshRSS supports several users on one install, works in a mobile
            browser, has themes and extensions, and syncs with mobile RSS apps
            through its API. It runs on your own server or a cheap VPS.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. The Old Reader — Best for Simplicity
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free | paid plan raises the feed limit to 500, with a 14-day free trial</p>
          <p className="text-gray-600 dark:text-gray-400">
            The Old Reader recreates the Google Reader experience: a plain,
            chronological list of posts from the sites you follow, with no AI and
            no rules engine. The site does not list the paid price publicly, so
            check it when you sign up.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The one we make: Trace
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free, open source (AGPL)</p>
          <p className="text-gray-600 dark:text-gray-400">
            Trace is not an RSS reader. It reads 100+ tech sources for you, groups
            coverage of one event into one story, and gives it an AI summary with
            links to each original report. You can choose topics and 5, 10 or 15
            stories, and read it on the web, in a daily email at 08:30 UK time, in
            the <Link href="/brief" className="text-blue-600 dark:text-blue-400 hover:underline">brief archive</Link>, with the Chrome
            extension, or through your AI assistant with read-only access
            (<Link href="/agents" className="text-blue-600 dark:text-blue-400 hover:underline">setup</Link>). It does not import OPML or
            follow your own feeds, so it suits you only if a short brief is what
            you want instead of every post from your list.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Which One to Pick
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            For a simpler hosted reader, <strong>Feedly</strong>. For a bigger free
            plan with more features, <strong>Inoreader</strong>. To run it yourself,{" "}
            <strong>Miniflux</strong> (minimal) or <strong>FreshRSS</strong> (more
            features). For plain RSS, <strong>The Old Reader</strong>. Most have a
            free plan, so try two or three with an OPML export from NewsBlur.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Frequently Asked Questions
          </h2>
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{faq.question}</h3>
              <p className="text-gray-600 dark:text-gray-400">{faq.answer}</p>
            </div>
          ))}

          <BlogEmailCard slug="newsblur-alternatives" placement="end" />

          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>Read Next</h3>
            <ul className="space-y-2">
              <li><Link href="/blog/feedly-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Feedly alternatives: free-plan limits for 6 readers →</Link></li>
              <li><Link href="/blog/inoreader-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Inoreader alternatives: 7 readers and their free plans →</Link></li>
              <li><Link href="/blog/best-rss-reader-apps" className="text-blue-600 dark:text-blue-400 hover:underline">RSS reader apps: 5 free picks compared →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
