"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <main className="text-center px-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">
          Something went wrong
        </p>
        <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.5rem]">
          An error occurred
        </h1>
        <p className="mt-4 max-w-md mx-auto text-[16px] leading-[1.8] text-secondary">
          We encountered an unexpected issue. Please try again.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="inline-flex rounded-full bg-foreground px-6 py-3 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex text-[13px] font-medium text-secondary hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
