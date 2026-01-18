import { NextRequest, NextResponse } from 'next/server';

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

    console.log(`Triggered onboarding workflow for user: ${uid}`);
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Onboarding complete! Your personalized feed is being generated.',
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

