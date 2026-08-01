"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  LogOut,

  Shield,
  FileText,
  Mail,
  Loader2,
  User,
  Settings,
  CreditCard,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateUserProfile,
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  /* ─── Tab content (shared between desktop + mobile) ─── */
  const tabContent = (
    <>
      {activeTab === 'account' && (
        <div className="max-w-xl">
          <h1 className="text-xl font-bold text-foreground tracking-[-0.02em] mb-6">Account Settings</h1>

          <div className="p-5 rounded-xl bg-surface-secondary/60 mb-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-foreground">
                {isSubscribed ? 'Pro Account' : 'Free Account'}
              </h3>
              <button
                onClick={() => setActiveTab('subscription')}
                className="text-xs text-secondary/60 hover:text-foreground transition-colors"
              >
                Manage →
              </button>
            </div>
            <p className="text-sm text-secondary/60">
              {isSubscribed
                ? 'Full access to all content and features.'
                : 'Try Pro free for 3 days to unlock unlimited articles and your full feed.'}
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-secondary/60">
            <div className="flex items-center gap-4">
              <Mail size={20} className="text-secondary/50 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">Daily Newsletter</p>
                <p className="text-xs text-secondary/55">Curated digest every morning</p>
              </div>
              <button
                onClick={toggleNewsletter}
                disabled={savingNewsletter}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  newsletterEnabled ? 'bg-foreground' : 'bg-secondary/20'
                } ${savingNewsletter ? 'opacity-50' : ''}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-surface rounded-full shadow transition-transform ${
                  newsletterEnabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-1">
            <a
              href="https://www.yourtrace.online/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-secondary/50 transition-colors"
            >
              <Shield size={16} className="text-secondary/50" />
              <span className="text-sm text-secondary/70">Privacy Policy</span>
              <ExternalLink size={12} className="text-secondary/35 ml-auto" />
            </a>
            <a
              href="https://www.yourtrace.online/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-secondary/50 transition-colors"
            >
              <FileText size={16} className="text-secondary/50" />
              <span className="text-sm text-secondary/70">Terms of Service</span>
              <ExternalLink size={12} className="text-secondary/35 ml-auto" />
            </a>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="max-w-xl">
          <h1 className="text-xl font-bold text-foreground tracking-[-0.02em] mb-1">Feed Preferences</h1>
          <p className="text-sm text-secondary/55 mb-6">
            Changes take effect on your next daily feed refresh.
          </p>

          <div className="space-y-px rounded-xl bg-surface-secondary/40 overflow-hidden">
            {/* Role */}
            <PrefRow
              label="Role & Experience"
              value={roleValue}
              isOpen={editing === 'role'}
              onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')}
            />
            {editing === 'role' && (
              <div className="px-5 py-4 border-t border-border/15 space-y-4 bg-white">
                <div>
                  <p className="text-xs font-medium text-secondary/60 mb-3">Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setEditRole(r.id)}
                        className={`p-3 rounded-xl text-left text-sm font-medium transition-all border-2 ${
                          editRole === r.id
                            ? 'border-foreground bg-surface-secondary'
                            : 'border-transparent bg-surface-secondary/40 hover:bg-surface-secondary/70'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary/60 mb-3">Experience</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SENIORITY_LEVELS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setEditSeniority(s.id)}
                        className={`p-3 rounded-xl text-left text-sm font-medium transition-all border-2 ${
                          editSeniority === s.id
                            ? 'border-foreground bg-surface-secondary'
                            : 'border-transparent bg-surface-secondary/40 hover:bg-surface-secondary/70'
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

            {/* Interests */}
            <PrefRow
              label="Interests"
              value={interestValue}
              isOpen={editing === 'interests'}
              onToggle={() => editing === 'interests' ? cancelEditing() : startEditing('interests')}
            />
            {editing === 'interests' && (
              <div className="px-5 py-4 border-t border-border/15 space-y-3 bg-white">
                <p className="text-xs text-secondary/55">Pick 3-5 topics</p>
                <div className="flex flex-wrap gap-2">
                  {ONBOARDING_INTERESTS.map((interest) => {
                    const selected = editInterests.includes(interest.id);
                    const disabled = !selected && editInterests.length >= 5;
                    return (
                      <button
                        key={interest.id}
                        disabled={disabled}
                        onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                        className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                          selected
                            ? 'bg-foreground text-background'
                            : 'bg-surface-secondary/60 text-foreground/80 hover:bg-surface-secondary'
                        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {interest.label}
                        {selected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
                <EditActions saving={saving} onCancel={cancelEditing} disabled={editInterests.length < 3} onSave={() => savePrefs({ interests: editInterests })} />
              </div>
            )}

            {/* Goals */}
            <PrefRow
              label="Career Goals"
              value={goalsValue}
              isOpen={editing === 'goals'}
              onToggle={() => editing === 'goals' ? cancelEditing() : startEditing('goals')}
            />
            {editing === 'goals' && (
              <div className="px-5 py-4 border-t border-border/15 space-y-3 bg-white">
                <p className="text-xs text-secondary/55">Pick up to 3</p>
                <div className="grid gap-2">
                  {CAREER_GOALS.map((goal) => {
                    const selected = editGoals.includes(goal.id);
                    const disabled = !selected && editGoals.length >= 3;
                    return (
                      <button
                        key={goal.id}
                        disabled={disabled}
                        onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                        className={`p-3 rounded-xl text-left transition-all border-2 ${
                          selected
                            ? 'border-foreground bg-surface-secondary'
                            : 'border-transparent bg-surface-secondary/40 hover:bg-surface-secondary/70'
                        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <div className="font-medium text-sm">{goal.label}</div>
                        <div className={`text-xs mt-0.5 ${selected ? 'text-secondary/65' : 'text-secondary/55'}`}>{goal.subtitle}</div>
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
          <h1 className="text-xl font-bold text-foreground tracking-[-0.02em] mb-6">Subscription</h1>
          <SubscriptionManager />
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
            </Link>
            <Link
              href="/feed"
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} />
              Back to feed
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        {/* Desktop: full-width grid layout */}
        <div className="hidden md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
          {/* Left nav */}
          <aside className="min-w-0">
            <div className="sticky top-24">
              {/* User card */}
              <div className="mb-8">
                <div className="flex items-center gap-3.5 mb-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-foreground/8 flex items-center justify-center text-xl font-bold text-secondary/50">
                      {user.displayName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[15px] font-bold text-foreground truncate">
                      {profile?.name || user.displayName || 'User'}
                    </h2>
                    <p className="text-[12px] text-secondary/45 truncate">{user.email}</p>
                  </div>
                </div>
                {roleValue && (
                  <div className="flex flex-wrap gap-1.5">
                    {roleValue.split(' · ').map((badge) => (
                      <span key={badge} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-foreground/[0.04] text-secondary/55">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-0.5 mb-8">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setEditing(null); }}
                    className={`flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-foreground/[0.06] text-foreground'
                        : 'text-secondary/55 hover:text-foreground hover:bg-foreground/[0.03]'
                    }`}
                  >
                    <tab.icon size={16} strokeWidth={activeTab === tab.key ? 2.5 : 2} />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="border-t border-border/15 pt-4">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3.5 py-2.5 w-full rounded-lg text-[14px] text-secondary/45 hover:text-foreground hover:bg-foreground/[0.03] transition-colors"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0 pb-16">
            {tabContent}
          </main>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          {/* User card */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-foreground/8 flex items-center justify-center text-lg font-bold text-secondary/50">
                  {user.displayName?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate">
                  {profile?.name || user.displayName || 'User'}
                </h2>
                <p className="text-[12px] text-secondary/45 truncate">{user.email}</p>
              </div>
            </div>
            {roleValue && (
              <div className="flex flex-wrap gap-1.5">
                {roleValue.split(' · ').map((badge) => (
                  <span key={badge} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-foreground/[0.04] text-secondary/55">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tab pills */}
          <div className="flex items-center gap-1.5 mb-6 pb-4 border-b border-border/15 overflow-x-auto scrollbar-hide">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setEditing(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-foreground text-background'
                    : 'bg-foreground/[0.06] text-secondary/60 hover:bg-foreground/10'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {tabContent}

          {activeTab === 'account' && (
            <div className="mt-8 pt-5 border-t border-border/15">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-secondary/45 hover:text-foreground hover:bg-foreground/[0.03] transition-colors"
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

function PrefRow({ label, value, isOpen, onToggle }: {
  label: string; value: string; isOpen?: boolean; onToggle?: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-surface-secondary/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {value && <p className="text-xs text-secondary/50 truncate mt-0.5">{value}</p>}
      </div>
      <ChevronDown size={16} className={`text-secondary/40 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

function EditActions({ saving, onCancel, onSave, disabled }: {
  saving: boolean; onCancel: () => void; onSave: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-medium text-secondary/60 bg-surface-secondary/60 hover:bg-surface-secondary transition-colors">
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="px-4 py-2 rounded-full text-xs font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-md hover:shadow-black/10 disabled:opacity-40"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
