import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function EditorialArticleShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <PublicHeader ctaLabel="Start reading" ctaHref="/feed?view=pulse" />
      <article className="editorial-static-article">{children}</article>
      <Footer />
    </div>
  );
}
