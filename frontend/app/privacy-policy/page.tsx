import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Trace',
  description:
    'Learn how Trace collects, uses, and protects your personal data. Our privacy policy explains your rights and how we safeguard your information.',
  alternates: {
    canonical: 'https://www.yourtrace.online/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy — Trace',
    description:
      'Learn how Trace collects, uses, and protects your personal data. Our privacy policy explains your rights and how we safeguard your information.',
    url: 'https://www.yourtrace.online/privacy-policy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Folder Tabs */}
        <div className="flex items-end mb-0">
          <div
            className="px-6 py-2.5 text-sm font-medium text-foreground bg-surface rounded-tl-lg"
            style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)' }}
          >
            Privacy
          </div>
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
        </div>

        {/* Main Content */}
        <div className="bg-surface rounded-tr-lg rounded-b-lg p-6 sm:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-foreground mb-2">Privacy Policy</h1>
          <p className="text-xs text-secondary/50 mb-8">Last Updated: February 17, 2026</p>
          <div className="mb-8 flex flex-wrap gap-2 text-sm">
            <Link href="/daily" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Daily archive
            </Link>
            <Link href="/trending" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Trending
            </Link>
            <Link href="/research" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Research
            </Link>
            <Link href="/compare" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Compare
            </Link>
          </div>

          <div className="space-y-8 text-sm text-secondary leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Introduction</h2>
              <p>
                Welcome to Trace. We respect your privacy and are committed to protecting your personal data.
                This privacy policy explains how we collect, use, disclose, and safeguard your information when
                you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Information We Collect</h2>
              <h3 className="font-medium text-foreground mb-2">Personal Information</h3>
              <p className="mb-3">When you sign in with Google, we collect:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Your name</li>
                <li>Email address</li>
                <li>Profile picture</li>
                <li>Google account ID</li>
              </ul>

              <h3 className="font-medium text-foreground mb-2">Profile Information</h3>
              <p className="mb-3">You may provide us with:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Your interests and preferences</li>
                <li>Learning goals</li>
                <li>Content preferences</li>
                <li>Hobbies and professional information</li>
              </ul>

              <h3 className="font-medium text-foreground mb-2">Usage Data</h3>
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
              <h2 className="text-lg font-semibold text-foreground mb-3">How We Use Your Information</h2>
              <p className="mb-3">We use your information to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Provide and personalize your content feed</li>
                <li>Improve our AI algorithms and content curation</li>
                <li>Understand your preferences and adapt to your interests</li>
                <li>Communicate with you about service updates</li>
                <li>Analyze and improve our service</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Data Sharing and Disclosure</h2>
              <p className="mb-3">We do not sell your personal information. We may share your data with:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Service Providers:</strong> Third-party services that help us operate (e.g., Firebase, cloud hosting)</li>
                <li><strong>Analytics Partners:</strong> To understand usage patterns (anonymized where possible)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal data.
                However, no method of transmission over the internet is 100% secure. While we strive to protect
                your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Opt out of certain data collection</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p>To exercise these rights, please contact us at tomartarun2001@gmail.com</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Subscriptions and Billing</h2>
              <p className="mb-4">
                Trace offers paid subscription plans that unlock personalized feed access and AI summaries.
                All billing is handled securely through the respective platform (Google Play or Stripe/Dodo Payments for web).
              </p>
              <p className="mb-4">
                <strong>Cancellation:</strong> You may cancel your subscription at any time through your Google Play account settings
                or the web account portal. Cancellation takes effect at the end of the current billing period.
              </p>
              <p>
                <strong>Billing Data:</strong> We do not store your payment card details. All payment processing is handled by
                Google Play Billing or our web payment processor.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Cookies and Tracking</h2>
              <p>
                We use cookies and similar tracking technologies to maintain your session, remember your preferences,
                and analyze usage patterns. You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Children&apos;s Privacy</h2>
              <p>
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal
                information from children under 13. If you believe we have collected such information, please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of significant changes by
                posting the new policy on this page and updating the &quot;Last Updated&quot; date.
              </p>
            </section>

            <section className="p-5 rounded-xl bg-surface-secondary">
              <h2 className="text-lg font-semibold text-foreground mb-3">Contact Us</h2>
              <p className="mb-3">
                If you have questions or concerns about this privacy policy, please contact us:
              </p>
              <p><strong>Email:</strong> <a href="mailto:tomartarun2001@gmail.com" className="text-foreground hover:underline">tomartarun2001@gmail.com</a></p>
            </section>

            <p className="text-xs text-secondary/50 text-center pt-4">
              By using Trace, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
