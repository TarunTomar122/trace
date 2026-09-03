"use client";

import { useEffect } from "react";
import Link from "next/link";
import PageShell from "@/components/feed-v2/PageShell";

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
    <PageShell>
      <section style={{ textAlign: "center", padding: "72px 0 40px" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1d9bf0" }}>
          Something went wrong
        </p>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          An error occurred
        </h1>
        <p style={{ margin: "14px auto 0", maxWidth: 480, fontSize: 16, lineHeight: 1.65, color: "#536471" }}>
          We encountered an unexpected issue. Please try again.
        </p>
        {error?.digest ? (
          <p style={{ margin: "10px auto 0", fontSize: 12, color: "#71767b", fontVariantNumeric: "tabular-nums" }}>
            Error ref: {error.digest}
          </p>
        ) : null}
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <button
            type="button"
            onClick={reset}
            style={{ height: 44, padding: "0 26px", borderRadius: 9999, border: "none", background: "#1d9bf0", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
          <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: "#536471", textDecoration: "none" }}>
            Back to home
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
