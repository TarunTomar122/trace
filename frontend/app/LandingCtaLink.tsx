'use client';

import Link from 'next/link';
import { trackLandingCTAClicked } from '@/lib/posthog';

/**
 * Landing CTA that reports to PostHog. The landing is a server component,
 * so click tracking lives in this small client wrapper.
 */
export default function LandingCtaLink({
  href,
  location,
  variant = 'read',
  className,
  prefetch,
  children,
}: {
  href: string;
  location: string;
  variant?: 'read' | 'subscribe';
  className?: string;
  prefetch?: boolean;
  children: React.ReactNode;
}) {
  const destination = href.startsWith('/subscribe') ? 'subscribe' : 'feed';
  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      onClick={() => trackLandingCTAClicked(variant, location, { destination })}
    >
      {children}
    </Link>
  );
}
