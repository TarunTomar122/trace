"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, ExternalLink, FileText, Loader2, LogOut, Mail, Shield, User } from 'lucide-react';
import SubscriptionManager from '@/components/SubscriptionManager';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/firestore';
import { trackDailyBriefPreferenceChanged } from '@/lib/posthog';
import { hasActiveSubscription } from '@/lib/subscription-access';
import PublicHeader from '@/components/PublicHeader';

type ProfileTab = 'account' | 'subscription';

const TABS: { key: ProfileTab; label: string; icon: typeof User }[] = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
];

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label="Daily email"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-surface-secondary'} disabled:opacity-50`}
    >
      <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => searchParams.get('tab') === 'subscription' ? 'subscription' : 'account');
  const [newsletterOverride, setNewsletterOverride] = useState<boolean | null>(null);
  const [savingNewsletter, setSavingNewsletter] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, router, user]);

  const newsletterEnabled = newsletterOverride
    ?? (profile?.dailyNewsletterEnabled === true || profile?.newsletterOptIn === true);
  const isSubscribed = hasActiveSubscription(profile);

  const toggleNewsletter = async () => {
    if (!user) return;
    const next = !newsletterEnabled;
    setNewsletterOverride(next);
    setSavingNewsletter(true);
    try {
      await updateUserProfile(user.uid, { dailyNewsletterEnabled: next, newsletterOptIn: next });
      trackDailyBriefPreferenceChanged(next, 'profile');
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update newsletter preference:', error);
    } finally {
      setNewsletterOverride(null);
      setSavingNewsletter(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-secondary" /></div>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader showMobileNav={false} rightSlot={<div className="flex items-center gap-2"><Link href="/bookmarks" className="rounded-full px-3 py-2 text-[12px] font-medium text-secondary hover:bg-surface-secondary hover:text-foreground">Saved</Link>{user.photoURL && <Image src={user.photoURL} alt="" width={32} height={32} className="rounded-full" />}</div>} />

      <section className="mx-auto mt-5 w-[calc(100%-24px)] max-w-[1180px] rounded-[22px] bg-surface p-6 ring-1 ring-foreground/7 dark:ring-white/10 sm:w-[calc(100%-40px)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Trace account</p>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] sm:text-[42px]">{profile?.name || user.displayName || 'Your profile'}</h1>
            <p className="mt-2 text-[14px] text-secondary">{user.email}</p>
          </div>
          <span className="w-fit rounded-full bg-surface-secondary px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {isSubscribed ? 'Trace Pro' : 'Trace Free'}
          </span>
        </div>

        <nav className="mt-7 flex w-fit gap-1 rounded-full bg-surface-secondary p-1" aria-label="Profile sections">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-medium transition ${activeTab === key ? 'bg-foreground text-background' : 'text-secondary hover:text-foreground'}`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </nav>
      </section>

      <section className="mx-auto mt-5 w-[calc(100%-24px)] max-w-[1180px] pb-20 sm:w-[calc(100%-40px)]">
        {activeTab === 'account' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[20px] bg-surface p-6 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-7">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{isSubscribed ? 'Pro plan' : 'Free plan'}</p>
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.025em]">{isSubscribed ? 'Your full Trace is active' : 'Your daily Trace is ready'}</h2>
              <p className="mt-2 text-[14px] leading-[1.65] text-secondary">
                {isSubscribed ? 'Unlimited summaries, searchable saved posts, daily archives, and Agent Access.' : 'Thirty headlines, five AI summaries a day, original sources, filters, and bookmarks.'}
              </p>
              <button type="button" onClick={() => setActiveTab('subscription')} className="mt-6 rounded-full bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background">
                {isSubscribed ? 'Manage plan' : 'Try Pro free'}
              </button>
            </article>

            <article className="flex items-center gap-4 rounded-[20px] bg-surface p-6 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-7">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-accent"><Mail size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold">Daily email</h2>
                <p className="mt-1 text-[13px] text-secondary">One compact AI and tech briefing each morning.</p>
              </div>
              <Toggle enabled={newsletterEnabled} onChange={() => void toggleNewsletter()} disabled={savingNewsletter} />
            </article>

            {[{ href: '/privacy-policy', icon: Shield, title: 'Privacy policy' }, { href: '/terms', icon: FileText, title: 'Terms of service' }].map(({ href, icon: Icon, title }) => (
              <Link key={href} href={href} target="_blank" className="group flex items-center gap-4 rounded-[20px] bg-surface p-6 ring-1 ring-foreground/7 hover:bg-surface-secondary dark:ring-white/10 sm:p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-secondary text-accent"><Icon size={18} /></span>
                <span className="flex-1 text-[15px] font-semibold">{title}</span>
                <ExternalLink size={15} className="text-secondary transition group-hover:text-foreground" />
              </Link>
            ))}

            <button type="button" onClick={() => void handleSignOut()} className="flex items-center gap-3 rounded-[20px] bg-surface p-6 text-left text-[14px] font-medium text-red-600 ring-1 ring-foreground/7 hover:bg-red-500/5 dark:text-red-400 dark:ring-white/10 lg:col-span-2">
              <LogOut size={17} /> Sign out
            </button>
          </div>
        ) : (
          <div className="rounded-[20px] bg-surface p-5 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-7">
            <SubscriptionManager />
          </div>
        )}
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-secondary" /></div>}><ProfileContent /></Suspense>;
}
