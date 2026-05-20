"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check, ChevronDown, LogOut, Shield, FileText, Mail,
  Loader2, User, Settings, CreditCard, ExternalLink, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateUserProfile, ROLES, SENIORITY_LEVELS,
  ONBOARDING_INTERESTS, CAREER_GOALS,
} from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import SubscriptionManager from '@/components/SubscriptionManager';

type ProfileTab = 'account' | 'preferences' | 'subscription';
type PrefKey = 'role' | 'interests' | 'goals';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

const TAB_CONFIG: { key: ProfileTab; label: string; icon: React.ElementType }[] = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'preferences', label: 'Preferences', icon: Settings },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
];

function PrefRow({ label, value, isOpen, onToggle }: {
  label: string; value: string; isOpen?: boolean; onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-[#f9fafb] transition-colors border-b border-[#e5e7eb] last:border-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#111827]">{label}</p>
        {value && <p className="text-[12px] text-[#9ca3af] truncate mt-0.5">{value}</p>}
      </div>
      <ChevronDown size={16} className={`text-[#9ca3af] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

function EditActions({ saving, onCancel, onSave, disabled }: {
  saving: boolean; onCancel: () => void; onSave: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button
        onClick={onCancel}
        className="px-4 py-2 rounded-full text-[12px] font-medium text-[#6b7280] bg-[#f3f4f6] hover:bg-[#e5e7eb] transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="px-4 py-2 rounded-full text-[12px] font-semibold bg-[#111827] text-white hover:bg-[#1f2937] transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-[#111827]' : 'bg-[#e5e7eb]'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [editing, setEditing] = useState<PrefKey | null>(null);
  const [saving, setSaving] = useState(false);

  const [editRole, setEditRole] = useState('');
  const [editSeniority, setEditSeniority] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [newsletterEnabled, setNewsletterEnabled] = useState(true);
  const [savingNewsletter, setSavingNewsletter] = useState(false);

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'subscription') setActiveTab('subscription');
    if (tab === 'preferences') setActiveTab('preferences');
  }, [searchParams]);

  useEffect(() => {
    if (profile) setNewsletterEnabled(profile.dailyNewsletterEnabled !== false);
  }, [profile]);

  const toggleNewsletter = async () => {
    if (!user) return;
    const newValue = !newsletterEnabled;
    setNewsletterEnabled(newValue);
    setSavingNewsletter(true);
    try {
      await updateUserProfile(user.uid, { dailyNewsletterEnabled: newValue });
      await refreshProfile();
    } catch (e) {
      console.error('Failed to update newsletter preference:', e);
      setNewsletterEnabled(!newValue);
    }
    setSavingNewsletter(false);
  };

  const startEditing = (key: PrefKey) => {
    if (!profile) return;
    setEditRole(profile.role || '');
    setEditSeniority(profile.seniority || '');
    setEditInterests(profile.interests || []);
    setEditGoals(profile.careerGoals || []);
    setEditing(key);
  };

  const cancelEditing = () => setEditing(null);

  const savePrefs = async (data: Record<string, unknown>) => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, data as any);
      await refreshProfile();
    } catch (e) { console.error('Failed to save:', e); }
    setSaving(false);
    setEditing(null);
  };

  const isSubscribed = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';

  const roleValue = [
    profile?.role ? lookupLabel(ROLES as unknown as { id: string; label: string }[], profile.role) : '',
    profile?.seniority ? lookupLabel(SENIORITY_LEVELS as unknown as { id: string; label: string }[], profile.seniority) : '',
  ].filter(Boolean).join(' · ');

  const interestValue = (profile?.interests || [])
    .map((id: string) => lookupLabel(ONBOARDING_INTERESTS as unknown as { id: string; label: string }[], id))
    .join(', ');

  const goalsValue = (profile?.careerGoals || [])
    .map((id: string) => lookupLabel(CAREER_GOALS as unknown as { id: string; label: string }[], id))
    .join(', ');

  const handleSignOut = async () => { await signOut(); router.push('/'); };

  const toggleIn = (arr: string[], id: string, max?: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : (max && arr.length >= max ? arr : [...arr, id]);

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
        <div className="max-w-xl space-y-5">
          {/* Plan status */}
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                  {isSubscribed ? 'Pro' : 'Free plan'}
                </p>
                <p className="text-[14px] text-[#6b7280]">
                  {isSubscribed
                    ? 'Full access to all content and features.'
                    : 'Upgrade to unlock unlimited articles and your full feed.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('subscription')}
                className="shrink-0 rounded-full border border-[#e5e7eb] px-3.5 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors"
              >
                Manage
              </button>
            </div>
          </div>

          {/* Newsletter */}
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6]">
                <Mail size={16} className="text-[#6b7280]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#111827]">Daily Newsletter</p>
                <p className="text-[12px] text-[#9ca3af]">Curated digest every morning</p>
              </div>
              <Toggle enabled={newsletterEnabled} onChange={toggleNewsletter} disabled={savingNewsletter} />
            </div>
          </div>

          {/* Links */}
          <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
            <a
              href="https://www.yourtrace.online/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-4 border-b border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors"
            >
              <Shield size={15} className="text-[#9ca3af]" />
              <span className="flex-1 text-[14px] text-[#374151]">Privacy Policy</span>
              <ExternalLink size={12} className="text-[#d1d5db]" />
            </a>
            <a
              href="https://www.yourtrace.online/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-4 hover:bg-[#f9fafb] transition-colors"
            >
              <FileText size={15} className="text-[#9ca3af]" />
              <span className="flex-1 text-[14px] text-[#374151]">Terms of Service</span>
              <ExternalLink size={12} className="text-[#d1d5db]" />
            </a>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="max-w-xl">
          <p className="text-[12px] text-[#9ca3af] mb-5">Changes take effect on your next daily feed refresh.</p>

          <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
            <PrefRow
              label="Role & Experience"
              value={roleValue}
              isOpen={editing === 'role'}
              onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')}
            />
            {editing === 'role' && (
              <div className="px-5 py-4 border-b border-[#e5e7eb] space-y-4 bg-[#f9fafb]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af] mb-3">Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setEditRole(r.id)}
                        className={`p-3 rounded-xl text-left text-[13px] font-medium transition-all border ${
                          editRole === r.id
                            ? 'border-[#111827] bg-white text-[#111827]'
                            : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d1d5db]'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af] mb-3">Experience</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SENIORITY_LEVELS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setEditSeniority(s.id)}
                        className={`p-3 rounded-xl text-left text-[13px] font-medium transition-all border ${
                          editSeniority === s.id
                            ? 'border-[#111827] bg-white text-[#111827]'
                            : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d1d5db]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <EditActions saving={saving} onCancel={cancelEditing} onSave={() => savePrefs({ role: editRole, seniority: editSeniority })} />
              </div>
            )}

            <PrefRow
              label="Interests"
              value={interestValue}
              isOpen={editing === 'interests'}
              onToggle={() => editing === 'interests' ? cancelEditing() : startEditing('interests')}
            />
            {editing === 'interests' && (
              <div className="px-5 py-4 border-b border-[#e5e7eb] space-y-3 bg-[#f9fafb]">
                <p className="text-[12px] text-[#9ca3af]">Pick 3–5 topics</p>
                <div className="flex flex-wrap gap-2">
                  {ONBOARDING_INTERESTS.map((interest) => {
                    const selected = editInterests.includes(interest.id);
                    const disabled = !selected && editInterests.length >= 5;
                    return (
                      <button
                        key={interest.id}
                        disabled={disabled}
                        onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                          selected
                            ? 'bg-[#111827] text-white'
                            : 'bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]'
                        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {interest.label}
                        {selected && <Check size={11} />}
                      </button>
                    );
                  })}
                </div>
                <EditActions saving={saving} onCancel={cancelEditing} disabled={editInterests.length < 3} onSave={() => savePrefs({ interests: editInterests })} />
              </div>
            )}

            <PrefRow
              label="Career Goals"
              value={goalsValue}
              isOpen={editing === 'goals'}
              onToggle={() => editing === 'goals' ? cancelEditing() : startEditing('goals')}
            />
            {editing === 'goals' && (
              <div className="px-5 py-4 bg-[#f9fafb] space-y-3">
                <p className="text-[12px] text-[#9ca3af]">Pick up to 3</p>
                <div className="grid gap-2">
                  {CAREER_GOALS.map((goal) => {
                    const selected = editGoals.includes(goal.id);
                    const disabled = !selected && editGoals.length >= 3;
                    return (
                      <button
                        key={goal.id}
                        disabled={disabled}
                        onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                        className={`p-3 rounded-xl text-left transition-all border ${
                          selected
                            ? 'border-[#111827] bg-white'
                            : 'border-[#e5e7eb] bg-white hover:border-[#d1d5db]'
                        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <p className="text-[13px] font-medium text-[#111827]">{goal.label}</p>
                        <p className="text-[12px] text-[#9ca3af] mt-0.5">{goal.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
                <EditActions saving={saving} onCancel={cancelEditing} disabled={editGoals.length < 1} onSave={() => savePrefs({ careerGoals: editGoals })} />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="max-w-xl">
          <SubscriptionManager />
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#f9f9f7]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/feed" prefetch={false} className="flex items-center gap-2.5 no-underline">
            <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
            <span className="text-[13px] font-bold tracking-[0.12em] text-[#111827]">TRACE</span>
          </Link>
          <Link
            href="/feed"
            prefetch={false}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to feed
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:py-12">
        {/* Desktop: sidebar + content */}
        <div className="hidden md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-10 lg:gap-16">
          <aside className="min-w-0">
            <div className="sticky top-24">
              {/* User card */}
              <div className="mb-8 flex items-center gap-3.5">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-12 w-12 rounded-full ring-2 ring-white shadow-sm" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)]">
                    <span className="text-base font-bold">{user.displayName?.charAt(0) || user.email?.[0]?.toUpperCase() || 'U'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111827] truncate">
                    {profile?.name || user.displayName || 'User'}
                  </p>
                  <p className="text-[12px] text-[#9ca3af] truncate">{user.email}</p>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-0.5 mb-8">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setEditing(null); }}
                    className={`flex items-center gap-2.5 w-full rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-[#111827] text-white'
                        : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]'
                    }`}
                  >
                    <tab.icon size={15} />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="border-t border-[#e5e7eb] pt-4">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 w-full rounded-lg px-3.5 py-2.5 text-[13px] text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 pb-16">
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#111827] mb-6">
              {activeTab === 'account' ? 'Account' : activeTab === 'preferences' ? 'Feed Preferences' : 'Subscription'}
            </h1>
            {tabContent}
          </main>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          {/* User row */}
          <div className="mb-6 flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full ring-2 ring-white shadow-sm" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)]">
                <span className="text-sm font-bold">{user.displayName?.charAt(0) || user.email?.[0]?.toUpperCase() || 'U'}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#111827] truncate">
                {profile?.name || user.displayName || 'User'}
              </p>
              <p className="text-[12px] text-[#9ca3af] truncate">{user.email}</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setEditing(null); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          {tabContent}

          {activeTab === 'account' && (
            <div className="mt-8 border-t border-[#e5e7eb] pt-5">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-[#9ca3af] hover:text-[#111827] hover:bg-[#f3f4f6] transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
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
