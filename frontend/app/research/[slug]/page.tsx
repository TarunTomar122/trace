import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MainNav from "@/components/MainNav";
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
    <div className="min-h-screen bg-background text-foreground px-2 selection:bg-primary/20 selection:text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MainNav showBanner={false} />
      <article className="relative pt-32 md:pt-36 lg:pt-40 pb-16 md:pb-24 overflow-hidden z-10">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <div className="mb-10 md:mb-12">
            <div className="text-xs uppercase tracking-wider text-secondary mb-4">{post.tag}</div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
              {post.title}
            </h1>
            <p className="text-secondary text-base md:text-lg mb-5">
              {post.subtitle}
            </p>
            <div className="text-xs text-secondary uppercase tracking-wider">
              {post.author} · {post.readTime} · {post.date}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {post.sections.map((section, index) => (
              <section key={`${post.slug}-section-${index}`} className="flex flex-col gap-3">
                {section.heading && (
                  <h2 className="text-xl md:text-2xl font-semibold text-foreground">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${post.slug}-section-${index}-paragraph-${paragraphIndex}`}
                    className="text-secondary text-base md:text-lg leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc pl-5 text-secondary text-base md:text-lg leading-relaxed space-y-2">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${post.slug}-section-${index}-bullet-${bulletIndex}`}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">Sources</h2>
            <ul className="space-y-2">
              {post.sources.map((source) => (
                <li key={source.url} className="text-sm md:text-base text-secondary">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground transition-colors"
                  >
                    {source.title}
                  </a>
                  {source.publisher ? ` — ${source.publisher}` : ""}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12 rounded-3xl bg-[#151515] p-8 text-white">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
              The product angle
            </h2>
            <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-white/65">
              Trace is built around the same ideas in this research: better source selection, grouped topic pages,
              and faster catch-up without turning your morning into another unread queue.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/trending"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#151515]"
              >
                See grouped topics
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
              >
                Start with Trace
              </Link>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
