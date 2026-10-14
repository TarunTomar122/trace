// Remembers, on this device, that the reader already signed up for the daily email,
// so the email asks (the feed's corner card, the blog cards) never show to someone
// who is already subscribed.

const KEY = 'trace_nl_subscribed';
const EVENT = 'trace:nl-subscribed';

export function markNewsletterSubscribed() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: nothing to remember */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function isNewsletterSubscribed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Calls `listener` when a signup elsewhere on the page marks the reader subscribed. Returns the unsubscribe. */
export function onNewsletterSubscribed(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
