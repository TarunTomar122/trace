import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HpJoinBox from "@/components/HpJoinBox";
import { comparePages, getComparePage } from "../content";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TWITTER_IMAGE,
  generateBreadcrumbSchema,
  generateFAQSchema,
  SITE_BASE_URL,
} from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { COMPARE_CSS } from "@/lib/compare-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return comparePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparePage(slug);

  if (!page) {
    return {
      title: "Comparison Not Found | Trace",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonical = `https://www.yourtrace.online/compare/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical,
    },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      title: page.title,
      description: page.description,
      url: canonical,
      type: "article",
      siteName: "Trace",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export default async function CompareDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getComparePage(slug);

  if (!page) {
    notFound();
  }

  const canonical = `https://www.yourtrace.online/compare/${page.slug}`;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Comparisons", url: `${SITE_BASE_URL}/compare` },
    { name: page.heroTitle, url: canonical },
  ]);
  const faqSchema = generateFAQSchema(page.faq);
  // Closest comparisons first; without a list, the next pages in order (so
  // every page doesn't link the same first four).
  const index = comparePages.findIndex((candidate) => candidate.slug === page.slug);
  const relatedPages = (
    page.related?.length
      ? page.related.map(getComparePage).filter((candidate) => candidate !== undefined)
      : [1, 2, 3].map((step) => comparePages[(index + step) % comparePages.length])
  )
    .filter((candidate) => candidate.slug !== page.slug)
    .slice(0, 3);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.description,
    url: canonical,
    mainEntityOfPage: canonical,
    publisher: {
      "@type": "Organization",
      name: "Trace",
      logo: {
        "@type": "ImageObject",
        url: "https://www.yourtrace.online/trace.png",
      },
    },
  };

  return (
    <div className={`hp cmp cmp-detail ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{COMPARE_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PublicHeader subscribeHref="#join" />
      <main>
        <article>
          <div className="cmp-top">
            <div className="cmp-hero">
              <p className="hp-kicker">
                Comparison Guide
              </p>
              <h1 className="hp-h1">
                {page.heroTitle}
              </h1>
              <p className="hp-hero-p">
                {page.heroDescription}
              </p>
            </div>

            <div className="cmp-intro-wrap">
              <div className="cmp-intro">
                <p>{page.intro}</p>
              </div>
            </div>
          </div>

          <div className="cmp-wrap">
            <section className="cmp-section">
              <h2 className="hp-h2 cmp-h2" id="cmp-table-title">{page.comparisonTitle}</h2>
              <div className="cmp-table-wrap" role="region" aria-labelledby="cmp-table-title" tabIndex={0}>
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th scope="col">Comparison</th>
                      <th scope="col" className="is-trace">Trace</th>
                      <th scope="col">Alternative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.comparisonRows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td className="is-trace">{row.trace}</td>
                        <td>{row.alternative}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cmp-panels">
              {page.sections.map((section) => (
                <div
                  key={section.title}
                  className="cmp-panel"
                >
                  <h2 className="hp-h3">{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              ))}
            </section>

            <section className="cmp-cta">
              <h2 className="hp-h2 cmp-h2">If you want the workflow, not just the idea</h2>
              <p>
                These public pages explain the category. The actual value of Trace is still inside the product:
                daily topic grouping, faster catch-up, and a cleaner reading habit.
              </p>
              <div className="hp-btns">
                <Link href="/feed" className="hp-btn hp-btn-dark">
                  Start with Trace
                </Link>
              </div>
            </section>

            <section className="cmp-faq">
              <h2 className="hp-h2 cmp-h2">FAQ</h2>
              <div className="cmp-faq-list">
                {page.faq.map((item) => (
                  <div key={item.question} className="cmp-faq-item">
                    <h3 className="hp-h3">{item.question}</h3>
                    <p>{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="cmp-related">
              <h2 className="hp-h2 cmp-h2">
                Related comparisons
              </h2>
              <div className="cmp-rel-grid">
                {page.relatedRoundup && (
                  <Link href={page.relatedRoundup.href} className="cmp-rel-card">
                    {page.relatedRoundup.label}
                  </Link>
                )}
                {relatedPages.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/compare/${related.slug}`}
                    className="cmp-rel-card"
                  >
                    {related.heroTitle}
                  </Link>
                ))}
              </div>
              <div className="cmp-links">
                <Link href="/compare" className="cmp-chip">More comparisons</Link>
                <Link href="/blog" className="cmp-chip">Guides</Link>
                <Link href="/feed" className="cmp-chip">Today&apos;s briefing</Link>
              </div>
            </section>
          </div>
        </article>

        <HpJoinBox heading="Get the brief in your inbox every morning" source="compare" />
      </main>
      <Footer variant="landing" />
    </div>
  );
}
