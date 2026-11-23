import * as React from "react";

import { NUM, Tag } from "@/components/admin-analytics/kit/cells";
import {
  agoText,
  dayText,
  dayWordsUtc,
  formWords,
  fromWords,
  SIGNUPS_STALE_MS,
  stampText,
  type Method,
  type PlanKind,
  type SignupKind,
  type SignupRow,
  type SignupsView,
} from "@/lib/analytics/signups-view";

import { Avatar } from "./avatar";
import { fmtCount, fmtPct } from "./format";
import { Box } from "./parts";
import { SiteIcon } from "./site-icon";

/**
 * The Signups tab of /admin/analytics, ported from StocksBrew: sign-ups today, this week and this month with their
 * bars, the newsletter, accounts and how many came back, readers' links and paid plans, then everyone, newest
 * first. Server-rendered; only the avatars and site icons are client parts (their fallback letter).
 */

const METHOD_WORDS: Record<Method, string> = { google: "Google", apple: "Apple", email: "Email", phone: "Phone", other: "Other" };
const PLAN_WORDS: Record<PlanKind, string> = { paid: "Paid", trial: "Trial", free: "Free" };
const KIND_WORDS: Record<SignupKind, string> = { newsletter: "Newsletter", account: "Account", both: "Both" };
/** The person column stays put while a phone scrolls the table sideways. */
const PIN = "sticky left-0 z-10 bg-oa-card";

/** Small bars, one per hour or day, scaled to the biggest; empty slots show as a hairline. */
function Bars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <span className={`flex h-[22px] shrink-0 items-end ${values.length > 24 ? "w-[90px] gap-[1.5px]" : "w-[64px] gap-px"}`} role="img" aria-label={label}>
      {values.map((value, index) => (
        <span
          key={index}
          className={`min-w-0 flex-1 rounded-[1px] ${value > 0 ? "bg-oa-primary/70" : "bg-oa-border"}`}
          style={{ height: value > 0 ? `${Math.max(18, (value / max) * 100)}%` : "2px" }}
        />
      ))}
    </span>
  );
}

function SignupTile({ label, value, sub, visual, title }: { label: string; value: string; sub?: React.ReactNode; visual?: React.ReactNode; title?: string }) {
  return (
    <div className="-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-oa-border px-3 py-2.5 sm:px-4" title={title}>
      <dt className="oa-caption truncate">{label}</dt>
      <dd className="flex items-end justify-between gap-2">
        <span className={`${NUM} text-[22px] font-semibold leading-7 tracking-[-0.01em] text-oa-fg`}>{value}</span>
        {visual}
      </dd>
      <dd className="truncate text-[12.5px] leading-4 text-oa-muted-fg">{sub ?? " "}</dd>
    </div>
  );
}

const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

function From({ from }: { from: NonNullable<SignupRow["from"]> }) {
  const { label, host } = fromWords(from);
  return (
    <span className="flex min-w-0 items-center gap-2" title={from.heard ? `Their answer to "How did you hear about Trace?": ${label}` : `First visit came from ${label}`}>
      <span className="flex size-4 shrink-0 items-center justify-center">
        {host ? (
          <SiteIcon host={host} />
        ) : (
          <svg viewBox="0 0 20 20" className="size-4 text-oa-muted-fg" aria-hidden>
            {from.id === "friend" || from.id === "referral" ? (
              <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM3 10h14M10 3c2 2 2.8 4.5 2.8 7s-.8 5-2.8 7c-2-2-2.8-4.5-2.8-7S8 5 10 3z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            )}
          </svg>
        )}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function MethodIcon({ method }: { method: Method }) {
  if (method === "google") {
    return (
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        <path d="M18 10.2c0-.6-.1-1.1-.2-1.6H10v3.1h4.5a3.9 3.9 0 0 1-1.7 2.5v2h2.7c1.6-1.5 2.5-3.6 2.5-6z" fill="#4285F4" />
        <path d="M10 18.3c2.3 0 4.2-.8 5.5-2.1l-2.7-2a5 5 0 0 1-7.5-2.7H2.5v2.1A8.3 8.3 0 0 0 10 18.3z" fill="#34A853" />
        <path d="M5.3 11.5a5 5 0 0 1 0-3.2V6.2H2.5a8.3 8.3 0 0 0 0 7.5z" fill="#FBBC05" />
        <path d="M10 5c1.3 0 2.4.4 3.3 1.3l2.4-2.4A8.3 8.3 0 0 0 2.5 6.2l2.8 2.1A5 5 0 0 1 10 5z" fill="#EA4335" />
      </svg>
    );
  }
  if (method === "other" || method === "apple") return null;
  return (
    <svg viewBox="0 0 20 20" className="size-4 text-oa-muted-fg" aria-hidden>
      <path
        d={method === "phone" ? "M6.5 2.5h7v15h-7zM9.5 15h1" : "M3 5h14v10H3zM3.5 5.5 10 11l6.5-5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The one value every account that has one shares, and how many have it; null when they differ (then the column is shown). */
function shared<T>(rows: readonly SignupRow[], pick: (row: SignupRow) => T | null): { value: T; count: number } | null {
  const values = rows.map(pick).filter((value): value is T => value != null);
  return rows.length > 1 && new Set(values).size === 1 ? { value: values[0]!, count: values.length } : null;
}

/** "Cancelled", "On hold": a plan that ended says so instead of a bare "Free". */
function planText(row: SignupRow): string {
  if (row.plan === "free" && row.planNote && row.planNote !== "comped") return row.planNote.charAt(0).toUpperCase() + row.planNote.slice(1);
  return row.plan ? PLAN_WORDS[row.plan] : "";
}

export function SignupsDashboard({ view, now }: { view: SignupsView; now: number }) {
  const { today, week, month } = view;
  const rows = view.rows;
  // Method and plan belong to accounts: a newsletter reader has neither, so they don't count against "all the same".
  const accountRows = rows.filter((row) => row.kind !== "newsletter");
  const paidSub = [
    view.paid.paying ? `${fmtCount(view.paid.paying)} paying` : "none paying",
    view.paid.trial ? `${fmtCount(view.paid.trial)} on trial` : null,
    view.paid.lapsed ? `${fmtCount(view.paid.lapsed)} lapsed` : null,
  ]
    .filter(Boolean)
    .join(", ");
  // A column where every row says the same thing is said once, in the list's header (owner design rule 1).
  const oneMethod = shared(accountRows, (row) => row.method);
  const onePlan = shared(accountRows, (row) => row.plan);
  const showMethod = oneMethod == null && accountRows.some((row) => row.method != null);
  const showPlan = onePlan == null && accountRows.some((row) => row.plan != null);
  const showFrom = rows.some((row) => row.from != null);
  const showForm = rows.some((row) => row.form != null);
  // "all accounts Google", or "170 Google" when a few accounts have no sign-in method on record.
  const allOr = (one: { count: number }) => (one.count === accountRows.length ? "all accounts" : fmtCount(one.count));
  const headerNotes = [
    oneMethod ? `${allOr(oneMethod)} ${METHOD_WORDS[oneMethod.value]}` : null,
    onePlan ? `${allOr(onePlan)} ${PLAN_WORDS[onePlan.value]}` : null,
    view.rowsTotal > rows.length ? `newest ${fmtCount(rows.length)} of ${fmtCount(view.rowsTotal)}` : "newest first",
  ].filter(Boolean);
  const stale = view.generatedMs != null && now - view.generatedMs > SIGNUPS_STALE_MS;
  const left = view.newsletter.total - view.newsletter.active;

  return (
    <div className="flex flex-col gap-3">
      {view.authMissing ? (
        <p className="oa-surface border border-amber-500/40 bg-oa-card px-3 py-2 text-[13.5px] text-amber-700 sm:px-4 dark:text-amber-400">
          Sign-in records didn&apos;t load, so accounts come from profiles alone and may miss a few.
        </p>
      ) : null}
      {stale ? (
        <p className="oa-surface border border-amber-500/40 bg-oa-card px-3 py-2 text-[13.5px] text-amber-700 sm:px-4 dark:text-amber-400">
          This list stopped updating {agoText(view.generatedMs, now)}. Everything below is from then.
        </p>
      ) : null}

      <dl className="oa-surface grid grid-cols-2 overflow-hidden border border-oa-border bg-oa-card md:grid-cols-4 2xl:grid-cols-8">
        <SignupTile label="Today" value={fmtCount(today.count)} sub={`${fmtCount(today.yesterday)} by now yesterday`} visual={<Bars values={today.hours} label="Sign-ups by hour today" />} />
        <SignupTile label="7 days" value={fmtCount(week.count)} sub={`${fmtCount(week.previous)} the week before`} visual={<Bars values={week.days} label="Sign-ups by day, 7 days" />} />
        <SignupTile label="30 days" value={fmtCount(month.count)} sub={`${fmtCount(month.previous)} the 30 days before`} visual={<Bars values={month.days} label="Sign-ups by day, 30 days" />} />
        <SignupTile label="All signups" value={fmtCount(view.total)} sub={view.firstMs != null ? `since ${dayText(view.firstMs, now)}` : undefined} />
        <SignupTile
          label="Newsletter"
          value={fmtCount(view.newsletter.active)}
          sub={view.newsletter.total ? (left ? `${fmtCount(left)} unsubscribed` : "none unsubscribed") : "no readers yet"}
          title={`Subscribed now, of the ${fmtCount(view.newsletter.total)} who ever joined`}
        />
        <SignupTile
          label="Accounts"
          value={fmtCount(view.accounts.total)}
          sub={view.accounts.eligible ? `${fmtPct(share(view.accounts.cameBack, view.accounts.eligible))} came back` : "none a day old yet"}
          title={`${fmtCount(view.accounts.cameBack)} seen again a day or more after signing up, of the ${fmtCount(view.accounts.eligible)} accounts at least a day old`}
        />
        <SignupTile
          label="Brought by readers"
          value={fmtCount(view.referred.count)}
          sub={view.referred.readers ? `through ${fmtCount(view.referred.readers)} readers' links` : "none yet"}
          title="Signed up through a reader's share link"
        />
        <SignupTile label="Paid" value={fmtCount(view.paid.count)} sub={paidSub} title="On a paid plan or trial now" />
      </dl>

      <Box
        label="People"
        right={
          <span className="block max-w-[13rem] truncate sm:max-w-none" title={headerNotes.join(", ")}>
            {headerNotes.join(", ")}
          </span>
        }
        flush
      >
        {/* About eight rows in view, cut mid-row so the next one shows; the page takes the scroll back at either end.
            On a phone the table scrolls sideways inside the box, the person pinned on the left. */}
        <div className="max-h-[27.75rem] min-h-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[58rem] table-fixed text-[13.5px]">
            <thead className="sticky top-0 z-20 bg-oa-card">
              <tr className="h-9 border-b border-oa-border text-left text-[12.5px] text-oa-muted-fg">
                <th className={`${PIN} w-[12.5rem] pl-3 pr-1 font-normal sm:px-4 lg:w-auto`}>Person</th>
                <th className="w-[7rem] px-2 font-normal">Signed up</th>
                <th className="w-[7rem] px-2 font-normal">Kind</th>
                {showPlan ? <th className="w-[5.5rem] px-2 font-normal">Plan</th> : null}
                <th className="w-[7rem] px-2 font-normal">Last seen</th>
                {showMethod ? <th className="w-[6rem] px-2 font-normal">Method</th> : null}
                {showFrom ? <th className="w-[10rem] px-2 font-normal">Came from</th> : null}
                {showForm ? <th className="w-[7.5rem] px-2 pr-4 font-normal">Form</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = row.name ?? row.email ?? "No email";
                const account = row.kind !== "newsletter";
                // When a shared column was folded into the header, the few accounts without that value say so here.
                const gaps = [account && oneMethod && !row.method ? "no sign-in method" : null, account && onePlan && !row.plan ? "no profile" : null].filter(Boolean).join(", ");
                const second = [row.name ? row.email : null, gaps || null].filter(Boolean).join(" · ");
                return (
                  <tr key={row.id} className="h-12 border-b border-oa-border/60 last:border-b-0">
                    <td className={`${PIN} pl-3 pr-1 sm:px-4`}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar src={row.photo} name={row.name ?? row.email ?? ""} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-oa-fg" title={name}>
                            {name}
                          </span>
                          {second ? (
                            <span className="truncate text-[12.5px] leading-4 text-oa-muted-fg" title={second}>
                              {second}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-2" title={stampText(row.createdMs) || undefined}>
                      {row.createdMs != null ? (
                        <span className="flex flex-col">
                          <span className="truncate text-oa-fg">{agoText(row.createdMs, now)}</span>
                          <span className="truncate text-[12.5px] leading-4 text-oa-muted-fg">{dayWordsUtc(row.createdMs, now)}</span>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2">
                      <span className="flex flex-col">
                        <span className="truncate text-oa-fg">{KIND_WORDS[row.kind]}</span>
                        {row.newsletter === "off" ? <span className="truncate text-[12.5px] leading-4 text-oa-muted-fg">unsubscribed</span> : null}
                      </span>
                    </td>
                    {showPlan ? (
                      <td className="truncate px-2" title={row.planNote ?? undefined}>
                        {row.plan === "paid" || row.plan === "trial" ? (
                          <Tag tone="primary" caps={false}>
                            {PLAN_WORDS[row.plan]}
                          </Tag>
                        ) : row.plan === "free" ? (
                          <span className="text-oa-muted-fg">{planText(row)}</span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className={`truncate px-2 ${row.cameBack ? "text-oa-fg" : "text-oa-muted-fg"}`} title={stampText(row.lastSeenMs) || undefined}>
                      {agoText(row.lastSeenMs, now)}
                    </td>
                    {showMethod ? (
                      <td className="px-2">
                        {row.method ? (
                          <span className="flex items-center gap-1.5 text-oa-fg">
                            <MethodIcon method={row.method} />
                            {METHOD_WORDS[row.method]}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    {showFrom ? <td className="px-2 text-oa-fg">{row.from ? <From from={row.from} /> : null}</td> : null}
                    {showForm ? <td className="truncate px-2 pr-4 text-oa-muted-fg">{formWords(row.form)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}
