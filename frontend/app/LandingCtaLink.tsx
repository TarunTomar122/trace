'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getLandingCtaAssignment,
  LANDING_CTA_EXPERIMENT_ID,
  trackLandingCtaExposure,
  trackLandingCTAClicked,
  type LandingCtaAssignment,
} from '@/lib/posthog';

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
  const isExperiment = location === 'hero';
  const [assignment, setAssignment] = useState<LandingCtaAssignment>('control');

  useEffect(() => {
    if (!isExperiment) return;
    const timer = window.setTimeout(() => {
      const nextAssignment = getLandingCtaAssignment();
      setAssignment(nextAssignment);
      trackLandingCtaExposure(nextAssignment);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isExperiment]);

  const destination = href.startsWith('/subscribe') ? 'subscribe' : 'feed';
  const experimentProps = isExperiment
    ? { experiment_id: LANDING_CTA_EXPERIMENT_ID, experiment_variant: assignment }
    : {};
  const renderedChildren = isExperiment && assignment === 'variant'
    ? 'Start reading in 5 minutes'
    : children;

  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      onClick={() => {
        if (isExperiment) trackLandingCtaExposure(assignment);
        trackLandingCTAClicked(variant, location, { destination, ...experimentProps });
      }}
    >
      {renderedChildren}
    </Link>
  );
}
