import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { newslettersContent } from "../content";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE, metadataTitle } from "@/lib/seo";

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
      title: `${page.name} Review — Tech Newsletter Reviews | Trace`,
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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-[#2563eb] text-lg tracking-tight">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

export default async function NewsletterDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = newslettersContent.find((p) => p.slug === slug);
  if (!page) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "Product",
      name: page.name,
      description: page.description,
      url: page.url,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: page.rating,
      bestRating: 5,
    },
    author: {
      "@type": "Organization",
      name: "Trace",
    },
    url: `https://www.yourtrace.online/newsletters/${slug}`,
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
              <Link href="/newsletters" className="transition-colors hover:text-[#6b7280]">
                Newsletter Reviews
              </Link>
              {" /"}
            </p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
              {page.name}
            </h1>
            <p className="mt-5 text-[16px] leading-[1.8] text-[#6b7280] sm:text-[17px]">
              {page.description}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Stars rating={page.rating} />
            <span className="text-sm font-medium text-[#6b7280]">
              {page.rating} / 5
            </span>
            <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#2563eb]">
              {page.frequency}
            </span>
            {page.topics.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#e5e7eb] px-3 py-1 text-[12px] text-[#6b7280]"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-4">
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:underline"
            >
              Visit {page.name} ↗
            </a>
          </div>

          <section className="mt-10">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="landing-card p-7">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-[#111827]">
                  <span className="text-green-600">+</span> Pros
                </h2>
                <ul className="mt-3 space-y-2">
                  {page.pros.map((pro) => (
                    <li
                      key={pro}
                      className="flex items-start gap-2 text-sm leading-relaxed text-[#6b7280]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="landing-card p-7">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-[#111827]">
                  <span className="text-red-500">−</span> Cons
                </h2>
                <ul className="mt-3 space-y-2">
                  {page.cons.map((con) => (
                    <li
                      key={con}
                      className="flex items-start gap-2 text-sm leading-relaxed text-[#6b7280]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mt-10 max-w-3xl">
            <h2 className="text-xl font-semibold text-[#111827]">How we reviewed it</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
              We assessed {page.name} on its {page.frequency.toLowerCase()} publishing cadence,
              coverage of {page.topics.join(", ")}, signal-to-noise ratio, and the amount of
              context each issue gives readers. The {page.rating}/5 rating reflects the overall
              reading experience, not sponsorship or referral payments. Use the pros and cons
              above to decide whether its format fits your own news routine.
            </p>
          </section>

          <section className="mt-10 rounded-[1.5rem] bg-[#111827] p-8 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">
              Want a better way than managing newsletters?
            </h2>
            <p className="mt-3 text-white/60 max-w-2xl">
              Trace pulls from the same sources these newsletters curate — plus
              communities, launches, and social platforms. One brief instead of
              five newsletters.
            </p>
            <Link
              href="/compare"
              className="mt-5 inline-block rounded-full bg-[#2563eb] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
              style={{ boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)" }}
            >
              See how Trace compares →
            </Link>
          </section>

          <section className="mt-8">
            <p className="text-sm text-[#6b7280] mb-3">Explore more:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/newsletters"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                ← All Reviews
              </Link>
              <Link
                href="/compare"
                className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]"
              >
                Compare Tools
              </Link>
              <Link
                href="/onboarding"
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
