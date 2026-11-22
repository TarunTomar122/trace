import { lookup } from 'node:dns/promises';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { isPublicAddress } from './oauth-clients';

const maxBytes = 3 * 1024 * 1024;

async function remoteImage(input: string): Promise<Buffer> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(4500);
  for (let hop = 0; hop < 3; hop++) {
    if (!['https:', 'http:'].includes(url.protocol) || url.port || url.username || url.password) break;
    // Pin the TCP connection to the validated IPv4 address, including every redirect.
    const address = await lookup(url.hostname, { family: 4 });
    if (!isPublicAddress(address.address)) break;
    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    const response = await new Promise<import('node:http').IncomingMessage>((resolve, reject) => {
      get(url, { signal, agent: false, family: 4, lookup: (_host, _opts, done) => done(null, address.address, 4) }, resolve).on('error', reject);
    });
    try {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
        url = new URL(response.headers.location, url);
        continue;
      }
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > maxBytes) break;
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of response) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('Image is too large');
        chunks.push(chunk);
      }
      const image = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000 });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp', 'gif', 'avif', 'heif'].includes(metadata.format || '')) break;
      return await image.resize(1080, 1080, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    } finally {
      response.destroy();
    }
  }
  throw new Error('Image unavailable');
}

export async function shareImages(imageUrl: string) {
  const local = (name: string) => readFile(join(process.cwd(), 'public', name));
  const logo = await local('tc.png');
  const background = await (imageUrl ? remoteImage(imageUrl) : Promise.reject()).catch(async () =>
    sharp(await local('feed.webp')).resize({ width: 1080 }).png().toBuffer());
  return { logoUrl: 'data:image/png;base64,' + logo.toString('base64'), imageUrl: 'data:image/png;base64,' + background.toString('base64') };
}
