import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getSignedInUid } from '@/lib/request-auth';
import { prefsFromProfile, profilePatchFromInput } from '@/lib/newsletter-prefs';

/**
 * GET /api/newsletter/preferences — the signed-in reader's daily brief setup.
 * PUT /api/newsletter/preferences — { enabled?, topics?, count?, format? }.
 *
 * Validated here rather than through PATCH /api/profile so the pipeline
 * only ever reads known lanes, counts and formats.
 */

export async function GET(request: NextRequest) {
  if (!adminFirestore) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  const uid = await getSignedInUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const snap = await adminFirestore.collection('user_profiles').doc(uid).get();
    const profile = snap.exists ? (snap.data() as Record<string, unknown>) : {};
    return NextResponse.json({ prefs: prefsFromProfile(profile), email: profile.email ?? null });
  } catch (error) {
    console.error('[api/newsletter/preferences] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!adminFirestore) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  const uid = await getSignedInUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = profilePatchFromInput(await request.json().catch(() => null));
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    const ref = adminFirestore.collection('user_profiles').doc(uid);
    await ref.set({ ...result.patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const snap = await ref.get();
    return NextResponse.json({ ok: true, prefs: prefsFromProfile(snap.data() as Record<string, unknown>) });
  } catch (error) {
    console.error('[api/newsletter/preferences] PUT error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
