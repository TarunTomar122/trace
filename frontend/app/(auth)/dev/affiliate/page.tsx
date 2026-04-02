"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Link2, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type AffiliateRow = {
  code: string;
  ownerName: string;
  ownerEmail: string;
  active: boolean;
  createdAt: string | null;
  clicks: number;
  androidClicks: number;
  signups: number;
  onboarded: number;
  subscribed: number;
  conversions: number;
};

type AffiliateResponse = {
  affiliates: AffiliateRow[];
  summary: {
    totalCodes: number;
    totalClicks: number;
    totalSignups: number;
    totalSubscribed: number;
  };
};

export default function AffiliatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [data, setData] = useState<AffiliateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", ownerName: "", ownerEmail: "" });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.yourtrace.online";

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/dev/affiliate", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load affiliate data");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load affiliate data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const isDevMode = process.env.NODE_ENV === "development" || window.location.search.includes("dev=true");
    if (!isDevMode) {
      router.push("/feed");
      return;
    }
    if (!loading && user) {
      void fetchData();
    } else if (!loading) {
      setIsLoading(false);
    }
  }, [loading, router, user]);

  const rows = useMemo(() => data?.affiliates || [], [data]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/dev/affiliate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to create affiliate code");
      setForm({ code: "", ownerName: "", ownerEmail: "" });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create affiliate code");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (row: AffiliateRow) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/dev/affiliate", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: row.code, active: !row.active }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to update code");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update code");
    }
  };

  const handleCopy = async (code: string) => {
    const url = `${appUrl}/?ref=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 1500);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/dev/analytics")}
            className="inline-flex items-center gap-2 text-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <button
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight">Affiliate</h1>
          <p className="mt-1 text-secondary">Create links, track clicks, signups, and paid conversions.</p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Codes" value={String(data?.summary.totalCodes || 0)} />
          <StatCard label="Clicks" value={String(data?.summary.totalClicks || 0)} />
          <StatCard label="Signups" value={String(data?.summary.totalSignups || 0)} />
          <StatCard label="Subscribed" value={String(data?.summary.totalSubscribed || 0)} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={handleCreate} className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Create affiliate link</h2>
            <div className="mt-4 space-y-3">
              <input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="code e.g. tarun"
                className="w-full rounded-2xl border border-black/10 bg-[#f7f3eb] px-4 py-3 text-sm outline-none"
              />
              <input
                value={form.ownerName}
                onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))}
                placeholder="owner name"
                className="w-full rounded-2xl border border-black/10 bg-[#f7f3eb] px-4 py-3 text-sm outline-none"
              />
              <input
                value={form.ownerEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                placeholder="owner email"
                className="w-full rounded-2xl border border-black/10 bg-[#f7f3eb] px-4 py-3 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving || !form.code.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              Create code
            </button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
            <div className="border-b border-black/8 px-6 py-4">
              <h2 className="text-lg font-semibold">Affiliate performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f7f3eb] text-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Code</th>
                    <th className="px-4 py-3 text-left font-medium">Owner</th>
                    <th className="px-4 py-3 text-left font-medium">Clicks</th>
                    <th className="px-4 py-3 text-left font-medium">Android</th>
                    <th className="px-4 py-3 text-left font-medium">Signups</th>
                    <th className="px-4 py-3 text-left font-medium">Onboarded</th>
                    <th className="px-4 py-3 text-left font-medium">Subscribed</th>
                    <th className="px-4 py-3 text-left font-medium">Link</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.code} className="border-t border-black/6">
                      <td className="px-4 py-4 font-semibold">{row.code}</td>
                      <td className="px-4 py-4">
                        <div>{row.ownerName || "—"}</div>
                        <div className="text-xs text-secondary">{row.ownerEmail || "—"}</div>
                      </td>
                      <td className="px-4 py-4">{row.clicks}</td>
                      <td className="px-4 py-4">{row.androidClicks}</td>
                      <td className="px-4 py-4">{row.signups}</td>
                      <td className="px-4 py-4">{row.onboarded}</td>
                      <td className="px-4 py-4">{row.subscribed}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => void handleCopy(row.code)}
                          className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium"
                        >
                          {copiedCode === row.code ? <Check size={14} /> : <Copy size={14} />}
                          Copy
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => void handleToggle(row)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {row.active ? "Active" : "Paused"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-secondary">
                        No affiliate codes yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
      <div className="text-sm text-secondary">{label}</div>
      <div className="mt-2 text-4xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
