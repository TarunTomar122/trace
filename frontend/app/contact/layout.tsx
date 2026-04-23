import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | Trace',
  description: 'Support and contact information for Trace.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
