// Everything brand-specific lives here. Rename the product by changing this one file.
export const BRAND = {
  name: 'Vantage',
  wordmark: 'Vantage',
  tagline: 'Wake up ahead.',
  // One-liner used under the logo / in meta.
  promise: 'A 5-minute daily audio brief on AI & tech, tuned to what you’re building.',
  domain: 'vantage.fm',
  supportEmail: 'hey@vantage.fm',
  priceMonthly: 5,
  currency: 'USD',
  sampleAudio: '/samples/brief-daily.mp3',
  // Social proof numbers are illustrative placeholders — swap for real ones before launch.
  social: { listeners: '3,100+', minutesSaved: '40 min/day', rating: '4.9' },
} as const;

export type Brand = typeof BRAND;
