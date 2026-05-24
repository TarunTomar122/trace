"use client";

import React from 'react';
import Link from 'next/link';
import { Construction } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

export default function WIPPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen flex flex-col">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#eff6ff]">
            <Construction className="text-[#2563eb]" size={40} />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">
            Work in progress
          </p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
            Coming soon
          </h1>
          <p className="mt-5 text-[16px] leading-[1.8] text-[#6b7280]">
            This feature is currently being built. Check back soon.
          </p>
          <div className="mt-8">
            <Link href="/" className="landing-btn landing-btn-primary landing-btn-sm">
              Back to home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
