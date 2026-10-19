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
      { label: "AI news for non-technical founders", href: "/blog/ai-news-for-non-technical-founders" },
      { label: "A daily AI briefing for founders", href: "/blog/daily-ai-briefing-for-founders" },
      { label: "How to follow AI model releases", href: "/blog/how-to-follow-ai-model-releases" },
      { label: "Daily Tech Briefing Guide", href: "/blog/daily-tech-briefing-guide" },
      { label: "Information Overload Solutions", href: "/blog/information-overload-solutions" },
      { label: "AI News Digest Tools Compared", href: "/blog/ai-news-digest-tools" },
      { label: "Best Tech News Aggregator Apps 2026", href: "/blog/best-tech-news-aggregator-apps" },
    ],
  },
  {
    title: "Comparisons",
    description: "Alternatives to the apps you use now, and Trace side by side with other tools and workflows.",
    links: [
      { label: "Feedly alternatives", href: "/blog/feedly-alternatives" },
      { label: "Flipboard alternatives", href: "/blog/flipboard-alternatives" },
      { label: "Google News alternatives", href: "/blog/google-news-alternatives" },
      { label: "daily.dev alternatives", href: "/blog/daily-dev-alternatives" },
      { label: "TLDR newsletter alternatives", href: "/blog/tldr-newsletter-alternatives" },
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
      { label: "Open the feed", href: "/feed" },
    ],
  },
];

export default function ResourcesHubPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/feed" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="public-kicker">Resources</p>
            <h1 className="public-title mt-4">
              Everything you need<br className="hidden sm:block" />
              to read smarter
            </h1>
            <p className="public-deck mt-5">
              Guides, comparisons, use cases, and tool reviews, organized by what you&apos;re
              trying to solve. Pick a section and go.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-x-12 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
            {RESOURCE_SECTIONS.map((section) => (
              <section key={section.title} className="public-list-section">
                <h2 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-foreground">
                  {section.title}
                </h2>
                <p className="mt-2 text-[16px] leading-[1.65] text-secondary">
                  {section.description}
                </p>
                <ul className="mt-5 space-y-3">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="group flex items-start justify-between gap-4 text-[15px] font-medium leading-6 text-foreground transition-colors hover:text-accent"
                      >
                        <span>{link.label}</span>
                        <span aria-hidden="true" className="text-secondary transition-transform group-hover:translate-x-0.5">↗</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
