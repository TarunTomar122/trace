import { ImageResponse } from 'next/og';
import { OgShareImageBody } from './og-share-image-body';
import { OG_FONT_BOLD_B64, OG_FONT_REGULAR_B64 } from './og-fonts';

// Keep the bundled fonts and logo in the existing Node.js image runtime.
export const runtime = 'nodejs';

export const alt = 'Trace — 10 big things in tech and AI';

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

function fontFromB64(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export default function Image() {
  return new ImageResponse(<OgShareImageBody />, {
    ...size,
    fonts: [
      { name: 'Inter', data: fontFromB64(OG_FONT_REGULAR_B64), weight: 400, style: 'normal' },
      { name: 'Inter', data: fontFromB64(OG_FONT_BOLD_B64), weight: 700, style: 'normal' },
    ],
  });
}
