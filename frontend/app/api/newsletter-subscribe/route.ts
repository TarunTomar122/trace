import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { signupAttribution } from '@/lib/first-touch';
import { visitorAddress } from '@/lib/analytics/address';
import { signupGuard, trapFilled } from '@/lib/signup-guard';

/**
 * POST /api/newsletter-subscribe
 * Body: { email: string, source?: 'landing_page' | 'daily_page' | 'featured_page' | 'blog' | 'feed_prompt',
 *         channel?: string, ref?: string } (channel and ref: lib/first-touch.ts)
 *
 * Adds an email to the free_newsletter_subscribers collection.
 * No auth required — this is for anonymous visitors, so lib/signup-guard.ts screens out bots first
 * (hidden trap field, per-visitor limit, site-wide cap on new entries).
 */

const SUBSCRIBED = {
  ok: true,
  status: 'subscribed',
  message: "You're in! Check your inbox for a welcome email.",
};

function busy({ retryAfterSec, message }: { retryAfterSec: number; message: string }) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const { email, source: rawSource } = body;
    // Where the signup came from, so the dashboard can credit the public
    // /brief and /featured pages, the blog and the feed's corner card. Allowlisted: this is an anonymous endpoint.
    const SOURCES = ['daily_page', 'featured_page', 'blog', 'feed_prompt'];
    const source = typeof rawSource === 'string' && SOURCES.includes(rawSource) ? rawSource : 'landing_page';

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const trimmed = email.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return NextResponse.json(
        { error: 'Please enter a valid email' },
        { status: 400 }
      );
    }

    // A filled trap field is a form-filling bot: answer like a normal signup and save nothing.
    if (trapFilled(body)) {
      // Source and domain only, so a real person caught by autofill would show up in the logs.
      const domain = typeof email === 'string' ? email.trim().toLowerCase().split('@')[1] ?? '' : '';
      console.warn(`[newsletter-subscribe] trap field filled; not saved (source=${source}, domain=${domain})`);
      return NextResponse.json(SUBSCRIBED);
    }

    const address = visitorAddress(request.headers);
    const visitor = signupGuard.visitor(address);
    if (!visitor.ok) {
      console.warn('[newsletter-subscribe] per-visitor limit hit');
      return busy(visitor);
    }

    if (!adminDb) {
      console.error('Firestore not initialized');
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      );
    }

    // Check if already subscribed
    const docRef = adminDb
      .collection('free_newsletter_subscribers')
      .doc(trimmed);
    const existing = await docRef.get();

    if (existing.exists) {
      const data = (existing.data() || {}) as Record<string, unknown>;
      // Someone who unsubscribed and came back through the form has to land on
      // the list again: this form is the only way back, and answering
      // "already subscribed" left them opted out forever.
      if (data.active !== true) {
        const entry = signupGuard.newEntry(address);
        if (!entry.ok) {
          console.warn('[newsletter-subscribe] new-entry limit hit (resubscribe)');
          return busy(entry);
        }
        await docRef.set(
          { active: true, resubscribedAt: new Date().toISOString() },
          { merge: true }
        );
        return NextResponse.json({
          ok: true,
          status: 'resubscribed',
          message: "You're back in! Trace Daily starts again with the next edition.",
        });
      }
      return NextResponse.json({
        ok: true,
        status: 'already',
        message: "You're already subscribed!",
      });
    }

    const entry = signupGuard.newEntry(address);
    if (!entry.ok) {
      console.warn('[newsletter-subscribe] new-entry limit hit');
      return busy(entry);
    }

    // Save subscriber
    await docRef.set({
      email: trimmed,
      subscribedAt: new Date().toISOString(),
      source,
      // Where they came from (channel) and whose share link brought them (referredBy):
      // lib/first-touch.ts, counted by the admin snapshot and the daily email's thank-you.
      ...signupAttribution(body),
      active: true,
    });

    return NextResponse.json(SUBSCRIBED);
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}

