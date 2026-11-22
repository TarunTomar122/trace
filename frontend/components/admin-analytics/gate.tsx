"use client";

import { useRouter } from "next/navigation";
import * as React from "react";



const MESSAGES: Record<string, string> = {
  wrong_password: "That's not it.",
  rate_limited: "Too many tries. Wait 15 minutes.",
  not_configured: "Analytics isn't set up on this server.",
  forbidden: "That didn't go through. Reload and try again.",
};

/** The password form. It only ever posts the password; nothing behind the gate is on this page. */
export function AdminGate() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (response.ok && body?.ok) {
        setPassword("");
        router.refresh();
        return;
      }
      setError(MESSAGES[body?.error ?? ""] ?? "That didn't work. Try again.");
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="oa-surface mx-auto mt-10 flex w-full max-w-sm flex-col gap-3 border border-oa-border bg-oa-card p-5">
      <h1 className="text-[19px] font-semibold text-oa-fg">Analytics</h1>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-oa-muted-fg">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 rounded-md border border-oa-border bg-oa-bg px-3 text-[15px] text-oa-fg outline-none focus:border-oa-fg/40"
        />
      </label>
      {error ? <p role="alert" className="text-[13.5px] text-signal-bearish">{error}</p> : null}
      <button type="submit" disabled={busy || !password}>
        {busy ? "Checking…" : "Open"}
      </button>
    </form>
  );
}

export function AdminSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
        router.refresh();
      }}
      className="h-8 rounded-md border border-oa-border px-3 text-[13px] text-oa-muted-fg hover:text-oa-fg"
    >
      Sign out
    </button>
  );
}
