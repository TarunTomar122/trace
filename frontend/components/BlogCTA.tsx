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

type BriefPreview = { date: string; label: string; stories: { title: string; href: string }[] };

// Both cards on a page share one request for the latest brief's headlines; a
// failed one is forgotten, so the next card to mount tries again.
let briefPreview: Promise<BriefPreview | null> | null = null;
function loadBriefPreview(): Promise<BriefPreview | null> {
  briefPreview ??= fetch("/api/public/brief-preview")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && data.preview ? (data.preview as BriefPreview) : null))
    .catch(() => null)
    .then((value) => {
      if (!value) briefPreview = null;
      return value;
    });
  return briefPreview;
}

/**
 * The daily-email ask inside a post: one after the intro, one at the end (which also keeps
 * the old end-of-article link to the feed). Server-rendered for everyone; after hydration,
 * readers already subscribed on this device lose the ask (the end card keeps its feed link).
 */
export function BlogEmailCard({ slug, placement }: { slug: string; placement: "intro" | "end" }) {
  const [hidden, setHidden] = useState(false);
  // The newest brief's top headlines: what the email is, before we ask for an address.
  // undefined while loading: the panel holds its height, so the article doesn't jump.
  const [preview, setPreview] = useState<BriefPreview | null | undefined>(undefined);
  const previewLabelId = useId();
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
    let live = true;
    void loadBriefPreview().then((value) => {
      if (live) setPreview(value);
    });
    return () => {
      live = false;
    };
  }, []);

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
      className="bl-feedlink"
    >
      {label} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );

  if (hidden) {
    // Already subscribed: no ask, but the end of the article still leads into the feed.
    if (placement !== "end") return null;
    return (
      <div className="not-prose bl-mail bl-mail-slim">
        <div className="bl-mail-slim-title">You&apos;re on the daily brief.</div>
        {feedLink("Open today's briefing")}
      </div>
    );
  }
  return (
    <div
      ref={rootRef}
      data-blog-email-card=""
      className="not-prose bl-mail"
    >
      <div className="bl-mail-kicker">
        The daily brief
      </div>
      <div className="bl-mail-title">
        The 10 stories that matter in tech and AI, every morning. Free.
      </div>
      {preview === undefined && status !== "done" && <div className="bl-mail-preview is-loading" aria-hidden="true" />}
      {preview && status !== "done" && (
        <div className="bl-mail-preview">
          <div id={previewLabelId} className="bl-mail-preview-label">In the brief for {preview.label}:</div>
          <ol aria-labelledby={previewLabelId}>
            {preview.stories.map((story) => (
              <li key={story.href}>
                <Link
                  href={story.href}
                  onClick={() => trackBlogCtaClicked(slug, placement === "end" ? "article_end" : "article_intro", "brief_preview")}
                >
                  {story.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
      {status === "done" ? (
        <div
          ref={doneRef}
          role="status"
          tabIndex={-1}
          className="bl-mail-done"
        >
          {message}
        </div>
      ) : (
        <div className="hp-signup hp-signup-box">
          <form onSubmit={submit} className="hp-form">
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
              className="hp-input"
            />
            <button type="submit" disabled={status === "loading"} className="hp-submit">
              {status === "loading" ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
          {status === "error" && (
            <div id={errorId} role="alert" className="hp-msg is-error">
              {message}
            </div>
          )}
        </div>
      )}
      {placement === "end" && <div className="bl-mail-foot">{feedLink("Or open today's briefing")}</div>}
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
    <div className="not-prose bl-cta">
      <div className="bl-cta-kicker">
        Trace
      </div>
      <h3 className="bl-cta-title">
        {heading || "Catch up on AI in 5 minutes — skip X and LinkedIn"}
      </h3>
      <p className="bl-cta-text">
        {blurb ||
          "Trace groups model releases, company news, and what actually changed from 100+ sources, ranked and summarized in about five minutes. Every story, Pulse, the archive, and agent access are included. Free for everyone, open source. No RSS, no newsletter pile."}
      </p>
      <div className="hp-btns">
        <Link
          href={feedHref(slug, "inline_cta")}
          onClick={() => trackBlogCtaClicked(slug, "inline_cta", "feed")}
          className="hp-btn hp-btn-dark"
        >
          {buttonLabel || "Open today's briefing"} <ArrowRight size={16} aria-hidden="true" />
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
    <div className="bl-sticky">
      <div className="bl-sticky-in">
        <p className="bl-sticky-text">
          5-minute AI briefing, free
        </p>
        <Link
          href={feedHref(slug, "sticky_bar")}
          onClick={() => trackBlogCtaClicked(slug, "sticky_bar", "feed")}
          className="bl-sticky-btn"
        >
          Open it <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="bl-sticky-x"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
