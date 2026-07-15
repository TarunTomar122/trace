type ServerEventProperties = Record<string, string | number | boolean | null | undefined>;

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: ServerEventProperties = {},
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey?.startsWith('phc_')) return;

  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');

  try {
    const response = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, event, properties: { distinct_id: distinctId, ...properties } }),
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) console.error(`PostHog capture failed: ${response.status}`);
  } catch (error) {
    console.error('PostHog capture failed:', error);
  }
}
