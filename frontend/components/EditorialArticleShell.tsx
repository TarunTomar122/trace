import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import { StickyBlogBar } from '@/components/BlogCTA';

export default function EditorialArticleShell({
  children,
  slug,
}: {
  children: ReactNode;
  /** post slug: enables the mobile sticky CTA bar. Omit to skip it. */
  slug?: string;
}) {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <PublicHeader ctaLabel="Start reading" ctaHref="/feed" />
      <article className="editorial-static-article">{children}</article>
      {slug ? <StickyBlogBar slug={slug} /> : null}
      <Footer />
    </div>
  );
}
