"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Check,
  Trash2,
  Save,
  Send,
  Sparkles,
  MessageCircle,
  Bot,
  CreditCard,
  PartyPopper,
  Newspaper,
  Zap,
  ArrowRight,
  Clock,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, getUserPatterns, updateUserProfile, updateUserInsights, addChatMessage, clearChatHistory, UserProfile, INTERESTS, INTEREST_SUBTOPICS, ROLES, ChatMessage } from '@/lib/firestore';
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
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);
  const hasLoadedProfile = useRef(false);
  const SKILL_OPTIONS = [
    { id: 'design', label: 'Design' },
    { id: 'writing', label: 'Writing' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'business', label: 'Business' },
    { id: 'software-tech', label: 'Software & Tech' },
    { id: 'data-analytics', label: 'Data & Analytics' },
    { id: 'finance', label: 'Finance' },
    { id: 'education', label: 'Education' },
    { id: 'health-wellness', label: 'Health & Wellness' },
    { id: 'creative-arts', label: 'Creative Arts' },
  ];

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
    setSelectedInterests(loadedInterests.slice(0, 4));
    setSelectedFocus((p.interestQueries as Record<string, string[]>) || {});
    setContentDepth(p.contentDepth);
    setNewsletterOptIn(p.newsletterOptIn !== false);
    setSelectedSkills(p.skills || []);
    setDislikedTopicsText(p.dislikedTopics?.join(', ') || '');
    if (p.sourcePreferences) {
      setSourcePreferences(p.sourcePreferences);
    }
    if (p.chatHistory) {
      setChatMessages(p.chatHistory.map(m => ({ role: m.role, content: m.content })));
    }
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const subscriptionParam = searchParams.get('subscription');
    if (tabParam === 'subscription' || subscriptionParam === 'required' || subscriptionParam === 'success') {
      setActiveTab('subscription');
    }
    if (subscriptionParam === 'success') {
      setShowSubscriptionSuccess(true);
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
  const [selectedFocus, setSelectedFocus] = useState<Record<string, string[]>>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Additional fields from onboarding
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
      if (selectedFocus[id]) {
        const next = { ...selectedFocus };
        delete next[id];
        setSelectedFocus(next);
      }
    } else if (selectedInterests.length < 4) {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const focusInterestCount = Object.values(selectedFocus).filter((list) => list.length > 0).length;

  const toggleSubtopic = (interestId: string, subtopicId: string) => {
    if (!selectedInterests.includes(interestId)) return;
    const current = selectedFocus[interestId] || [];
    const isSelected = current.includes(subtopicId);
    if (!isSelected) {
      const isNewInterest = current.length === 0;
      if (isNewInterest && focusInterestCount >= 4) return;
      if (current.length >= 2) return;
      setSelectedFocus({ ...selectedFocus, [interestId]: [...current, subtopicId] });
      return;
    }
    const nextList = current.filter((id) => id !== subtopicId);
    if (nextList.length === 0) {
      const next = { ...selectedFocus };
      delete next[interestId];
      setSelectedFocus(next);
      return;
    }
    setSelectedFocus({ ...selectedFocus, [interestId]: nextList });
  };

  const toggleSkill = (id: string) => {
    if (selectedSkills.includes(id)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== id));
    } else {
      setSelectedSkills([...selectedSkills, id]);
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
          profileUpdate = { interests: normalizedInterests, interestQueries: selectedFocus };
          localProfileUpdate = { interests: normalizedInterests, interestQueries: selectedFocus };
          break;
        }
        case 'skills': {
          profileUpdate = { skills: selectedSkills };
          localProfileUpdate = { skills: selectedSkills };
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
      if (isOnboarded && ['interests', 'skills', 'goals', 'contentPreferences'].includes(section)) {
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
      setSaveMessage("Saved — updates show in tomorrow's feed.");
      setTimeout(() => setSaveMessage(''), 3500);
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
          setSelectedInterests((profile.interests || []).map(i => i.startsWith('custom-') ? i.replace('custom-', '') : i).slice(0, 4));
          setSelectedFocus((profile.interestQueries as Record<string, string[]>) || {});
          break;
        case 'skills':
          setSelectedSkills(profile.skills || []);
          break;
        case 'contentPreferences':
          if (profile.sourcePreferences) setSourcePreferences(profile.sourcePreferences);
          setContentDepth(profile.contentDepth);
          break;
        case 'newsletter':
          setNewsletterOptIn(profile.newsletterOptIn !== false);
          break;
        case 'goals':
          setGoalsShortTerm(profile.goals?.shortTerm || '');
          break;
        case 'contentPreferences':
          if (profile.sourcePreferences) setSourcePreferences(profile.sourcePreferences);
          setContentDepth(profile.contentDepth);
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
    <div className="min-h-screen bg-background">
      <Header
        showBackToFeed
        onSignOut={handleSignOut}
      />

      {/* Onboarding banner for non-onboarded users */}
      {profile && !profile.onboarded && (
        <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 max-w-4xl py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Tell us what you care about
                  </p>
                  <p className="text-xs text-secondary/70 mt-0.5">
                    Pick your interests so Trace can pull the best content from hundreds of sources for you
                  </p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors shrink-0"
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
              <img src={user.photoURL} alt="Profile" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-gray-200 dark:border-gray-800" />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-gray-800">
                <User size={32} className="text-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">{profile?.name || user.displayName}</h1>
              <p className="text-sm text-secondary mt-1">{user.email}</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 p-1 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'profile'
                  ? 'bg-white dark:bg-gray-950 text-foreground shadow-sm'
                  : 'text-secondary hover:text-foreground'
                }`}
            >
              <User size={16} />
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'subscription'
                  ? 'bg-white dark:bg-gray-950 text-foreground shadow-sm'
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
              className="space-y-6"
            >
              {/* Subscription Success Banner */}
              <AnimatePresence>
                {showSubscriptionSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', duration: 0.6, bounce: 0.3 }}
                    className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950 dark:via-green-950 dark:to-teal-950 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 md:p-8"
                  >
                    {/* Dismiss button */}
                    <button
                      onClick={() => setShowSubscriptionSuccess(false)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                    >
                      <X size={16} />
                    </button>

                    {/* Decorative background circles */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-100/50 dark:bg-emerald-900/50 rounded-full blur-2xl" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-teal-100/50 dark:bg-teal-900/50 rounded-full blur-2xl" />

                    <div className="relative">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                          <PartyPopper size={24} className="text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                            Welcome to Trace Premium!
                          </h3>
                          <p className="text-sm text-emerald-600 dark:text-emerald-300">
                            You&apos;re all set — great choice.
                          </p>
                        </div>
                      </div>

                      {/* What's happening now */}
                      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-xl p-4 md:p-5 mb-4 border border-emerald-100 dark:border-emerald-900">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock size={16} className="text-violet-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">
                              Your personalized feed is being built right now
                            </p>
                            <p className="text-xs text-secondary leading-relaxed">
                              We&apos;re searching across hundreds of sources to find the best content for your interests. This usually takes 5–10 minutes. Head to your feed — it&apos;ll be ready by the time you get there.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* What you unlocked */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                        <div className="flex items-center gap-2.5 bg-white/60 dark:bg-gray-900/60 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                            <Sparkles size={14} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-secondary">Personalized feed</p>
                            <p className="text-[10px] text-secondary">Curated to your interests</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white/60 dark:bg-gray-900/60 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                            <Newspaper size={14} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-secondary">Daily newsletter</p>
                            <p className="text-[10px] text-secondary">In your inbox every morning</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white/60 dark:bg-gray-900/60 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                            <Zap size={14} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-secondary">AI summaries</p>
                            <p className="text-[10px] text-secondary">Read any article in 2 min</p>
                          </div>
                        </div>
                      </div>

                      {/* CTA */}
                      <Link
                        href="/feed"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 dark:bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors active:scale-[0.98]"
                      >
                        Go to your feed
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                <section className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
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
                      Interact with your feed to help Trace learn what matters most to you.
                    </div>
                  )}
                </section>
              )}


              {/* Basic Info */}
              {/* <section className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
                <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-6">
                  Basic Information
                </h2>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Name</label>
                    {isEditing ? (
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                    ) : (
                      <p className="text-base py-3">{profile?.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Role</label>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        {ROLES.map((r) => (
                          <button key={r} onClick={() => setRole(r)} className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${role === r ? 'bg-foreground text-background' : 'bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base py-3 text-secondary">{profile?.role}</p>
                    )}
                  </div>
                </div>
              </section> */}

              {/* Interests + Focus */}
              <section className="pb-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Topics you want more of ({selectedInterests.length}/4)
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'interests' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('interests')} className="px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('interests')} disabled={savingSection === 'interests'} className="px-4 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-accent/90 transition-colors disabled:opacity-50">
                          {savingSection === 'interests' ? <div className="w-3 h-3 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('interests')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest.id);
                    const isMaxed = !isSelected && selectedInterests.length >= 4;
                    return editingSection === 'interests' ? (
                      <button
                        key={interest.id}
                        onClick={() => toggleInterest(interest.id)}
                        disabled={isMaxed}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-foreground/80 hover:border-foreground/40'
                        } ${isMaxed ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span>{interest.label}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    ) : isSelected ? (
                      <span key={interest.id} className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium flex items-center gap-2">
                        <span>{interest.label}</span>
                      </span>
                    ) : null;
                  })}
                </div>

                <div className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                      Focus areas (optional)
                    </h3>
                    <span className="text-xs text-secondary/60">
                      {focusInterestCount}/4 refined
                    </span>
                  </div>
                  <div className="space-y-4">
                    {selectedInterests.map((interestId) => {
                      const interest = INTERESTS.find((i) => i.id === interestId);
                      const subtopics = INTEREST_SUBTOPICS[interestId] || [];
                      if (!interest || subtopics.length === 0) return null;
                      const selectedSubtopics = selectedFocus[interestId] || [];
                      const isFocusFull = selectedSubtopics.length === 0 && focusInterestCount >= 4;
                      return (
                        <div key={interestId} className="space-y-2">
                          <div className="text-xs font-medium text-secondary/70">
                            {interest.label}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subtopics.map((subtopic) => {
                              const isSelected = selectedSubtopics.includes(subtopic.id);
                              const isDisabled =
                                (!isSelected && selectedSubtopics.length >= 2) || isFocusFull;
                              return editingSection === 'interests' ? (
                                <button
                                  key={subtopic.id}
                                  onClick={() => toggleSubtopic(interestId, subtopic.id)}
                                  disabled={isDisabled}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border ${
                                    isSelected
                                      ? 'border-foreground bg-foreground text-background'
                                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-foreground/80 hover:border-foreground/40'
                                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  {subtopic.label}
                                </button>
                              ) : isSelected ? (
                                <span
                                  key={subtopic.id}
                                  className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium flex items-center gap-2"
                                >
                                  {subtopic.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Content preferences */}
              {/* <section className="pb-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Content preferences
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
                      <button onClick={() => setEditingSection('contentPreferences')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div className="space-y-6">
                  {(Object.keys(sourcePreferences) as Array<keyof typeof sourcePreferences>).map(key => (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-secondary">
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

                  <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
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
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                              contentDepth === opt.id
                                ? 'bg-foreground text-background'
                                : 'bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
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
              </section> */}

              {/* Newsletter */}
              {profile?.onboarded && (
                <section className="pb-6 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-6">
                    Daily newsletter
                  </h2>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-secondary">Receive daily newsletter</p>
                      <p className="text-xs text-secondary/70 mt-1">
                        {['trial', 'active'].includes(profile?.subscriptionStatus || '')
                          ? 'Your personalized summary lands at 10:00 AM IST.'
                          : 'A curated digest lands in your inbox every morning.'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newValue = !newsletterOptIn;
                        setNewsletterOptIn(newValue);
                        if (user) {
                          try {
                            await updateUserProfile(user.uid, { newsletterOptIn: newValue });
                          } catch (error) {
                            console.error('Error saving newsletter preference:', error);
                            setNewsletterOptIn(!newValue);
                          }
                        }
                      }}
                      disabled={savingSection === 'newsletter'}
                      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                        newsletterOptIn ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          newsletterOptIn ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </section>
              )}

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
              <section className="pb-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60">
                    Skills
                  </h2>
                  {profile?.onboarded && (
                    editingSection === 'skills' ? (
                      <div className="flex gap-2">
                        <button onClick={() => cancelEditSection('skills')} className="px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-red-500 transition-colors">Cancel</button>
                        <button onClick={() => handleSaveSection('skills')} disabled={savingSection === 'skills'} className="px-4 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-accent/90 transition-colors disabled:opacity-50">
                          {savingSection === 'skills' ? <div className="w-3 h-3 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSection('skills')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Edit</button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill.id);
                    return editingSection === 'skills' ? (
                      <button
                        key={skill.id}
                        onClick={() => toggleSkill(skill.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border ${
                          isSelected
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-foreground/80 hover:border-foreground/40'
                        }`}
                      >
                        <span>{skill.label}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    ) : isSelected ? (
                      <span
                        key={skill.id}
                        className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium flex items-center gap-2"
                      >
                        <span>{skill.label}</span>
                      </span>
                    ) : null;
                  })}
                </div>
              </section>


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

              {/* Feedback link */}
              <div className="text-center pt-4 pb-8 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm text-secondary/70">
                  Got feedback, bugs, or feature requests?{' '}
                  <a
                    href="mailto:trace@example.com?subject=Trace Feedback"
                    className="text-primary hover:underline font-medium"
                  >
                    Let us know
                  </a>
                </p>
              </div>
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
