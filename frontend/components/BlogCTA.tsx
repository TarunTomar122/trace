"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { trackBlogCtaClicked, trackNewsletterSignup } from "@/lib/posthog";
import { isNewsletterSubscribed, markNewsletterSubscribed, onNewsletterSubscribed } from "@/lib/newsletter-local";

const SIGNUP_ERROR = "Couldn't subscribe right now. Try again in a moment.";

function feedHref(slug: string, location: string) {
  return `/feed?utm_source=blog&utm_medium=${location}&utm_campaign=${slug}`;
}

/**
 * The daily-email ask inside a post: one after the intro, one at the end (which also keeps
 * the old end-of-article link to the feed). Server-rendered for everyone; after hydration,
 * readers already subscribed on this device lose the ask (the end card keeps its feed link).
 */
export function BlogEmailCard({ slug, placement }: { slug: string; placement: "intro" | "end" }) {
  const [hidden, setHidden] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const focusDone = useRef(false);
  const signingUp = useRef(false);

  // the form is gone after a signup: keep keyboard focus on the confirmation
  useEffect(() => {
    if (status !== "done" || !focusDone.current) return;
    focusDone.current = false;
    doneRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (isNewsletterSubscribed()) setHidden(true);
    // A signup in the other card on the page: say so here too, rather than ask again.
    return onNewsletterSubscribed(() => {
      if (signingUp.current) return;
      setMessage("You're subscribed to the daily brief.");
      setStatus("done");
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "loading") return;
    // read this before the button disables: a disabled button drops focus to the page
    const hadFocus = !!rootRef.current?.contains(document.activeElement);
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "blog" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" && data.error ? data.error : SIGNUP_ERROR);
      if (data.status !== "already") trackNewsletterSignup("blog_inline", { post_slug: slug, placement });
      signingUp.current = true;
      markNewsletterSubscribed();
      signingUp.current = false;
      focusDone.current = hadFocus;
      setMessage(data.message || "You're in! Check your inbox.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error && err.message && !/fetch|JSON|token/i.test(err.message) ? err.message : SIGNUP_ERROR);
      if (hadFocus) window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const feedLink = (label: string) => (
    <Link
      href={feedHref(slug, "article_end")}
      onClick={() => trackBlogCtaClicked(slug, "article_end", "feed")}
      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
    >
      {label} <ArrowRight size={14} />
    </Link>
  );

  if (hidden) {
    // Already subscribed: no ask, but the end of the article still leads into the feed.
    if (placement !== "end") return null;
    return (
      <div className="not-prose my-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-blue-100 bg-blue-50/60 px-6 py-5 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="text-[15px] font-semibold text-gray-900 dark:text-white">You&apos;re on the daily brief.</div>
        {feedLink("Open today's briefing")}
      </div>
    );
  }
  return (
    <div
      ref={rootRef}
      data-blog-email-card=""
      className="not-prose my-10 rounded-xl border border-blue-100 bg-blue-50/60 p-6 dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-7"
    >
      <div className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
        The daily brief
      </div>
      <div className="mt-2 text-lg font-bold leading-snug text-gray-900 dark:text-white sm:text-xl">
        The 10 stories that matter in tech and AI, every morning. Free.
      </div>
      {status === "done" ? (
        <div
          ref={doneRef}
          role="status"
          tabIndex={-1}
          className="mt-4 text-[15px] font-semibold text-emerald-700 outline-none dark:text-emerald-400"
        >
          {message}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            ref={inputRef}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            aria-invalid={status === "error" || undefined}
            aria-describedby={status === "error" ? errorId : undefined}
            autoComplete="email"
            className="h-11 min-w-0 rounded-full border border-gray-300 bg-white px-5 text-[16px] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:flex-1 sm:text-[15px]"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="h-11 shrink-0 rounded-full bg-blue-600 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-70"
          >
            {status === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      )}
      {status === "error" && (
        <div id={errorId} role="alert" className="mt-2 text-[14px] font-semibold text-red-600 dark:text-red-400">
          {message}
        </div>
      )}
      {placement === "end" && <div className="mt-4">{feedLink("Or open today's briefing")}</div>}
    </div>
  );
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
    <div className="not-prose my-10 rounded-xl border border-blue-100 bg-blue-50/60 p-6 dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-7">
      <div className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
        Trace
      </div>
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

/** Sticky bottom bar, mobile only. Mount once per article page. Steps aside while an email card is on screen. */
export function StickyBlogBar({ slug }: { slug: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [cardInView, setCardInView] = useState(false);

  useEffect(() => {
    const cards = document.querySelectorAll("[data-blog-email-card]");
    if (!cards.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setCardInView(visible.size > 0);
    });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  if (dismissed || cardInView) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 md:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
          5-minute AI briefing, free
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
