"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronRight,
  LogOut,
  ArrowRight,
  Bookmark,
  Shield,
  FileText,
  Mail,
  Loader2,
  Crown,
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
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'subscription') setActiveTab('subscription');
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
    <div className="min-h-screen bg-background text-foreground">
      <Header showBackToFeed backHref="/feed" backLabel="Feed" />
      <main className="container mx-auto px-4 max-w-2xl py-8">

        {/* Profile header */}
        <div className="flex flex-col items-center text-center mb-8">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" width={72} height={72} className="w-[72px] h-[72px] rounded-full mb-3" />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-surface-secondary flex items-center justify-center text-xl font-bold text-secondary/50 mb-3">
              {user.displayName?.charAt(0) || '?'}
            </div>
          )}
          <h1 className="text-xl font-bold">{profile?.name || user.displayName || 'User'}</h1>
          <p className="text-sm text-secondary/50 mt-0.5">{user.email}</p>
          {roleValue && (
            <div className="flex gap-2 mt-3">
              {roleValue.split(' · ').map((badge) => (
                <span key={badge} className="text-xs font-medium px-3 py-1 rounded-full bg-surface-secondary text-secondary/70">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-full bg-surface-secondary mb-8 w-fit mx-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'profile' ? 'bg-surface text-foreground shadow-sm' : 'text-secondary/50'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'subscription' ? 'bg-surface text-foreground shadow-sm' : 'text-secondary/50'
            }`}
          >
            Subscription
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-3">

            {/* Subscription CTA */}
            {isSubscribed ? (
              <div className="p-5 rounded-2xl bg-surface-secondary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown size={16} style={{ color: ACCENT }} />
                    <span className="text-base font-bold">Pro</span>
                  </div>
                  <button onClick={() => setActiveTab('subscription')} className="text-xs text-secondary/50 hover:text-foreground transition-colors flex items-center gap-1">
                    Manage <ChevronRight size={14} />
                  </button>
                </div>
                <p className="text-sm text-secondary/50 mt-1">Full access to all content.</p>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-surface-secondary">
                <p className="text-base font-bold mb-1">Unlock the full experience</p>
                <p className="text-sm text-secondary/50 mb-4">
                  Unlimited articles, deep dives, and personalized summaries. Start with a free trial.
                </p>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: ACCENT }}
                >
                  Start Free Trial <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Preferences */}
            <div className="rounded-2xl bg-surface-secondary overflow-hidden">
              <PrefRow label="Role & Experience" value={roleValue} isOpen={editing === 'role'} onToggle={() => editing === 'role' ? cancelEditing() : startEditing('role')} />
              {editing === 'role' && (
                <div className="px-5 py-4 border-t border-border/10 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-secondary/60 mb-2">Role</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map((r) => (
                        <button key={r.id} onClick={() => setEditRole(r.id)}
                          className={`p-3 rounded-xl text-left text-sm font-medium transition-all ${
                            editRole === r.id ? 'bg-foreground text-background' : 'bg-background hover:bg-background/80'
                          }`}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-secondary/60 mb-2">Experience</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SENIORITY_LEVELS.map((s) => (
                        <button key={s.id} onClick={() => setEditSeniority(s.id)}
                          className={`p-3 rounded-xl text-left text-sm font-medium transition-all ${
                            editSeniority === s.id ? 'bg-foreground text-background' : 'bg-background hover:bg-background/80'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <EditActions saving={saving} onCancel={cancelEditing} onSave={() => savePrefs({ role: editRole, seniority: editSeniority })} />
                </div>
              )}

              <div className="border-t border-border/10" />

              <PrefRow label="Interests" value={interestValue} isOpen={editing === 'interests'} onToggle={() => editing === 'interests' ? cancelEditing() : startEditing('interests')} />
              {editing === 'interests' && (
                <div className="px-5 py-4 border-t border-border/10 space-y-3">
                  <p className="text-xs text-secondary/50">Pick 3-5 topics</p>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_INTERESTS.map((interest) => {
                      const selected = editInterests.includes(interest.id);
                      const disabled = !selected && editInterests.length >= 5;
                      return (
                        <button key={interest.id} disabled={disabled}
                          onClick={() => setEditInterests(toggleIn(editInterests, interest.id, 5))}
                          className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                            selected ? 'bg-foreground text-background' : 'bg-background text-foreground/80 hover:bg-background/80'
                          } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
                          {interest.label}
                          {selected && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                  <EditActions saving={saving} onCancel={cancelEditing} disabled={editInterests.length < 3} onSave={() => savePrefs({ interests: editInterests })} />
                </div>
              )}

              <div className="border-t border-border/10" />

              <PrefRow label="Deep Dive Sources" value={sourcesValue} isOpen={editing === 'sources'} onToggle={() => editing === 'sources' ? cancelEditing() : startEditing('sources')} />
              {editing === 'sources' && (
                <div className="px-5 py-4 border-t border-border/10 space-y-4">
                  {LEARNING_SOURCE_CATEGORIES.map((cat) => (
                    <div key={cat.id}>
                      <p className="text-xs font-semibold text-secondary/50 mb-2">{cat.label}</p>
                      <div className="space-y-1.5">
                        {cat.sources.map((source) => {
                          const selected = editSources.includes(source.name);
                          return (
                            <button key={source.name} onClick={() => setEditSources(toggleIn(editSources, source.name))}
                              className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-2 text-sm font-medium ${
                                selected ? 'bg-foreground text-background' : 'bg-background hover:bg-background/80'
                              }`}>
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

              <div className="border-t border-border/10" />

              <PrefRow label="Career Goals" value={goalsValue} isOpen={editing === 'goals'} onToggle={() => editing === 'goals' ? cancelEditing() : startEditing('goals')} />
              {editing === 'goals' && (
                <div className="px-5 py-4 border-t border-border/10 space-y-3">
                  <p className="text-xs text-secondary/50">Pick up to 3</p>
                  <div className="grid gap-2">
                    {CAREER_GOALS.map((goal) => {
                      const selected = editGoals.includes(goal.id);
                      const disabled = !selected && editGoals.length >= 3;
                      return (
                        <button key={goal.id} disabled={disabled}
                          onClick={() => setEditGoals(toggleIn(editGoals, goal.id, 3))}
                          className={`p-3 rounded-xl text-left transition-all ${
                            selected ? 'bg-foreground text-background' : 'bg-background hover:bg-background/80'
                          } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
                          <div className="font-medium text-sm">{goal.label}</div>
                          <div className={`text-xs mt-0.5 ${selected ? 'text-background/60' : 'text-secondary/50'}`}>{goal.subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                  <EditActions saving={saving} onCancel={cancelEditing} disabled={editGoals.length < 1} onSave={() => savePrefs({ careerGoals: editGoals })} />
                </div>
              )}
            </div>

            <p className="text-[11px] text-secondary/30 px-1">
              Changes take effect on your next daily feed refresh.
            </p>

            {/* Menu */}
            <div className="rounded-2xl bg-surface-secondary overflow-hidden">
              <Link href="/bookmarks" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-secondary/70 transition-colors">
                <Bookmark size={18} className="text-secondary/40" />
                <span className="flex-1 text-sm font-medium">Saved Articles</span>
                <ChevronRight size={16} className="text-secondary/30" />
              </Link>
              <div className="border-t border-border/10 ml-12" />
              <a href="https://www.yourtrace.online/privacy-policy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-secondary/70 transition-colors">
                <Shield size={18} className="text-secondary/40" />
                <span className="flex-1 text-sm font-medium">Privacy Policy</span>
                <ExternalLink size={14} className="text-secondary/30" />
              </a>
              <div className="border-t border-border/10 ml-12" />
              <a href="https://www.yourtrace.online/terms" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-secondary/70 transition-colors">
                <FileText size={18} className="text-secondary/40" />
                <span className="flex-1 text-sm font-medium">Terms of Service</span>
                <ExternalLink size={14} className="text-secondary/30" />
              </a>
            </div>

            {/* Newsletter */}
            <div className="rounded-2xl bg-surface-secondary px-5 py-4">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-secondary/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Daily Newsletter</p>
                  <p className="text-xs text-secondary/40">Curated digest, every morning.</p>
                </div>
                <button
                  onClick={toggleNewsletter}
                  disabled={savingNewsletter}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                    newsletterEnabled ? 'bg-amber-500' : 'bg-secondary/20'
                  } ${savingNewsletter ? 'opacity-50' : ''}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    newsletterEnabled ? 'left-6' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="pt-2 space-y-1">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-secondary/60 hover:text-foreground hover:bg-surface-secondary transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>

            <p className="text-xs text-secondary/30 text-center pt-4 pb-4">Trace v1.0.5</p>
          </div>
        )}

        {activeTab === 'subscription' && <SubscriptionManager />}
      </main>
    </div>
  );
}

function PrefRow({ label, value, isOpen, onToggle }: {
  label: string; value: string; isOpen?: boolean; onToggle?: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-surface-secondary/70 transition-colors">
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
      <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-medium text-secondary/60 bg-background hover:bg-background/80 transition-colors">
        Cancel
      </button>
      <button onClick={onSave} disabled={saving || disabled}
        className="px-4 py-2 rounded-full text-xs font-semibold text-white transition-all disabled:opacity-40"
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
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
