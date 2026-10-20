import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HpJoinBox from "@/components/HpJoinBox";
import { newslettersContent } from "./content";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { NEWSLETTERS_CSS } from "@/lib/newsletters-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

export const metadata: Metadata = {
  title: "Tech Newsletter Reviews & Comparisons | Trace",
  description:
    "Honest reviews of the most popular tech newsletters. See ratings, pros, cons, and whether each one is worth your inbox space.",
  alternates: { canonical: "https://www.yourtrace.online/newsletters" },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Tech Newsletter Reviews & Comparisons | Trace",
    description:
      "Honest reviews of popular tech newsletters. Ratings, pros, and cons help you see which are worth your inbox space.",
    url: "https://www.yourtrace.online/newsletters",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech Newsletter Reviews & Comparisons | Trace",
    description:
      "Honest reviews of popular tech newsletters. See which are worth your time.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default function NewslettersHubPage() {
  return (
    <div className={`hp nl ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{NEWSLETTERS_CSS}</style>
      <PublicHeader subscribeHref="#join" />
      <main>
        <div className="nl-top">
          <section className="nl-hero">
            <p className="hp-kicker">Newsletter reviews</p>
            <h1 className="hp-h1">
              Tech newsletters,{" "}<br className="hidden sm:block" />
              actually reviewed
            </h1>
            <p className="hp-hero-p">
              Most &ldquo;best newsletters&rdquo; lists are just links. These are real reviews with ratings,
              pros, cons, and honest takes on whether each one earns its inbox real estate.
            </p>
            <div className="hp-btns">
              <Link href="/compare" className="hp-btn hp-btn-line">
                Compare Tools
              </Link>
              <Link href="/solutions" className="hp-btn hp-btn-line">
                Solutions
              </Link>
            </div>
          </section>
        </div>

        <section className="nl-grid-wrap">
          <div className="nl-grid">
            {newslettersContent.map((item) => (
              <Link
                key={item.slug}
                href={`/newsletters/${item.slug}`}
                className="nl-card"
              >
                <div className="nl-card-top">
                  <span className="nl-tag">Review</span>
                  <span className="nl-rate">
                    <span className="nl-stars" role="img" aria-label={`${item.rating} out of 5 stars`}>
                      {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </span>
                    <span aria-hidden="true">{item.rating}/5</span>
                  </span>
                </div>
                <h2 className="nl-card-title">
                  {item.name}
                </h2>
                <p className="nl-card-text">
                  {item.description}
                </p>
                <div className="nl-chips">
                  <span className="nl-chip nl-chip-freq">
                    {item.frequency}
                  </span>
                  {item.topics.slice(0, 2).map((t) => (
                    <span key={t} className="nl-chip">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="nl-more">
                  Read review
                </div>
              </Link>
            ))}
          </div>
        </section>

        <HpJoinBox heading="Get the brief in your inbox every morning" source="newsletters" />
      </main>
      <Footer variant="landing" />
    </div>
  );
}
