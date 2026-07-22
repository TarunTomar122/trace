import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';

export default function EditorialArticleShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1b1a17]">
      <PublicHeader ctaLabel="Start reading" ctaHref="/onboarding?intent=read" />
      <article className="editorial-static-article">{children}</article>
      <Footer />
    </div>
  );
}
