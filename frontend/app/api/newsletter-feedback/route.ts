import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Trace feedback</title></head>
<body style="margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1419;">
  <div style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center;">
    <p style="margin:0 0 20px;font-size:14px;font-weight:800;letter-spacing:.18em;color:#0f1419;">TRACE</p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;letter-spacing:-.02em;">${
      valid ? 'Thanks — that helps.' : 'Hmm, that link looked broken.'
    }</h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#536471;">${
      valid
        ? 'Your rating is saved. I read every piece of feedback myself.'
        : 'Try tapping a rating in the email again.'
    }</p>
    <a href="https://yourtrace.online/feed?from=email" style="display:inline-block;padding:13px 28px;border-radius:999px;background:#1d9bf0;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Open the feed</a>
  </div>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
