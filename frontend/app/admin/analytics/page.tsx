import { headers } from "next/headers";
import { Suspense } from "react";

import { AnalyticsDashboard, BEFORE_WORDS, RangePicker } from "@/components/admin-analytics/dashboard";
import { AdminGate, AdminSignOut } from "@/components/admin-analytics/gate";
import { AdminPage, Empty, PageHead, PanelGhost, StatStripGhost, TabBar } from "@/components/admin-analytics/kit/shell";
import { SignupsDashboard } from "@/components/admin-analytics/signups";
import { SpeedDashboard, SpeedRangePicker } from "@/components/admin-analytics/speed";
import { SystemDashboard } from "@/components/admin-analytics/system";
import { adminConfigured } from "@/lib/analytics/admin-auth";
import { authorized } from "@/lib/analytics/admin-data";
import { loadDashboard, loadLive, parseRange } from "@/lib/analytics/dashboard";
import { analyticsNamespace } from "@/lib/analytics/db";
import { loadOpsHealth } from "@/lib/analytics/ops-health";
import { loadSignupsView } from "@/lib/analytics/signups-view";
import { parseDeviceFilter, parseSpeedRange } from "@/lib/analytics/speed";
import { loadSpeed } from "@/lib/analytics/speed-load";
import "./style.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Analytics · Trace", robots: { index: false, follow: false } };

const TABS = [
  { id: "visitors", label: "Visitors", href: "/admin/analytics" },
  { id: "signups", label: "Signups", href: "/admin/analytics?tab=signups" },
  { id: "speed", label: "Speed", href: "/admin/analytics?tab=speed" },
  { id: "system", label: "System", href: "/admin/analytics?tab=system" },
];

type Search = { range?: string; tab?: string; dev?: string };

/** The time the page was read, for "N minutes ago" in the tabs (a request-time value, not a render-time one). */
function readAt(): number {
  return Date.now();
}

/** The Signups tab's data part; only rendered after the admin cookie check below. */
async function SignupsSection() {
  const view = await loadSignupsView().catch((error) => {
    console.warn("[analytics] signups failed to load:", (error as Error)?.message);
    return null;
  });
  if (!view) return <Empty title="Couldn't load the signups">The snapshot didn&apos;t answer. Reload in a minute.</Empty>;
  return <SignupsDashboard view={view} now={readAt()} />;
}

/**
 * The owner's analytics. Every request checks the signed admin cookie here, in the page itself (a layout is no
 * guard: Next renders pages alongside it). Without it the page is the password form and nothing else: no data
 * is read.
 *
 * Four tabs: Visitors (first-party analytics, lib/analytics/dashboard.ts), Signups (newsletter subscribers),
 * Speed (real visitors' page loads, lib/analytics/speed.ts, with Caddy's own response time beside them) and
 * System (the VPS's health, from the snapshot timer).
 */
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!adminConfigured()) {
    return (
      <AdminPage>
        <Empty title="This page isn't set up yet" />
      </AdminPage>
    );
  }
  if (!(await authorized())) {
    return (
      <AdminPage>
        <AdminGate />
      </AdminPage>
    );
  }
  const q = await searchParams;

  if (q.tab === "signups") {
    return (
      <AdminPage>
        <PageHead title="Signups" meta={<span>Days in UTC</span>} actions={<AdminSignOut />} />
        <TabBar tabs={TABS} current="signups" />
        {/* The head and tabs go out at once; the signups follow when the snapshot has been read. */}
        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <StatStripGhost count={8} />
              <PanelGhost rows={8} lines={2} />
            </div>
          }
        >
          <SignupsSection />
        </Suspense>
      </AdminPage>
    );
  }

  if (q.tab === "system") {
    const health = await loadOpsHealth().catch(() => null);
    return (
      <AdminPage>
        <PageHead title="System" meta={<span>Checked every 5 minutes</span>} actions={<AdminSignOut />} />
        <TabBar tabs={TABS} current="system" />
        {health ? (
          <SystemDashboard data={health} now={readAt()} />
        ) : (
          <Empty title="Couldn't load the checks">The snapshot didn&apos;t answer. Check the snapshot timer on the VPS.</Empty>
        )}
      </AdminPage>
    );
  }

  const ns = analyticsNamespace((await headers()).get("host"));

  if (q.tab === "speed") {
    const range = parseSpeedRange(q.range);
    const device = parseDeviceFilter(q.dev);
    const view = await loadSpeed(ns, range, device).catch((error) => {
      console.warn("[analytics] speed failed to load:", (error as Error)?.message);
      return null;
    });
    return (
      <AdminPage>
        <PageHead
          title="Speed"
          meta={<span>Real visitors, full page loads, 75th percentile</span>}
          actions={
            <>
              <SpeedRangePicker range={range} device={device} />
              <AdminSignOut />
            </>
          }
        />
        <TabBar tabs={TABS} current="speed" />
        {!view ? (
          <Empty title="Couldn't load the timings">The store didn&apos;t answer. Reload in a minute.</Empty>
        ) : view.empty && device === "all" ? (
          <Empty title="No page loads measured yet">Timings show up here after the first visitors load a page.</Empty>
        ) : (
          <SpeedDashboard view={view} />
        )}
      </AdminPage>
    );
  }

  const range = parseRange(q.range);
  const [data, live] = await Promise.all([
    loadDashboard(ns, range).catch((error) => {
      console.warn("[analytics] dashboard failed to load:", (error as Error)?.message);
      return null;
    }),
    loadLive(ns).catch(() => null),
  ]);
  return (
    <AdminPage>
      <PageHead
        title="Analytics"
        meta={<span>{BEFORE_WORDS[range]}</span>}
        actions={
          <>
            <RangePicker current={range} />
            <AdminSignOut />
          </>
        }
      />
      <TabBar tabs={TABS} current="visitors" />
      {data ? (
        <AnalyticsDashboard data={data} live={live} />
      ) : (
        <Empty title="Couldn't load the numbers">The store didn&apos;t answer. Reload in a minute.</Empty>
      )}
    </AdminPage>
  );
}
