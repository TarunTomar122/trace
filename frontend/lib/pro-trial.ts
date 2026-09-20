/**
 * Trace Pro trial configuration.
 *
 * Dodo takes the trial length per checkout (`subscription_data.trial_period_days`),
 * and our webhook already records `trialEndDate` when a trial comes back, so the
 * account is treated as Pro for the duration.
 *
 * Set NEXT_PUBLIC_PRO_TRIAL_DAYS=0 to switch the offer off everywhere: the
 * checkout stops sending it and the copy stops mentioning it, so the UI can
 * never promise a trial we are not granting.
 */
export const PRO_TRIAL_DAYS = (() => {
  const raw = (process.env.NEXT_PUBLIC_PRO_TRIAL_DAYS ?? '7').trim();
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days < 0) return 7;
  return Math.min(days, 30);
})();

export const PRO_TRIAL_ENABLED = PRO_TRIAL_DAYS > 0;

/** "7 days free, then $5 a month" — used on the paywall and the pricing card. */
export function trialFootline(priceLabel: string): string {
  if (!PRO_TRIAL_ENABLED) return `Cancel anytime. ${priceLabel} after this month.`;
  return `${PRO_TRIAL_DAYS} days free, then ${priceLabel}. Cancel anytime.`;
}
