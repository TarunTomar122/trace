"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Check,
  Plus,
  X,
  Trash2,
  Save,
  Send,
  Sparkles,
  MessageCircle,
  Bot,
  CreditCard,
  Mail
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, getUserPatterns, updateUserProfile, updateUserInsights, addChatMessage, clearChatHistory, UserProfile, INTERESTS, ROLES, ChatMessage } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import SubscriptionManager from '@/components/SubscriptionManager';
import TraceInsightCard from '@/components/TraceInsightCard';
import { buildTraceInsights, TraceInsights } from '@/lib/traceInsights';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signOut, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [traceInsights, setTraceInsights] = useState<TraceInsights | null>(null);
  const [traceInsightsLoading, setTraceInsightsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'chat' | 'subscription'>('profile');
  const hasLoadedProfile = useRef(false);

  // Switch to subscription tab if coming from onboarding or feed redirect
  const applyProfile = (p: UserProfile) => {
    setProfile(p);
    setName(p.name);
    setRole(p.role);
    setCompany(p.company || '');
    setLocation(p.location || '');
    setExperienceYears(
      p.experienceYears !== undefined && p.experienceYears !== null
        ? String(p.experienceYears)
        : ''
    );
    setCurrentWorkProject(p.currentWork?.project || '');
    setCurrentWorkFocus(p.currentWork?.focus || '');
    setProjectsText(p.projects?.join(', ') || '');
    setGoalsShortTerm(p.goals?.shortTerm || '');
    setGoalsLongTerm(p.goals?.longTerm || '');
    setLearningStyle(p.learningStyle || '');
    setAttentionConstraints(p.attentionConstraints || '');
    setMotivationTriggersText(p.motivationTriggers?.join(', ') || '');
    setContentLikesText(p.contentPreferences?.likes?.join(', ') || '');
    setContentDislikesText(p.contentPreferences?.dislikes?.join(', ') || '');
    setFavoriteSourcesText(p.favoriteSources?.join(', ') || '');
    setPersonalityTraitsText(p.personalityTraits?.join(', ') || '');
    setPetPeevesText(p.petPeeves?.join(', ') || '');
    const loadedInterests = (p.interests || []).map(i =>
      i.startsWith('custom-') ? i.replace('custom-', '') : i
    );
    setSelectedInterests(loadedInterests.slice(0, 8));
    setContentDepth(p.contentDepth);
    setHobbiesText(p.hobbies?.join(', ') || '');
    setSkillsText(p.skills?.join(', ') || '');
    setDislikedTopicsText(p.dislikedTopics?.join(', ') || '');
    if (p.sourcePreferences) {
      setSourcePreferences(p.sourcePreferences);
    }
    if (p.chatHistory) {
      setChatMessages(p.chatHistory.map(m => ({ role: m.role, content: m.content })));
    }
    // Newsletter opt-in defaults to true if not set
    setNewsletterOptIn(p.newsletterOptIn !== false);
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const subscriptionParam = searchParams.get('subscription');
    if (tabParam === 'subscription' || subscriptionParam === 'required' || subscriptionParam === 'success') {
      setActiveTab('subscription');
    }
  }, [searchParams]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [currentWorkProject, setCurrentWorkProject] = useState('');
  const [currentWorkFocus, setCurrentWorkFocus] = useState('');
  const [projectsText, setProjectsText] = useState('');
  const [goalsShortTerm, setGoalsShortTerm] = useState('');
  const [goalsLongTerm, setGoalsLongTerm] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [attentionConstraints, setAttentionConstraints] = useState('');
  const [motivationTriggersText, setMotivationTriggersText] = useState('');
  const [contentLikesText, setContentLikesText] = useState('');
  const [contentDislikesText, setContentDislikesText] = useState('');
  const [favoriteSourcesText, setFavoriteSourcesText] = useState('');
  const [personalityTraitsText, setPersonalityTraitsText] = useState('');
  const [petPeevesText, setPetPeevesText] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [contentDepth, setContentDepth] = useState<'quick' | 'deep' | 'surprise' | null>(null);
  const [customInterest, setCustomInterest] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Additional fields from onboarding
  const [hobbiesText, setHobbiesText] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [dislikedTopicsText, setDislikedTopicsText] = useState('');
  const [sourcePreferences, setSourcePreferences] = useState({
    youtube: 30,
    articles: 25,
    papers: 10,
    repos: 15,
    tweets: 10,
    discussions: 10,
  });
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);

  useEffect(() => {
    // Alpha mode check: if not in alpha mode, redirect to waitlist
    if (!isAlphaMode()) {
      if (user) {
        router.push('/waitlist');
      } else {
        router.push('/');
      }
      return;
    }

    if (!loading && !user) {
      router.push('/');
      return;
    }

    if (editingSection) return;

    if (authProfile && !profile) {
      applyProfile(authProfile);
    }

    if (user && !hasLoadedProfile.current) {
      hasLoadedProfile.current = true;
      getUserProfile(user.uid).then(p => {
        if (p) {
          applyProfile(p);
        }
      });
    }
  }, [user, loading, router, authProfile, profile, editingSection]);

  useEffect(() => {
    if (!user || !profile?.onboarded) {
      setTraceInsights(null);
      return;
    }

    let isActive = true;
    setTraceInsightsLoading(true);

    Promise.all([
      getUserPatterns(user.uid),
    ])
      .then(([patterns]) => {
        if (!isActive) return;
        const insights = buildTraceInsights({ patterns });
        setTraceInsights(insights);
      })
      .catch((error) => {
        console.error('Error loading trace insights:', error);
      })
      .finally(() => {
        if (!isActive) return;
        setTraceInsightsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [user, profile]);

  const parseCommaSeparated = (text: string, maxItems?: number): string[] => {
    const items = text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return typeof maxItems === 'number' ? items.slice(0, maxItems) : items;
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Start chat if no history
  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length === 0 && profile) {
      startChat();
    }
  }, [activeTab, profile]);

  const startChat = async () => {
    if (!profile) return;
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], profile }),
      });

      const data = await response.json();
      const assistantMessage = { role: 'assistant' as const, content: data.message };
      setChatMessages([assistantMessage]);

      if (user) {
        await addChatMessage(user.uid, assistantMessage);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !user || !profile) return;

    const userMessage = { role: 'user' as const, content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Save user message
      await addChatMessage(user.uid, userMessage);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile }),
      });

      const data = await response.json();
      const assistantMessage = { role: 'assistant' as const, content: data.message };
      setChatMessages([...newMessages, assistantMessage]);

      // Save assistant message
      await addChatMessage(user.uid, assistantMessage);

      // Save any insights extracted
      if (data.insights && Object.keys(data.insights).length > 0) {
        await updateUserInsights(user.uid, data.insights);
        // Refresh profile
        const updatedProfile = await getUserProfile(user.uid);
        if (updatedProfile) setProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter(i => i !== id));
    } else if (selectedInterests.length < 8) {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && selectedInterests.length < 8) {
      const customId = customInterest.toLowerCase().trim().replace(/\s+/g, '-');
      if (!selectedInterests.includes(customId)) {
        setSelectedInterests([...selectedInterests, customId]);
      }
      setCustomInterest('');
      setShowCustomInput(false);
    }
  };

  // Slider helper
  const updateSlider = (key: keyof typeof sourcePreferences, value: number) => {
    setSourcePreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSection = async (section: string) => {
    if (!user || !profile) return;

    setSavingSection(section);
    try {
      let profileUpdate: Record<string, unknown> = {};
      let localProfileUpdate: Partial<UserProfile> = {};

      switch (section) {
        case 'interests': {
          const normalizedInterests = selectedInterests.map(interest =>
            interest.startsWith('custom-') ? interest.replace('custom-', '') : interest
          );
          profileUpdate = { interests: normalizedInterests };
          localProfileUpdate = { interests: normalizedInterests };
          break;
        }
        case 'hobbies': {
          const parsedHobbies = parseCommaSeparated(hobbiesText, 3);
          profileUpdate = { hobbies: parsedHobbies };
          localProfileUpdate = { hobbies: parsedHobbies };
          break;
        }
        case 'skills': {
          const parsedSkills = parseCommaSeparated(skillsText);
          profileUpdate = { skills: parsedSkills };
          localProfileUpdate = { skills: parsedSkills };
          break;
        }
        case 'goals': {
          profileUpdate = { goals: { shortTerm: goalsShortTerm || undefined, longTerm: goalsLongTerm || undefined } };
          localProfileUpdate = { goals: { shortTerm: goalsShortTerm || undefined, longTerm: goalsLongTerm || undefined } };
          break;
        }
        case 'contentPreferences': {
          profileUpdate = { sourcePreferences, contentDepth };
          localProfileUpdate = { sourcePreferences, contentDepth };
          break;
        }
        case 'newsletter': {
          profileUpdate = { newsletterOptIn };
          localProfileUpdate = { newsletterOptIn };
          break;
        }
        default:
          return;
      }

      await updateUserProfile(user.uid, profileUpdate);

      // Trigger feed refresh if onboarded
      const isOnboarded = Boolean(profile.onboarded);
      if (isOnboarded && ['interests', 'hobbies', 'skills', 'goals', 'contentPreferences'].includes(section)) {
        try {
          await fetch('/api/onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid }),
          });
        } catch (error) {
          console.error('Error triggering profile refresh:', error);
        }
      }

      setProfile({ ...profile, ...localProfileUpdate });
      setEditingSection(null);
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error('Error saving section:', error);
      setSaveMessage('Error saving');
    } finally {
      setSavingSection(null);
    }
  };

  const cancelEditSection = (section: string) => {
    // Reset section values to profile values
    if (profile) {
      switch (section) {
        case 'interests':
          setSelectedInterests((profile.interests || []).map(i => i.startsWith('custom-') ? i.replace('custom-', '') : i).slice(0, 8));
          break;
        case 'hobbies':
          setHobbiesText(profile.hobbies?.join(', ') || '');
          break;
        case 'skills':
          setSkillsText(profile.skills?.join(', ') || '');
          break;
        case 'goals':
          setGoalsShortTerm(profile.goals?.shortTerm || '');
          break;
        case 'contentPreferences':
          if (profile.sourcePreferences) setSourcePreferences(profile.sourcePreferences);
          setContentDepth(profile.contentDepth);
          break;
        case 'newsletter':
          setNewsletterOptIn(profile.newsletterOptIn !== false);
          break;
      }
    }
    setEditingSection(null);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        showBackToFeed
        onSignOut={handleSignOut}
      />

      {/* Onboarding banner for non-onboarded users */}
      {profile && !profile.onboarded && (
        <div className="bg-gray-100 border-b border-gray-200">
          <div className="container mx-auto px-4 max-w-4xl py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Make your feed feel personal
                  </p>
                  <p className="text-xs text-secondary/70 mt-0.5">
                    Most early users say picking interests makes the feed feel 2–3x more relevant
                  </p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors shrink-0"
              >
                <Sparkles size={14} />
                Personalize my feed
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 max-w-4xl py-8 md:py-12">
        {/* Save message toast */}
        <AnimatePresence>
          {saveMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-800 text-white text-sm font-medium rounded-xl shadow-lg z-50"
            >
              {saveMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-5">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-gray-200" />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200">
                <User size={32} className="text-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">{profile?.name || user.displayName}</h1>
              <p className="text-sm text-slate-500 mt-1">{user.email}</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'profile'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-secondary hover:text-foreground'
                }`}
            >
              <User size={16} />
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'subscription'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-secondary hover:text-foreground'
                }`}
            >
              <CreditCard size={16} />
              <span className="hidden sm:inline">Subscription</span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'subscription' ? (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SubscriptionManager />
            </motion.div>
          ) : (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Trace Snapshot */}
              {profile?.onboarded && (
                <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-6 flex items-center gap-2">
                    <Sparkles size={14} className="text-foreground" />
                    Your focus snapshot
                  </h2>
                  {traceInsightsLoading ? (
                    <div className="text-sm text-secondary/70">Loading insights...</div>
                  ) : traceInsights ? (
                    <TraceInsightCard insights={traceInsights} />
                  ) : (
                    <div className="text-sm text-secondary/70">
                      Interact with your feed to teach Trace what helps you focus and avoid doomscrolling.
                    </div>
                  )}
                </section>
              )}


              {/* Basic Info */}
              {/* <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-6">
                  Basic Information
                </h2>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Name</label>
                    {isEditing ? (
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                    ) : (
                      <p className="text-base py-3">{profile?.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Role</label>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        {ROLES.map((r) => (
                          <button key={r} onClick={() => setRole(r)} className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${role === r ? 'bg-foreground text-background' : 'bg-gray-100 text-secondary hover:bg-gray-200'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base py-3 text-slate-700">{profile?.role}</p>
                    )}
                  </div>
                </div>
              </section> */}

              {/* Interests */}
              <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Topics you want more of ({selectedInterests.length}/8)
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'interests' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('interests')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('interests')} disabled={savingSection === 'interests'} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                          {savingSection === 'interests' ? <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('interests')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest.id);
                    return editingSection === 'interests' ? (
                      <button key={interest.id} onClick={() => toggleInterest(interest.id)} className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isSelected ? 'bg-foreground text-background' : 'bg-gray-100 text-secondary hover:bg-gray-200'}`}>
                        <span>{interest.label}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    ) : isSelected ? (
                      <span key={interest.id} className="px-4 py-2.5 rounded-full bg-gray-100 text-sm font-medium flex items-center gap-2">
                        <span>{interest.label}</span>
                      </span>
                    ) : null;
                  })}

                  {selectedInterests.filter(i => i.startsWith('custom-') || !INTERESTS.some(interest => interest.id === i)).map(customId => (
                    editingSection === 'interests' ? (
                      <button key={customId} onClick={() => toggleInterest(customId)} className="px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all flex items-center gap-2">
                        <span>{customId.startsWith('custom-') ? customId.replace('custom-', '').replace(/-/g, ' ') : customId}</span>
                        <X size={14} />
                      </button>
                    ) : (
                      <span key={customId} className="px-4 py-2.5 rounded-full bg-gray-100 text-sm font-medium flex items-center gap-2">
                        <span>{customId.startsWith('custom-') ? customId.replace('custom-', '').replace(/-/g, ' ') : customId}</span>
                      </span>
                    )
                  ))}

                  {editingSection === 'interests' && (
                    !showCustomInput ? (
                      <button onClick={() => setShowCustomInput(true)} className="px-4 py-2.5 rounded-full border-2 border-dashed border-gray-200 hover:border-gray-300 text-sm font-medium transition-all flex items-center gap-2 text-secondary">
                        <Plus size={14} />
                        Add custom
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="text" value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomInterest()} placeholder="Interest" autoFocus className="px-4 py-2.5 rounded-full border-2 border-foreground bg-transparent text-sm font-medium outline-none w-32" />
                        <button onClick={addCustomInterest} className="p-2.5 rounded-full bg-foreground text-background"><Check size={14} /></button>
                        <button onClick={() => { setShowCustomInput(false); setCustomInterest(''); }} className="p-2.5 rounded-full bg-gray-100"><X size={14} /></button>
                      </div>
                    )
                  )}
                </div>
              </section>

              {/* Hobbies */}
              <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Hobbies
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'hobbies' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('hobbies')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('hobbies')} disabled={savingSection === 'hobbies'} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                          {savingSection === 'hobbies' ? <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('hobbies')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div>
                  {editingSection === 'hobbies' ? (
                    <>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Things you enjoy outside of work
                      </label>
                      <textarea
                        value={hobbiesText}
                        onChange={(e) => setHobbiesText(e.target.value)}
                        placeholder="marathon training, sourdough baking, film photography, ceramics"
                        rows={2}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40 resize-none"
                      />
                    </>
                  ) : (
                    <p className="text-base font-medium text-slate-700">{profile?.hobbies?.length ? profile.hobbies.join(', ') : 'Not set'}</p>
                  )}
                </div>
              </section>

              {/* Projects */}
              {/* <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Projects
                </h2>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                    What are you building or working on?
                  </label>
                  {isEditing ? (
                    <textarea
                      value={projectsText}
                      onChange={(e) => setProjectsText(e.target.value)}
                      placeholder="portfolio site, side project, newsletter"
                      rows={2}
                      className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                    />
                  ) : (
                    <p className="text-lg font-serif py-3 text-secondary">{profile?.projects?.length ? profile.projects.join(', ') : 'Not set'}</p>
                  )}
                </div>
              </section> */}

              {/* Skills */}
              <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Skills
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'skills' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('skills')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('skills')} disabled={savingSection === 'skills'} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                          {savingSection === 'skills' ? <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('skills')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div>
                  {editingSection === 'skills' ? (
                    <>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Your skills & expertise
                      </label>
                      <textarea
                        value={skillsText}
                        onChange={(e) => setSkillsText(e.target.value)}
                        placeholder="TypeScript, Figma, financial modeling, user interviews"
                        rows={2}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40 resize-none"
                      />
                    </>
                  ) : (
                    <p className="text-base font-medium text-slate-700">{profile?.skills?.length ? profile.skills.join(', ') : 'Not set'}</p>
                  )}
                </div>
              </section>

              {/* Short-term Goals */}
              <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Short-term Goals
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'goals' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('goals')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('goals')} disabled={savingSection === 'goals'} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                          {savingSection === 'goals' ? <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('goals')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div>
                  {editingSection === 'goals' ? (
                    <>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        What do you want to achieve soon?
                      </label>
                      <textarea
                        value={goalsShortTerm}
                        onChange={(e) => setGoalsShortTerm(e.target.value)}
                        placeholder="Ship MVP, learn TypeScript"
                        rows={2}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40 resize-none"
                      />
                    </>
                  ) : (
                    <p className="text-base font-medium text-slate-700">{profile?.goals?.shortTerm || 'Not set'}</p>
                  )}
                </div>
              </section>

              {/* Content Mix - Source Preferences */}
              <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Content Source Preferences
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'contentPreferences' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('contentPreferences')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('contentPreferences')} disabled={savingSection === 'contentPreferences'} className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                          {savingSection === 'contentPreferences' ? <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('contentPreferences')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div className="space-y-6">
                  {/* Sliders */}
                  {(Object.keys(sourcePreferences) as Array<keyof typeof sourcePreferences>).map(key => (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700">
                          {key === 'youtube' && '📹 YouTube Videos'}
                          {key === 'articles' && '📰 Articles & Blogs'}
                          {key === 'papers' && '📄 Research Papers'}
                          {key === 'repos' && '💻 GitHub Repos'}
                          {key === 'tweets' && '🐦 Tweets & Threads'}
                          {key === 'discussions' && '💬 HN & Discussions'}
                        </label>
                        <span className="text-sm font-semibold text-foreground">{sourcePreferences[key]}</span>
                      </div>
                      {editingSection === 'contentPreferences' ? (
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value={sourcePreferences[key]}
                          onChange={(e) => updateSlider(key, parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-foreground"
                        />
                      ) : (
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground rounded-full transition-all"
                            style={{ width: `${(sourcePreferences[key] / 10) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Content Depth */}
                  <div className="pt-6 border-t border-gray-100">
                    <label className="block text-sm font-medium text-secondary mb-4">
                      Content Depth <span className="text-secondary/50 text-xs font-normal ml-2">(optional)</span>
                    </label>
                    {editingSection === 'contentPreferences' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { id: 'quick', label: '⚡ Quick Reads' },
                          { id: 'deep', label: '📚 Deep Dives' },
                          { id: 'surprise', label: '🎁 Surprise Me' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setContentDepth(opt.id as 'quick' | 'deep' | 'surprise')}
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${contentDepth === opt.id
                                ? 'bg-foreground text-background'
                                : 'bg-gray-100 text-secondary hover:bg-gray-200'
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base text-slate-600 py-2">
                        {contentDepth === 'quick' ? '⚡ Quick Reads'
                          : contentDepth === 'deep' ? '📚 Deep Dives'
                            : contentDepth === 'surprise' ? '🎁 Surprise Me'
                              : 'Not set'}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Newsletter Settings */}
              {profile?.onboarded && ['trial', 'active'].includes(profile?.subscriptionStatus || '') && (
                <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-6 flex items-center gap-2">
                    <Mail size={14} className="text-foreground" />
                    Daily Newsletter
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Receive daily newsletter</p>
                        <p className="text-xs text-secondary/70 mt-1">
                          Get your personalized feed delivered to your inbox at 10:00 AM IST
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const newValue = !newsletterOptIn;
                          setNewsletterOptIn(newValue);
                          // Auto-save newsletter preference
                          if (user) {
                            try {
                              await updateUserProfile(user.uid, { newsletterOptIn: newValue });
                              setSaveMessage('Saved!');
                              setTimeout(() => setSaveMessage(''), 2000);
                            } catch (error) {
                              console.error('Error saving newsletter preference:', error);
                              setNewsletterOptIn(!newValue); // Revert on error
                            }
                          }
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                          newsletterOptIn
                            ? 'bg-foreground'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                            newsletterOptIn ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-secondary/60">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Newsletter delivery time: 10:00 AM IST daily</span>
                      </div>
                      <p className="text-xs text-secondary/50 mt-2">
                        Your newsletter includes up to 8 hand-picked articles summarized by AI, curated based on your interests.
                      </p>
                    </div>
                  </div>
                </section>
              )}

            

              {/* AI Insights */}
              {profile?.insights && Object.keys(profile.insights).some(k => {
                const value = profile.insights?.[k as keyof typeof profile.insights];
                return Array.isArray(value) ? value.length > 0 : !!value;
              }) && (
                  <section className="border border-border p-6 md:p-8">
                    <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6 flex items-center gap-2">
                      <Sparkles size={12} className="text-primary" />
                      AI-Gathered Insights
                    </h2>

                    <div className="grid gap-4">
                      {profile.insights.currentProjects && profile.insights.currentProjects.length > 0 && (
                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-widest text-secondary mb-2 block">Current Projects</label>
                          <div className="flex flex-wrap gap-2">
                            {profile.insights.currentProjects.map((p, i) => (
                              <span key={i} className="px-3 py-1 bg-border text-sm font-mono">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.insights.goals && profile.insights.goals.length > 0 && (
                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-widest text-secondary mb-2 block">Goals</label>
                          <div className="flex flex-wrap gap-2">
                            {profile.insights.goals.map((g, i) => (
                              <span key={i} className="px-3 py-1 bg-border text-sm font-mono">{g}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {profile.insights.additionalContext && (
                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-widest text-secondary mb-2 block">Additional Context</label>
                          <p className="text-sm font-mono text-secondary">{profile.insights.additionalContext}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
