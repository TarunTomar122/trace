/**
 * Bot guard for the anonymous email signup (/api/newsletter-subscribe).
 *
 * Why: on 2026-11-19 and 2026-11-23 scripts put 6 and then 12 addresses on the list inside a minute or two
 * (strangers' inboxes, or a farm of accounts that "opened" every email in one sweep). Each one costs a slot
 * on the free Brevo plan shared with the market-movers emails, and bounces or spam reports hurt both.
 *
 * Checks, in order:
 * - trap: a hidden field people never see or fill. Filled means a form-filling bot: answer as if it worked
 *   and save nothing, so the bot learns nothing.
 * - per visitor: a few attempts per window, and at most two new list entries a day (a person signs up one
 *   address). Keyed by address, IPv6 by its /64, so one machine cannot run through a list, nor use up the
 *   site-wide cap on its own and lock real people out.
 * - whole site: a cap on new list entries per window across everyone. Real signups have never come faster
 *   than a couple an hour, so a burst past it is a script; people caught by it are told when to try again.
 *
 * Counters live in memory: the site runs as one Node process on the VPS, so one count covers every visitor.
 */
import { createIpRateLimiter } from './ip-rate-limit.ts';
import { TRAP_FIELD } from './signup-trap-field.ts';

export { TRAP_FIELD };

export const PER_VISITOR = { limit: 5, windowMs: 10 * 60_000 };
export const NEW_PER_VISITOR = { limit: 2, windowMs: 24 * 60 * 60_000 };
export const SITE_WIDE = { limit: 4, windowMs: 5 * 60_000 };

function minutes(retryAfterSec: number): string {
  const m = Math.max(1, Math.ceil(retryAfterSec / 60));
  return m === 1 ? '1 minute' : `${m} minutes`;
}

/** Shown in the form when one visitor tries too often (or adds a third address in a day). */
export function tooManyTriesMessage(retryAfterSec: number): string {
  return retryAfterSec > 60 * 60
    ? 'Too many signups from your connection today. Try again tomorrow.'
    : `Too many tries. Try again in ${minutes(retryAfterSec)}.`;
}

/** Shown when the site-wide burst cap is full. */
export function busyMessage(retryAfterSec: number): string {
  return `Lots of signups at once right now. Try again in ${minutes(retryAfterSec)}.`;
}

/** What the per-visitor limits count by: the address, or for IPv6 its /64 (one home line usually owns a /64). */
export function visitorKey(address: string): string {
  if (!address.includes(':')) return address;
  const parts = expandIpv6(address);
  return parts ? `${parts.slice(0, 4).join(':')}::/64` : address;
}

function expandIpv6(address: string): string[] | null {
  const bare = address.replace(/^\[|\]$/g, '').split('%')[0];
  if (!/^[0-9a-fA-F:.]+$/.test(bare)) return null;
  const halves = bare.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length < 4) return null;
  return groups.slice(0, 4).map((g) => (/^[0-9a-fA-F]{1,4}$/.test(g) ? g.toLowerCase().replace(/^0+(?=.)/, '') : 'x'));
}

/** True when the hidden trap field came back with anything in it. */
export function trapFilled(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const value = (body as Record<string, unknown>)[TRAP_FIELD];
  return typeof value === 'string' ? value.trim() !== '' : value != null && value !== false;
}

type Verdict = { ok: true } | { ok: false; retryAfterSec: number; message: string };

export function createSignupGuard(perVisitor = PER_VISITOR, siteWide = SITE_WIDE, newPerVisitor = NEW_PER_VISITOR) {
  const visitors = createIpRateLimiter(perVisitor);
  const newFromVisitor = createIpRateLimiter(newPerVisitor);
  const site = createIpRateLimiter(siteWide);
  return {
    /** Every well-formed attempt from one visitor, including "already subscribed" answers. */
    visitor(address: string, now?: number): Verdict {
      const r = visitors(visitorKey(address), now);
      return r.ok ? r : { ...r, message: tooManyTriesMessage(r.retryAfterSec) };
    },
    /** Only attempts that would add someone to the list (new or coming back): per visitor first, then site-wide. */
    newEntry(address: string, now?: number): Verdict {
      const mine = newFromVisitor(visitorKey(address), now);
      if (!mine.ok) return { ...mine, message: tooManyTriesMessage(mine.retryAfterSec) };
      const all = site('all', now);
      return all.ok ? all : { ...all, message: busyMessage(all.retryAfterSec) };
    },
  };
}

/** The process-wide guard the route uses. */
export const signupGuard = createSignupGuard();
