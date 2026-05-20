"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import StoryWireFooter from "@/components/StoryWireFooter";

export function getStoryBackLabel(returnHref: string): string {
  if (returnHref.startsWith("/feed")) return "Back to feed";
  return "Back";
}

export default function StoryPageShell({
  backHref,
  backLabel,
  shareButton,
  children,
  ctaHref = "/feed",
  ctaLabel = "Open feed",
  mode = "public",
  contentLayout,
}: {
  backHref: string;
  backLabel?: string;
  shareButton?: React.ReactNode;
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  mode?: "public" | "app";
  contentLayout?: (content: React.ReactNode) => React.ReactNode;
}) {
  const label = backLabel ?? getStoryBackLabel(backHref);
  const isApp = mode === "app";
  const { user } = useAuth();

  if (isApp) {
    return (
      <div className="story-page story-page--app min-h-screen bg-white">
        <header className="sticky top-0 z-40 bg-white px-4 pt-3 pb-3 sm:px-6">
          <div className="edition-feed-nav edition-feed-nav--story mx-auto max-w-6xl">
            <Link href={backHref} prefetch={false} className="story-page-header-back">
              <ArrowLeft size={16} aria-hidden />
              <span>{label}</span>
            </Link>
            <Link
              href="/feed"
              prefetch={false}
              className="story-page-header-logo flex items-center gap-2.5 no-underline"
              style={{ color: "inherit" }}
            >
              <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
              <span className="text-[13px] font-bold tracking-[0.12em] text-[#111827]">TRACE</span>
            </Link>
            <div className="story-page-header-end">
              {shareButton}
              {user?.photoURL ? (
                <Link href="/profile" prefetch={false}>
                  <img src={user.photoURL} alt="Profile" className="h-8 w-8 rounded-full ring-2 ring-white" />
                </Link>
              ) : (
                <Link
                  href="/profile"
                  prefetch={false}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)]"
                >
                  <span className="text-sm font-semibold">{user?.email?.[0]?.toUpperCase() || "U"}</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="story-page-main mx-auto max-w-6xl px-4 pb-0 pt-4 sm:px-6 sm:pt-5">
          {contentLayout
            ? contentLayout(children)
            : (
              <>
                <div className="story-page-content">{children}</div>
                <StoryWireFooter />
              </>
            )}
        </main>
      </div>
    );
  }

  return (
    <div className="story-page">
      <header className="story-page-header">
        <div className="story-page-nav">
          <Link href="/" className="story-page-logo">
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span>TRACE</span>
          </Link>
          <>
            <nav className="story-page-nav-links" aria-label="Site">
              <Link href="/blog">Blog</Link>
            </nav>
            <Link href={ctaHref} className="story-page-cta">
              {ctaLabel}
            </Link>
          </>
        </div>
      </header>

      <main className="story-page-main">
        <div className="story-page-toolbar">
          <Link href={backHref} className="story-page-back">
            <ArrowLeft size={16} />
            {label}
          </Link>
          {shareButton}
        </div>
        {contentLayout
          ? contentLayout(children)
          : <div className="story-page-content">{children}</div>}
      </main>
    </div>
  );
}
