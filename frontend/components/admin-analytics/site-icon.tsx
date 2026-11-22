"use client";

import * as React from "react";

/**
 * A referrer's favicon, through our own admin-only proxy (app/api/admin/favicon),
 * or the site's first letter when there is none.
 */
export function SiteIcon({ host }: { host: string }) {
  const [failed, setFailed] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  // An icon that failed before hydration never fires onError for React: check once on mount.
  React.useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (host === "(direct)") {
    return (
      <svg viewBox="0 0 20 20" className="size-4 text-oa-muted-fg" aria-hidden>
        <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (failed) {
    return (
      <span aria-hidden className="flex size-4 items-center justify-center rounded-[3px] bg-oa-bg text-[10px] font-semibold uppercase leading-none text-oa-muted-fg">
        {host.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/admin/favicon?host=${encodeURIComponent(host)}`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      ref={imgRef}
      onError={() => setFailed(true)}
      className="size-4 rounded-[3px]"
    />
  );
}
