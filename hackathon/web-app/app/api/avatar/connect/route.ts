import Runway from '@runwayml/sdk';
import { getPresetAvatarMetadata } from '@/lib/preset-avatars';

const client = new Runway({ apiKey: process.env.RUNWAYML_API_SECRET });

export async function POST(req: Request) {
  try {
    const { avatarId } = await req.json();
    if (!avatarId) {
      return Response.json({ error: 'Missing avatarId' }, { status: 400 });
    }

    const isPreset = Boolean(getPresetAvatarMetadata(avatarId));
    if (!isPreset) {
      await pollAvatarUntilReady(avatarId);
    }

    const avatar = isPreset
      ? { type: 'runway-preset' as const, presetId: avatarId }
      : { type: 'custom' as const, avatarId };

    const { id: sessionId } = await client.realtimeSessions.create({
      model: 'gwm1_avatars',
      avatar,
    });

    const session = await pollSessionUntilReady(sessionId);
    return Response.json({ sessionId, sessionKey: session.sessionKey });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to create avatar session' },
      { status: 500 },
    );
  }
}

async function pollAvatarUntilReady(avatarId: string) {
  const TIMEOUT_MS = 120_000;
  const POLL_INTERVAL_MS = 2_000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const avatar = await client.avatars.retrieve(avatarId);

    if (avatar.status === 'READY') return avatar;

    if (avatar.status === 'FAILED') {
      throw new Error('Avatar failed before becoming ready');
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Avatar is still processing. Please try again shortly.');
}

async function pollSessionUntilReady(sessionId: string) {
  const TIMEOUT_MS = 30_000;
  const POLL_INTERVAL_MS = 1_000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const session = await client.realtimeSessions.retrieve(sessionId);

    if (session.status === 'READY') return session;

    if (session.status === 'COMPLETED' || session.status === 'FAILED' || session.status === 'CANCELLED') {
      throw new Error(`Session ${session.status.toLowerCase()} before becoming ready`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Session creation timed out');
}
