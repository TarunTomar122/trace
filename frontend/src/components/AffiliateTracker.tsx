"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  buildAffiliateAttributionFromSearch,
  hasAffiliateBeenTracked,
  markAffiliateTracked,
  writeAffiliateAttribution,
} from "@/lib/affiliate";

export default function AffiliateTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const attribution = buildAffiliateAttributionFromSearch(searchParams, pathname || "/");
    if (!attribution) return;

    writeAffiliateAttribution(attribution);

    if (hasAffiliateBeenTracked(attribution.code, "landing", attribution.landingPath)) {
      return;
    }

    markAffiliateTracked(attribution.code, "landing", attribution.landingPath);

    void fetch("/api/affiliate/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: attribution.code,
        target: "landing",
        landingPath: attribution.landingPath,
        utmSource: attribution.utmSource,
        utmCampaign: attribution.utmCampaign,
        utmMedium: attribution.utmMedium,
      }),
      keepalive: true,
    }).catch(() => {
      // Tracking should never block the page.
    });
  }, [pathname, searchParams]);

  return null;
}
