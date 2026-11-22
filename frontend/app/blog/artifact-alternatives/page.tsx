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
  title: "Artifact alternatives: 5 AI news apps after the shutdown | Trace",
  description:
    "Artifact closed in 2024. Particle, Perplexity, Feedly, Inoreader and Ground News compared on price and summaries, plus Trace, which we make.",
  keywords: [
    "artifact news alternatives",
    "artifact app alternative",
    "artifact news app shut down",
    "AI news app alternative",
    "artifact alternatives 2026",
    "best AI news app",
    "news app like artifact",
    "AI news aggregator",
    "personalized news app",
    "Trace news app",
  ],
  alternates: {
    canonical: `${SITE_BASE_URL}/blog/artifact-alternatives`,
  },
  openGraph: {
    type: "article",
    title: "Artifact alternatives: 5 AI news apps after the shutdown",
    description: "Artifact closed in 2024. Particle, Perplexity, Feedly, Inoreader and Ground News compared on price and summaries, plus Trace, which we make.",
    url: `${SITE_BASE_URL}/blog/artifact-alternatives`,
    siteName: "Trace",
    locale: "en_US",
    publishedTime: "2026-06-22T00:00:00Z",
    modifiedTime: "2026-10-19T00:00:00Z",
    authors: ["https://x.com/tarat_211"],
    images: [{ url: `${SITE_BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: "Artifact Alternatives — Trace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Artifact alternatives: 5 AI news apps after the shutdown",
    description: "Artifact closed in 2024. Particle, Perplexity, Feedly, Inoreader and Ground News compared on price and summaries, plus Trace, which we make.",
    images: [`${SITE_BASE_URL}/twitter-image`],
    creator: "@tarat_211",
  },
};

export default function BlogPost() {
  const blogPostSchema = generateBlogPostingSchema({
    headline: "Artifact alternatives: 5 AI news apps after the shutdown",
    description: "Artifact closed in 2024. Particle, Perplexity, Feedly, Inoreader and Ground News compared on price and summaries, plus Trace, which we make.",
    url: `${SITE_BASE_URL}/blog/artifact-alternatives`,
    datePublished: "2026-06-22T00:00:00Z",
    dateModified: "2026-10-19T00:00:00Z",
    authorName: "Tarun Tomar",
    authorUrl: `${SITE_BASE_URL}/about`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: "Artifact Alternatives", url: `${SITE_BASE_URL}/blog/artifact-alternatives` },
  ]);

  const faqSchema = generateFAQSchema([
    {
      question: "What happened to the Artifact news app?",
      answer: "Artifact was an AI news app built by Instagram's co-founders, Kevin Systrom and Mike Krieger. They announced in January 2024 that it would shut down, and in April 2024 Yahoo bought it and folded its personalization technology into Yahoo News.",
    },
    {
      question: "What is a good alternative to Artifact?",
      answer: "For a personalized daily briefing, Particle is the closest match. For on-demand research on a story, Perplexity. To choose every source yourself, Feedly or Inoreader. If you mainly read tech and AI news, Trace, which we make, groups each story across outlets and summarizes it, free.",
    },
    {
      question: "Is Artifact news app still available?",
      answer: "No. Its founders announced in January 2024 that it would close, and Yahoo bought it that April and folded its technology into Yahoo News. There is no standalone Artifact app, so former users need a different one.",
    },
    {
      question: "Which AI news apps summarize a story across outlets?",
      answer: "Particle groups coverage from several outlets into a short summary of each story. Perplexity writes a cited summary when you ask about a topic. Trace, which we make, groups tech and AI coverage from 100+ sources into one story and links each original report under the summary. Feedly and Inoreader summarize one article at a time on their paid plans.",
    },
  ]);

  return (
    <EditorialArticleShell slug="artifact-alternatives">
      <StructuredDataList schemas={[blogPostSchema, breadcrumbSchema, faqSchema]} />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/blog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 dark:text-white font-medium" aria-current="page">Artifact Alternatives</li>
          </ol>
        </nav>
        <Link href="/blog" className="text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block">← Back to Blog</Link>

        <header className="mb-8">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Comparisons</span>
          <h1 className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Artifact Alternatives: 5 AI News Apps After the Shutdown
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span><time dateTime="2026-06-22">June 22, 2026</time></span>
            <span>4 min read</span>
            <span>By <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:text-blue-400">Tarun Tomar</a></span>
          </div>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Artifact was one of the most ambitious AI news apps — built by Instagram&apos;s
            co-founders with headline rewriting, personalization, and AI summaries. It closed in
            2024: its founders announced the shutdown in January, and Yahoo bought it that
            April and folded its technology into Yahoo News. Here are five apps that do a similar
            job today, with what each costs.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            We make Trace, so it&apos;s listed separately below.
          </p>

          <BlogEmailCard slug="artifact-alternatives" placement="intro" />

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            What Artifact Did Well, and What It Lacked
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li><strong>It is gone:</strong> the standalone app closed in 2024, so you need a replacement either way</li>
            <li><strong>No story grouping:</strong> each article was treated on its own, with no multi-source comparison</li>
            <li><strong>Filter bubble risk:</strong> aggressive personalization could turn into an echo chamber</li>
            <li><strong>Single-source summaries:</strong> the AI summarized one article at a time, not across publications</li>
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
                  <th className="border border-gray-200 dark:border-gray-800 px-4 py-2 text-left">Multi-Source AI</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Particle News</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / $2.99/mo</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Personalization</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Across outlets</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Perplexity</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / $20/mo</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Research</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">On-demand</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Feedly</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">RSS Control</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Single-article (Pro+)</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Inoreader</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / Pro from €6.67/mo</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Power Users</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Single-article (Pro)</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Ground News</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free / paid plans</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Bias Awareness</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Coverage comparison</td></tr>
                <tr><td className="border border-gray-200 dark:border-gray-800 px-4 py-2 font-medium">Trace (ours)</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Free, open source</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">Tech and AI news only</td><td className="border border-gray-200 dark:border-gray-800 px-4 py-2">One per story, across outlets</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            1. Particle News — Best for Personalized Briefings
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free | Particle+ from $2.99/month</p>
          <p className="text-gray-600 dark:text-gray-400">
            Particle takes the personalization-first approach similar to Artifact. It
            learns your interests and tailors your daily briefing. The design is clean
            and there&apos;s a clear &quot;you&apos;re done&quot; signal.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            2. Perplexity — Best for On-Demand Research
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free | Pro $20/month</p>
          <p className="text-gray-600 dark:text-gray-400">
            Perplexity is a research assistant, not a news feed. Ask it about any topic
            and get a cited, multi-source summary. Great for deep dives on specific
            stories that Artifact only summarized from one angle.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            3. Feedly — Best for RSS Control
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (100 sources) | paid Pro and Pro+ plans</p>
          <p className="text-gray-600 dark:text-gray-400">
            If you want to choose exactly which sources appear in your feed, Feedly
            gives you that control. Its AI assistant, Leo, is on the Pro+ plan.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            4. Inoreader — Best for Power Users
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free (150 feeds) | Pro from €6.67/month billed yearly</p>
          <p className="text-gray-600 dark:text-gray-400">
            Inoreader&apos;s rules engine and advanced filtering make it the power-user
            choice. Track specific keywords and competitors across sources.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            5. Ground News — Best for Bias-Aware Reading
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free plan | paid plans</p>
          <p className="text-gray-600 dark:text-gray-400">
            Ground News shows you how different outlets across the political spectrum
            cover the same story, a view Artifact never offered.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The one we make: Trace
          </h2>
          <p className="text-gray-600 dark:text-gray-400"><strong>Price:</strong> Free, open source</p>
          <p className="text-gray-600 dark:text-gray-400">
            Trace covers tech and AI news only. Instead of summarizing one article at a
            time, it reads 100+ tech sources, groups coverage of the same event into one
            story, and writes a short summary with links to each original report. You
            read it on the web or as a daily email at 08:30 UK time.
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-4">
            <li>One summary per story, written from several outlets</li>
            <li>Links to each original report under the summary</li>
            <li>Choose your topics and 5, 10 or 15 stories</li>
            <li>Free for everyone, and open source</li>
          </ul>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            If you miss Artifact&apos;s personalized feed, <strong>Particle</strong> is the
            closest match. For digging into one story, <strong>Perplexity</strong>. For
            choosing every source, <strong>Feedly</strong> or <strong>Inoreader</strong>. If
            you mainly read tech and AI news, <strong>Trace</strong> (ours) gives you one
            summary per story across outlets. All of them can be used free.
          </p>

          <BlogEmailCard slug="artifact-alternatives" placement="end" />

          <hr className="my-10 border-gray-200 dark:border-gray-800" />
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-3 ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>Read Next</h3>
            <ul className="space-y-2">
              <li><Link href="/blog/best-ai-news-apps-2026" className="text-blue-600 dark:text-blue-400 hover:underline">AI news apps: 6 compared on price and platforms →</Link></li>
              <li><Link href="/blog/ai-news-digest-tools" className="text-blue-600 dark:text-blue-400 hover:underline">AI news digest tools compared →</Link></li>
              <li><Link href="/blog/google-news-alternatives" className="text-blue-600 dark:text-blue-400 hover:underline">Google News alternatives for tech readers →</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </EditorialArticleShell>
  );
}
