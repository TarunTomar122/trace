"use client";

import * as React from "react";

/** A person's photo (Google's, from their account), or their first letter when there is none or it won't load. */
export function Avatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  // A photo that failed before hydration never fires onError for React: check once on mount.
  React.useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (!src || failed) {
    return (
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-oa-bg text-[12px] font-semibold uppercase leading-none text-oa-muted-fg shadow-[0_0_0_1px_var(--oa-border)]">
        {Array.from(name.trim())[0] ?? "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      referrerPolicy="no-referrer"
      ref={imgRef}
      onError={() => setFailed(true)}
      className="size-7 shrink-0 rounded-full object-cover"
    />
  );
}
