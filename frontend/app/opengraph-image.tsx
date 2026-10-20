import { ImageResponse } from 'next/og';
import { OgShareImageBody } from './og-share-image-body';
import { ogFonts } from './og-style';

// Keep the bundled fonts and logo in the existing Node.js image runtime.
export const runtime = 'nodejs';

export const alt = "Trace: the fastest way to catch up on tech & AI news";

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(<OgShareImageBody />, {
    ...size,
    fonts: ogFonts(),
  });
}
