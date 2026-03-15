"use client";

import React from 'react';
import { Mail, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function WaitlistPage() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f4efe7] text-foreground flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-12">
          <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
        </div>

        <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-foreground/5" />
          <Mail size={36} className="relative text-foreground/60" />
          <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/25">
            <Check size={14} className="text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
          You&apos;re in.
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-secondary">
          Thanks for joining Trace! We&apos;re putting the finishing touches on your daily feeds — trending topics, personalized articles, and AI summaries.
        </p>

        <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-black/6 bg-white p-5">
          <h3 className="text-sm font-semibold mb-1.5">What happens next?</h3>
          <p className="text-sm text-secondary leading-relaxed">
            We&apos;ll send you an email at{' '}
            <span className="font-medium text-foreground">{user?.email}</span>{' '}
            as soon as Trace goes live.
          </p>
        </div>

        {profile && (
          <p className="mt-6 text-sm text-secondary/50">
            Welcome, {profile.name || user?.displayName || 'there'}!
          </p>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Home
          </button>
          <button
            onClick={signOut}
            className="text-sm text-secondary/50 hover:text-foreground transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
