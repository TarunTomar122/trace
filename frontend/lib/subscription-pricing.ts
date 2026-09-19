/** US default subscription display — keep in sync with Dodo / env billing. */
export const SUBSCRIPTION_PRICE_DEFAULT = '$5/month';
/** No list-price strikethrough unless a sale is actually running. */
export const SUBSCRIPTION_COMPARE_AT_DEFAULT: string | null = null;
export const SUBSCRIPTION_PRICE_INDIA = '₹49/month';

export type PricingOfferKind = 'india' | 'default';

export function getCompareAtPriceDisplay(offer: PricingOfferKind): string | null {
  return offer === 'default' ? SUBSCRIPTION_COMPARE_AT_DEFAULT : null;
}

/** "$5/month" → "$5/mo" for tight button labels. */
export function shortPriceDisplay(priceDisplay: string): string {
  return priceDisplay.replace('/month', '/mo');
}

/** "$5/month" → "$5" for the big plan-price numeral. */
export function priceAmountDisplay(priceDisplay: string): string {
  return priceDisplay.replace(/\/mo(nth)?$/i, '');
}
