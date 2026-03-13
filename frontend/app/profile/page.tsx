"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  LogOut,
  Bookmark,
  Shield,
  FileText,
  Mail,
  Loader2,
  User,
  Settings,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateUserProfile,
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
  LEARNING_SOURCE_CATEGORIES,
} from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import SubscriptionManager from '@/components/SubscriptionManager';

type ProfileTab = 'account' | 'preferences' | 'subscription';
type PrefKey = 'role' | 'interests' | 'sources' | 'goals';

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
  const [editSources, setEditSources] = useState<string[]>([]);
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
    setEditSources(profile.selectedLearningSources || []);
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

  const sourcesValue = (profile?.selectedLearningSources || []).slice(0, 3).join(', ')
    + ((profile?.selectedLearningSources?.length || 0) > 3 ? ` +${(profile?.selectedLearningSources?.length || 0) - 3}` : '');

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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Folder Tabs */}
        <div className="flex items-end">
          {TAB_CONFIG.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                relative px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2
                ${activeTab === tab.key ? 'text-foreground bg-surface z-10' : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'}
                ${i === 0 ? 'rounded-tl-lg' : ''}
              `}
              style={{
                clipPath: i === 0
                  ? 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)'
                  : 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
                marginLeft: i === 0 ? 0 : '-6px',
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          <div className="split-layout" style={{ height: 'calc(100vh - 100px)' }}>
            {/* Sidebar - User Info */}
            <div className="split-sidebar">
              <div className="p-6 border-b border-sidebar-border">
                <div className="flex items-center gap-4">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-16 h-16 rounded-full" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center text-xl font-bold text-secondary/50">
                      {user.displayName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {profile?.name || user.displayName || 'User'}
                    </h2>
                    <p className="text-sm text-secondary/50 truncate">{user.email}</p>
                  </div>
                </div>
                {roleValue && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {roleValue.split(' · ').map((badge) => (
                      <span key={badge} className="text-xs font-medium px-3 py-1 rounded-full bg-surface-secondary text-secondary/70">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="p-4">
                <Link
                  href="/bookmarks"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <Bookmark size={18} className="text-secondary/40" />
                  <span className="text-sm font-medium">Saved Articles</span>
                </Link>
                <Link
                  href="/feed"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <span className="text-sm font-medium text-secondary/60">← Back to Feed</span>
                </Link>
              </div>

              <div className="mt-auto p-4 border-t border-sidebar-border">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm text-secondary/60 hover:text-foreground hover:bg-surface-secondary transition-colors"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
                <p className="text-xs text-secondary/30 text-center mt-4">Trace v1.0.5</p>
              </div>
            </div>

            {/* Main Content */}
            <div className="split-main">
          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="max-w-xl">
              <h1 className="text-2xl font-semibold mb-6">Account Settings</h1>

              {/* Subscription Status */}
              <div className="p-5 rounded-lg bg-surface-secondary mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">
                    {isSubscribed ? 'Pro Account' : 'Free Account'}
                  </h3>
                  <button
                    onClick={() => setActiveTab('subscription')}
                    className="text-xs text-secondary/50 hover:text-foreground transition-colors"
                  >
                    Manage →
                  </button>
                </div>
                <p className="text-sm text-secondary/60">
                  {isSubscribed
                    ? 'Full access to all content and features.'
                    : 'Upgrade to unlock unlimited articles and deep dives.'}
                </p>
              </div>

              {/* Newsletter Toggle */}
              <div className="p-5 rounded-lg bg-surface-secondary">
                <div className="flex items-center gap-4">
                  <Mail size={20} className="text-secondary/40 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Daily Newsletter</p>
                    <p className="text-xs text-secondary/50">Curated digest every morning</p>
                  </div>
                  <button
                    onClick={toggleNewsletter}
                    disabled={savingNewsletter}
                    className={`
                      relative w-11 h-6 rounded-full transition-colors shrink-0
                      ${newsletterEnabled ? 'bg-foreground' : 'bg-secondary/20'}
                      ${savingNewsletter ? 'opacity-50' : ''}
                    `}
                  >
                    <span className={`
                      absolute top-1 w-4 h-4 bg-surface rounded-full shadow transition-transform
                      ${newsletterEnabled ? 'left-6' : 'left-1'}
                    `} />
                  </button>
                </div>
              </div>

              {/* Legal Links */}
              <div className="mt-6 space-y-2">
                <a
                  href="https://www.yourtrace.online/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <Shield size={16} className="text-secondary/40" />
                  <span className="text-sm">Privacy Policy</span>
                  <ExternalLink size={12} className="text-secondary/30 ml-auto" />
                </a>
                <a
                  href="https://www.yourtrace.online/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <FileText size={16} className="text-secondary/40" />
                  <span className="text-sm">Terms of Service</span>
                  <ExternalLink size={12} className="text-secondary/30 ml-auto" />
                </a>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="max-w-xl">
              <h1 className="text-2xl font-semibold mb-2">Feed Preferences</h1>
              <p className="text-sm text-secondary/50 mb-6">
                Changes take effect on your next daily feed refresh.
              </p>

              <div className="space-y-1 rounded-lg bg-surface-secondary overflow-hidden">
                {/* Role */}
                <PrefRow
                  label="Role & Experience"
                  value={roleValue}
                  isOpen={editing === 'role'}
                  onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')}
                />
                {editing === 'role' && (
                  <div className="px-5 py-4 border-t border-sidebar-border space-y-4 bg-surface">
                    <div>
                      <p className="text-xs font-medium text-secondary/60 mb-3">Role</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ROLES.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setEditRole(r.id)}
                            className={`p-3 rounded-lg text-left text-sm font-medium transition-all border-2 ${
                              editRole === r.id
                                ? 'border-foreground bg-surface-secondary'
                                : 'border-transparent bg-surface-tertiary hover:bg-surface-secondary'
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
                            className={`p-3 rounded-lg text-left text-sm font-medium transition-all border-2 ${
                              editSeniority === s.id
                                ? 'border-foreground bg-surface-secondary'
                                : 'border-transparent bg-surface-tertiary hover:bg-surface-secondary'
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
                  <div className="px-5 py-4 border-t border-sidebar-border space-y-3 bg-surface">
                    <p className="text-xs text-secondary/50">Pick 3-5 topics</p>
                    <div className="flex flex-wrap gap-2">
                      {ONBOARDING_INTERESTS.map((interest) => {
                        const selected = editInterests.includes(interest.id);
                        const disabled = !selected && editInterests.length >= 5;
                        return (
                          <button
                            key={interest.id}
                            disabled={disabled}
                            onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                              selected
                                ? 'bg-foreground text-background'
                                : 'bg-surface-tertiary text-foreground/80 hover:bg-surface-secondary'
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

                {/* Sources */}
                <PrefRow
                  label="Deep Dive Sources"
                  value={sourcesValue}
                  isOpen={editing === 'sources'}
                  onToggle={() => editing === 'sources' ? cancelEditing() : startEditing('sources')}
                />
                {editing === 'sources' && (
                  <div className="px-5 py-4 border-t border-sidebar-border space-y-4 bg-surface max-h-[400px] overflow-y-auto">
                    {LEARNING_SOURCE_CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <p className="text-xs font-semibold text-secondary/50 mb-2">{cat.label}</p>
                        <div className="space-y-1.5">
                          {cat.sources.map((source) => {
                            const selected = editSources.includes(source.name);
                            return (
                              <button
                                key={source.name}
                                onClick={() => setEditSources(toggleIn(editSources, source.name))}
                                className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-2 text-sm font-medium border-2 ${
                                  selected
                                    ? 'border-foreground bg-surface-secondary'
                                    : 'border-transparent bg-surface-tertiary hover:bg-surface-secondary'
                                }`}
                              >
                                <span className="flex-1 truncate">{source.name}</span>
                                {selected && <Check size={14} className="shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <EditActions saving={saving} onCancel={cancelEditing} disabled={editSources.length < 1} onSave={() => savePrefs({ selectedLearningSources: editSources })} />
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
                  <div className="px-5 py-4 border-t border-sidebar-border space-y-3 bg-surface">
                    <p className="text-xs text-secondary/50">Pick up to 3</p>
                    <div className="grid gap-2">
                      {CAREER_GOALS.map((goal) => {
                        const selected = editGoals.includes(goal.id);
                        const disabled = !selected && editGoals.length >= 3;
                        return (
                          <button
                            key={goal.id}
                            disabled={disabled}
                            onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                            className={`p-3 rounded-lg text-left transition-all border-2 ${
                              selected
                                ? 'border-foreground bg-surface-secondary'
                                : 'border-transparent bg-surface-tertiary hover:bg-surface-secondary'
                            } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            <div className="font-medium text-sm">{goal.label}</div>
                            <div className={`text-xs mt-0.5 ${selected ? 'text-secondary/60' : 'text-secondary/50'}`}>{goal.subtitle}</div>
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

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="max-w-xl">
              <h1 className="text-2xl font-semibold mb-6">Subscription</h1>
              <SubscriptionManager />
            </div>
          )}
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden bg-surface rounded-tr-lg rounded-b-lg">
          {/* User Header */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center text-lg font-bold text-secondary/50">
                  {user.displayName?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">
                  {profile?.name || user.displayName || 'User'}
                </h2>
                <p className="text-xs text-secondary/50 truncate">{user.email}</p>
              </div>
            </div>
            {roleValue && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {roleValue.split(' · ').map((badge) => (
                  <span key={badge} className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-surface-secondary text-secondary/70">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Content */}
          <div className="p-4">
            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                {/* Subscription Status */}
                <div className="p-4 rounded-lg bg-surface-secondary">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold">
                      {isSubscribed ? 'Pro Account' : 'Free Account'}
                    </h3>
                    <button
                      onClick={() => setActiveTab('subscription')}
                      className="text-xs text-secondary/50 hover:text-foreground transition-colors"
                    >
                      Manage →
                    </button>
                  </div>
                  <p className="text-xs text-secondary/60">
                    {isSubscribed
                      ? 'Full access to all content and features.'
                      : 'Upgrade to unlock unlimited articles.'}
                  </p>
                </div>

                {/* Newsletter Toggle */}
                <div className="p-4 rounded-lg bg-surface-secondary">
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-secondary/40 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Daily Newsletter</p>
                      <p className="text-[10px] text-secondary/50">Curated digest every morning</p>
                    </div>
                    <button
                      onClick={toggleNewsletter}
                      disabled={savingNewsletter}
                      className={`
                        relative w-10 h-5 rounded-full transition-colors shrink-0
                        ${newsletterEnabled ? 'bg-foreground' : 'bg-secondary/20'}
                        ${savingNewsletter ? 'opacity-50' : ''}
                      `}
                    >
                      <span className={`
                        absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform
                        ${newsletterEnabled ? 'left-5' : 'left-0.5'}
                      `} />
                    </button>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="space-y-1">
                  <Link
                    href="/bookmarks"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    <Bookmark size={16} className="text-secondary/40" />
                    <span className="text-sm">Saved Articles</span>
                  </Link>
                  <Link
                    href="/feed"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    <span className="text-sm text-secondary/60">← Back to Feed</span>
                  </Link>
                </div>

                {/* Legal Links */}
                <div className="pt-4 border-t border-sidebar-border space-y-1">
                  <a
                    href="https://www.yourtrace.online/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    <Shield size={14} className="text-secondary/40" />
                    <span className="text-sm">Privacy Policy</span>
                    <ExternalLink size={10} className="text-secondary/30 ml-auto" />
                  </a>
                  <a
                    href="https://www.yourtrace.online/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    <FileText size={14} className="text-secondary/40" />
                    <span className="text-sm">Terms of Service</span>
                    <ExternalLink size={10} className="text-secondary/30 ml-auto" />
                  </a>
                </div>

                {/* Sign Out */}
                <div className="pt-4 border-t border-sidebar-border">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-secondary/60 hover:text-foreground hover:bg-surface-secondary transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                  <p className="text-[10px] text-secondary/30 text-center mt-3">Trace v1.0.5</p>
                </div>
              </div>
            )}

            {/* Preferences Tab - Mobile */}
            {activeTab === 'preferences' && (
              <div>
                <h1 className="text-xl font-semibold mb-1">Feed Preferences</h1>
                <p className="text-xs text-secondary/50 mb-4">
                  Changes take effect on your next daily feed refresh.
                </p>

                <div className="space-y-1 rounded-lg bg-surface-secondary overflow-hidden">
                  {/* Role */}
                  <PrefRow
                    label="Role & Experience"
                    value={roleValue}
                    isOpen={editing === 'role'}
                    onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')}
                  />
                  {editing === 'role' && (
                    <div className="px-4 py-3 border-t border-sidebar-border space-y-3 bg-surface">
                      <div>
                        <p className="text-xs font-medium text-secondary/60 mb-2">Role</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {ROLES.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => setEditRole(r.id)}
                              className={`p-2.5 rounded-lg text-left text-xs font-medium transition-all border-2 ${
                                editRole === r.id
                                  ? 'border-foreground bg-surface-secondary'
                                  : 'border-transparent bg-surface-tertiary'
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-secondary/60 mb-2">Experience</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SENIORITY_LEVELS.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => setEditSeniority(s.id)}
                              className={`p-2.5 rounded-lg text-left text-xs font-medium transition-all border-2 ${
                                editSeniority === s.id
                                  ? 'border-foreground bg-surface-secondary'
                                  : 'border-transparent bg-surface-tertiary'
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
                    <div className="px-4 py-3 border-t border-sidebar-border space-y-2 bg-surface">
                      <p className="text-[10px] text-secondary/50">Pick 3-5 topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ONBOARDING_INTERESTS.map((interest) => {
                          const selected = editInterests.includes(interest.id);
                          const disabled = !selected && editInterests.length >= 5;
                          return (
                            <button
                              key={interest.id}
                              disabled={disabled}
                              onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 ${
                                selected
                                  ? 'bg-foreground text-background'
                                  : 'bg-surface-tertiary text-foreground/80'
                              } ${disabled ? 'opacity-30' : ''}`}
                            >
                              {interest.label}
                              {selected && <Check size={10} />}
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
                    <div className="px-4 py-3 border-t border-sidebar-border space-y-2 bg-surface">
                      <p className="text-[10px] text-secondary/50">Pick up to 3</p>
                      <div className="grid gap-1.5">
                        {CAREER_GOALS.map((goal) => {
                          const selected = editGoals.includes(goal.id);
                          const disabled = !selected && editGoals.length >= 3;
                          return (
                            <button
                              key={goal.id}
                              disabled={disabled}
                              onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                              className={`p-2.5 rounded-lg text-left transition-all border-2 ${
                                selected
                                  ? 'border-foreground bg-surface-secondary'
                                  : 'border-transparent bg-surface-tertiary'
                              } ${disabled ? 'opacity-30' : ''}`}
                            >
                              <div className="font-medium text-xs">{goal.label}</div>
                              <div className="text-[10px] text-secondary/50 mt-0.5">{goal.subtitle}</div>
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

            {/* Subscription Tab - Mobile */}
            {activeTab === 'subscription' && (
              <div>
                <h1 className="text-xl font-semibold mb-4">Subscription</h1>
                <SubscriptionManager />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrefRow({ label, value, isOpen, onToggle }: {
  label: string; value: string; isOpen?: boolean; onToggle?: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-surface-tertiary/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {value && <p className="text-xs text-secondary/40 truncate mt-0.5">{value}</p>}
      </div>
      <ChevronDown size={16} className={`text-secondary/30 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

function EditActions({ saving, onCancel, onSave, disabled }: {
  saving: boolean; onCancel: () => void; onSave: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-medium text-secondary/60 bg-surface-tertiary hover:bg-surface-secondary transition-colors">
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="px-4 py-2 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-40"
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
