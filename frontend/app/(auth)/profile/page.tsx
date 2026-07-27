"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LogOut, Shield, FileText, Mail,
  Loader2, User, CreditCard, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import { trackDailyBriefPreferenceChanged } from '@/lib/posthog';
import SubscriptionManager from '@/components/SubscriptionManager';
import {
  BLUE,
  HAIRLINE,
  INK,
  MUTED,
  EditionHeader,
  MonoLabel,
  editionSerif,
} from '@/app/wip/feed-edition/edition-shared';
import { hasActiveSubscription } from '@/lib/subscription-access';

type ProfileTab = 'account' | 'subscription';

const TAB_CONFIG: { key: ProfileTab; label: string; icon: React.ElementType }[] = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
];

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-[#2557d6]' : 'bg-[#e4e1d8]'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    () => searchParams?.get('tab') === 'subscription' ? 'subscription' : 'account',
  );
  const [newsletterOverride, setNewsletterOverride] = useState<boolean | null>(null);
  const [savingNewsletter, setSavingNewsletter] = useState(false);

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  const newsletterEnabled = newsletterOverride
    ?? (profile?.dailyNewsletterEnabled === true || profile?.newsletterOptIn === true);

  const toggleNewsletter = async () => {
    if (!user) return;
    const newValue = !newsletterEnabled;
    setNewsletterOverride(newValue);
    setSavingNewsletter(true);
    try {
      await updateUserProfile(user.uid, {
        dailyNewsletterEnabled: newValue,
        newsletterOptIn: newValue,
      });
      trackDailyBriefPreferenceChanged(newValue, 'profile');
      await refreshProfile();
      setNewsletterOverride(null);
    } catch (e) {
      console.error('Failed to update newsletter preference:', e);
      setNewsletterOverride(null);
    }
    setSavingNewsletter(false);
  };

  const isSubscribed = hasActiveSubscription(profile);

  const handleSignOut = async () => { await signOut(); router.push('/'); };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f9f9f7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#9ca3af]" />
      </div>
    );
  }

  const tabContent = (
    <>
      {activeTab === 'account' && (
        <div className="border-t" style={{ borderColor: HAIRLINE }}>
          {/* Plan status */}
          <div className="border-b py-6" style={{ borderColor: HAIRLINE }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: BLUE }}>
                  {isSubscribed ? 'Pro' : 'Free plan'}
                </p>
                <p className="text-[14px] leading-[1.65]" style={{ color: MUTED }}>
                  {isSubscribed
                    ? 'Full access to all content and features.'
                    : 'Upgrade to read the complete feed.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('subscription')}
                className="shrink-0 border px-3.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f0eee7]"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                Manage
              </button>
            </div>
          </div>

          {/* Newsletter */}
          <div className="flex items-center gap-4 border-b py-6" style={{ borderColor: HAIRLINE }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ borderColor: HAIRLINE }}>
              <Mail size={16} style={{ color: BLUE }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium" style={{ color: INK }}>Daily email</p>
              <p className="mt-1 text-[12px]" style={{ color: MUTED }}>One tech news email each morning</p>
            </div>
            <Toggle enabled={newsletterEnabled} onChange={toggleNewsletter} disabled={savingNewsletter} />
          </div>

          {/* Links */}
          <div className="border-b" style={{ borderColor: HAIRLINE }}>
            <a
              href="https://www.yourtrace.online/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 border-b py-5 transition-colors hover:bg-[#f0eee7]"
              style={{ borderColor: HAIRLINE }}
            >
              <Shield size={15} style={{ color: BLUE }} />
              <span className="flex-1 text-[14px]" style={{ color: INK }}>Privacy Policy</span>
              <ExternalLink size={12} style={{ color: MUTED }} />
            </a>
            <a
              href="https://www.yourtrace.online/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-5 transition-colors hover:bg-[#f0eee7]"
            >
              <FileText size={15} style={{ color: BLUE }} />
              <span className="flex-1 text-[14px]" style={{ color: INK }}>Terms of Service</span>
              <ExternalLink size={12} style={{ color: MUTED }} />
            </a>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="profile-subscription">
          <SubscriptionManager />
        </div>
      )}
    </>
  );

  const activeTitle = activeTab === 'account' ? 'Account' : 'Subscription';

  return (
    <div className="min-h-screen" style={{ background: '#faf9f5' }}>
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <EditionHeader view="profile" />

        <section className="pb-10 pt-10 sm:pt-14">
          <MonoLabel>Trace account</MonoLabel>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className={`${editionSerif.className} text-[44px] leading-[1] sm:text-[56px]`} style={{ color: INK }}>
                {profile?.name || user.displayName || 'Profile'}
              </h1>
              <p className="mt-3 text-[14px]" style={{ color: MUTED }}>{user.email}</p>
            </div>
            <span className="border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: BLUE, borderColor: BLUE }}>
              {isSubscribed ? 'Trace Pro' : 'Trace Free'}
            </span>
          </div>
        </section>

        <div className="grid gap-8 border-t pt-8 md:grid-cols-[170px_minmax(0,1fr)]" style={{ borderColor: HAIRLINE }}>
          <aside className="flex min-w-0 flex-col md:sticky md:top-6 md:self-start">
            <nav className="flex border-y md:flex-col md:border-y-0" style={{ borderColor: HAIRLINE }}>
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex min-w-0 flex-1 items-center gap-2 border-r px-3 py-3 text-left text-[12px] font-medium transition-colors last:border-r-0 md:border-b md:border-r-0 ${
                    activeTab === tab.key ? 'bg-[#2557d6] text-white' : 'text-[#75705f] hover:bg-[#f0eee7]'
                  }`}
                  style={{ borderColor: HAIRLINE }}
                >
                  <tab.icon size={14} />
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </nav>

            <button
              onClick={handleSignOut}
              className="mt-6 flex items-center gap-2 border-y px-3 py-3 text-[12px] transition-colors hover:bg-[#f7ebe8]"
              style={{ color: '#a24d43', borderColor: HAIRLINE }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </aside>

          <main className="min-w-0 pb-24 md:border-l md:pl-10" style={{ borderColor: HAIRLINE }}>
            <MonoLabel>{activeTab === 'account' ? '01' : '02'} · {activeTitle}</MonoLabel>
            <h2 className={`${editionSerif.className} mt-3 text-[34px] leading-[1.1]`} style={{ color: INK }}>{activeTitle}</h2>
            <div className="mt-7">{tabContent}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f9f9f7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#9ca3af]" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
