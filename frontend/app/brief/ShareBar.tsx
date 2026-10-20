'use client';

import { useState } from 'react';
import posthog from 'posthog-js';

type Channel = 'x' | 'linkedin' | 'copy' | 'native';

/** Share a public page (a day's brief, a featured item). Every share is a link back to it. */
export default function ShareBar({
  url,
  text,
  event = 'daily_edition_shared',
}: {
  url: string;
  text: string;
  event?: 'daily_edition_shared' | 'featured_page_shared';
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${url}?from=share`;

  function track(channel: Channel) {
    posthog.capture(event, { channel, url });
  }

  async function copy() {
    track('copy');
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', shareUrl);
    }
  }

  async function nativeShare() {
    if (!('share' in navigator)) return copy();
    track('native');
    try {
      await navigator.share({ title: text, url: shareUrl });
    } catch {
      /* dismissed */
    }
  }

  // Rectangular outline buttons, as on the homepage (lib/home-css.ts .hp-btn-line).
  const button =
    'inline-flex h-10 items-center gap-2 rounded-[3px] border border-[#c7c7c7] bg-white px-4 text-[15px] text-[#0a0a0a] transition-colors hover:border-[#0a0a0a]';

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <a
        className={button}
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('x')}
      >
        Share on X
      </a>
      <a
        className={button}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('linkedin')}
      >
        LinkedIn
      </a>
      <button type="button" className={button} onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      {/* Phones get the system share sheet; it falls back to copying the link. */}
      <button type="button" className={`${button} sm:hidden`} onClick={nativeShare}>
        More…
      </button>
    </div>
  );
}
