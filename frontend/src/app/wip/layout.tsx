import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Work In Progress | Trace',
  description: 'Temporary Trace page.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function WipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
