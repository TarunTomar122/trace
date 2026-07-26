"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check, ChevronDown, LogOut, Shield, FileText, Mail,
  Loader2, User, Settings, CreditCard, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateUserProfile, ROLES, SENIORITY_LEVELS,
  ONBOARDING_INTERESTS, CAREER_GOALS,
} from '@/lib/firestore';
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
      className="flex w-full items-center gap-3 border-b px-0 py-5 text-left transition-colors hover:bg-[#f5f3ed] last:border-0"
      style={{ borderColor: HAIRLINE }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium" style={{ color: INK }}>{label}</p>
        {value && <p className="mt-1 text-[12px] leading-[1.6]" style={{ color: MUTED }}>{value}</p>}
      </div>
      <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: MUTED }} />
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
        className="border px-4 py-2 text-[12px] font-medium transition-colors hover:bg-[#f0eee7]"
        style={{ borderColor: HAIRLINE, color: MUTED }}
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1d48b4] disabled:opacity-40"
        style={{ background: BLUE }}
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
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [editing, setEditing] = useState<PrefKey | null>(null);
  const [saving, setSaving] = useState(false);

  const [editRole, setEditRole] = useState('');
  const [editSeniority, setEditSeniority] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [newsletterEnabled, setNewsletterEnabled] = useState(false);
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
    if (profile) {
      setNewsletterEnabled(
        profile.dailyNewsletterEnabled === true || profile.newsletterOptIn === true,
      );
    }
  }, [profile]);

  const toggleNewsletter = async () => {
    if (!user) return;
    const newValue = !newsletterEnabled;
    setNewsletterEnabled(newValue);
    setSavingNewsletter(true);
    try {
      await updateUserProfile(user.uid, {
        dailyNewsletterEnabled: newValue,
        newsletterOptIn: newValue,
      });
      trackDailyBriefPreferenceChanged(newValue, 'profile');
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

  const isSubscribed = hasActiveSubscription(profile);

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
                    : 'Upgrade to unlock unlimited articles and your full feed.'}
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
              <p className="text-[14px] font-medium" style={{ color: INK }}>Daily Newsletter</p>
              <p className="mt-1 text-[12px]" style={{ color: MUTED }}>Curated digest every morning</p>
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

      {activeTab === 'preferences' && (
        <div>
          <p className="mb-5 text-[12px]" style={{ color: MUTED }}>Changes take effect on your next daily feed refresh.</p>

          <div className="border-t" style={{ borderColor: HAIRLINE }}>
            <PrefRow
              label="Role & Experience"
              value={roleValue}
              isOpen={editing === 'role'}
              onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')}
            />
            {editing === 'role' && (
              <div className="space-y-4 border-b px-5 py-5" style={{ borderColor: HAIRLINE, background: '#f5f3ed' }}>
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setEditRole(r.id)}
                        className={`border p-3 text-left text-[13px] font-medium transition-colors ${
                          editRole === r.id
                            ? 'border-[#2557d6] bg-[#faf9f5] text-[#1b1a17]'
                            : 'border-[#e4e1d8] bg-transparent text-[#75705f] hover:bg-[#faf9f5]'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>Experience</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SENIORITY_LEVELS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setEditSeniority(s.id)}
                        className={`border p-3 text-left text-[13px] font-medium transition-colors ${
                          editSeniority === s.id
                            ? 'border-[#2557d6] bg-[#faf9f5] text-[#1b1a17]'
                            : 'border-[#e4e1d8] bg-transparent text-[#75705f] hover:bg-[#faf9f5]'
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
              <div className="space-y-3 border-b px-5 py-5" style={{ borderColor: HAIRLINE, background: '#f5f3ed' }}>
                <p className="text-[12px]" style={{ color: MUTED }}>Pick 3–5 topics</p>
                <div className="flex flex-wrap gap-2">
                  {ONBOARDING_INTERESTS.map((interest) => {
                    const selected = editInterests.includes(interest.id);
                    const disabled = !selected && editInterests.length >= 5;
                    return (
                      <button
                        key={interest.id}
                        disabled={disabled}
                        onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                        className={`flex items-center gap-1.5 border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                          selected
                            ? 'border-[#2557d6] bg-[#2557d6] text-white'
                            : 'border-[#e4e1d8] bg-transparent text-[#75705f] hover:bg-[#faf9f5]'
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
              <div className="space-y-3 px-5 py-5" style={{ background: '#f5f3ed' }}>
                <p className="text-[12px]" style={{ color: MUTED }}>Pick up to 3</p>
                <div className="grid gap-2">
                  {CAREER_GOALS.map((goal) => {
                    const selected = editGoals.includes(goal.id);
                    const disabled = !selected && editGoals.length >= 3;
                    return (
                      <button
                        key={goal.id}
                        disabled={disabled}
                        onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                        className={`border p-3 text-left transition-colors ${
                          selected
                            ? 'border-[#2557d6] bg-[#faf9f5]'
                            : 'border-[#e4e1d8] bg-transparent hover:bg-[#faf9f5]'
                        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <p className="text-[13px] font-medium" style={{ color: INK }}>{goal.label}</p>
                        <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{goal.subtitle}</p>
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
        <div className="profile-subscription">
          <SubscriptionManager />
        </div>
      )}
    </>
  );

  const activeTitle = activeTab === 'account' ? 'Account' : activeTab === 'preferences' ? 'Feed preferences' : 'Trace Pro';

  return (
    <div className="min-h-screen" style={{ background: '#faf9f5' }}>
      <div className="mx-auto max-w-[880px] px-5 sm:px-8">
        <EditionHeader view="profile" />

        <section className="pb-12 pt-14 sm:pt-20">
          <MonoLabel>Trace account</MonoLabel>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className={`${editionSerif.className} text-[52px] leading-[0.98] sm:text-[72px]`} style={{ color: INK }}>
                {profile?.name || user.displayName || 'Profile'}
              </h1>
              <p className="mt-4 text-[15px]" style={{ color: MUTED }}>{user.email}</p>
            </div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: BLUE }}>
              {isSubscribed ? 'Trace Pro' : 'Trace Free'}
            </span>
          </div>
        </section>

        <div className="grid gap-12 border-t pt-8 md:grid-cols-[190px_minmax(0,1fr)]" style={{ borderColor: HAIRLINE }}>
          <aside className="flex min-w-0 flex-col md:sticky md:top-6 md:min-h-[500px] md:self-start">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full border object-cover" style={{ borderColor: HAIRLINE }} />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: BLUE }}>
                  <span className="text-sm font-semibold">{user.displayName?.charAt(0) || user.email?.[0]?.toUpperCase() || 'U'}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium" style={{ color: INK }}>{profile?.name || user.displayName || 'User'}</p>
                {roleValue && <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>{roleValue}</p>}
              </div>
            </div>

            <nav className="mt-8 flex border-y md:flex-col md:border-y-0" style={{ borderColor: HAIRLINE }}>
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setEditing(null); }}
                  className={`flex min-w-0 flex-1 items-center gap-2 border-r px-3 py-3 text-left text-[12px] font-medium transition-colors last:border-r-0 md:border-b md:border-r-0 ${
                    activeTab === tab.key ? 'text-[#2557d6]' : 'hover:bg-[#f0eee7]'
                  }`}
                  style={{ borderColor: HAIRLINE, color: activeTab === tab.key ? BLUE : MUTED }}
                >
                  <tab.icon size={14} />
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </nav>

            <button
              onClick={handleSignOut}
              className="mt-8 flex items-center gap-2 border-y px-3 py-3 text-[12px] transition-colors hover:bg-[#f7ebe8] md:mt-auto"
              style={{ color: '#a24d43', borderColor: HAIRLINE }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </aside>

          <main className="min-w-0 pb-24">
            <MonoLabel>{activeTab === 'account' ? '01' : activeTab === 'preferences' ? '02' : '03'} · {activeTitle}</MonoLabel>
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
