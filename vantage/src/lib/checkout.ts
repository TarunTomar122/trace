// Dodo Payments checkout — DOCUMENTED STUB.
//
// Live flow (to implement when the backend exists):
//   1. Backend route creates a Dodo checkout session for the $5/mo product using
//      DODO_API_KEY + DODO_PRODUCT_ID (both already in the repo root .env), passing
//      the Firebase uid as metadata and a success_url back to /welcome.
//   2. Frontend calls that route and window.location = session.url.
//   3. Dodo webhook (DODO_WEBHOOK_SECRET) flips the user's subscription in Firestore;
//      the app reads it to unlock daily delivery.
//
// In the prototype we skip Dodo and just mark the local user subscribed so the
// full journey (paywall -> unlock -> daily episode) is walkable.

import { BRAND } from './brand';

export async function startCheckout(onLocalSubscribe: () => void): Promise<void> {
  // TODO(live): const { url } = await fetch('/api/checkout', { method: 'POST' }).then(r => r.json());
  //             window.location.href = url;
  const ok = window.confirm(
    `Prototype checkout — no card charged.\n\nStart your ${BRAND.name} membership for $${BRAND.priceMonthly}/mo?`,
  );
  if (ok) onLocalSubscribe();
}
