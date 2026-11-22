import { createHash, randomBytes } from "crypto";

/**
 * The visitor id, the way Plausible does it: a hash of a daily random salt, the
 * site, the visitor's address and their User-Agent, cut to 16 hex characters.
 * Nothing persistent is stored on the visitor's device and no cookie is set.
 * The salt changes every UTC day and the old one is deleted, so yesterday's ids
 * can never be tied to today's, or recomputed from an address. The address
 * itself is never stored.
 *
 * Both web instances must agree on the day's salt (or one person would count
 * twice), so it lives in the store as one document per day, created by
 * whichever instance needs it first; the other reads it back.
 */

export const SALT_COLLECTION_SUFFIX = "salt";

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function visitorHash(salt: string, host: string, ip: string, ua: string): string {
  return createHash("sha256").update(`${salt}\n${host}\n${ip}\n${ua}`).digest("hex").slice(0, 16);
}

export function newSalt(): string {
  return randomBytes(32).toString("hex");
}

/** The narrow store the salt keeper needs, so tests can hand it a fake. */
export type SaltStore = {
  read(day: string): Promise<string | null>;
  /** Create the day's salt; resolves false when another instance created it first. */
  create(day: string, salt: string): Promise<boolean>;
  /** Remove every stored salt for a day before `day`. Best effort. */
  removeBefore(day: string): Promise<void>;
};

export class SaltKeeper {
  private day: string | null = null;
  private salt: string | null = null;
  private pending: Promise<string> | null = null;

  constructor(private readonly store: SaltStore, private readonly make: () => string = newSalt) {}

  /** The salt for the UTC day `now` falls in. */
  async saltFor(now: number): Promise<string> {
    const day = utcDay(now);
    if (this.day === day && this.salt) return this.salt;
    // A late event from a day this process has already left (a beacon queued before midnight, a retried flush):
    // hashed with the current salt. Loading the old day would re-create a salt that was just deleted.
    if (this.day && this.salt && day < this.day) return this.salt;
    if (this.pending) {
      const salt = await this.pending;
      if (this.day === day || (this.day && day < this.day)) return salt;
    }
    this.pending = this.load(day).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /** The salt already in memory for `now`'s day (or a later day this process moved on to), without waiting; null if none. */
  cachedSaltFor(now: number): string | null {
    const day = utcDay(now);
    return this.day && this.salt && day <= this.day ? this.salt : null;
  }

  private async load(day: string): Promise<string> {
    let salt = await this.store.read(day);
    if (!salt) {
      const fresh = this.make();
      const created = await this.store.create(day, fresh);
      salt = created ? fresh : await this.store.read(day);
      if (!salt) throw new Error("analytics salt could not be read back");
      // A new day: the old salts go, so the old ids can never be linked or recomputed.
      void this.store.removeBefore(day).catch(() => undefined);
    }
    this.day = day;
    this.salt = salt;
    return salt;
  }
}
