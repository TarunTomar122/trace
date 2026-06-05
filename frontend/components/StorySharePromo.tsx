"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getPublicStoryCta } from "@/lib/article-share";
import { trackCheckoutClicked } from "@/lib/posthog";

export default function StorySharePromo({
  trackingId = "shared_story_promo",
}: {
  trackingId?: string;
}) {
  const { user, profile, loading, profileResolved } = useAuth();
  const cta = getPublicStoryCta({
    user,
    profile,
    loading: loading || !profileResolved,
  });

  if (!cta.showPromo) return null;

  return (
    <div className="story-page-promo">
      <h2 className="story-page-promo-title">{cta.promoTitle}</h2>
      <p className="story-page-promo-copy">{cta.promoCopy}</p>
      <Link
        href={cta.href}
        className="story-page-btn-primary"
        onClick={() => trackCheckoutClicked(trackingId)}
      >
        {cta.buttonLabel}
      </Link>
    </div>
  );
}
