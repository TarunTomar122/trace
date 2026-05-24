"use client";

import { useEffect } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="landing-page landing-grid-bg min-h-screen flex flex-col">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">
            Something went wrong
          </p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.5rem]">
            An error occurred
          </h1>
          <p className="mt-4 max-w-md mx-auto text-[16px] leading-[1.8] text-[#6b7280]">
            We encountered an unexpected issue. Please try again.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="landing-btn landing-btn-primary landing-btn-sm"
            >
              Try again
            </button>
            <Link
              href="/"
              className="text-[13px] font-medium text-[#6b7280] transition-colors hover:text-[#111827]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
