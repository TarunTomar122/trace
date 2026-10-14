// Remembers, on this device, that the reader already signed up for the daily email,
// so the feed's email ask never shows to someone who is already subscribed.

const KEY = 'trace_nl_subscribed';

export function markNewsletterSubscribed() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: nothing to remember */
  }
}

export function isNewsletterSubscribed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
