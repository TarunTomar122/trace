'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  trackLandingDiscoveryClick,
  trackLandingDiscoveryExposure,
} from '@/lib/posthog';

export default function LandingDiscoveryLink({
  href,
  slug,
  children,
  className,
}: {
  href: string;
  slug: string;
  children: React.ReactNode;
  className?: string;
}) {
  const exposureTracked = useRef(false);

  useEffect(() => {
    if (exposureTracked.current) return;
    exposureTracked.current = true;
    trackLandingDiscoveryExposure(slug);
  }, [slug]);

  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackLandingDiscoveryClick(slug)}
    >
      {children}
    </Link>
  );
}
