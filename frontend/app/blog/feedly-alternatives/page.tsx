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
  title: "Free Feedly Alternatives: 7 Options Compared (2026) | Trace",
  description:
    "7 Feedly alternatives you can start free in 2026: Inoreader, NewsBlur, Miniflux, NetNewsWire, Fluent Reader, Reeder, and Trace, a free AI tech news brief.",
  keywords: [
    "feedly alternative",
    "feedly alternatives",
    "feedly alternative free",
    "free alternative to feedly",
    "feedly free alternative",
    "feedly alternatives free",
    "feedly alternatives reddit",
    "feedly alternative android",
    "best feedly alternatives",
    "RSS reader alternative",
    "feedly vs inoreader",
    "free RSS reader",
    "news aggregator free",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/feedly-alternatives`,
  },
  openGraph: {
    type: "article",
    title: "Free Feedly Alternatives: 7 Options Compared (2026)",
    description:
      "7 Feedly alternatives you can start free in 2026, from Inoreader and NewsBlur to NetNewsWire, with prices and who each one suits.",
    url: `${SITE_BASE_URL}/blog/feedly-alternatives`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-05-04T00:00:00Z",
    modifiedTime: "2026-10-28T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [
      {
        url: `${SITE_BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Feedly Alternatives — Trace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Feedly Alternatives: 7 Options Compared (2026)",
    description:
      "7 Feedly alternatives you can start free in 2026, with prices and who each one suits.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "Free Feedly Alternatives: 7 Options Compared (2026)",
    description:
      "Seven Feedly alternatives you can start free in 2026: Inoreader, NewsBlur, Miniflux, NetNewsWire, Fluent Reader, Reeder, and Trace, with prices and who each one suits.",
    url: `${SITE_BASE_URL}/blog/feedly-alternatives`,
    datePublished: "2026-05-04T00:00:00Z",
    dateModified: "2026-10-28T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: "https://x.com/tarat_211",
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "Feedly Alternatives", url: `${SITE_BASE_URL}/blog/feedly-alternatives` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What is the best free alternative to Feedly?",
      answer:
        "It depends on what you want from Feedly. For a free RSS reader with more on the free plan, Inoreader (150 feeds). For free and open source, NetNewsWire on Mac and iOS, Fluent Reader on Windows and macOS, or Miniflux if you self-host. If you would rather not manage feeds at all, Trace is a free, open-source tech and AI news brief that groups each story once from 100+ sources.",
    },
    {
      question: "Why should I switch from Feedly to another RSS reader?",
      answer:
        "Feedly's free plan is limited to 100 sources and 3 folders, search is a paid feature, and its AI assistant, Leo, is on the Pro+ plan. Inoreader includes more on its free plan, open-source readers cost nothing, and Trace includes its summaries for free.",
    },
    {
      question: "Is Trace better than Feedly?",
      answer:
        "They do different jobs. Trace is the better fit if you want a ready-made, summarized brief of tech and AI news with no setup. It is free for everyone: every story, Pulse, the archive, and a daily email you can customize. Feedly is the better fit if you want to choose every source and read everything those sources publish.",
    },
    {
      question: "Are there any completely free RSS readers like Feedly?",
      answer:
        "Yes. NetNewsWire (Mac and iOS) and Fluent Reader (Windows and macOS) are free and open source, and Miniflux and NewsBlur are free if you self-host them. Inoreader, NewsBlur and Feedly also have free hosted plans with source limits. Trace is free too, but it is a news brief rather than an RSS reader.",
    },
  ]);

  return (
    <EditorialArticleShell slug="feedly-alternatives">
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
              Feedly Alternatives
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
            Comparisons
          </span>
          <h1
            className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`}
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Free Feedly Alternatives: 7 Options Compared (2026)
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>Updated <time dateTime="2026-10-28">October 28, 2026</time></span>
            <span>8 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Looking for a free Feedly alternative? All seven below are free to
            start: NetNewsWire and Fluent Reader are free, open-source RSS apps,
            Miniflux is free if you host it yourself, Inoreader and NewsBlur
            have free plans, and Reeder is a free download with a paid
            subscription. The seventh, Trace, is not an RSS reader: it
            is a free, open-source tech and AI news brief that groups each story
            once, however many outlets cover it, and can email it to you each
            morning.
          </p>

          <BlogEmailCard slug="feedly-alternatives" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Why Look for Feedly Alternatives?
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Feedly is one of the most widely used RSS readers, and its free plan
            is enough for many people. The usual reasons to look elsewhere:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>The free plan stops at 100 sources and 3 folders</li>
            <li>Search is a paid feature</li>
            <li>The AI assistant, Leo, is only on the Pro+ plan</li>
            <li>Each outlet&apos;s version of the same story shows up separately</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400">
            If you want more on a free plan, open-source software, or a summary
            instead of a feed, one of these should fit.
          </p>

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
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Trace</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Quick Catch-Up</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✓ Free, one per story</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Inoreader</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / €6.67/mo</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Power Users</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✓ (Pro)</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">NewsBlur</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / $36/year</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Open Source Fans</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✓ (Archive plan)</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Miniflux</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free (Self-hosted)</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Self-Hosters</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✗</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Reeder</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / $14.99/year</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Apple Users</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✗</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">NetNewsWire</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Mac/iOS Users</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✗</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Fluent Reader</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Desktop Users</td>
                  <td className="border border-gray-200 dark:border-gray-800 px-4 py-2">✗</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Trace — Best Feedly Alternative for Quick Catch-Up
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            If you mostly use Feedly to keep up with tech and AI news and are
            tired of maintaining feeds, Trace takes a different approach. It
            reads 100+ sources for you and groups each story once, however many
            outlets cover it, with a short summary and links to every source.
            It does not import OPML or follow your own feeds, so it replaces
            Feedly only if a ranked brief suits you better than every post from
            your own list.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>No setup required: pick a few topics, or just open the brief</li>
            <li>Each story grouped once across 100+ sources, with a summary</li>
            <li>Optional daily email around 8:30am UK time</li>
            <li>Free for everyone, open source</li>
          </ul>
          <InlineTraceCTA
            slug="feedly-alternatives"
            blurb="Skip the RSS setup. Trace already reads 100+ tech sources and hands you one ranked briefing — model releases, company news, and what actually changed."
          />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Inoreader — Best for Power Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free tier | Pro from €6.67/month
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Inoreader is like Feedly but with more advanced filtering and rules.
            It&apos;s the best Feedly alternative for power users who want
            fine-grained control.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>Advanced filtering rules</li>
            <li>Newsletter feeds</li>
            <li>AI summaries (Pro)</li>
            <li>Power-user features</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. NewsBlur — Best Open Source Option
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (64 sites, or self-hosted) | Premium $36/year | Premium Archive $99/year
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            NewsBlur is open source under the MIT license and can be
            self-hosted. The hosted free plan follows up to 64 sites, and the
            Premium Archive plan adds a full archive, Ask AI and a daily
            briefing. A good fit for privacy-conscious readers.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. Miniflux — Best for Self-Hosters
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free (self-hosted)
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Miniflux is a minimalist RSS reader you can self-host. It&apos;s the
            best Feedly alternative for developers who want full control.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. Reeder — Best for Apple Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free download | subscription $1.99/month or $14.99/year (US App Store)
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Reeder is a carefully designed reader for iPhone, iPad and Mac. The
            current app moved to a subscription in 2024; the older
            one-time-purchase version is still sold separately as Reeder
            Classic. A good fit if you are deep in the Apple ecosystem.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            6. NetNewsWire — Best Free Mac/iOS Option
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            NetNewsWire is free, fast, and open source. It&apos;s the best free
            Feedly alternative for Mac and iOS users.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            7. Fluent Reader — Best Desktop Option
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Price:</strong> Free
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Fluent Reader is a free, open-source desktop RSS reader for Windows
            and macOS with a clean interface. It is free to download from its
            GitHub releases. A good fit if you read on a desktop.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            If you want the simplest Feedly alternative with AI summaries, try{" "}
            <Link href="/feed?utm_source=blog&utm_medium=verdict&utm_campaign=feedly-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Trace&apos;s daily AI briefing
            </Link>
            {" "}
            (or start from the{" "}
            <Link href="/?utm_source=blog&utm_medium=verdict&utm_campaign=feedly-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              homepage
            </Link>
            ). If you want power-user features, try{" "}
            <strong>Inoreader</strong>. If you want open source, try{" "}
            <strong>NewsBlur</strong>.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            The best RSS reader is the one you actually use. Try a few and see
            what sticks.
          </p>

          <BlogEmailCard slug="feedly-alternatives" placement="end" />

          {/* Internal cross-linking */}
          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Read Next
            </h3>
            <ul className="space-y-2">
              <li><Link href="/blog/inoreader-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Inoreader alternatives →</Link></li>
              <li><Link href="/blog/newsblur-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">NewsBlur alternatives →</Link></li>
              <li><Link href="/blog/best-tech-news-aggregator-apps" className="text-blue-600 dark:text-blue-400 hover:underline">7 tech news aggregators compared →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
