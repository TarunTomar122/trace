import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Clock, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { BlogEmailCard, InlineTraceCTA, StickyBlogBar } from "@/components/BlogCTA";
import { ArticleImage } from "@/components/ArticleImage";
import { blogPosts } from "../content";
import { standaloneBlogPosts } from "../standalone-content";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TWITTER_IMAGE,
  generateBreadcrumbSchema,
  generateFAQSchema,
  metadataTitle,
  SITE_BASE_URL,
} from "@/lib/seo";

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
          <p className="public-body">{content}</p>
        ),
        a: ({ href = "", children: content }) =>
          href.startsWith("/") ? (
            <Link href={href} className="public-link">
              {content}
            </Link>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="public-link"
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
    title: metadataTitle(post.title),
    description: post.excerpt,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: "article",
      ...DEFAULT_OPEN_GRAPH,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [DEFAULT_TWITTER_IMAGE],
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
  const toIso = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };
  const publishedIso = toIso(post.date);
  const modifiedIso = post.updated ? toIso(post.updated) ?? publishedIso : publishedIso;
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
    "image": DEFAULT_OG_IMAGE.url,
    "datePublished": publishedIso,
    "dateModified": modifiedIso,
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

  // relatedSlugs can name standalone posts too (e.g. best-ai-news-apps-2026).
  const relatedPosts: Array<{ slug: string; tag: string; title: string; excerpt: string }> = (
    post.relatedSlugs?.length
      ? post.relatedSlugs
          .map((slug) =>
            blogPosts.find((candidate) => candidate.slug === slug) ??
            standaloneBlogPosts.find((candidate) => candidate.slug === slug),
          )
          .filter((candidate) => candidate !== undefined)
      : [
          ...blogPosts.filter((p) => p.slug !== post.slug && p.tag === post.tag),
          ...blogPosts.filter((p) => p.slug !== post.slug && p.tag !== post.tag && p.category === post.category),
        ]
  )
    .filter((p, index, all) => all.findIndex((candidate) => candidate.slug === p.slug) === index)
    .slice(0, 3);
  // The email ask follows the intro; the feed pitch waits until mid-article so the two don't stack.
  const feedCtaIndex = Math.max(1, Math.floor(post.sections.length / 2));

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
      {post.faqs && post.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(post.faqs)) }}
        />
      )}
      <PublicHeader variant="landing" ctaLabel="Start reading free" ctaHref="/feed" />

      <article className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl pt-12 sm:pt-18">
          <Link href="/blog" className="public-meta inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.2em] transition-colors hover:text-foreground">
            <ArrowLeft size={12} />
            Blog
          </Link>

          <header className="mt-7 max-w-3xl">
            <p className="public-kicker mb-4">{post.tag}</p>
            <h1 className="public-title public-title-detail">
              {post.title}
            </h1>
            <p className="public-deck mt-5">
              {post.subtitle}
            </p>
            <div className="public-meta mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>{post.author}</span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {post.readTime}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {post.date}
              </span>
            </div>
          </header>

          <div className="public-hero-media mt-10 sm:mt-12">
            <ArticleImage
              thumbnail={post.image}
              title={post.title}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl pb-20 sm:mt-16 sm:pb-28">

          {post.sections.filter((section) => section.heading).length > 2 && (
            <nav aria-label="Table of contents" className="public-rule mb-12 border-y py-6">
              <p className="public-kicker text-secondary">
                In this guide
              </p>
              <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {post.sections
                  .filter((section): section is typeof section & { heading: string } => Boolean(section.heading))
                  .map((section, index) => (
                    <li key={section.heading}>
                      <a
                        href={`#${headingId(section.heading)}`}
                        className="text-[14px] leading-6 text-secondary hover:text-accent"
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
                    className="scroll-mt-24 text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[1.875rem]"
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
                        <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="public-body">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {index === 0 && <BlogEmailCard slug={post.slug} placement="intro" />}
                {index === feedCtaIndex && (
                  <InlineTraceCTA
                    slug={post.slug}
                    heading={post.ctaHeading}
                    blurb={post.ctaBlurb}
                    buttonLabel={post.ctaButton}
                  />
                )}
              </section>
            ))}
          </div>

          {/* Sources */}
          {post.sources.length > 0 && (
            <section className="public-rule mt-14 border-t pt-8">
              <h2 className="public-kicker mb-5 text-secondary">Sources &amp; further reading</h2>
              <div className="space-y-2.5">
                {post.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-[15px] leading-6 text-secondary transition-colors hover:text-foreground"
                  >
                    <ExternalLink size={14} className="mt-1 shrink-0 text-secondary group-hover:text-accent" />
                    <span>
                      {source.title}
                      {source.publisher ? <span className="text-secondary"> · {source.publisher}</span> : ""}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {post.faqs && post.faqs.length > 0 && (
            <section className="public-rule mt-14 border-t pt-8">
              <h2 className="public-kicker mb-5 text-secondary">FAQ</h2>
              <div className="space-y-6">
                {post.faqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="text-[17px] font-semibold leading-snug text-foreground">{faq.question}</h3>
                    <p className="public-body mt-2">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CTA: the daily email, with the feed link underneath */}
          <BlogEmailCard slug={post.slug} placement="end" />

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <section className="public-rule mt-14 border-t pt-8">
              <h2 className="public-kicker mb-5 text-secondary">Related articles</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group landing-card block p-5 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                  >
                    <p className="public-kicker">{related.tag}</p>
                    <h3 className="mt-2 text-[16px] font-semibold leading-snug text-foreground">{related.title}</h3>
                    <p className="mt-2 text-[15px] leading-[1.65] text-secondary">{related.excerpt}</p>
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
              { href: `/feed?utm_source=blog&utm_medium=bottom_nav&utm_campaign=${post.slug}`, label: "Today's briefing" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="public-chip"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </article>

      <StickyBlogBar slug={post.slug} />
      <Footer variant="landing" />
    </div>
  );
}
