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
    const existing = await adminDb
      .collection('free_newsletter_subscribers')
      .doc(trimmed)
      .get();

    if (existing.exists) {
      return NextResponse.json({
        ok: true,
        message: "You're already subscribed!",
      });
    }

    // Save subscriber
    await adminDb
      .collection('free_newsletter_subscribers')
      .doc(trimmed)
      .set({
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

