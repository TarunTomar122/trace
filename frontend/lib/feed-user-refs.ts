import type { Firestore } from 'firebase-admin/firestore';

/**
 * Owner IDs with feed docs: the `_global` sentinel plus every user profile.
 * Backend-agnostic replacement for `collection('v3_user_feeds').listDocuments()`,
 * which only works on Firestore (LocalDB has no materialised parent docs).
 */
export async function listFeedOwnerIds(db: Firestore, limit = 1500): Promise<string[]> {
  const ids = new Set<string>(['_global']);
  const snap = await db.collection('user_profiles').orderBy('__name__').limit(limit).get();
  for (const doc of snap.docs) {
    if (doc.id) ids.add(doc.id);
    if (ids.size > limit) break;
  }
  return [...ids];
}
