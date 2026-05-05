import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Folder Tabs */}
        <div className="flex items-end mb-0">
          <Link
            href="/privacy-policy"
            className="px-6 py-2.5 text-sm font-medium text-tab-inactive bg-surface-tertiary hover:text-foreground transition-colors rounded-tl-lg"
            style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)' }}
          >
            Privacy
          </Link>
          <div
            className="px-6 py-2.5 text-sm font-medium text-foreground bg-surface"
            style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
          >
            Terms
          </div>
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-foreground mb-2">Terms of Service</h1>
          <p className="text-xs text-secondary/50 mb-8">Last Updated: February 17, 2026</p>
          <div className="mb-8 flex flex-wrap gap-2 text-sm">
            <Link href="/daily" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Daily archive
            </Link>
            <Link href="/trending" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Trending
            </Link>
            <Link href="/blog" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Research
            </Link>
            <Link href="/compare" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
              Compare
            </Link>
          </div>

          <div className="space-y-8 text-sm text-secondary leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Acceptance of Terms</h2>
              <p>
                By accessing or using Trace (&quot;the Service&quot;), you agree to be bound by these Terms of Service
                (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Description of Service</h2>
              <p>
                Trace is a personalized content curation platform that uses artificial intelligence to deliver
                relevant content from various sources including YouTube, GitHub, research papers, and web articles.
                The Service adapts to your interests and learning patterns to provide a customized feed.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">User Accounts</h2>
              <h3 className="font-medium text-foreground mb-2">Registration</h3>
              <p className="mb-3">
                To use certain features of the Service, you must register using Google authentication. You agree to:
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Be responsible for all activities under your account</li>
              </ul>

              <h3 className="font-medium text-foreground mb-2">Eligibility</h3>
              <p>
                You must be at least 13 years old to use the Service. By using the Service, you represent that
                you meet this age requirement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use automated means to access the Service without permission</li>
                <li>Impersonate any person or entity</li>
                <li>Collect or harvest information about other users</li>
                <li>Upload or transmit viruses or malicious code</li>
                <li>Abuse, harass, or harm other users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Content</h2>
              <h3 className="font-medium text-foreground mb-2">Third-Party Content</h3>
              <p className="mb-3">
                The Service curates and links to content from third-party sources. We do not own, control, or
                endorse this content. You acknowledge that:
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Third-party content is subject to the terms and conditions of its source</li>
                <li>We are not responsible for the accuracy, legality, or availability of third-party content</li>
                <li>You use third-party content at your own risk</li>
              </ul>

              <h3 className="font-medium text-foreground mb-2">User Data</h3>
              <p>
                Your interactions, preferences, and profile information remain your property. By using the Service,
                you grant us a limited license to use this data to provide and improve the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Intellectual Property</h2>
              <p className="mb-3">
                The Service, including its design, features, and functionality, is owned by Trace and protected by
                copyright, trademark, and other intellectual property laws. You may not:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Copy, modify, or create derivative works of the Service</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Remove or alter any proprietary notices</li>
                <li>Use the Service&apos;s branding without permission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Subscriptions and Payments</h2>
              <p className="mb-3">Trace offers the following paid subscription plans:</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Weekly plan at $1.99/week</li>
                <li>Monthly plan at $6.99/month</li>
                <li>Yearly plan at $59.99/year</li>
              </ul>
              <p className="mb-4">
                <strong>Free Trial:</strong> New subscribers may be eligible for a free trial. If you do not cancel
                before the trial period ends, you will be charged the applicable subscription fee.
              </p>
              <p className="mb-4">
                <strong>Billing:</strong> Subscriptions are billed in advance on a recurring basis. All payments are
                processed through Google Play Billing (Android) or our web payment processor.
              </p>
              <p>
                <strong>Cancellation:</strong> You may cancel your subscription at any time. Cancellation takes effect
                at the end of the current billing period. We do not provide refunds for unused portions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Service Availability</h2>
              <p className="mb-3">
                We strive to provide continuous service but do not guarantee that the Service will be uninterrupted,
                secure, or error-free. We reserve the right to:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Modify or discontinue the Service at any time</li>
                <li>Perform maintenance and updates</li>
                <li>Implement changes to features or functionality</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Termination</h2>
              <p className="mb-3">
                We may terminate or suspend your access to the Service immediately, without notice, for:
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Violation of these Terms</li>
                <li>Illegal or fraudulent activity</li>
                <li>Abuse of the Service or other users</li>
                <li>Any other reason we deem appropriate</li>
              </ul>
              <p>
                You may terminate your account at any time by contacting us. Upon termination, your right to
                access the Service will cease immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Disclaimers</h2>
              <p className="mb-3">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, INCLUDING:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Warranties of merchantability or fitness for a particular purpose</li>
                <li>Accuracy, reliability, or completeness of content</li>
                <li>Uninterrupted or error-free operation</li>
                <li>Security or freedom from viruses or harmful components</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRACE AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
                LOSS OF PROFITS, DATA, OR USE, ARISING FROM YOUR USE OF THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of significant changes
                by updating the &quot;Last Updated&quot; date and posting the new Terms. Your continued use of the Service
                after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section className="p-5 rounded-xl bg-surface-secondary">
              <h2 className="text-lg font-semibold text-foreground mb-3">Contact Information</h2>
              <p className="mb-3">
                If you have questions about these Terms of Service, please contact us:
              </p>
              <p><strong>Email:</strong> <a href="mailto:tomartarun2001@gmail.com" className="text-foreground hover:underline">tomartarun2001@gmail.com</a></p>
            </section>

            <p className="text-xs text-secondary/50 text-center pt-4">
              By using Trace, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
