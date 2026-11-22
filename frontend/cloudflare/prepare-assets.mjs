import { cp, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.resolve(process.argv[2] ?? path.join(here, '../.next'));
const stage = await mkdtemp(path.join(here, '.assets-'));
try {
  await mkdir(path.join(stage, '_next'));
  await cp(path.join(build, 'static'), path.join(stage, '_next/static'), { recursive: true });
  await writeFile(path.join(stage, '_headers'), '/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n');
  await rm(path.join(here, '.assets'), { recursive: true, force: true });
  await rename(stage, path.join(here, '.assets'));
} finally {
  await rm(stage, { recursive: true, force: true });
}
