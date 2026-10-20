import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import { StickyBlogBar } from '@/components/BlogCTA';
import { HOME_CSS } from '@/lib/home-css';
import { BLOG_CSS } from '@/lib/blog-css';
import { HOME_FONT_VARS } from '@/lib/home-fonts';

/**
 * Wraps the static blog posts (app/blog/<name>/page.tsx) in the site's 1440-style
 * shell. The posts keep their own markup; BLOG_CSS restyles `.editorial-static-article`.
 */
export default function EditorialArticleShell({
  children,
  slug,
}: {
  children: ReactNode;
  /** post slug: enables the mobile sticky CTA bar. Omit to skip it. */
  slug?: string;
}) {
  return (
    <div className={`hp bl ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{BLOG_CSS}</style>
      <PublicHeader />
      <main>
        <article className="editorial-static-article">{children}</article>
      </main>
      {slug ? <StickyBlogBar slug={slug} /> : null}
      <Footer variant="landing" />
    </div>
  );
}
