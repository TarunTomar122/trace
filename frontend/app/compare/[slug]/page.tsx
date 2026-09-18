import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { comparePages, getComparePage } from "../content";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TWITTER_IMAGE,
  generateBreadcrumbSchema,
  generateFAQSchema,
  SITE_BASE_URL,
} from "@/lib/seo";

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
  const relatedPages = comparePages
    .filter((candidate) => candidate.slug !== page.slug)
    .slice(0, 4);
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
    <div className="landing-page landing-grid-bg min-h-screen">
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
      <PublicHeader variant="landing" ctaLabel="Start reading free" ctaHref="/feed" />
      <main className="px-4 sm:px-6">
        <article className="mx-auto max-w-5xl pt-16 pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p className="public-meta uppercase tracking-[0.2em]">
              Comparison Guide
            </p>
            <h1 className="public-title public-title-detail mt-4">
              {page.heroTitle}
            </h1>
            <p className="public-deck mt-5">
              {page.heroDescription}
            </p>
          </div>

          <div className="public-content-card mt-10 p-7 sm:p-8">
            <p className="public-body">{page.intro}</p>
          </div>

          <section className="public-content-card mt-8 p-7 sm:p-8">
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground">{page.comparisonTitle}</h2>
            <div className="mt-6 overflow-x-auto rounded-[16px] bg-surface-secondary">
              <div className="grid min-w-[680px] grid-cols-[1.1fr_1fr_1fr] px-5 py-4 text-sm font-semibold text-foreground">
                <div>Comparison</div>
                <div>Trace</div>
                <div>Alternative</div>
              </div>
              {page.comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid min-w-[680px] grid-cols-[1.1fr_1fr_1fr] border-t border-border px-5 py-5 text-[15px] leading-6"
                >
                  <div className="font-medium text-foreground">{row.label}</div>
                  <div className="text-secondary">{row.trace}</div>
                  <div className="text-secondary">{row.alternative}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            {page.sections.map((section) => (
              <div
                key={section.title}
                className="public-list-section"
              >
                <h2 className="text-[1.625rem] font-semibold tracking-[-0.025em] text-foreground">{section.title}</h2>
                <p className="public-body mt-4">{section.body}</p>
              </div>
            ))}
          </section>

          <section className="public-cta mt-10 p-8 sm:p-10">
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground">If you want the workflow, not just the idea</h2>
            <p className="public-body mt-4 max-w-2xl">
              These public pages explain the category. The actual value of Trace is still inside the product:
              daily topic grouping, faster catch-up, and a cleaner reading habit.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/feed"
                className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85"
              >
                Start with Trace
              </Link>
            </div>
          </section>

          <section className="public-list-section mt-12">
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground">FAQ</h2>
            <div className="mt-6 space-y-5">
              {page.faq.map((item) => (
                <div key={item.question}>
                  <h3 className="text-[17px] font-semibold text-foreground">{item.question}</h3>
                  <p className="mt-2 text-[16px] leading-[1.7] text-secondary">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="public-kicker text-secondary">
              Related comparisons
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {page.relatedRoundup && (
                <Link
                  href={page.relatedRoundup.href}
                  className="public-content-card p-5 text-[15px] font-semibold leading-6 text-foreground transition-colors hover:text-accent"
                >
                  {page.relatedRoundup.label}
                </Link>
              )}
              {relatedPages.map((related) => (
                <Link
                  key={related.slug}
                  href={`/compare/${related.slug}`}
                  className="public-content-card p-5 text-[15px] font-semibold leading-6 text-foreground transition-colors hover:text-accent"
                >
                  {related.heroTitle}
                </Link>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Link href="/compare" className="public-chip">More comparisons</Link>
              <Link href="/blog" className="public-chip">Blog</Link>
              <Link href="/feed" className="public-chip">Today's briefing</Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
