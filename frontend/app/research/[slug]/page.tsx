import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { researchPosts } from "../content";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return researchPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = researchPosts.find((item) => item.slug === slug);

  if (!post) {
    return {
      title: "Research | Trace"
    };
  }

  const baseUrl = "https://www.yourtrace.online";
  const url = `${baseUrl}/research/${post.slug}`;

  return {
    title: `${post.title} | Trace`,
    description: post.excerpt,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${post.title} | Trace`,
      description: post.excerpt,
      url,
      siteName: "Trace",
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Trace`,
      description: post.excerpt
    }
  };
}

export default async function ResearchPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = researchPosts.find((item) => item.slug === slug);

  if (!post) {
    notFound();
  }

  const canonicalUrl = `https://www.yourtrace.online/research/${post.slug}`;
  const publishedIso = (() => {
    const parsed = new Date(post.date);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  })();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": publishedIso,
    "dateModified": publishedIso,
    "author": {
      "@type": "Organization",
      "name": post.author,
    },
    "publisher": {
      "@type": "Organization",
      "name": "Trace",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.yourtrace.online/trace.png",
      },
    },
    "mainEntityOfPage": canonicalUrl,
    "url": canonicalUrl,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PublicHeader />

      <article className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pt-20 pb-20 sm:pt-28">
          {/* Breadcrumb */}
          <Link href="/research" className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-secondary/40 transition-colors hover:text-foreground">
            <ArrowLeft size={12} />
            Research
          </Link>

          {/* Post meta */}
          <div className="mt-6 mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-4">{post.tag}</p>
            <h1 className="text-[2rem] font-bold tracking-[-0.035em] leading-[1.08] text-foreground sm:text-[2.75rem]">
              {post.title}
            </h1>
            <p className="mt-4 text-[16px] leading-[1.8] text-secondary">
              {post.subtitle}
            </p>
            <p className="mt-4 text-[12px] text-secondary/40 uppercase tracking-[0.15em]">
              {post.author} · {post.readTime} · {post.date}
            </p>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-10">
            {post.sections.map((section, index) => (
              <section key={`${post.slug}-section-${index}`} className="flex flex-col gap-4">
                {section.heading && (
                  <h2 className="text-[1.35rem] font-bold tracking-[-0.02em] text-foreground sm:text-[1.5rem]">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${post.slug}-section-${index}-paragraph-${paragraphIndex}`}
                    className="text-[16px] leading-[1.8] text-secondary"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2.5 pl-0">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${post.slug}-section-${index}-bullet-${bulletIndex}`} className="flex gap-3">
                        <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-secondary/25" />
                        <span className="text-[16px] leading-[1.8] text-secondary">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Sources */}
          <section className="mt-14 pt-8 border-t border-border/[0.06]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-5">Sources</h2>
            <div className="space-y-2.5">
              {post.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-[14px] text-secondary transition-colors hover:text-foreground"
                >
                  <ExternalLink size={13} className="mt-1 shrink-0 text-secondary/30 group-hover:text-foreground/50" />
                  <span>
                    {source.title}
                    {source.publisher ? <span className="text-secondary/40"> — {source.publisher}</span> : ""}
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* Product angle CTA */}
          <section className="mt-14 overflow-hidden rounded-[20px] bg-[#151515] p-8 text-white sm:p-10">
            <h2 className="text-[1.35rem] font-bold tracking-[-0.02em]">
              The product angle
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-white/40">
              Trace is built around the same ideas in this research: better source selection, grouped topic pages,
              and faster catch-up without turning your morning into another unread queue.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/trending"
                className="group inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#151515] transition-all hover:bg-white/90"
              >
                See grouped topics
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/daily"
                className="rounded-full border border-white/12 px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-white/10"
              >
                Browse daily archive
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/12 px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-white/10"
              >
                Start with Trace
              </Link>
            </div>
          </section>

          {/* Related links */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { href: "/research", label: "More research" },
              { href: "/compare", label: "Compare guides" },
              { href: "/tools", label: "Free tools" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border/[0.08] px-3.5 py-1.5 text-[12px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
