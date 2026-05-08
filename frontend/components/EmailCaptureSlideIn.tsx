"use client";

import { useState, useEffect } from "react";
import { Mail, ArrowRight, Check, X } from "lucide-react";

const DISMISS_STORAGE_KEY = "trace-email-capture-dismissed";

export default function EmailCaptureSlideIn() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_STORAGE_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      /* ignore */
    }
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) setVisible(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const response = await fetch("/api/newsletter-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Failed");
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  if (dismissed) return null;

  return (
    <div
      className="hidden sm:block transition-all duration-500 ease-out"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        width: "360px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="relative rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:bg-[#1a1a22] py-8 px-6 overflow-hidden" style={{ boxShadow: '0 0 0 1.5px rgba(245,158,11,0.25), 0 20px 60px rgba(0,0,0,0.15)' }}>
        <div className="absolute inset-x-0 top-0 h-[3px]" />

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss newsletter signup"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-secondary/45 transition-colors hover:bg-foreground/8 hover:text-foreground"
        >
          <X size={18} strokeWidth={2} />
        </button>

        {status === "success" ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check size={20} className="text-emerald-600" strokeWidth={2.5} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-foreground">You&apos;re on the list</p>
            <p className="mt-1 text-[13px] text-secondary/50">Check your inbox tomorrow.</p>
          </div>
        ) : (
          <>
            <div className="mb-7 pr-8">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
                  <Mail size={18} className="text-foreground/60" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground leading-snug">
                    Want the daily brief in your inbox?
                  </p>
                  <p className="text-[13px] text-secondary/50 mt-1">
                    Free. Every morning. No spam.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 min-w-0 rounded-full border border-border/15 bg-surface-secondary px-5 py-3.5 text-[14px] outline-none transition-colors placeholder:text-secondary/30 focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background transition-all hover:bg-foreground/90 disabled:opacity-60 shrink-0"
              >
                {status === "loading" ? (
                  "Wait"
                ) : (
                  <ArrowRight size={17} strokeWidth={2.5} />
                )}
              </button>
            </form>

            {status === "error" && (
              <p className="mt-2 text-[12px] text-red-500">Something went wrong. Try again.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
