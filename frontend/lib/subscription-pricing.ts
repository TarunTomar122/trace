/** US default subscription display — keep in sync with Dodo / env billing. */
export const SUBSCRIPTION_PRICE_DEFAULT = '$2.99/month';
export const SUBSCRIPTION_COMPARE_AT_DEFAULT = '$4.99/month';
export const SUBSCRIPTION_PRICE_INDIA = '₹49/month';

export type PricingOfferKind = 'india' | 'default';

export function getCompareAtPriceDisplay(offer: PricingOfferKind): string | null {
  return offer === 'default' ? SUBSCRIPTION_COMPARE_AT_DEFAULT : null;
}

/** "$2.99/month" → "$2.99/mo" for tight button labels. */
export function shortPriceDisplay(priceDisplay: string): string {
  return priceDisplay.replace('/month', '/mo');
}
