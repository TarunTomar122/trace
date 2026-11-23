import type { RangeTotals } from "./rollup.ts";

/**
 * Trace's funnel, from the beacon's key events (people per day, added up over the range like visitors):
 * visited → subscribed to the newsletter → made an account → finished onboarding → opened a checkout → paid.
 * Checkout and payment are the sponsor slot (the one thing Trace sells today). Pure.
 *
 * The steps are not nested (an account needs no newsletter signup, a checkout no onboarding), so each step's rate
 * is a share of the step it really follows (`of`): visitors, accounts or checkouts.
 */

export type FunnelStep = { id: string; label: string; count: number; source: "beacon" | "records"; of: string | null };

export const FUNNEL: ReadonlyArray<{ id: string; label: string; event: string | null; of: string | null }> = [
  { id: "visit", label: "Visited", event: null, of: null },
  { id: "newsletter", label: "Newsletter signup", event: "newsletter_signup", of: "visit" },
  { id: "account", label: "Made an account", event: "signup_completed", of: "visit" },
  { id: "onboarded", label: "Onboarded", event: "onboarded", of: "account" },
  { id: "checkout", label: "Opened checkout", event: "checkout_started", of: "visit" },
  { id: "paid", label: "Paid", event: "purchase_completed", of: "checkout" },
];

export function funnel(totals: Pick<RangeTotals, "v" | "events">): FunnelStep[] {
  return FUNNEL.map((step) => ({
    id: step.id,
    label: step.label,
    count: step.event ? (totals.events[step.event]?.v ?? 0) : totals.v,
    source: "beacon",
    of: step.of,
  }));
}

/**
 * Each step as a share of the step it follows (`of`), at most 100% (people are counted per day, so a step can
 * edge past its base over a range); null for the first step or an empty base.
 */
export function stepRates(steps: readonly FunnelStep[]): Array<number | null> {
  const counts = new Map(steps.map((step) => [step.id, step.count]));
  return steps.map((step) => {
    const base = step.of ? counts.get(step.of) : undefined;
    return base ? Math.min(1, step.count / base) : null;
  });
}
