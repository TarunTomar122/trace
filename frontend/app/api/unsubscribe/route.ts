import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { plainPage } from '@/lib/plain-page';

/**
 * Unsubscribe from the daily newsletter.
 *
 *   GET  /api/unsubscribe?email=...   one tap from the email footer
 *   POST /api/unsubscribe?email=...   RFC 8058 List-Unsubscribe=One-Click
 *   POST /api/unsubscribe { uid }     subscription webhook cleanup (unchanged)
 *
 * The email footer links here and every send carries a matching
 * List-Unsubscribe header, so both verbs have to actually opt the address out:
 * an unhonoured unsubscribe is what gets a sending IP filtered.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function optOutByEmail(raw: string) {
  const db = adminDb;
  if (!db) throw new Error('database unavailable');
  const email = raw.trim().toLowerCase();
  const now = new Date().toISOString();
  let touched = 0;

  // Landing-page subscribers are keyed by their own address.
  const subscriber = db.collection('free_newsletter_subscribers').doc(email);
  const existing = await subscriber.get();
  if (existing.exists) {
    await subscriber.set({ active: false, unsubscribedAt: now }, { merge: true });
    touched += 1;
  }

  // Account holders: set both flags so any reader of the preference sees it.
  const profiles = await db
    .collection('user_profiles')
    .where('email', '==', email)
    .limit(10)
    .get();
  for (const doc of profiles.docs) {
    await doc.ref.set(
      {
        dailyNewsletterEnabled: false,
        newsletterOptIn: false,
        newsletterUnsubscribedAt: now,
      },
      { merge: true }
    );
    touched += 1;
  }

  return { email, touched };
}

function confirmationPage(valid: boolean) {
  return plainPage({
    title: 'Trace unsubscribe',
    heading: valid ? "You're unsubscribed." : 'That link looked broken.',
    body: valid
      ? 'No more morning emails to this address. You can still read the feed any time.'
      : 'No address came through with this link. Try the unsubscribe link in the email again.',
    cta: { href: 'https://yourtrace.online/feed', label: 'Open the feed' },
  });
}

export async function GET(request: NextRequest) {
  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase();

  if (!adminDb || !email || !EMAIL_RE.test(email)) {
    return new NextResponse(confirmationPage(false), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const { touched } = await optOutByEmail(email);
    console.log(`Unsubscribe via link: ${email} (${touched} record(s) updated)`);
  } catch (error) {
    console.error('Unsubscribe error:', error);
  }

  return new NextResponse(confirmationPage(true), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: NextRequest) {
  const email = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase();

  // One-click from the List-Unsubscribe header: Gmail and Yahoo POST here with
  // a form body, so the address has to come from the query string.
  if (email) {
    try {
      const { touched } = await optOutByEmail(email);
      console.log(`Unsubscribe via one-click: ${email} (${touched} record(s) updated)`);
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error('Unsubscribe one-click error:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  // Existing behaviour: the subscription webhook asks for a cleanup dispatch.
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: 'uid is required' }, { status: 400 });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'ttomar/claudia';

    if (!githubToken) {
      console.warn('GITHUB_TOKEN not set, skipping unsubscribe trigger');
      return NextResponse.json({
        ok: true,
        message: 'Unsubscribe saved. Cleanup will happen later.',
        triggered: false,
      });
    }

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
          event_type: 'user-unsubscribe',
          client_payload: {
            user_id: uid,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub dispatch failed:', response.status, errorText);
      return NextResponse.json({
        ok: true,
        message: 'Unsubscribe saved. Cleanup queued.',
        triggered: false,
        error: 'GitHub dispatch failed',
      });
    }

    console.log(`Triggered unsubscribe workflow for user: ${uid}`);

    return NextResponse.json({
      ok: true,
      message: 'Unsubscribe cleanup queued.',
      triggered: true,
    });

  } catch (error) {
    console.error('Unsubscribe API error:', error);
    return NextResponse.json({
      ok: true,
      message: 'Unsubscribe saved.',
      triggered: false,
      error: String(error),
    });
  }
}
