import type { NextRequest } from 'next/server';
import {
  SUBSCRIPTION_COMPARE_AT_DEFAULT,
  SUBSCRIPTION_PRICE_DEFAULT,
  SUBSCRIPTION_PRICE_INDIA,
} from '@/lib/subscription-pricing';

type UserProfileLike = {
  location?: string | null;
  timezone?: string | null;
  locale?: string | null;
};

export interface SubscriptionOffer {
  countryCode: string | null;
  countrySource: 'header' | 'profile' | 'fallback';
  isIndiaOffer: boolean;
  productId: string;
  priceDisplay: string;
  compareAtPriceDisplay: string | null;
}

const COUNTRY_HEADER_KEYS = [
  'x-vercel-ip-country',
  'cf-ipcountry',
  'cloudfront-viewer-country',
  'x-country-code',
];

type HeaderReader = Pick<Headers, 'get'> | { get(name: string): string | null };

function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function inferCountryFromProfile(profile: UserProfileLike | undefined): string | null {
  if (!profile) return null;

  const localeCountry = profile.locale?.match(/-([A-Za-z]{2})$/)?.[1];
  const normalizedLocaleCountry = normalizeCountryCode(localeCountry);
  if (normalizedLocaleCountry) return normalizedLocaleCountry;

  if (profile.timezone === 'Asia/Kolkata') return 'IN';

  const location = profile.location?.toLowerCase() ?? '';
  if (location.includes('india')) return 'IN';

  return null;
}

export function resolveCountryCodeFromHeaders(headers: HeaderReader, profile?: UserProfileLike): Pick<SubscriptionOffer, 'countryCode' | 'countrySource'> {
  for (const headerName of COUNTRY_HEADER_KEYS) {
    const headerCountry = normalizeCountryCode(headers.get(headerName));
    if (headerCountry) {
      return { countryCode: headerCountry, countrySource: 'header' };
    }
  }

  const profileCountry = inferCountryFromProfile(profile);
  if (profileCountry) {
    return { countryCode: profileCountry, countrySource: 'profile' };
  }

  return { countryCode: null, countrySource: 'fallback' };
}

export function resolveCountryCode(request: NextRequest, profile?: UserProfileLike): Pick<SubscriptionOffer, 'countryCode' | 'countrySource'> {
  return resolveCountryCodeFromHeaders(request.headers, profile);
}

export function resolveSubscriptionOfferFromHeaders(headers: HeaderReader, profile?: UserProfileLike): SubscriptionOffer {
  const { countryCode, countrySource } = resolveCountryCodeFromHeaders(headers, profile);
  const defaultProductId = process.env.DODO_PRODUCT_ID;
  const indiaProductId = process.env.DODO_PRODUCT_ID_INDIA;

  if (!defaultProductId || defaultProductId === 'prod_your_product_id_here') {
    throw new Error('Missing default Dodo product configuration');
  }

  const isIndiaOffer = countryCode === 'IN' && Boolean(indiaProductId && indiaProductId !== 'prod_your_india_product_id_here');
  const productId = isIndiaOffer ? indiaProductId! : defaultProductId;

  return {
    countryCode,
    countrySource,
    isIndiaOffer,
    productId,
    priceDisplay: isIndiaOffer
      ? (process.env.SUBSCRIPTION_PRICE_DISPLAY_INDIA || SUBSCRIPTION_PRICE_INDIA)
      : (process.env.SUBSCRIPTION_PRICE_DISPLAY_DEFAULT || SUBSCRIPTION_PRICE_DEFAULT),
    compareAtPriceDisplay: isIndiaOffer
      ? null
      : (process.env.SUBSCRIPTION_COMPARE_AT_DISPLAY_DEFAULT || SUBSCRIPTION_COMPARE_AT_DEFAULT),
  };
}

export function resolveSubscriptionOffer(request: NextRequest, profile?: UserProfileLike): SubscriptionOffer {
  return resolveSubscriptionOfferFromHeaders(request.headers, profile);
}
