import { NextRequest, NextResponse } from 'next/server';

/**
 * Triggers the GitHub Action to unmap a user on unsubscribe.
 *
 * POST /api/unsubscribe
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

