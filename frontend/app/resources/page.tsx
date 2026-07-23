import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Tech Reading Resources, Guides & Comparisons | Trace",
  description:
    "Guides, tools, comparisons, and templates to help you build a better tech reading workflow.",
  alternates: { canonical: "https://www.yourtrace.online/resources" },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Tech Reading Resources, Guides & Comparisons | Trace",
    description:
      "Guides, tools, comparisons, and templates for building a better tech reading workflow.",
    url: "https://www.yourtrace.online/resources",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech Reading Resources, Guides & Comparisons | Trace",
    description:
      "Guides, tools, comparisons, and templates for building a better tech reading workflow.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

const RESOURCE_SECTIONS = [
  {
    title: "Guides",
    description: "Practical walkthroughs for building better tech news habits.",
    links: [
      { label: "What Is a Developer News Aggregator?", href: "/blog/developer-news-aggregator-guide" },
      { label: "Build a Personalized Developer News Feed", href: "/blog/personalized-developer-news-feed" },
      { label: "How to Stay Updated with Tech News", href: "/blog/how-to-stay-updated-with-tech-news" },
      { label: "Daily Tech Briefing Guide", href: "/blog/daily-tech-briefing-guide" },
      { label: "Information Overload Solutions", href: "/blog/information-overload-solutions" },
      { label: "AI News Digest Tools Compared", href: "/blog/ai-news-digest-tools" },
      { label: "Best Tech News Aggregator Apps 2026", href: "/blog/best-tech-news-aggregator-apps" },
    ],
  },
  {
    title: "Comparisons",
    description: "Head-to-head breakdowns of Trace vs other tools and workflows.",
    links: [
      { label: "Trace vs daily.dev", href: "/compare/daily-dev-alternative" },
      { label: "Trace vs TLDR", href: "/compare/tldr-newsletter-alternative" },
      { label: "Trace vs Feedly", href: "/compare/feedly-alternative" },
      { label: "Trace vs Inoreader", href: "/compare/trace-vs-inoreader" },
      { label: "Trace vs Manual Reading", href: "/compare/trace-vs-manual-reading" },
      { label: "Trace vs Readwise Reader", href: "/compare/trace-vs-readwise-reader" },
      { label: "All Comparisons", href: "/compare" },
    ],
  },
  {
    title: "Use Cases",
    description: "How different roles use Trace to stay current.",
    links: [
      { label: "Trace for Founders", href: "/use-cases/for-founders" },
      { label: "Trace for Developers", href: "/use-cases/for-developers" },
      { label: "Trace for PMs", href: "/use-cases/for-pms" },
      { label: "Trace for Investors", href: "/use-cases/for-investors" },
      { label: "All Use Cases", href: "/use-cases" },
    ],
  },
  {
    title: "Solutions",
    description: "Fix specific workflow problems with Trace.",
    links: [
      { label: "Stop Information Overload", href: "/solutions/info-overload" },
      { label: "Build a Morning Briefing Habit", href: "/solutions/morning-briefing-workflow" },
      { label: "Track Trends Without Doomscrolling", href: "/solutions/trend-tracking-workflow" },
      { label: "All Solutions", href: "/solutions" },
    ],
  },
  {
    title: "Newsletter Reviews",
    description: "Honest reviews of popular tech newsletters.",
    links: [
      { label: "TLDR Review", href: "/newsletters/tldr-tech" },
      { label: "Morning Brew Review", href: "/newsletters/morning-brew-tech" },
      { label: "The Hustle Review", href: "/newsletters/the-hustle" },
      { label: "All Reviews", href: "/newsletters" },
    ],
  },
  {
    title: "Product",
    description: "How Trace works, pricing, and getting started.",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Tools Directory", href: "/tools" },
      { label: "Get Started", href: "/onboarding" },
    ],
  },
];

export default function ResourcesHubPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Resources</p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.75rem]">
              Everything you need<br className="hidden sm:block" />
              to read smarter
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-[#6b7280]">
              Guides, comparisons, use cases, and tool reviews — organized by what you&apos;re
              trying to solve. Pick a section and go.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {RESOURCE_SECTIONS.map((section) => (
              <div key={section.title} className="landing-card p-7">
                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                  {section.description}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm font-medium text-[#2563eb] transition-colors hover:text-[#1d4ed8]"
                      >
                        {link.label} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
