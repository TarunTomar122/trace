import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { comparePages } from "./content";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "News Reader Alternatives And Comparison Guides | Trace",
  description:
    "Compare Trace against RSS readers and traditional news apps. Find the right setup if you want less noise and faster context.",
  alternates: {
    canonical: "https://www.yourtrace.online/compare",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "News Reader Alternatives And Comparison Guides | Trace",
    description:
      "Comparison pages for people who want less noise, faster context, and a better way to follow tech news.",
    url: "https://www.yourtrace.online/compare",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "News Reader Alternatives And Comparison Guides | Trace",
    description:
      "Comparison pages for people who want less noise and faster context.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default function CompareHubPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="public-kicker">
              Comparison Guides
            </p>
            <h1 className="public-title mt-4">
              Better ways to follow tech news<br className="hidden sm:block" />
              without building another reading backlog
            </h1>
            <p className="public-deck mt-5">
              These pages are for people comparing Trace with RSS readers, traditional news apps,
              and other ways of keeping up. The idea is simple: less scrolling, more context.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/blog" className="public-chip">
                Research
              </Link>
              <Link href="/tools" className="public-chip">
                Tools
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {comparePages.map((page) => (
              <Link
                key={page.slug}
                href={`/compare/${page.slug}`}
                className="landing-card p-7 transition-all hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="public-kicker text-secondary">
                  Comparison
                </div>
                <h2 className="mt-4 text-[1.625rem] font-semibold tracking-[-0.025em] text-foreground">
                  {page.heroTitle}
                </h2>
                <p className="mt-4 text-[16px] leading-[1.7] text-secondary">
                  {page.description}
                </p>
                <div className="public-link mt-6 text-sm">
                  Read guide
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
