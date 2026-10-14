import { CONTACT_EMAIL } from '@/lib/site-links';
import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageShell from '@/components/LegalPageShell';
import { DEFAULT_OPEN_GRAPH } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Privacy Policy — Trace',
  description:
    'Learn how Trace collects, uses, and protects your personal data. Our privacy policy explains your rights and how we safeguard your information.',
  alternates: {
    canonical: 'https://www.yourtrace.online/privacy-policy',
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: 'Privacy Policy — Trace',
    description:
      'Learn how Trace collects, uses, and protects your personal data. Our privacy policy explains your rights and how we safeguard your information.',
    url: 'https://www.yourtrace.online/privacy-policy',
    type: 'website',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      activeTab="privacy"
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your data."
    >
      <p className="text-xs text-[#9ca3af] mb-8">Last Updated: October 14, 2026</p>
      <div className="mb-8 flex flex-wrap gap-2 text-sm">
        <Link href="/blog" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
          Research
        </Link>
        <Link href="/compare" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
          Compare
        </Link>
      </div>

      <div className="space-y-8 text-sm text-[#6b7280] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Introduction</h2>
          <p>
            Welcome to Trace. We respect your privacy and are committed to protecting your personal data.
            This privacy policy explains how we collect, use, disclose, and safeguard your information when
            you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Information We Collect</h2>
          <h3 className="font-medium text-[#111827] mb-2">Personal Information</h3>
          <p className="mb-3">When you sign in with Google, we collect:</p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>Your name</li>
            <li>Email address</li>
            <li>Profile picture</li>
            <li>Google account ID</li>
          </ul>

          <h3 className="font-medium text-[#111827] mb-2">Profile Information</h3>
          <p className="mb-3">You may provide us with:</p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>Your interests and preferences</li>
            <li>Learning goals</li>
            <li>Content preferences</li>
            <li>Hobbies and professional information</li>
          </ul>

          <h3 className="font-medium text-[#111827] mb-2">Usage Data</h3>
          <p className="mb-3">We automatically collect:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Interaction data (content you like, skip, or bookmark)</li>
            <li>Reading/viewing patterns</li>
            <li>Time spent on different content types</li>
            <li>Device and browser information</li>
            <li>IP address and general location</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">How We Use Your Information</h2>
          <p className="mb-3">We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and personalize your content feed</li>
            <li>Improve our AI algorithms and content curation</li>
            <li>Understand your preferences and adapt to your interests</li>
            <li>Communicate with you about service updates</li>
            <li>Send you the daily brief email while you are subscribed</li>
            <li>Analyze and improve our service</li>
            <li>Ensure security and prevent fraud</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">AI Agent Connections</h2>
          <p className="mb-3">
            When you connect an AI app such as Claude, ChatGPT or Cursor to Trace&apos;s MCP server, you sign in
            with Google and approve that app. We store the app&apos;s name and the addresses it registered, a record
            of your approval (which app and when), and a one-way hash of each sign-in code, access token and
            refresh token (never the tokens themselves), so we can check its requests. Access tokens last an hour. Removing Trace from the app deletes its sign-in there, and a
            sign-in left unused for 90 days stops working. The app can read your Trace brief; it cannot change your account.
            What the app does with the brief is covered by that app&apos;s own privacy policy.
          </p>
          <p>
            The approval page also offers Trace&apos;s daily brief email (a box, ticked by default). If your daily email is off,
            connecting leaves it off.
            Every email has a one-click unsubscribe link, and unsubscribing does not affect your agent&apos;s access.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Data Sharing and Disclosure</h2>
          <p className="mb-3">We do not sell your personal information. We may share your data with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-[#111827]">Service Providers:</strong> Third-party services that help us operate (e.g., Firebase, cloud hosting)</li>
            <li><strong className="text-[#111827]">Analytics Partners:</strong> To understand usage patterns (anonymized where possible)</li>
            <li><strong className="text-[#111827]">Legal Requirements:</strong> When required by law or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal data.
            However, no method of transmission over the internet is 100% secure. While we strive to protect
            your information, we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Your Rights</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Opt out of certain data collection</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>To exercise these rights, please contact us at {CONTACT_EMAIL}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Payments and Billing</h2>
          <p className="mb-4">
            The Trace web app is free. Paid items are limited to subscriptions bought earlier and sponsored tool placements.
            All billing is handled securely through the respective platform (Google Play or Dodo Payments for web).
          </p>
          <p className="mb-4">
            <strong className="text-[#111827]">Cancellation:</strong> You may cancel an existing subscription at any time through your Google Play account settings
            or from your Trace profile. Cancellation takes effect at the end of the current billing period.
          </p>
          <p>
            <strong className="text-[#111827]">Billing Data:</strong> We do not store your payment card details. All payment processing is handled by
            Google Play Billing or our web payment processor.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Cookies and Tracking</h2>
          <p>
            We use cookies and similar tracking technologies to maintain your session, remember your preferences,
            and analyze usage patterns. You can control cookies through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Children&apos;s Privacy</h2>
          <p>
            Our service is not intended for children under 13 years of age. We do not knowingly collect personal
            information from children under 13. If you believe we have collected such information, please contact us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of significant changes by
            posting the new policy on this page and updating the &quot;Last Updated&quot; date.
          </p>
        </section>

        <section className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
          <h2 className="text-lg font-semibold text-[#111827] mb-3">Contact Us</h2>
          <p className="mb-3">
            If you have questions or concerns about this privacy policy, please contact us:
          </p>
          <p><strong className="text-[#111827]">Email:</strong>{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#2563eb] hover:underline">{CONTACT_EMAIL}</a>
          </p>
        </section>

        <p className="text-xs text-[#9ca3af] text-center pt-4">
          By using Trace, you acknowledge that you have read and understood this Privacy Policy.
        </p>
      </div>
    </LegalPageShell>
  );
}
