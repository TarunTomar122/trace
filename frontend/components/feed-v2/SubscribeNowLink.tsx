'use client';

import type { ReactNode } from 'react';

/** Jumps to the page's subscribe form and puts the cursor in the email field. */
export default function SubscribeNowLink({
  inputId = 'subscribe-email',
  className,
  children,
}: {
  inputId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href="#subscribe"
      className={className}
      onClick={() => {
        // The anchor scrolls; focus once it has, without a second jump.
        window.setTimeout(() => document.getElementById(inputId)?.focus({ preventScroll: true }), 350);
      }}
    >
      {children}
    </a>
  );
}
