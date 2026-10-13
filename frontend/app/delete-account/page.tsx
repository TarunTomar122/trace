import { CONTACT_EMAIL } from '@/lib/site-links';
import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';
import { DEFAULT_OPEN_GRAPH } from '@/lib/seo';

const SUPPORT_EMAIL = CONTACT_EMAIL;

export const metadata: Metadata = {
  title: 'Delete Account — Trace',
  description:
    'Request account and data deletion for Trace. Learn what data is deleted, what may be retained temporarily, and how long deletion takes.',
  alternates: {
    canonical: 'https://www.yourtrace.online/delete-account',
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: 'Delete Account — Trace',
    description:
      'Request account and data deletion for Trace. Learn what data is deleted, what may be retained temporarily, and how long deletion takes.',
    url: 'https://www.yourtrace.online/delete-account',
    type: 'website',
  },
};

export default function DeleteAccountPage() {
  return (
    <LegalPageShell
      activeTab="delete-account"
      title="Delete Your Account"
      subtitle="Remove your Trace account and associated data."
      showDeleteTab
    >
      <div className="space-y-8 text-sm text-[#6b7280] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Option 1: Delete in the App</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open Trace.</li>
            <li>Go to <strong className="text-[#111827]">Profile</strong>.</li>
            <li>Tap <strong className="text-[#111827]">Delete Account</strong>.</li>
            <li>Confirm the deletion request.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Option 2: Request by Email</h2>
          <p className="mb-3">
            Send your request from the email connected to your Trace account to:
          </p>
          <p>
            <a
              className="text-[#2563eb] hover:underline"
              href={`mailto:${SUPPORT_EMAIL}?subject=Trace%20Account%20Deletion%20Request`}
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">What Gets Deleted</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Profile and onboarding preferences</li>
            <li>Bookmarks and in-app personalization data</li>
            <li>Associated account records needed to operate Trace</li>
          </ul>
          <p className="mt-3">
            Deletion is permanent. Export or copy anything you want to keep before submitting
            the request. After processing, you will need to create a new account and repeat
            onboarding if you decide to use Trace again. Signing out or uninstalling the app
            does not delete the account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">What May Be Retained Temporarily</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Limited billing or transaction records required for legal/compliance purposes</li>
            <li>Operational logs retained briefly for abuse prevention and debugging</li>
          </ul>
        </section>

        <section className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Deletion Timeline</h2>
          <p>
            Most deletion requests are processed within 7 days. Certain records that must be retained by law may be
            kept for the minimum required period.
          </p>
        </section>
      </div>
    </LegalPageShell>
  );
}
