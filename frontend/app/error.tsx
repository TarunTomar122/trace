"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import StatusPage, { STATUS_TITLE_ID, type StatusCard } from "@/components/StatusPage";

const CARDS: StatusCard[] = [
  { title: "Daily Brief", text: "5-minute brief, grouped from 100+ sources", href: "/brief", tint: "yellow" },
  { title: "The Feed", text: "Every story ranked, every source attached", href: "/feed", tint: "cyan" },
  { title: "Guides", text: "Plain tips for beating news overload", href: "/blog", tint: "green" },
];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Move focus to the headline so screen readers announce the failure.
  useEffect(() => {
    document.getElementById(STATUS_TITLE_ID)?.focus();
  }, []);

  // reset() alone re-renders the same failed server payload; refetch it first.
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <StatusPage
      note="well, that wasn't meant to happen"
      title="Something went wrong"
      lede="This page hit a problem on our side. Trying again often fixes it."
      actions={
        <>
          <button type="button" onClick={retry} className="st-btn st-btn-dark">
            Try again
          </button>
          {/* The boundary only clears on a route change, so on the homepage itself a plain
              link to "/" would do nothing; retry instead. */}
          <Link
            href="/"
            className="st-btn st-btn-line"
            onClick={(event) => {
              if (pathname === "/") {
                event.preventDefault();
                retry();
              }
            }}
          >
            Back to home
          </Link>
        </>
      }
      fine={
        <>
          Still stuck? <Link href="/contact">Tell us</Link> and we will look into it.
          {error?.digest ? (
            <span className="st-ref">Error ref: {error.digest}</span>
          ) : null}
        </>
      }
      // A card for the page that just failed would be a dead click (same path, boundary stays).
      cards={CARDS.filter((card) => card.href !== pathname).slice(0, 2)}
    />
  );
}
