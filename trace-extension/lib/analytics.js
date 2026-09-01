const INSTALL_ID_KEY = 'trace.extension.install-id.v1';
const DAILY_ACTIVE_KEY = 'trace.extension.analytics-daily.v1';
const SITE_ORIGIN = chrome.runtime.getManifest().homepage_url;
const ANALYTICS_URL = new URL('/api/extension/analytics', SITE_ORIGIN).toString();

async function installId() {
  const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
  if (stored[INSTALL_ID_KEY]) return stored[INSTALL_ID_KEY];
  const value = `ext_${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [INSTALL_ID_KEY]: value });
  return value;
}

export async function captureExtensionEvent(event, properties = {}) {
  try {
    await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distinctId: await installId(), event, properties }),
      keepalive: true,
    });
  } catch {
    // Analytics must never affect the new-tab experience.
  }
}

export async function captureExtensionDailyActive(properties = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const stored = await chrome.storage.local.get(DAILY_ACTIVE_KEY);
  if (stored[DAILY_ACTIVE_KEY] === date) return;
  await chrome.storage.local.set({ [DAILY_ACTIVE_KEY]: date });
  await captureExtensionEvent('extension_feed_viewed', properties);
}
