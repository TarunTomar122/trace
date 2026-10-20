import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HpJoinBox from "@/components/HpJoinBox";
import { comparePages } from "./content";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { COMPARE_CSS } from "@/lib/compare-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

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

// Roundups of alternatives live on the blog; these are the ones people search for.
const ALTERNATIVES = [
  { label: "Feedly alternatives", href: "/blog/feedly-alternatives" },
  { label: "Flipboard alternatives", href: "/blog/flipboard-alternatives" },
  { label: "Google News alternatives", href: "/blog/google-news-alternatives" },
  { label: "Inoreader alternatives", href: "/blog/inoreader-alternatives" },
  { label: "Techmeme alternatives", href: "/blog/techmeme-alternatives" },
  { label: "daily.dev alternatives", href: "/blog/daily-dev-alternatives" },
  { label: "TLDR alternatives", href: "/blog/tldr-newsletter-alternatives" },
  { label: "Ground News alternatives", href: "/blog/ground-news-alternatives-for-tech" },
];

export default function CompareHubPage() {
  return (
    <div className={`hp cmp ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{COMPARE_CSS}</style>
      <PublicHeader subscribeHref="#join" />
      <main>
        <div className="cmp-top">
          <section className="cmp-hero">
            <p className="hp-kicker">
              Comparison Guides
            </p>
            <h1 className="hp-h1">
              Better ways to follow tech news{" "}<br className="hidden sm:block" />
              without building another reading backlog
            </h1>
            <p className="hp-hero-p">
              These pages are for people comparing Trace with RSS readers, traditional news apps,
              and other ways of keeping up. The idea is simple: less scrolling, more context.
            </p>
            <div className="cmp-links">
              <Link href="/blog" className="hp-btn hp-btn-line">
                Guides
              </Link>
              <Link href="/tools" className="hp-btn hp-btn-line">
                Tools
              </Link>
            </div>
            <p className="cmp-leaving">Leaving a specific app?</p>
            <div className="cmp-links cmp-links-tight">
              {ALTERNATIVES.map((item) => (
                <Link key={item.href} href={item.href} className="cmp-chip">
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="cmp-grid-wrap">
          <div className="cmp-grid">
            {comparePages.map((page) => (
              <Link
                key={page.slug}
                href={`/compare/${page.slug}`}
                className="cmp-card"
              >
                <div className="cmp-tag">
                  Comparison
                </div>
                <h2 className="cmp-card-title">
                  {page.heroTitle}
                </h2>
                <p className="cmp-card-text">
                  {page.description}
                </p>
                <div className="cmp-more">
                  Read guide
                </div>
              </Link>
            ))}
          </div>
        </section>

        <HpJoinBox heading="Get the brief in your inbox every morning" source="compare" />
      </main>
      <Footer variant="landing" />
    </div>
  );
}
