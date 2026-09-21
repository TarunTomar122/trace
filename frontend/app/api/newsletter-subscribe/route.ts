import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/newsletter-subscribe
 * Body: { email: string }
 *
 * Adds an email to the free_newsletter_subscribers collection.
 * No auth required — this is for anonymous visitors.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

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
        await docRef.set(
          { active: true, resubscribedAt: new Date().toISOString() },
          { merge: true }
        );
        return NextResponse.json({
          ok: true,
          message: "You're back in! First newsletter lands tomorrow.",
        });
      }
      return NextResponse.json({
        ok: true,
        message: "You're already subscribed!",
      });
    }

    // Save subscriber
    await docRef.set({
      email: trimmed,
      subscribedAt: new Date().toISOString(),
      source: 'landing_page',
      active: true,
    });

    return NextResponse.json({
      ok: true,
      message: "You're in! First newsletter lands tomorrow.",
    });
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}

