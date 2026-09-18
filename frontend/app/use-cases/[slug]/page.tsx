import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { useCasesContent } from "../content";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return useCasesContent.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = useCasesContent.find((p) => p.slug === slug);
  if (!page) return {};
  const url = `https://www.yourtrace.online/use-cases/${slug}`;
  return {
    title: `${page.title} | Trace Use Cases`,
    description: page.shortDescription,
    alternates: { canonical: url },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      title: `${page.title} | Trace Use Cases`,
      description: page.shortDescription,
      url,
      siteName: "Trace",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} | Trace Use Cases`,
      description: page.shortDescription,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export default async function UseCaseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = useCasesContent.find((p) => p.slug === slug);
  if (!page) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.shortDescription,
    url: `https://www.yourtrace.online/use-cases/${slug}`,
    mainEntityOfPage: `https://www.yourtrace.online/use-cases/${slug}`,
    isPartOf: {
      "@type": "CollectionPage",
      name: "Trace for Every Role in Tech",
      url: "https://www.yourtrace.online/use-cases",
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
      <PublicHeader variant="landing" ctaLabel="Start reading free" ctaHref="/feed" />
      <main className="px-4 sm:px-6">
        <article className="mx-auto max-w-5xl pt-16 pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-[#9ca3af]">
              <Link href="/use-cases" className="transition-colors hover:text-[#6b7280]">
                Use Cases
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
                <h2 className="text-xl font-semibold text-[#111827]">Why It Matters</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  {page.whyItMatters}
                </p>
              </div>

              <div className="landing-card p-7">
                <h2 className="text-xl font-semibold text-[#111827]">Daily Routine</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  {page.dailyRoutine}
                </p>
              </div>

              <div className="md:col-span-2 landing-card p-7">
                <h2 className="text-xl font-semibold text-[#111827]">Key Features</h2>
                <ul className="mt-3 space-y-2">
                  {page.keyFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm leading-relaxed text-[#6b7280]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mt-10 max-w-3xl">
            <h2 className="text-xl font-semibold text-[#111827]">What changes day to day</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
              Instead of checking the same publications and community feeds separately,
              you start with one ordered brief. Related coverage stays grouped, source links
              remain available, and the topics you pick move to the front.
            </p>
          </section>

          <section className="mt-10 rounded-[1.5rem] bg-[#111827] p-8 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">
              {page.title.startsWith("Trace for")
                ? page.title.replace("Trace ", "") + "? Try Trace"
                : "Go Pro — $2.99/mo"}
            </h2>
            <p className="mt-3 text-white/60 max-w-2xl">
              See how Trace fits your workflow. One brief, under 10 minutes,
              personalized to the topics you care about.
            </p>
            <Link
              href="/feed"
              className="mt-5 inline-block rounded-full bg-[#2563eb] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
              style={{ boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)" }}
            >
              Get started →
            </Link>
          </section>

          <section className="mt-8">
            <p className="text-sm text-[#6b7280] mb-3">Explore more:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/use-cases"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                ← All Use Cases
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
              {slug === "for-founders" && (
                <>
                  <Link
                    href="/blog/ai-news-for-non-technical-founders"
                    className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
                  >
                    AI news if you don't code
                  </Link>
                  <Link
                    href="/blog/daily-ai-briefing-for-founders"
                    className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
                  >
                    Daily AI briefing
                  </Link>
                  <Link
                    href="/blog/stay-on-top-of-ai-news-without-twitter"
                    className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
                  >
                    AI news without Twitter
                  </Link>
                </>
              )}
              <Link
                href="/feed"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                Get Started
              </Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
