import type { ReactNode } from 'react';
import PageShell from '@/components/feed-v2/PageShell';

export default function SegmentLayout({ children }: { children: ReactNode }) {
  return <PageShell chrome={false}>{children}</PageShell>;
}
