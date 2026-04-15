import Link from 'next/link';
import { Mail } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';

export default function ContactPage() {
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
          <Link
            href="/terms"
            className="px-6 py-2.5 text-sm font-medium text-tab-inactive bg-surface-tertiary hover:text-foreground transition-colors"
            style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
          >
            Terms
          </Link>
          <div
            className="px-6 py-2.5 text-sm font-medium text-foreground bg-surface"
            style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
          >
            Contact
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-surface rounded-tr-lg rounded-b-lg p-6 sm:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-foreground mb-2">Contact Us</h1>
          <p className="text-sm text-secondary mb-8">
            Have a question, feedback, or need help with your subscription? We&apos;re here to help.
          </p>
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
          </div>

          <div className="space-y-4 max-w-md">
            {/* Email */}
            <a
              href="mailto:tomartarun2001@gmail.com"
              className="flex items-center gap-4 p-4 bg-surface-secondary rounded-xl hover:bg-surface-tertiary transition-all hover:shadow-sm group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                <Mail size={18} className="text-secondary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Email</p>
                <p className="text-sm text-secondary">tomartarun2001@gmail.com</p>
              </div>
            </a>

            {/* Twitter */}
            <a
              href="https://x.com/tarat_211"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-surface-secondary rounded-xl hover:bg-surface-tertiary transition-all hover:shadow-sm group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Twitter / X</p>
                <p className="text-sm text-secondary">@tarat_211</p>
              </div>
            </a>

            {/* GitHub */}
            <a
              href="https://github.com/TarunTomar122"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-surface-secondary rounded-xl hover:bg-surface-tertiary transition-all hover:shadow-sm group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">GitHub</p>
                <p className="text-sm text-secondary">TarunTomar122</p>
              </div>
            </a>
          </div>

          {/* Subscription support note */}
          <div className="mt-8 p-5 rounded-xl bg-surface-secondary max-w-md">
            <p className="text-sm font-semibold text-foreground mb-2">Subscription & Billing Support</p>
            <p className="text-sm text-secondary leading-relaxed">
              For subscription cancellations or billing issues on Android, manage your subscription via{' '}
              <strong>Google Play &gt; Account &gt; Subscriptions</strong>.
              For web subscriptions, visit your{' '}
              <Link href="/profile" className="text-foreground hover:underline">profile page</Link>.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
