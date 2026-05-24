import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Contact — Trace',
  description:
    'Get in touch with the Trace team. Have questions, feedback, or need help with your subscription? We are here to help.',
  alternates: {
    canonical: 'https://www.yourtrace.online/contact',
  },
  openGraph: {
    title: 'Contact — Trace',
    description:
      'Get in touch with the Trace team. Have questions, feedback, or need help with your subscription? We are here to help.',
    url: 'https://www.yourtrace.online/contact',
  },
};

export default function ContactPage() {
  return (
    <LegalPageShell
      activeTab="contact"
      title="Contact Us"
      subtitle="Questions, feedback, or subscription help — we're here."
    >
      <div className="mb-8 flex flex-wrap gap-2 text-sm">
        <Link href="/blog" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
          Research
        </Link>
      </div>

      <div className="space-y-4 max-w-md">
        <a
          href="mailto:tomartarun2001@gmail.com"
          className="flex items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 transition-all hover:border-[#d1d5db] hover:shadow-sm group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            <Mail size={18} className="text-[#6b7280]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Email</p>
            <p className="text-sm text-[#6b7280]">tomartarun2001@gmail.com</p>
          </div>
        </a>

        <a
          href="https://x.com/tarat_211"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 transition-all hover:border-[#d1d5db] hover:shadow-sm group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            <svg className="h-4 w-4 text-[#6b7280]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Twitter / X</p>
            <p className="text-sm text-[#6b7280]">@tarat_211</p>
          </div>
        </a>

        <a
          href="https://github.com/TarunTomar122"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 transition-all hover:border-[#d1d5db] hover:shadow-sm group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            <svg className="h-4 w-4 text-[#6b7280]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">GitHub</p>
            <p className="text-sm text-[#6b7280]">TarunTomar122</p>
          </div>
        </a>
      </div>

      <div className="mt-8 max-w-md rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
        <p className="text-sm font-semibold text-[#111827] mb-2">Subscription & Billing Support</p>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          For subscription cancellations or billing issues on Android, manage your subscription via{' '}
          <strong className="text-[#111827]">Google Play &gt; Account &gt; Subscriptions</strong>.
          For web subscriptions, visit your{' '}
          <Link href="/profile" className="text-[#2563eb] hover:underline">profile page</Link>.
        </p>
      </div>
    </LegalPageShell>
  );
}
