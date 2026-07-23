import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { comparePages, getComparePage } from "../content";
import {
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
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <article className="mx-auto max-w-5xl pt-16 pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#9ca3af]">
              Comparison Guide
            </p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
              {page.heroTitle}
            </h1>
            <p className="mt-5 text-[16px] leading-[1.8] text-[#6b7280] sm:text-[17px]">
              {page.heroDescription}
            </p>
          </div>

          <div className="mt-10 landing-card p-7">
            <p className="text-base leading-8 text-[#6b7280]">{page.intro}</p>
          </div>

          <section className="mt-8 landing-card p-7">
            <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">{page.comparisonTitle}</h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#e5e7eb]">
              <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-[#f9fafb] px-4 py-3 text-sm font-semibold text-[#111827]">
                <div>Comparison</div>
                <div>Trace</div>
                <div>Alternative</div>
              </div>
              {page.comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-[#e5e7eb] px-4 py-4 text-sm leading-6"
                >
                  <div className="font-medium text-[#111827]">{row.label}</div>
                  <div className="text-[#6b7280]">{row.trace}</div>
                  <div className="text-[#6b7280]">{row.alternative}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            {page.sections.map((section) => (
              <div
                key={section.title}
                className="landing-card p-7"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-[#6b7280]">{section.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 rounded-[1.5rem] bg-[#111827] p-8 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">If you want the workflow, not just the idea</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              These public pages explain the category. The actual value of Trace is still inside the product:
              daily topic grouping, faster catch-up, and a cleaner reading habit.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white"
                style={{ boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)" }}
              >
                Start with Trace →
              </Link>
            </div>
          </section>

          <section className="mt-10 landing-card p-7">
            <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">FAQ</h2>
            <div className="mt-6 space-y-5">
              {page.faq.map((item) => (
                <div key={item.question}>
                  <h3 className="text-base font-semibold text-[#111827]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#6b7280]">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af]">
              Related comparisons
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedPages.map((related) => (
                <Link
                  key={related.slug}
                  href={`/compare/${related.slug}`}
                  className="landing-card p-5 text-sm font-semibold leading-6 text-[#111827] transition-colors hover:text-[#2563eb]"
                >
                  {related.heroTitle} →
                </Link>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Link href="/compare" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">More comparisons</Link>
              <Link href="/blog" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">Blog</Link>
              <Link href="/tools" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">Free tools</Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
