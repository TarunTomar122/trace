"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getArticleImageCandidates } from "@/lib/fallback-images";

type ArticleImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  thumbnail?: string | null;
  title: string;
  /** Passed to picsum fallback when the thumbnail fails to load */
  fallbackWidth?: number;
  fallbackHeight?: number;
};

/**
 * Renders a story thumbnail with automatic fallbacks when the URL 404s or breaks.
 * Chain: source thumbnail → curated Unsplash → picsum.photos seed.
 */
export function ArticleImage({
  thumbnail,
  title,
  fallbackWidth = 800,
  fallbackHeight = 500,
  alt = "",
  onError,
  ...props
}: ArticleImageProps) {
  const candidates = useMemo(
    () => getArticleImageCandidates(thumbnail, title, fallbackWidth, fallbackHeight),
    [thumbnail, title, fallbackWidth, fallbackHeight],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const src = candidates[Math.min(index, candidates.length - 1)];

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      onError={(event) => {
        if (index < candidates.length - 1) {
          setIndex((current) => current + 1);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
