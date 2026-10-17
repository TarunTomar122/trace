import { adminFirestore } from '@/lib/firebase-admin';

/**
 * Opening the feed is the activity signal DAU/WAU/MAU and email routing are
 * built from. Callers run this through `after()`: a bare fire-and-forget write
 * is dropped when the serverless function freezes after responding, which is
 * why lastActiveAt stopped moving in early September.
 *
 * Callers: /api/mobile/feed and /api/feed for the app, and the signed-in web
 * feed's load request (GET /api/retention/streak). The web /feed page renders
 * the shared edition server-side without a session, so it can't stamp here.
 */
export async function stampLastActive(uid: string): Promise<void> {
  if (!uid || !adminFirestore) return;
  try {
    await adminFirestore
      .collection('user_profiles')
      .doc(uid)
      .set({ lastActiveAt: new Date() }, { merge: true });
  } catch (error) {
    console.error('[last-active] lastActiveAt stamp failed:', error);
  }
}
