"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { trackBlogCtaClicked } from "@/lib/posthog";

function feedHref(slug: string, location: string) {
  return `/feed?utm_source=blog&utm_medium=${location}&utm_campaign=${slug}`;
}

/** Mid-article pitch card. Drop after the Trace section or comparison table. */
export function InlineTraceCTA({
  slug,
  blurb,
  heading,
  buttonLabel,
}: {
  slug: string;
  blurb?: string;
  heading?: string;
  buttonLabel?: string;
}) {
  return (
    <div className="my-10 rounded-xl border border-blue-100 bg-blue-50/60 p-6 dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-7">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
        Trace
      </p>
      <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        {heading || "Catch up on AI in 5 minutes — skip X and LinkedIn"}
      </h3>
      <p className="mt-2 leading-relaxed text-gray-600 dark:text-gray-400">
        {blurb ||
          "Trace groups model releases, company news, and what actually changed from 100+ sources, ranked and summarized in about five minutes. Every story, Pulse, the archive, and agent access are included. Free for everyone, open source. No RSS, no newsletter pile."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={feedHref(slug, "inline_cta")}
          onClick={() => trackBlogCtaClicked(slug, "inline_cta", "feed")}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          {buttonLabel || "Open today's briefing"} <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

/** Sticky bottom bar, mobile only. Mount once per article page. */
export function StickyBlogBar({ slug }: { slug: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 md:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
          5-minute AI briefing — free to start
        </p>
        <Link
          href={feedHref(slug, "sticky_bar")}
          onClick={() => trackBlogCtaClicked(slug, "sticky_bar", "feed")}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Open it <ArrowRight size={14} />
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1.5 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
