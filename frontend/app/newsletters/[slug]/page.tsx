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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-lg tracking-tight text-accent" aria-label={`${rating} out of 5 stars`}>
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
            <p className="public-meta uppercase tracking-[0.2em]">
              <Link href="/newsletters" className="transition-colors hover:text-foreground">
                Newsletter Reviews
              </Link>
              {" /"}
            </p>
            <h1 className="public-title public-title-detail mt-4">
              {page.name}
            </h1>
            <p className="public-deck mt-5">
              {page.description}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Stars rating={page.rating} />
            <span className="public-meta font-medium">
              {page.rating} / 5
            </span>
            <span className="public-chip text-accent">
              {page.frequency}
            </span>
            {page.topics.map((t) => (
              <span
                key={t}
                className="public-chip"
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
              className="public-link inline-flex items-center gap-1.5 text-sm"
            >
              Visit {page.name} ↗
            </a>
          </div>

          <section className="mt-10">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="public-content-card p-7">
                <h2 className="flex items-center gap-2 text-[1.5rem] font-semibold text-foreground">
                  <span className="text-accent">+</span> Pros
                </h2>
                <ul className="mt-3 space-y-2">
                  {page.pros.map((pro) => (
                    <li
                      key={pro}
                      className="flex items-start gap-3 text-[16px] leading-[1.65] text-secondary"
                    >
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="public-content-card p-7">
                <h2 className="flex items-center gap-2 text-[1.5rem] font-semibold text-foreground">
                  <span className="text-secondary">−</span> Cons
                </h2>
                <ul className="mt-3 space-y-2">
                  {page.cons.map((con) => (
                    <li
                      key={con}
                      className="flex items-start gap-3 text-[16px] leading-[1.65] text-secondary"
                    >
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mt-10 max-w-3xl">
            <h2 className="text-[1.625rem] font-semibold tracking-[-0.025em] text-foreground">How we reviewed it</h2>
            <p className="public-body mt-3">
              We assessed {page.name} on its {page.frequency.toLowerCase()} publishing cadence,
              coverage of {page.topics.join(", ")}, signal-to-noise ratio, and the amount of
              context each issue gives readers. The {page.rating}/5 rating reflects the overall
              reading experience, not sponsorship or referral payments. Use the pros and cons
              above to decide whether its format fits your own news routine.
            </p>
          </section>

          <section className="public-cta mt-10 p-8 sm:p-10">
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground">
              Want a better way than managing newsletters?
            </h2>
            <p className="public-body mt-3 max-w-2xl">
              Trace pulls from the same sources these newsletters curate, plus
              communities, launches, and social platforms. One brief instead of
              five newsletters.
            </p>
            <Link
              href="/compare"
              className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85"
            >
              See how Trace compares
            </Link>
          </section>

          <section className="mt-8">
            <p className="public-meta mb-3">Explore more:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/newsletters"
                className="public-chip"
              >
                All reviews
              </Link>
              <Link
                href="/compare"
                className="public-chip"
              >
                Compare Tools
              </Link>
              <Link
                href="/feed?view=pulse"
                className="public-chip"
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
