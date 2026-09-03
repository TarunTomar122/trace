import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import PageShell from '@/components/feed-v2/PageShell';
export const metadata: Metadata = {
  title: 'Contact | Trace',
  description: 'Support and contact information for Trace.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function SegmentLayout({ children }: { children: ReactNode }) {
  return <PageShell chrome={false}>{children}</PageShell>;
}
