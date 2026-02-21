import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const ONBOARD_DISPATCH_COOLDOWN_MS = 45_000;

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toMillis?: () => number };
    if (typeof maybe.toMillis === 'function') {
      return maybe.toMillis();
    }
  }
  return null;
}

/**
 * Triggers the GitHub Action to run Python onboarding hook for a user.
 * 
 * POST /api/onboard
 * Body: { uid: string }
 * 
 * Requires GITHUB_TOKEN env var with repo dispatch permission.
 */
export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    // Hard rule: never generate feeds for unsubscribed users.
    if (adminDb) {
      try {
        const userSnap = await adminDb.collection('user_profiles').doc(uid).get();
        if (userSnap.exists) {
          const userData = userSnap.data() || {};
          const webSub = String(userData.subscriptionStatus || 'none');
          const appSub = String(userData.appSubscriptionStatus || 'none');
          const hasSubscriptionAccess =
            ['trial', 'active'].includes(webSub) || ['trial', 'active'].includes(appSub);

          if (!hasSubscriptionAccess) {
            return NextResponse.json({
              ok: true,
              message: 'Skipping feed generation for unsubscribed user.',
              triggered: false,
              blocked: 'unsubscribed',
            });
          }
        }
      } catch (error) {
        console.warn('Failed to verify subscription before onboarding dispatch:', error);
      }
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'ttomar/claudia'; // owner/repo format
    
    if (!githubToken) {
      console.warn('GITHUB_TOKEN not set, skipping onboard trigger');
      // Don't fail - user will get feed from next daily batch
      return NextResponse.json({ 
        ok: true, 
        message: 'Onboarding saved. Feed will be ready by tomorrow morning.',
        triggered: false 
      });
    }

    // Server-side dedupe: prevent duplicate dispatches for the same user in
    // a short window when multiple clients/screens trigger simultaneously.
    if (adminDb) {
      try {
        const userRef = adminDb.collection('user_profiles').doc(uid);
        const userSnap = await userRef.get();
        const lastTriggeredMs = userSnap.exists
          ? toMillis(userSnap.get('lastOnboardDispatchAt'))
          : null;
        const nowMs = Date.now();

        if (lastTriggeredMs && nowMs - lastTriggeredMs < ONBOARD_DISPATCH_COOLDOWN_MS) {
          const waitMs = ONBOARD_DISPATCH_COOLDOWN_MS - (nowMs - lastTriggeredMs);
          return NextResponse.json({
            ok: true,
            message: 'Feed generation already queued.',
            triggered: false,
            deduped: true,
            waitMs,
          });
        }
      } catch (error) {
        console.warn('Onboard dedupe check failed, proceeding with dispatch:', error);
      }
    }

    // Trigger GitHub Action via repository_dispatch
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'user-onboard',
          client_payload: {
            user_id: uid,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub dispatch failed:', response.status, errorText);
      // Don't fail the request - user is still onboarded
      return NextResponse.json({ 
        ok: true, 
        message: 'Onboarding saved. Feed generation queued.',
        triggered: false,
        error: 'GitHub dispatch failed' 
      });
    }

    console.log(`Triggered v3 feed generation workflow for user: ${uid}`);

    if (adminDb) {
      try {
        await adminDb.collection('user_profiles').doc(uid).set(
          {
            lastOnboardDispatchAt: new Date(),
            feedBuildStatus: 'building',
            feedBuildRequestedAt: new Date(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn('Failed to persist onboard dispatch metadata:', error);
      }
    }
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Your personalized feed is being generated.',
      triggered: true 
    });
    
  } catch (error) {
    console.error('Onboard API error:', error);
    // Don't fail - user data is saved, just feed generation didn't trigger
    return NextResponse.json({ 
      ok: true, 
      message: 'Onboarding saved.',
      triggered: false,
      error: String(error) 
    });
  }
}

