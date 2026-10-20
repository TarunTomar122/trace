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
import { HOME_CSS } from "@/lib/home-css";
import { BLOG_CSS } from "@/lib/blog-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function RichParagraph({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children: content }) => <p>{content}</p>,
        a: ({ href = "", children: content }) =>
          href.startsWith("/") ? (
            <Link href={href}>{content}</Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer">
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
    <div className={`hp bl ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{BLOG_CSS}</style>
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
      <PublicHeader />

      <main>
        <article className="bl-art">
          <Link href="/blog" className="bl-back">
            <ArrowLeft size={14} aria-hidden="true" />
            Blog
          </Link>

          <header className="bl-art-head">
            <p className="bl-tag">{post.tag}</p>
            <h1 className="bl-title">{post.title}</h1>
            <p className="bl-deck">{post.subtitle}</p>
            <div className="bl-byline">
              <span>{post.author}</span>
              <span>
                <Clock size={14} aria-hidden="true" />
                {post.readTime}
              </span>
              <span>
                <Calendar size={14} aria-hidden="true" />
                {post.date}
              </span>
            </div>
          </header>

          <div className="bl-hero-img">
            <ArticleImage
              thumbnail={post.image}
              title={post.title}
              alt={post.title}
              className="bl-img"
            />
          </div>

          {post.sections.filter((section) => section.heading).length > 2 && (
            <nav aria-label="Table of contents" className="bl-toc">
              <p className="bl-toc-title">In this guide</p>
              <ol>
                {post.sections
                  .filter((section): section is typeof section & { heading: string } => Boolean(section.heading))
                  .map((section, index) => (
                    <li key={section.heading}>
                      <a href={`#${headingId(section.heading)}`}>
                        {index + 1}. {section.heading}
                      </a>
                    </li>
                  ))}
              </ol>
            </nav>
          )}

          {/* Content */}
          <div className="bl-prose">
            {post.sections.map((section, index) => (
              <section key={`${post.slug}-section-${index}`}>
                {section.heading && <h2 id={headingId(section.heading)}>{section.heading}</h2>}
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <RichParagraph
                    key={`${post.slug}-section-${index}-paragraph-${paragraphIndex}`}
                  >
                    {paragraph}
                  </RichParagraph>
                ))}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${post.slug}-section-${index}-bullet-${bulletIndex}`}>{bullet}</li>
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
            <section className="bl-aux">
              <h2 className="bl-aux-title">Sources &amp; further reading</h2>
              <div className="bl-sources">
                {post.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bl-source"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    <span>
                      {source.title}
                      {source.publisher ? <span className="bl-source-pub"> · {source.publisher}</span> : ""}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {post.faqs && post.faqs.length > 0 && (
            <section className="bl-aux">
              <h2 className="bl-aux-title">FAQ</h2>
              <div className="bl-faq">
                {post.faqs.map((faq) => (
                  <div key={faq.question}>
                    <h3 className="bl-faq-q">{faq.question}</h3>
                    <p className="bl-faq-a">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CTA: the daily email, with the feed link underneath */}
          <BlogEmailCard slug={post.slug} placement="end" />

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <section className="bl-aux">
              <h2 className="bl-aux-title">Related articles</h2>
              <div className="bl-related">
                {relatedPosts.map((related) => (
                  <Link key={related.slug} href={`/blog/${related.slug}`} className="bl-rel">
                    <p className="bl-tag">{related.tag}</p>
                    <h3 className="bl-rel-title">{related.title}</h3>
                    <p className="bl-rel-ex">{related.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bottom nav */}
          <div className="bl-chips">
            {[
              { href: "/blog", label: "All articles" },
              { href: "/compare", label: "Compare guides" },
              { href: "/tools", label: "Free tools" },
              { href: `/feed?utm_source=blog&utm_medium=bottom_nav&utm_campaign=${post.slug}`, label: "Today's briefing" },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="bl-chip">
                {link.label}
              </Link>
            ))}
          </div>
        </article>
      </main>

      <StickyBlogBar slug={post.slug} />
      <Footer variant="landing" />
    </div>
  );
}
