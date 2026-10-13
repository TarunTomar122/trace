import { createHash, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { toDateMaybe } from '@/lib/subscription-access';

const AGENT_KEY_COLLECTION = 'agent_access_keys';
const AGENT_KEY_PREFIX = 'trace_agent_';

export type AgentAccessResult =
  | { ok: true; uid: string }
  | { ok: false; status: 401 | 402 | 503; error: string };

export function hashAgentKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createAgentKey(uid: string): Promise<string> {
  if (!adminFirestore) throw new Error('Server configuration error');
  const token = `${AGENT_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  await adminFirestore.collection(AGENT_KEY_COLLECTION).doc(uid).set({
    uid,
    tokenHash: hashAgentKey(token),
    tokenPrefix: token.slice(0, 18),
    scope: 'trace:read',
    createdAt: FieldValue.serverTimestamp(),
    revokedAt: null,
  });
  return token;
}

export async function revokeAgentKey(uid: string): Promise<void> {
  if (!adminFirestore) throw new Error('Server configuration error');
  await adminFirestore.collection(AGENT_KEY_COLLECTION).doc(uid).set({
    uid,
    revokedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getAgentKeyStatus(uid: string) {
  if (!adminFirestore) throw new Error('Server configuration error');
  const snapshot = await adminFirestore.collection(AGENT_KEY_COLLECTION).doc(uid).get();
  if (!snapshot.exists) return { configured: false };
  const data = snapshot.data() || {};
  return {
    configured: Boolean(data.tokenHash && !data.revokedAt),
    tokenPrefix: typeof data.tokenPrefix === 'string' ? data.tokenPrefix : null,
    createdAt: toDateMaybe(data.createdAt)?.toISOString() || null,
  };
}

export async function authenticateAgentKey(token: string): Promise<AgentAccessResult> {
  if (!adminFirestore) {
    return { ok: false, status: 503, error: 'Agent access is temporarily unavailable' };
  }
  if (!token.startsWith(AGENT_KEY_PREFIX) || token.length < 40 || token.length > 128) {
    return { ok: false, status: 401, error: 'Invalid Trace Agent Key' };
  }

  const snapshot = await adminFirestore
    .collection(AGENT_KEY_COLLECTION)
    .where('tokenHash', '==', hashAgentKey(token))
    .limit(1)
    .get();
  if (snapshot.empty) {
    return { ok: false, status: 401, error: 'Invalid or rotated Trace Agent Key' };
  }

  const key = snapshot.docs[0].data();
  if (key.revokedAt || typeof key.uid !== 'string') {
    return { ok: false, status: 401, error: 'This Trace Agent Key has been revoked' };
  }

  return { ok: true, uid: key.uid };
}

export function bearerToken(authorization: string | null): string {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}
