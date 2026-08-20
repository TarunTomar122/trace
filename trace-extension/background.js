import { captureExtensionEvent } from './lib/analytics.js';

const SESSION_KEY = 'trace.extension.session.v1';
const ACCOUNT_KEY = 'trace.extension.account.v1';
const ALLOWED_ORIGINS = new Set(['https://www.yourtrace.online']);

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  const extensionVersion = chrome.runtime.getManifest().version;
  if (reason === 'install') {
    void captureExtensionEvent('extension_installed', { extension_version: extensionVersion });
  } else if (reason === 'update') {
    void captureExtensionEvent('extension_updated', {
      extension_version: extensionVersion,
      previous_version: previousVersion || '',
    });
  }
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  let origin = '';
  try { origin = new URL(sender.url || '').origin; } catch {}
  if (
    !ALLOWED_ORIGINS.has(origin)
    || message?.type !== 'TRACE_EXTENSION_SESSION'
    || typeof message.token !== 'string'
    || !message.token.startsWith('trace_ext_')
    || !Number.isFinite(Date.parse(message.expiresAt))
  ) {
    sendResponse({ ok: false });
    return;
  }
  chrome.storage.local.set({
    [SESSION_KEY]: { token: message.token, expiresAt: message.expiresAt },
  }).then(() => chrome.storage.local.remove(ACCOUNT_KEY))
    .then(() => {
      chrome.runtime.sendMessage({ type: 'TRACE_SESSION_UPDATED' }).catch(() => undefined);
      sendResponse({ ok: true });
    })
    .catch(() => sendResponse({ ok: false }));
  return true;
});
