import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getSignedInUid } from '@/lib/request-auth';

/**
 * GET /api/profile — full profile doc for the signed-in user.
 * PATCH /api/profile — allowlisted partial profile update (merge).
 *
 * Replaces direct browser Firestore writes (updateUserProfile,
 * syncUserTimezone, recordLastActive, affiliate attribution) so the web
 * client never touches Firestore and works against any backend selected
 * by FIRESTORE_BACKEND.
 */

// Fields the client must never write: billing/entitlement state is owned by
// the Dodo webhook + RevenueCat sync, build state by the pipeline.
const PROTECTED_FIELDS = new Set([
  'uid',
  // Identity is set once at sign-up from the verified token; the welcome email
  // keys on these, so a client must not be able to rewrite them.
  'email',
  'createdAt',
  'signupPlatform',
  'subscriptionStatus',
  'appSubscriptionStatus',
  'subscriptionId',
  'dodoCustomerId',
  'planId',
  'nextBillingDate',
  'trialEndDate',
  'cancelledAt',
  'willCancelAt',
  'lastPaymentDate',
  'lastCheckoutCreatedAt',
  'lastCheckoutSessionId',
  'feedBuildStatus',
  'feedBuildCompletedAt',
  'isEarlyAdopter',
  'deleted',
  // Win-back bookkeeping belongs to the email pipeline; newsletter setup goes
  // through the validated /api/newsletter/preferences.
  'winbackSends',
  'winbackLastSentAt',
  'newsletterTopics',
  'newsletterStoryCount',
  'newsletterFormat',
]);

function sanitizePatch(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (PROTECTED_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export async function GET(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const snap = await adminFirestore.collection('user_profiles').doc(uid).get();
    if (!snap.exists) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile: { uid: snap.id, ...snap.data() } });
  } catch (error) {
    console.error('[api/profile] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const patch = sanitizePatch(body);
    if (!patch || Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Empty or invalid patch' }, { status: 400 });
    }

    if ('lastActiveAt' in patch && !isValidIsoDate(patch.lastActiveAt)) {
      patch.lastActiveAt = new Date().toISOString();
    }

    const ref = adminFirestore.collection('user_profiles').doc(uid);

    // Affiliate attribution is first-touch only (mirrors previous client logic).
    const hasAffiliateKeys = ['affiliateCode', 'affiliateLandingPath', 'utmSource', 'utmCampaign', 'utmMedium']
      .some((key) => key in patch);
    if (hasAffiliateKeys) {
      const existing = await ref.get();
      if (existing.exists && (existing.data() || {}).affiliateCode) {
        delete patch.affiliateCode;
        delete patch.affiliateAttributedAt;
        delete patch.affiliateLandingPath;
        delete patch.utmSource;
        delete patch.utmCampaign;
        delete patch.utmMedium;
      } else if ('affiliateCode' in patch) {
        patch.affiliateAttributedAt = FieldValue.serverTimestamp();
      }
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ ok: true, skipped: 'affiliate already attributed' });
      }
    }

    await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/profile] PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
