'use client';

import { useEffect, useRef, useState } from 'react';
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
  const exposureTracked = useRef(false);

  useEffect(() => {
    if (!isExperiment) return;
    const timer = window.setTimeout(() => {
      const nextAssignment = getLandingCtaAssignment();
      setAssignment(nextAssignment);
      if (!exposureTracked.current) {
        exposureTracked.current = true;
        trackLandingCtaExposure(nextAssignment);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isExperiment]);

  const destination = href.startsWith('/subscribe') ? 'subscribe' : 'feed';
  const experimentProps = isExperiment
    ? { experiment_id: LANDING_CTA_EXPERIMENT_ID, experiment_variant: assignment }
    : {};
  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      onClick={() => {
        if (isExperiment && !exposureTracked.current) {
          const nextAssignment = getLandingCtaAssignment();
          setAssignment(nextAssignment);
          exposureTracked.current = true;
          trackLandingCtaExposure(nextAssignment);
          trackLandingCTAClicked(variant, location, {
            destination,
            experiment_id: LANDING_CTA_EXPERIMENT_ID,
            experiment_variant: nextAssignment,
          });
          return;
        }
        trackLandingCTAClicked(variant, location, { destination, ...experimentProps });
      }}
    >
      {children}
    </Link>
  );
}
