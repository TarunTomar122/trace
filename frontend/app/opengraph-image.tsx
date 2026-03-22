import { ImageResponse } from 'next/og';
import { OgShareImageBody } from './og-share-image-body';

export const runtime = 'edge';

export const alt = 'Trace — Your daily tech, in one place';

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(<OgShareImageBody />, { ...size });
}
