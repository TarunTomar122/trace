"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  LogOut,
  ArrowRight,
  Briefcase,
  Sparkles,
  BookOpen,
  Target,
  Circle,
  Mail,
} from 'lucide-react';
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
import Header from '@/components/Header';
import SubscriptionManager from '@/components/SubscriptionManager';

const ACCENT = '#F59E0B';

type PrefKey = 'role' | 'interests' | 'sources' | 'goals';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>('profile');
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
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'subscription') setActiveTab('subscription');
  }, [searchParams]);

  // Initialize newsletter preference from profile
  useEffect(() => {
    if (profile) {
      setNewsletterEnabled(profile.dailyNewsletterEnabled !== false);
    }
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
      setNewsletterEnabled(!newValue); // revert on error
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
    } catch (e) {
      console.error('Failed to save:', e);
    }
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

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const toggleIn = (arr: string[], id: string, max?: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : (max && arr.length >= max ? arr : [...arr, id]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header showBackToFeed backHref="/feed" backLabel="Feed" />
      <main className="container mx-auto px-4 max-w-2xl py-6">
        <div className="flex items-center gap-4 mb-8">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" width={56} height={56} className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-lg font-bold text-secondary/70">
              {user.displayName?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold">{profile?.name || user.displayName || 'User'}</h1>
            <p className="text-sm text-secondary/60">{user.email}</p>
            {roleValue && <p className="text-xs text-secondary/50 mt-0.5">{roleValue}</p>}
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 mb-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'profile' ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-secondary/60'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'subscription' ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-secondary/60'
            }`}
          >
            Subscription
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {!isSubscribed && (
              <div className="rounded-2xl border p-5" style={{ backgroundColor: `${ACCENT}08`, borderColor: `${ACCENT}30` }}>
                <h3 className="font-semibold text-sm mb-3">Unlock the full Trace experience</h3>
                <div className="space-y-2 mb-4">
                  {['Unlimited For You articles & Deep Dives', 'Summaries tailored to your reading style', 'Start with a 4-day free trial'].map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <Circle size={5} fill={ACCENT} stroke={ACCENT} />
                      <span className="text-xs text-secondary/70">{t}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  Start Free Trial <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary/50 font-medium mb-3">Preferences</p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">

                {/* Role & Experience */}
                <PrefRow label="Role & Experience" value={roleValue} icon={<Briefcase size={16} />} isOpen={editing === 'role'} onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')} />
                {editing === 'role' && (
                  <div className="px-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
                    <div>
                      <p className="text-xs font-medium mb-2">Role</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ROLES.map((r) => (
                          <button key={r.id} onClick={() => setEditRole(r.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${editRole === r.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-gray-200 dark:border-gray-800'}`}>
                            <div className="font-medium text-sm">{r.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2">Experience</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SENIORITY_LEVELS.map((s) => (
                          <button key={s.id} onClick={() => setEditSeniority(s.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${editSeniority === s.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-gray-200 dark:border-gray-800'}`}>
                            <div className="font-medium text-sm">{s.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <EditActions saving={saving} onCancel={cancelEditing} onSave={() => savePrefs({ role: editRole, seniority: editSeniority })} />
                  </div>
                )}

                {/* Interests */}
                <PrefRow label="Interests" value={interestValue} icon={<Sparkles size={16} />} isOpen={editing === 'interests'} onToggle={() => editing === 'interests' ? cancelEditing() : startEditing('interests')} />
                {editing === 'interests' && (
                  <div className="px-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
                    <p className="text-xs text-secondary/60">Pick 3-5 topics</p>
                    <div className="flex flex-wrap gap-2">
                      {ONBOARDING_INTERESTS.map((interest) => {
                        const selected = editInterests.includes(interest.id);
                        const disabled = !selected && editInterests.length >= 5;
                        return (
                          <button key={interest.id} disabled={disabled}
                            onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                            className={`px-3 py-2 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                              selected ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 dark:border-gray-700 text-foreground/80'
                            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            {interest.label}
                            {selected && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                    <EditActions saving={saving} onCancel={cancelEditing} disabled={editInterests.length < 3} onSave={() => savePrefs({ interests: editInterests })} />
                  </div>
                )}

                {/* Deep Dive Sources */}
                <PrefRow label="Deep Dive Sources" value={sourcesValue} icon={<BookOpen size={16} />} isOpen={editing === 'sources'} onToggle={() => editing === 'sources' ? cancelEditing() : startEditing('sources')} />
                {editing === 'sources' && (
                  <div className="px-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
                    {LEARNING_SOURCE_CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <p className="text-xs font-semibold text-secondary/70 mb-2">{cat.label}</p>
                        <div className="space-y-1.5">
                          {cat.sources.map((source) => {
                            const selected = editSources.includes(source.name);
                            return (
                              <button key={source.name} onClick={() => setEditSources(toggleIn(editSources, source.name))}
                                className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 text-sm ${
                                  selected ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-gray-200 dark:border-gray-800'
                                }`}>
                                <span className="flex-1 truncate">{source.name}</span>
                                {selected && <Check size={14} className="text-amber-500 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <EditActions saving={saving} onCancel={cancelEditing} disabled={editSources.length < 1} onSave={() => savePrefs({ selectedLearningSources: editSources })} />
                  </div>
                )}

                {/* Career Goals */}
                <PrefRow label="Career Goals" value={goalsValue} icon={<Target size={16} />} isOpen={editing === 'goals'} onToggle={() => editing === 'goals' ? cancelEditing() : startEditing('goals')} />
                {editing === 'goals' && (
                  <div className="px-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
                    <p className="text-xs text-secondary/60">Pick up to 3</p>
                    <div className="grid gap-2">
                      {CAREER_GOALS.map((goal) => {
                        const selected = editGoals.includes(goal.id);
                        const disabled = !selected && editGoals.length >= 3;
                        return (
                          <button key={goal.id} disabled={disabled}
                            onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              selected ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-gray-200 dark:border-gray-800'
                            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            <div className="font-medium text-sm">{goal.label}</div>
                            <div className="text-xs text-secondary/60 mt-0.5">{goal.subtitle}</div>
                          </button>
                        );
                      })}
                    </div>
                    <EditActions saving={saving} onCancel={cancelEditing} disabled={editGoals.length < 1} onSave={() => savePrefs({ careerGoals: editGoals })} />
                  </div>
                )}

              </div>
              <p className="text-[11px] text-secondary/40 mt-2">
                Changes take effect on your next daily feed refresh.
              </p>
            </div>

            {/* Notifications */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary/50 font-medium mb-3">Notifications</p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-secondary/50 flex-shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Daily Newsletter</p>
                    <p className="text-xs text-secondary/50">Receive your digest every morning at 6 AM</p>
                  </div>
                  <button
                    onClick={toggleNewsletter}
                    disabled={savingNewsletter}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      newsletterEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'
                    } ${savingNewsletter ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        newsletterEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-secondary/70 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>

            <p className="text-xs text-secondary/40 text-center pt-4">Trace v1.0.5</p>
          </div>
        )}

        {activeTab === 'subscription' && (
          <SubscriptionManager />
        )}
      </main>
    </div>
  );
}

function PrefRow({ label, value, icon, isOpen, onToggle }: {
  label: string; value: string; icon: React.ReactNode; isOpen?: boolean; onToggle?: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-secondary/50 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {value && <p className="text-xs text-secondary/50 truncate">{value}</p>}
      </div>
      <ChevronDown size={16} className={`text-secondary/40 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

function EditActions({ saving, onCancel, onSave, disabled }: {
  saving: boolean; onCancel: () => void; onSave: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-medium text-secondary/70 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        Cancel
      </button>
      <button onClick={onSave} disabled={saving || disabled}
        className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
