import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HpJoinBox from "@/components/HpJoinBox";
import { newslettersContent } from "../content";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TWITTER_IMAGE,
  SITE_BASE_URL,
  generateBreadcrumbSchema,
  metadataTitle,
} from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { NEWSLETTERS_CSS } from "@/lib/newsletters-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return newslettersContent.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = newslettersContent.find((p) => p.slug === slug);
  if (!page) return {};
  const url = `https://www.yourtrace.online/newsletters/${slug}`;
  return {
    title: metadataTitle(`${page.name} newsletter review`),
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      title: `${page.name} Review | Tech Newsletter Reviews | Trace`,
      description: page.description,
      url,
      siteName: "Trace",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.name} Review | Trace`,
      description: page.description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export default async function NewsletterDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = newslettersContent.find((p) => p.slug === slug);
  if (!page) notFound();

  const pageUrl = `${SITE_BASE_URL}/newsletters/${slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${page.name} newsletter review`,
    description: page.description,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    author: {
      "@type": "Organization",
      name: "Trace",
      url: SITE_BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Trace",
      url: SITE_BASE_URL,
    },
  };
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Newsletter Reviews", url: `${SITE_BASE_URL}/newsletters` },
    { name: page.name, url: pageUrl },
  ]);

  return (
    <div className={`hp nl nl-detail ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{NEWSLETTERS_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, breadcrumbSchema]) }}
      />
      <PublicHeader subscribeHref="#join" />
      <main>
        <article>
          <div className="nl-top">
            <div className="nl-hero">
              <Link href="/newsletters" className="nl-crumb">
                Newsletter Reviews
              </Link>
              <h1 className="hp-h1">
                {page.name}
              </h1>
              <p className="hp-hero-p">
                {page.description}
              </p>

              <div className="nl-meta">
                <span className="nl-chip nl-chip-freq">
                  {page.frequency}
                </span>
                {page.topics.map((t) => (
                  <span key={t} className="nl-chip">
                    {t}
                  </span>
                ))}
              </div>

              <div className="hp-btns">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hp-btn hp-btn-line nl-visit"
                >
                  Visit {page.name} ↗
                </a>
              </div>
            </div>
          </div>

          <div className="nl-band">
            <section className="nl-panels">
              <div className="nl-panel nl-pros">
                <h2 className="hp-h3 nl-panel-title">
                  <span className="nl-sign" aria-hidden="true">+</span> Pros
                </h2>
                <ul className="nl-list">
                  {page.pros.map((pro) => (
                    <li key={pro}>{pro}</li>
                  ))}
                </ul>
              </div>

              <div className="nl-panel nl-cons">
                <h2 className="hp-h3 nl-panel-title">
                  <span className="nl-sign" aria-hidden="true">−</span> Cons
                </h2>
                <ul className="nl-list">
                  {page.cons.map((con) => (
                    <li key={con}>{con}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="nl-wrap">
            <section className="nl-method">
              <h2 className="hp-h2 nl-h2">How we reviewed it</h2>
              <p>
                We assessed {page.name} on its {page.frequency.toLowerCase()} publishing cadence,
                coverage of {page.topics.join(", ")}, signal-to-noise ratio, and the amount of
                context each issue gives readers. Nothing here is sponsored or paid for by the
                newsletter. Use the pros and cons above to decide whether its format fits your
                own news routine.
              </p>
            </section>

            <section className="nl-cta">
              <h2 className="hp-h2 nl-h2">
                Want a better way than managing newsletters?
              </h2>
              <p>
                Trace is a free daily brief of tech and AI news from 100+ sources,
                grouping coverage of the same event into one story with links to each
                original report. We make it.
              </p>
              <div className="hp-btns">
                <Link href="/compare" className="hp-btn hp-btn-dark">
                  See how Trace compares
                </Link>
              </div>
            </section>

            <section className="nl-explore">
              <p className="nl-explore-label">Explore more:</p>
              <div className="nl-rel-grid">
                <Link href="/newsletters" className="nl-rel-card">
                  All reviews
                </Link>
                <Link href="/compare" className="nl-rel-card">
                  Compare Tools
                </Link>
                <Link href="/feed" className="nl-rel-card">
                  Get Started
                </Link>
              </div>
            </section>
          </div>
        </article>

        <HpJoinBox heading="Get Trace Daily in your inbox every morning" source="newsletters" />
      </main>
      <Footer variant="landing" />
    </div>
  );
}
