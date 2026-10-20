import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { plainPage } from '@/lib/plain-page';

/**
 * GET /api/newsletter-feedback?r=5&email=someone@example.com
 *
 * Records a one-tap rating from the daily newsletter and shows a small
 * confirmation page. Email clients open this link in the browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const email = (params.get('email') || '').trim().toLowerCase();
  const rating = Number.parseInt(params.get('r') || '', 10);
  const date = params.get('d') || new Date().toISOString().slice(0, 10);

  const valid = Number.isInteger(rating) && rating >= 1 && rating <= 5 && email;

  if (valid && adminDb) {
    try {
      await adminDb.collection('newsletter_feedback').add({
        email,
        rating,
        editionDate: date,
        source: 'email_footer',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Newsletter feedback error:', error);
    }
  }

  const html = plainPage({
    title: 'Trace feedback',
    heading: valid ? 'Thanks, that helps.' : 'Hmm, that link looked broken.',
    body: valid
      ? 'Your rating is saved. I read every piece of feedback myself.'
      : 'Try tapping a rating in the email again.',
    cta: { href: 'https://yourtrace.online/feed?from=email', label: 'Open the feed' },
  });

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
