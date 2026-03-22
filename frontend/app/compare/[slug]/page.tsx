import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { comparePages, getComparePage } from "../content";

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
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PublicHeader />
      <main className="px-4 sm:px-6">
        <article className="mx-auto max-w-5xl pt-24 pb-20 sm:pt-32">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-secondary/40">
              Comparison Guide
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {page.heroTitle}
            </h1>
            <p className="mt-5 text-lg leading-8 text-secondary">
              {page.heroDescription}
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-border/20 bg-white p-7 shadow-sm dark:bg-gray-950">
            <p className="text-base leading-8 text-secondary">{page.intro}</p>
          </div>

          <section className="mt-10 rounded-3xl border border-border/20 bg-white p-7 shadow-sm dark:bg-gray-950">
            <h2 className="text-2xl font-semibold tracking-tight">{page.comparisonTitle}</h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border/20">
              <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-muted/40 px-4 py-3 text-sm font-semibold">
                <div>Comparison</div>
                <div>Trace</div>
                <div>Alternative</div>
              </div>
              {page.comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-border/20 px-4 py-4 text-sm leading-6"
                >
                  <div className="font-medium text-foreground">{row.label}</div>
                  <div className="text-secondary">{row.trace}</div>
                  <div className="text-secondary">{row.alternative}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-6 md:grid-cols-2">
            {page.sections.map((section) => (
              <div
                key={section.title}
                className="rounded-3xl border border-border/20 bg-white p-7 shadow-sm dark:bg-gray-950"
              >
                <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-secondary">{section.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 rounded-3xl bg-[#151515] p-8 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">If you want the workflow, not just the idea</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              These public pages explain the category. The actual value of Trace is still inside the product:
              daily topic grouping, faster catch-up, and a cleaner reading habit.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/trending"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#151515]"
              >
                See sample topics
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
              >
                Start with Trace
              </Link>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-border/20 bg-white p-7 shadow-sm dark:bg-gray-950">
            <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
            <div className="mt-6 space-y-5">
              {page.faq.map((item) => (
                <div key={item.question}>
                  <h3 className="text-base font-semibold">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-secondary">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
