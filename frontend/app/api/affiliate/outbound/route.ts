import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

function readAffiliateCookie(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as { code?: string; landingPath?: string | null };
  } catch {
    return null;
  }
}

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return null;
  return code;
}

export async function GET(request: NextRequest) {
  const nextUrl = request.nextUrl.searchParams.get('next') || 'https://play.google.com/store/apps/details?id=online.yourtrace.app';
  const target = request.nextUrl.searchParams.get('target') || 'android_app';
  const cookieAttribution = readAffiliateCookie(request.cookies.get('trace_affiliate')?.value);
  const code = normalizeCode(request.nextUrl.searchParams.get('code') || cookieAttribution?.code || null);

  if (code && adminDb) {
    try {
      await adminDb.collection('affiliate_clicks').add({
        code,
        target,
        landingPath: cookieAttribution?.landingPath || request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent') || null,
        referer: request.headers.get('referer') || null,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Affiliate outbound tracking error:', error);
    }
  }

  return NextResponse.redirect(nextUrl);
}
