"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { trackCheckoutClicked } from "@/lib/posthog";
import { LANDING_PRICING_BULLET_POINTS } from "@/lib/subscription-pricing-bullets";

const INDIA_PRICING = { priceDisplay: "₹19/month", pricingOffer: "india" as const };
const DEFAULT_PRICING = { priceDisplay: "$4.99/month", pricingOffer: "default" as const };

type PricingInfo = { priceDisplay: string; pricingOffer: "india" | "default" };

function guessClientPricing(): PricingInfo {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Kolkata") return INDIA_PRICING;
    const lang = (navigator.language || "").toLowerCase();
    if (lang === "en-in" || lang.endsWith("-in")) return INDIA_PRICING;
  } catch {
    /* ignore */
  }
  return DEFAULT_PRICING;
}

export default function PremiumCTASection({
  variant = "dark",
  className = "",
}: {
  /** "dark" = dark card (landing page style), "light" = light card */
  variant?: "dark" | "light";
  className?: string;
}) {
  const [pricing] = useState<PricingInfo>(() => guessClientPricing());

  const planName =
    pricing.pricingOffer === "india" ? "Trace Pro India" : "Trace Pro";

  if (variant === "light") {
    return (
    <section
      className={`mx-auto max-w-lg rounded-[20px] border border-border/10 bg-foreground/[0.02] overflow-hidden ${className}`}
    >
        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-semibold text-secondary/35 uppercase tracking-[0.2em] mb-4">
            {planName}
          </p>
          <h3 className="text-[1.5rem] font-bold tracking-[-0.03em] leading-[1.1] text-foreground sm:text-[1.75rem]">
            Your personal daily
            <br className="hidden sm:block" />
            advantage in tech
          </h3>
          <p className="mt-3 text-[14px] text-secondary/50 leading-[1.7] max-w-md">
            Deeper context, smarter filtering, and signal over noise — in one
            daily pulse. Subscribe for {pricing.priceDisplay}.
          </p>
          <div className="mt-6 space-y-3">
            {LANDING_PRICING_BULLET_POINTS.map((line) => (
              <div key={line} className="flex items-start gap-3">
                <Check
                  size={13}
                  className="shrink-0 mt-[3px] text-foreground/30"
                  strokeWidth={2.5}
                />
                <p className="text-[13px] font-medium text-foreground/75 leading-snug">
                  {line}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/profile?tab=subscription"
            prefetch={false}
            onClick={() => trackCheckoutClicked("premium_cta_light")}
            className="mt-6 inline-flex items-center justify-center w-full sm:w-auto rounded-full bg-foreground px-6 py-3.5 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90 hover:scale-[1.01] active:scale-[0.99]"
          >
            Subscribe to {planName}
          </Link>
          <p className="mt-3 text-[12px] leading-snug text-secondary/40">
            {pricing.priceDisplay} · Cancel anytime
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`mx-auto max-w-lg rounded-[28px] bg-[#151515] shadow-[0_32px_80px_rgba(15,15,15,0.25)] overflow-hidden ${className}`}
    >
      <div className="bg-gradient-to-br from-white/[0.04] to-transparent p-6 sm:p-8">
        <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.2em] mb-5">
          {planName}
        </p>
        <h3 className="text-[1.5rem] font-bold tracking-[-0.03em] leading-[1.1] text-white sm:text-[1.75rem]">
          Your personal daily
          <br className="hidden sm:block" />
          advantage in tech
        </h3>
        <p className="mt-3 text-[14px] text-white/40 leading-[1.7] max-w-md">
          Deeper context, smarter filtering, and signal over noise — in one
          daily pulse. Subscribe for {pricing.priceDisplay}.
        </p>
        <div className="mt-6 space-y-3">
          {LANDING_PRICING_BULLET_POINTS.map((line) => (
            <div key={line} className="flex items-start gap-3">
              <Check
                size={13}
                className="shrink-0 mt-[3px] text-white/30"
                strokeWidth={2.5}
              />
              <p className="text-[13px] font-medium text-white/75 leading-snug">
                {line}
              </p>
            </div>
          ))}
        </div>
        <Link
          href="/profile?tab=subscription"
          prefetch={false}
          onClick={() => trackCheckoutClicked("premium_cta_dark")}
          className="mt-6 inline-flex items-center justify-center w-full rounded-full bg-white px-6 py-3.5 text-[13px] font-semibold text-[#151515] transition-all hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99]"
        >
          Subscribe to {planName}
        </Link>
        <p className="mt-3 text-center text-[12px] leading-snug text-white/35">
          {pricing.priceDisplay} · Cancel anytime
        </p>
      </div>
    </section>
  );
}
