import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { solutionsContent } from "../content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return solutionsContent.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = solutionsContent.find((p) => p.slug === slug);
  if (!page) return {};
  const url = `https://www.yourtrace.online/solutions/${slug}`;
  return {
    title: `${page.title} | Trace Solutions`,
    description: page.shortDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.title} | Trace Solutions`,
      description: page.shortDescription,
      url,
      siteName: "Trace",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} | Trace Solutions`,
      description: page.shortDescription,
    },
  };
}

export default async function SolutionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = solutionsContent.find((p) => p.slug === slug);
  if (!page) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.shortDescription,
    url: `https://www.yourtrace.online/solutions/${slug}`,
    mainEntityOfPage: `https://www.yourtrace.online/solutions/${slug}`,
    isPartOf: {
      "@type": "CollectionPage",
      name: "Solutions for Every Tech Reading Workflow",
      url: "https://www.yourtrace.online/solutions",
    },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <article className="mx-auto max-w-5xl pt-16 pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#9ca3af]">
              <Link href="/solutions" className="transition-colors hover:text-[#6b7280]">
                Solutions
              </Link>
              {" /"}
            </p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
              {page.title}
            </h1>
            <p className="mt-5 text-[16px] leading-[1.8] text-[#6b7280] sm:text-[17px]">
              {page.shortDescription}
            </p>
          </div>

          <section className="mt-10">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="landing-card p-7">
                <h2 className="text-xl font-semibold text-[#111827]">The Problem</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  {page.painPoint}
                </p>
              </div>

              <div className="landing-card p-7">
                <h2 className="text-xl font-semibold text-[#111827]">Who Feels This</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  {page.whoItsFor}
                </p>
              </div>

              <div className="md:col-span-2 landing-card p-7">
                <h2 className="text-xl font-semibold text-[#111827]">How Trace Helps</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  {page.howTraceHelps}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-[1.5rem] bg-[#111827] p-8 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">
              Ready to fix{" "}
              {page.title.toLowerCase().startsWith("stop")
                ? page.title.slice(5).toLowerCase()
                : page.title.toLowerCase()}
              ?
            </h2>
            <p className="mt-3 text-white/60 max-w-2xl">
              Start your free trial and see how Trace cuts through the noise.
              One brief, under 10 minutes, and you&apos;re caught up.
            </p>
            <Link
              href="/onboarding"
              className="mt-5 inline-block rounded-full bg-[#2563eb] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
              style={{ boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)" }}
            >
              Start free trial →
            </Link>
          </section>

          <section className="mt-8">
            <p className="text-sm text-[#6b7280] mb-3">Explore more:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/solutions"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                ← All Solutions
              </Link>
              <Link
                href="/compare"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                Compare Tools
              </Link>
              <Link
                href="/blog"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                Read the Blog
              </Link>
              <Link
                href="/onboarding"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                Start Free Trial
              </Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
