import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type FacebookTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type FacebookPagesResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    instagram_business_account?: {
      id?: string;
      username?: string;
      profile_picture_url?: string;
    };
  }>;
};

const DEFAULT_GRAPH_VERSION = 'v23.0';

function getGraphBase() {
  const version = process.env.INSTAGRAM_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  return `https://graph.facebook.com/${version}`;
}

async function exchangeCodeForShortToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<FacebookTokenResponse> {
  const graphBase = getGraphBase();
  const url = `${graphBase}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(
    appSecret
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error?.message || 'Failed to exchange authorization code');
  }
  return data;
}

async function exchangeForLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string
): Promise<FacebookTokenResponse | null> {
  const graphBase = getGraphBase();
  const url = `${graphBase}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
    appId
  )}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.access_token) return null;
  return data;
}

async function getManagedPages(accessToken: string): Promise<FacebookPagesResponse> {
  const graphBase = getGraphBase();
  const url = `${graphBase}/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(
    accessToken
  )}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to fetch Facebook Pages');
  }
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Server not configured for Firebase Admin' }, { status: 500 });
    }

    const firebaseToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(firebaseToken);
    const uid = decoded.uid;

    const { code } = (await request.json()) as { code?: string };
    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET or INSTAGRAM_REDIRECT_URI' },
        { status: 500 }
      );
    }

    const shortToken = await exchangeCodeForShortToken(code, appId, appSecret, redirectUri);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token, appId, appSecret);
    const tokenToStore = longToken?.access_token || shortToken.access_token;
    const expiresIn = longToken?.expires_in || shortToken.expires_in || 0;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const pages = await getManagedPages(tokenToStore);
    const pageWithInstagram = (pages.data || []).find((p) => p.instagram_business_account?.id);

    await adminDb.collection('user_integrations').doc(uid).set(
      {
        instagram: {
          connected: true,
          provider: 'facebook_login',
          accessToken: tokenToStore,
          tokenType: longToken?.token_type || shortToken.token_type || null,
          expiresIn,
          expiresAt,
          pageId: pageWithInstagram?.id || null,
          pageName: pageWithInstagram?.name || null,
          instagramUserId: pageWithInstagram?.instagram_business_account?.id || null,
          instagramUsername: pageWithInstagram?.instagram_business_account?.username || null,
          profilePictureUrl: pageWithInstagram?.instagram_business_account?.profile_picture_url || null,
          connectedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await adminDb.collection('user_profiles').doc(uid).set(
      {
        instagramConnected: true,
        instagramUsername: pageWithInstagram?.instagram_business_account?.username || null,
        instagramConnectedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      pageName: pageWithInstagram?.name || null,
      instagramUsername: pageWithInstagram?.instagram_business_account?.username || null,
      hasInstagramBusinessAccount: !!pageWithInstagram?.instagram_business_account?.id,
    });
  } catch (error) {
    console.error('Instagram OAuth exchange error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Instagram OAuth exchange failed' },
      { status: 500 }
    );
  }
}
