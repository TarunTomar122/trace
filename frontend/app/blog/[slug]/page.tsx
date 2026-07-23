import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Clock, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { blogPosts } from "../content";
import { generateBreadcrumbSchema, SITE_BASE_URL } from "@/lib/seo";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function RichParagraph({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children: content }) => (
          <p className="text-[16px] leading-[1.8] landing-muted">{content}</p>
        ),
        a: ({ href = "", children: content }) =>
          href.startsWith("/") ? (
            <Link href={href} className="font-medium text-[#2563eb] underline-offset-4 hover:underline">
              {content}
            </Link>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#2563eb] underline-offset-4 hover:underline"
            >
              {content}
            </a>
          ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function headingId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);

  if (!post) {
    return {
      title: "Blog | Trace"
    };
  }

  const baseUrl = "https://www.yourtrace.online";
  const url = `${baseUrl}/blog/${post.slug}`;

  return {
    title: `${post.title} | Trace Blog`,
    description: post.excerpt,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${post.title} | Trace Blog`,
      description: post.excerpt,
      url,
      siteName: "Trace",
      type: "article",
      images: [{ url: post.image, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Trace Blog`,
      description: post.excerpt,
      images: [post.image],
    }
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);

  if (!post) {
    notFound();
  }

  const canonicalUrl = `https://www.yourtrace.online/blog/${post.slug}`;
  const publishedIso = (() => {
    const parsed = new Date(post.date);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  })();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: post.title, url: canonicalUrl },
  ]);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "image": post.image,
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
        "url": "https://www.yourtrace.online/trace.webp",
      },
    },
    "mainEntityOfPage": canonicalUrl,
    "url": canonicalUrl,
  };

  const relatedPosts = blogPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);

  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />

      {/* Hero Image */}
      <div className="relative w-full h-[280px] sm:h-[400px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.image}
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
      </div>

      <article className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pb-20 sm:pb-28">
          {/* Breadcrumb */}
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af] transition-colors hover:text-[#111827]">
            <ArrowLeft size={12} />
            Blog
          </Link>

          {/* Post meta */}
          <div className="mt-6 mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#2563eb] mb-4">{post.tag}</p>
            <h1 className="text-[2rem] font-bold tracking-[-0.035em] leading-[1.08] text-[#111827] sm:text-[2.75rem]">
              {post.title}
            </h1>
            <p className="mt-4 text-[16px] leading-[1.8] landing-muted">
              {post.subtitle}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <span className="text-[12px] text-[#6b7280]">{post.author}</span>
              <span className="flex items-center gap-1 text-[12px] text-[#9ca3af]">
                <Clock size={11} />
                {post.readTime}
              </span>
              <span className="flex items-center gap-1 text-[12px] text-[#9ca3af]">
                <Calendar size={11} />
                {post.date}
              </span>
            </div>
          </div>

          {post.sections.filter((section) => section.heading).length > 2 && (
            <nav aria-label="Table of contents" className="mb-12 border-y border-[#e5e7eb] py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af]">
                In this guide
              </p>
              <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {post.sections
                  .filter((section): section is typeof section & { heading: string } => Boolean(section.heading))
                  .map((section, index) => (
                    <li key={section.heading}>
                      <a
                        href={`#${headingId(section.heading)}`}
                        className="text-[13px] leading-6 text-[#6b7280] hover:text-[#2563eb]"
                      >
                        {index + 1}. {section.heading}
                      </a>
                    </li>
                  ))}
              </ol>
            </nav>
          )}

          {/* Content */}
          <div className="flex flex-col gap-10">
            {post.sections.map((section, index) => (
              <section key={`${post.slug}-section-${index}`} className="flex flex-col gap-4">
                {section.heading && (
                  <h2
                    id={headingId(section.heading)}
                    className="scroll-mt-24 text-[1.35rem] font-bold tracking-[-0.02em] text-[#111827] sm:text-[1.5rem]"
                  >
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <RichParagraph
                    key={`${post.slug}-section-${index}-paragraph-${paragraphIndex}`}
                  >
                    {paragraph}
                  </RichParagraph>
                ))}
                {section.bullets && (
                  <ul className="space-y-3 pl-0">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${post.slug}-section-${index}-bullet-${bulletIndex}`} className="flex gap-3">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]/40" />
                        <span className="text-[15px] leading-[1.8] landing-muted">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Sources */}
          {post.sources.length > 0 && (
            <section className="mt-14 pt-8 border-t border-[#e5e7eb]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af] mb-5">Sources & Further Reading</h2>
              <div className="space-y-2.5">
                {post.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-[14px] landing-muted transition-colors hover:text-[#111827]"
                  >
                    <ExternalLink size={13} className="mt-1 shrink-0 text-[#9ca3af] group-hover:text-[#2563eb]" />
                    <span>
                      {source.title}
                      {source.publisher ? <span className="text-[#9ca3af]"> — {source.publisher}</span> : ""}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="mt-14 overflow-hidden rounded-3xl border border-[#e5e7eb] bg-gradient-to-br from-[#eff6ff] to-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] sm:p-10">
            <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Trace</p>
            <h2 className="mt-3 text-[1.35rem] font-bold tracking-[-0.02em] text-[#111827]">
              Stay informed without the overwhelm
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-[1.7] landing-muted">
              Trace groups related stories from 50+ sources into one clean daily briefing. AI summaries, key points, and community context so you catch up in minutes, not hours.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/profile?tab=subscription"
                className="landing-btn landing-btn-primary landing-btn-sm"
              >
                Start with Trace
              </Link>
            </div>
          </section>

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-14 pt-8 border-t border-[#e5e7eb]">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af] mb-5">Related Articles</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group landing-card block p-5 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">{related.tag}</p>
                    <h3 className="mt-2 text-[14px] font-semibold leading-snug text-[#111827]">{related.title}</h3>
                    <p className="mt-2 text-[12px] leading-[1.6] landing-muted line-clamp-2">{related.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bottom nav */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { href: "/blog", label: "All articles" },
              { href: "/compare", label: "Compare guides" },
              { href: "/tools", label: "Free tools" },
              { href: "/trending", label: "Trending topics" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-[#e5e7eb] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#6b7280] transition-all hover:text-[#111827] hover:border-[#d1d5db]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </article>

      <Footer variant="landing" />
    </div>
  );
}
