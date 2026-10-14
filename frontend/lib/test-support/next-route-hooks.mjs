// Lets `node --test` import Next route handlers directly:
// - `@/...` resolves to the frontend root, extensionless imports find .ts
// - `next/server` and friends resolve to their CommonJS entry files
// - lib/firebase-admin.ts is swapped for an in-memory stub, so route tests
//   can never touch Firebase or LocalDB.
// Import this first, then load the modules under test with `await import()`.
import { registerHooks } from 'node:module';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const frontendRoot = new URL('../../', import.meta.url);
const firebaseAdmin = new URL('lib/firebase-admin.ts', frontendRoot).href;
const firebaseAdminStub = new URL('./firebase-admin-stub.mjs', import.meta.url).href;
const NEXT_ENTRY_POINTS = new Set(['next/server', 'next/headers', 'next/navigation', 'next/cache']);

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function findSource(base) {
  for (const suffix of ['', '.ts', '.mjs', '.js', '/index.ts']) {
    const candidate = `${base}${suffix}`;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (NEXT_ENTRY_POINTS.has(specifier)) return nextResolve(`${specifier}.js`, context);
    let url = null;
    if (specifier.startsWith('@/')) {
      url = findSource(new URL(specifier.slice(2), frontendRoot).href);
    } else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith(frontendRoot.href)) {
      url = findSource(new URL(specifier, context.parentURL).href);
    }
    if (url === firebaseAdmin) return { url: firebaseAdminStub, shortCircuit: true };
    if (url) return { url, shortCircuit: true };
    const resolved = nextResolve(specifier, context);
    if (resolved.url === firebaseAdmin) return { url: firebaseAdminStub, shortCircuit: true };
    return resolved;
  },
});
