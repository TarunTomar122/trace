"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { trackCheckoutClicked } from "@/lib/posthog";
import { SUBSCRIPTION_PRICE_DEFAULT } from "@/lib/subscription-pricing";

interface PricingPreview {
  trialDays: number;
  priceDisplay: string;
  pricingOffer: "india" | "default";
}

const DEFAULT_PREVIEW: PricingPreview = {
  trialDays: 3,
  priceDisplay: SUBSCRIPTION_PRICE_DEFAULT,
  pricingOffer: "default",
};

function guessClientPreview(): PricingPreview {
  return DEFAULT_PREVIEW;
}

interface InlineCheckoutButtonProps {
  trackingSource: string;
  className?: string;
  variant?: "primary" | "dark" | "light";
  label?: string;
  showPrice?: boolean;
  extraProps?: Record<string, unknown>;
}

export function InlineCheckoutButton({
  trackingSource,
  className = "",
  variant = "primary",
  label,
  showPrice = true,
  extraProps,
}: InlineCheckoutButtonProps) {
  const { user, signInWithGoogle } = useAuth();
  const [preview, setPreview] = useState<PricingPreview>(() => guessClientPreview());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(guessClientPreview());
    let cancelled = false;
    const fetchPricing = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/subscription/pricing", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.priceDisplay) {
          setPreview({
            trialDays: typeof data.trialDays === "number" ? data.trialDays : preview.trialDays,
            priceDisplay: SUBSCRIPTION_PRICE_DEFAULT,
            pricingOffer: "default",
          });
        }
      } catch {}
    };
    void fetchPricing();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async () => {
    if (loading) return;
    setError(null);
    trackCheckoutClicked(trackingSource, {
      pricing_offer: preview.pricingOffer,
      price_display: preview.priceDisplay,
      trial_days: preview.trialDays,
      ...extraProps,
    });

    // Not signed in → trigger sign-in with checkout intent
    if (!user) {
      setLoading(true);
      const result = await signInWithGoogle("checkout", { rememberIntent: true });
      if (result.status === "success") {
        // Now proceed to checkout automatically
        try {
          const token = await result.user.getIdToken();
          const res = await fetch("/api/subscription/create-checkout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to create checkout");
          window.location.href = data.checkoutUrl;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setLoading(false);
        }
      } else if (result.status === "redirecting") {
        return;
      } else if (result.status === "error") {
        setError(result.message || "Sign-in failed");
        setLoading(false);
      } else {
        setLoading(false);
      }
      return;
    }

    // Signed in → direct checkout
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const buttonLabel = label || `Try Pro`;

  const baseClass =
    variant === "dark"
      ? "inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
      : variant === "light"
        ? "inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-foreground border border-border shadow-sm transition-all hover:bg-white/90"
        : "inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 disabled:opacity-60";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`${baseClass} ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Setting up your trial…
          </>
        ) : (
          buttonLabel
        )}
      </button>
      {showPrice && (
        <p className="mt-2 text-center text-[11px] leading-none text-foreground/60">
          {preview.priceDisplay} after trial · Cancel anytime
        </p>
      )}
      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function InlineCheckoutTextLink({
  trackingSource,
  className = "",
  children,
  extraProps,
}: {
  trackingSource: string;
  className?: string;
  children: React.ReactNode;
  extraProps?: Record<string, unknown>;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    trackCheckoutClicked(trackingSource, extraProps);
    if (!user) {
      const result = await signInWithGoogle("checkout", { rememberIntent: true });
      if (result.status === "success") {
        try {
          const token = await result.user.getIdToken();
          const res = await fetch("/api/subscription/create-checkout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed");
          window.location.href = data.checkoutUrl;
        } catch {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.href = data.checkoutUrl;
    } catch {
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? <Loader2 size={14} className="inline animate-spin" /> : children}
    </button>
  );
}
