import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

const SUPPORT_EMAIL = 'tomartarun2001@gmail.com';

export const metadata: Metadata = {
  title: 'Delete Account — Trace',
  description:
    'Request account and data deletion for Trace. Learn what data is deleted, what may be retained temporarily, and how long deletion takes.',
  alternates: {
    canonical: 'https://www.yourtrace.online/delete-account',
  },
  openGraph: {
    title: 'Delete Account — Trace',
    description:
      'Request account and data deletion for Trace. Learn what data is deleted, what may be retained temporarily, and how long deletion takes.',
    url: 'https://www.yourtrace.online/delete-account',
  },
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end mb-0">
          <Link
            href="/privacy-policy"
            className="px-6 py-2.5 text-sm font-medium text-tab-inactive bg-surface-tertiary hover:text-foreground transition-colors rounded-tl-lg"
            style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)' }}
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="px-6 py-2.5 text-sm font-medium text-tab-inactive bg-surface-tertiary hover:text-foreground transition-colors"
            style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="px-6 py-2.5 text-sm font-medium text-tab-inactive bg-surface-tertiary hover:text-foreground transition-colors"
            style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
          >
            Contact
          </Link>
          <div
            className="px-6 py-2.5 text-sm font-medium text-foreground bg-surface"
            style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
          >
            Delete Account
          </div>
        </div>

        <div className="bg-surface rounded-tr-lg rounded-b-lg p-6 sm:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-foreground mb-2">
            Delete Your Trace Account
          </h1>
          <p className="text-sm text-secondary mb-8">
            You can delete your Trace account and associated data directly from the app or by contacting support.
          </p>

          <div className="space-y-8 text-sm text-secondary leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Option 1: Delete in the App</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Open Trace.</li>
                <li>Go to <strong>Profile</strong>.</li>
                <li>Tap <strong>Delete Account</strong>.</li>
                <li>Confirm the deletion request.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Option 2: Request by Email</h2>
              <p className="mb-3">
                Send your request from the email connected to your Trace account to:
              </p>
              <p>
                <a className="text-foreground hover:underline" href={`mailto:${SUPPORT_EMAIL}?subject=Trace%20Account%20Deletion%20Request`}>
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">What Gets Deleted</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Profile and onboarding preferences</li>
                <li>Bookmarks and in-app personalization data</li>
                <li>Associated account records needed to operate Trace</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">What May Be Retained Temporarily</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Limited billing or transaction records required for legal/compliance purposes</li>
                <li>Operational logs retained briefly for abuse prevention and debugging</li>
              </ul>
            </section>

            <section className="p-5 rounded-xl bg-surface-secondary">
              <h2 className="text-lg font-semibold text-foreground mb-3">Deletion Timeline</h2>
              <p>
                Most deletion requests are processed within 7 days. Certain records that must be retained by law may be
                kept for the minimum required period.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

