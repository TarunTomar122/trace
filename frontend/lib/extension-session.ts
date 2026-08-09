import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from './firebase-admin.ts';

const TOKEN_PREFIX = 'trace_ext_';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function extensionSessionId(token: string): string | null {
  if (!token.startsWith(TOKEN_PREFIX) || token.length < TOKEN_PREFIX.length + 32) return null;
  return createHash('sha256').update(token).digest('base64url');
}

export async function createExtensionSession(uid: string): Promise<{ token: string; expiresAt: string }> {
  if (!adminFirestore) throw new Error('Firestore not initialized');
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const id = extensionSessionId(token);
  if (!id) throw new Error('Could not create extension session');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await adminFirestore.collection('extension_sessions').doc(id).set({
    uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    revokedAt: null,
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getExtensionSessionUid(token: string): Promise<string> {
  if (!adminFirestore) return '';
  const id = extensionSessionId(token);
  if (!id) return '';
  const snapshot = await adminFirestore.collection('extension_sessions').doc(id).get();
  const session = snapshot.data();
  const expiresAt = session?.expiresAt?.toDate?.() || new Date(session?.expiresAt || 0);
  return snapshot.exists
    && typeof session?.uid === 'string'
    && !session.revokedAt
    && Number.isFinite(expiresAt.getTime())
    && expiresAt > new Date()
    ? session.uid
    : '';
}

export async function revokeExtensionSession(token: string): Promise<void> {
  if (!adminFirestore) throw new Error('Firestore not initialized');
  const id = extensionSessionId(token);
  if (!id) return;
  await adminFirestore.collection('extension_sessions').doc(id).set({
    revokedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export function extensionBearerToken(authorization: string | null): string {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  return token.startsWith(TOKEN_PREFIX) ? token : '';
}
