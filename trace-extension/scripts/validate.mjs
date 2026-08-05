import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const packageJson = JSON.parse(await read('package.json'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, packageJson.version);
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal('host_permissions' in manifest, false, 'public CORS endpoint should not require host permissions');
assert.deepEqual(manifest.chrome_url_overrides, { newtab: 'newtab.html' });
assert.equal(
  manifest.content_security_policy?.extension_pages,
  "script-src 'self'; object-src 'self'",
);
assert.match(manifest.homepage_url, /^https:\/\/www\.yourtrace\.online\/?$/);

const requiredFiles = [
  'manifest.json',
  'newtab.html',
  'styles.css',
  'newtab.js',
  'lib/brief.js',
  ...Object.values(manifest.icons),
];

for (const path of requiredFiles) {
  assert.ok((await stat(resolve(root, path))).isFile(), `missing extension file: ${path}`);
}

const html = await read('newtab.html');
assert.doesNotMatch(html, /<script(?![^>]+src=)/i, 'inline scripts are not allowed');
assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'inline event handlers are not allowed');
assert.match(html, /<script type="module" src="newtab\.js"><\/script>/);

const javascript = `${await read('newtab.js')}\n${await read('lib/brief.js')}`;
assert.doesNotMatch(javascript, /\beval\s*\(|\bnew\s+Function\b/);
assert.doesNotMatch(javascript, /import\s+[^;]*https?:\/\//);

const textFiles = [
  'manifest.json',
  'newtab.html',
  'styles.css',
  'newtab.js',
  'lib/brief.js',
  'README.md',
  'PRIVACY.md',
  'store/listing.md',
];

for (const path of textFiles) {
  assert.doesNotMatch(await read(path), /\u2014/, `${path} contains an em dash`);
}

console.log(`Trace extension validation passed with ${requiredFiles.length} runtime files.`);
