"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getArticleImageCandidates } from "@/lib/fallback-images";

const LOCAL_PLACEHOLDER = "/article-placeholder.svg";

type ArticleImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  thumbnail?: string | null;
  title: string;
  /** Passed to picsum fallback when the thumbnail fails to load */
  fallbackWidth?: number;
  fallbackHeight?: number;
};

/**
 * Renders a crawler-safe local image first, then swaps in the first remote
 * candidate that successfully preloads in the browser. Broken third-party
 * images never reach the rendered <img>.
 */
export function ArticleImage({
  thumbnail,
  title,
  fallbackWidth = 800,
  fallbackHeight = 500,
  alt = "",
  onLoad,
  onError,
  ...props
}: ArticleImageProps) {
  const candidates = useMemo(
    () => getArticleImageCandidates(thumbnail, title, fallbackWidth, fallbackHeight),
    [thumbnail, title, fallbackWidth, fallbackHeight],
  );

  const candidateKey = candidates.join("|");
  const [loaded, setLoaded] = useState({ key: "", src: LOCAL_PLACEHOLDER });
  const src = loaded.key === candidateKey ? loaded.src : LOCAL_PLACEHOLDER;

  useEffect(() => {
    let cancelled = false;

    const loadCandidate = async (index: number) => {
      if (cancelled || index >= candidates.length) return;

      const image = new Image();
      image.onload = () => {
        if (!cancelled) {
          setLoaded({ key: candidateKey, src: candidates[index] });
        }
      };
      image.onerror = () => void loadCandidate(index + 1);
      image.src = candidates[index];
    };

    void loadCandidate(0);

    return () => {
      cancelled = true;
    };
  }, [candidateKey, candidates]);

  return (
    // A plain img is intentional: remote candidates are preloaded before use,
    // while Next Image would still expose failed remote optimizer requests.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      onError={onError}
    />
  );
}
