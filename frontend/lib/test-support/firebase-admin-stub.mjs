// Replaces lib/firebase-admin.ts in route tests (see next-route-hooks.mjs):
// an in-memory database and a fake ID-token verifier, so a test can never
// reach Firebase or LocalDB, whatever the environment holds.
import { MemoryFirestore } from './memory-firestore.mjs';

export const adminFirestore = new MemoryFirestore();
export const adminDb = adminFirestore;
export const adminStorage = null;

export const TEST_ID_TOKEN_PREFIX = 'test-id-token:';

export const adminAuth = {
  async verifyIdToken(token) {
    if (typeof token === 'string' && token.startsWith(TEST_ID_TOKEN_PREFIX)) {
      const uid = token.slice(TEST_ID_TOKEN_PREFIX.length);
      return { uid, email: `${uid}@example.com` };
    }
    throw new Error('invalid test ID token');
  },
};

export function firestoreBackendMode() {
  return 'local';
}
