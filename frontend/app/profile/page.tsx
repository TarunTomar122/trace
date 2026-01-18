"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
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
  Bot
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, updateUserProfile, updateUserInsights, addChatMessage, clearChatHistory, UserProfile, INTERESTS, ROLES, ChatMessage } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'chat'>('profile');
  
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
    
    if (user) {
      getUserProfile(user.uid).then(p => {
        if (p) {
          setProfile(p);
          setName(p.name);
          setRole(p.role);
          setCompany(p.company || '');
          setLocation(p.location || '');
          setExperienceYears(p.experienceYears !== undefined && p.experienceYears !== null ? String(p.experienceYears) : '');
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
          setSelectedInterests(p.interests);
          setContentDepth(p.contentDepth);
          // Load chat history
          if (p.chatHistory) {
            setChatMessages(p.chatHistory.map(m => ({ role: m.role, content: m.content })));
          }
        }
      });
    }
  }, [user, loading, router]);

  const parseCommaSeparated = (text: string): string[] => {
    return text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
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
      const customId = `custom-${customInterest.toLowerCase().replace(/\s+/g, '-')}`;
      if (!selectedInterests.includes(customId)) {
        setSelectedInterests([...selectedInterests, customId]);
      }
      setCustomInterest('');
      setShowCustomInput(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    
    setIsSaving(true);
    try {
      const parsedExperienceYears = experienceYears.trim() ? Number(experienceYears) : null;
      const parsedProjects = parseCommaSeparated(projectsText);
      const parsedMotivationTriggers = parseCommaSeparated(motivationTriggersText);
      const parsedContentLikes = parseCommaSeparated(contentLikesText);
      const parsedContentDislikes = parseCommaSeparated(contentDislikesText);
      const parsedFavoriteSources = parseCommaSeparated(favoriteSourcesText);
      const parsedPersonalityTraits = parseCommaSeparated(personalityTraitsText);
      const parsedPetPeeves = parseCommaSeparated(petPeevesText);

      // Helper to remove undefined values from an object
      const removeUndefined = (obj: any): any => {
        return Object.fromEntries(
          Object.entries(obj).filter(([_, v]) => v !== undefined)
        );
      };

      const profileUpdate = {
        name,
        role,
        ...(company && { company }),
        ...(location && { location }),
        experienceYears: parsedExperienceYears !== null && !Number.isNaN(parsedExperienceYears) ? parsedExperienceYears : null,
        currentWork: removeUndefined({
          project: currentWorkProject || undefined,
          focus: currentWorkFocus || undefined,
        }),
        projects: parsedProjects,
        goals: removeUndefined({
          shortTerm: goalsShortTerm || undefined,
          longTerm: goalsLongTerm || undefined,
        }),
        ...(learningStyle && { learningStyle }),
        ...(attentionConstraints && { attentionConstraints }),
        motivationTriggers: parsedMotivationTriggers,
        interests: selectedInterests,
        contentDepth,
        contentPreferences: {
          likes: parsedContentLikes,
          dislikes: parsedContentDislikes,
        },
        favoriteSources: parsedFavoriteSources,
        personalityTraits: parsedPersonalityTraits,
        petPeeves: parsedPetPeeves,
      };

      await updateUserProfile(user.uid, profileUpdate);
      
      setProfile({
        ...profile,
        name,
        role,
        company: company || undefined,
        location: location || undefined,
        experienceYears: parsedExperienceYears !== null && !Number.isNaN(parsedExperienceYears) ? parsedExperienceYears : undefined,
        currentWork: {
          project: currentWorkProject || undefined,
          focus: currentWorkFocus || undefined,
        },
        projects: parsedProjects,
        goals: {
          shortTerm: goalsShortTerm || undefined,
          longTerm: goalsLongTerm || undefined,
        },
        learningStyle: learningStyle || undefined,
        attentionConstraints: attentionConstraints || undefined,
        motivationTriggers: parsedMotivationTriggers,
        interests: selectedInterests,
        contentDepth,
        contentPreferences: {
          likes: parsedContentLikes,
          dislikes: parsedContentDislikes,
        },
        favoriteSources: parsedFavoriteSources,
        personalityTraits: parsedPersonalityTraits,
        petPeeves: parsedPetPeeves,
      });
      
      setIsEditing(false);
      setSaveMessage('Changes saved!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage('Error saving changes');
    } finally {
      setIsSaving(false);
    }
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
    <div className="min-h-screen bg-background text-foreground font-serif">
      <Header 
        showBackToFeed 
        onSignOut={handleSignOut}
      />

      <main className="container mx-auto px-4 max-w-4xl py-8 md:py-12">
        {/* Save message toast */}
        <AnimatePresence>
          {saveMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 bg-primary text-primary-foreground text-sm font-mono z-50"
            >
              {saveMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-6">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-border" />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center border-2 border-border">
                <User size={32} className="text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-light">{profile?.name || user.displayName}</h1>
              <p className="text-sm font-mono text-secondary">{user.email}</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border border-border">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-3 text-[10px] font-mono uppercase tracking-widest transition-colors flex items-center gap-2 ${
                activeTab === 'profile' ? 'bg-primary text-primary-foreground' : 'hover:bg-border/50'
              }`}
            >
              <User size={12} />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-6 py-3 text-[10px] font-mono uppercase tracking-widest transition-colors flex items-center gap-2 ${
                activeTab === 'chat' ? 'bg-primary text-primary-foreground' : 'hover:bg-border/50'
              }`}
            >
              <MessageCircle size={12} />
              Tell Me More
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'profile' ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Edit Button */}
              <div className="flex justify-end">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-3 border border-border text-[10px] font-mono uppercase tracking-widest hover:border-primary transition-colors"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-3 border border-border text-[10px] font-mono uppercase tracking-widest hover:border-red-500 hover:text-red-500 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-widest flex items-center gap-2"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Basic Information
                </h2>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">Name</label>
                    {isEditing ? (
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors" />
                    ) : (
                      <p className="text-lg font-serif py-3">{profile?.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">Role</label>
                    {isEditing ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {ROLES.map((r) => (
                          <button key={r} onClick={() => setRole(r)} className={`px-3 py-2 border text-xs font-mono transition-all ${role === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-lg font-serif py-3">{profile?.role}</p>
                    )}
                  </div>

                  <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                    Company <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                    {isEditing ? (
                    <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme, freelancing, stealth startup" className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30" />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.company || 'Not set'}</p>
                    )}
                  </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                    Location <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  {isEditing ? (
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bangalore, India" className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30" />
                  ) : (
                    <p className="text-lg font-serif py-3 text-secondary">{profile?.location || 'Not set'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                    Experience (years) <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  {isEditing ? (
                    <input type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="3" className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30" />
                  ) : (
                    <p className="text-lg font-serif py-3 text-secondary">
                      {profile?.experienceYears !== undefined && profile?.experienceYears !== null ? profile.experienceYears : 'Not set'}
                    </p>
                  )}
                </div>
                </div>
              </section>

              {/* Interests */}
              <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Interests ({selectedInterests.length}/8)
                </h2>

                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest.id);
                    return isEditing ? (
                      <button key={interest.id} onClick={() => toggleInterest(interest.id)} className={`px-3 py-2 border text-sm font-mono transition-all flex items-center gap-2 ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}>
                        <span>{interest.emoji}</span>
                        <span>{interest.label}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    ) : isSelected ? (
                      <span key={interest.id} className="px-3 py-2 border border-primary bg-primary/5 text-sm font-mono flex items-center gap-2">
                        <span>{interest.emoji}</span>
                        <span>{interest.label}</span>
                      </span>
                    ) : null;
                  })}
                  
                  {selectedInterests.filter(i => i.startsWith('custom-') || !INTERESTS.some(interest => interest.id === i)).map(customId => (
                    isEditing ? (
                      <button key={customId} onClick={() => toggleInterest(customId)} className="px-3 py-2 border border-primary bg-primary text-primary-foreground text-sm font-mono transition-all flex items-center gap-2">
                        <span>{customId.startsWith('custom-') ? customId.replace('custom-', '').replace(/-/g, ' ') : customId}</span>
                        <X size={12} />
                      </button>
                    ) : (
                      <span key={customId} className="px-3 py-2 border border-primary bg-primary/5 text-sm font-mono flex items-center gap-2">
                        <span>{customId.startsWith('custom-') ? customId.replace('custom-', '').replace(/-/g, ' ') : customId}</span>
                      </span>
                    )
                  ))}

                  {isEditing && (
                    !showCustomInput ? (
                      <button onClick={() => setShowCustomInput(true)} className="px-3 py-2 border border-dashed border-border hover:border-primary/50 text-sm font-mono transition-all flex items-center gap-2 text-secondary">
                        <Plus size={12} />
                        Add custom
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="text" value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomInterest()} placeholder="Interest" autoFocus className="px-3 py-2 border border-primary bg-transparent text-sm font-mono outline-none w-28" />
                        <button onClick={addCustomInterest} className="p-2 border border-primary bg-primary text-primary-foreground"><Check size={12} /></button>
                        <button onClick={() => { setShowCustomInput(false); setCustomInterest(''); }} className="p-2 border border-border"><X size={12} /></button>
                      </div>
                    )
                  )}
                </div>
              </section>

              {/* Work & Goals */}
              <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Work & Goals
                </h2>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Current project <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={currentWorkProject}
                        onChange={(e) => setCurrentWorkProject(e.target.value)}
                        placeholder="Design system revamp, creator newsletter"
                        className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.currentWork?.project || 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Current focus <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={currentWorkFocus}
                        onChange={(e) => setCurrentWorkFocus(e.target.value)}
                        placeholder="Improve onboarding, boost retention"
                        className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.currentWork?.focus || 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Projects <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
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

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Short-term goals <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={goalsShortTerm}
                        onChange={(e) => setGoalsShortTerm(e.target.value)}
                        placeholder="Ship MVP, learn TypeScript"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.goals?.shortTerm || 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Long-term goals <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={goalsLongTerm}
                        onChange={(e) => setGoalsLongTerm(e.target.value)}
                        placeholder="Lead a team, start a company"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.goals?.longTerm || 'Not set'}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Learning & Motivation */}
              <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Learning & Motivation
                </h2>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Learning style <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={learningStyle}
                        onChange={(e) => setLearningStyle(e.target.value)}
                        placeholder="Visual examples > long text"
                        className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.learningStyle || 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Attention constraints <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={attentionConstraints}
                        onChange={(e) => setAttentionConstraints(e.target.value)}
                        placeholder="Low tolerance for long content"
                        className="w-full bg-transparent border-b-2 border-border py-3 text-lg font-serif outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.attentionConstraints || 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Motivation triggers <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={motivationTriggersText}
                        onChange={(e) => setMotivationTriggersText(e.target.value)}
                        placeholder="Strong hooks, clear ROI, aesthetics"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.motivationTriggers?.length ? profile.motivationTriggers.join(', ') : 'Not set'}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Content Preferences */}
              <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Content Preferences
                </h2>

                <div className="max-w-md">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Content Depth <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        {[
                          { id: 'quick', label: '⚡ Quick Reads' },
                          { id: 'deep', label: '📚 Deep Dives' },
                          { id: 'surprise', label: '🎁 Surprise Me' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setContentDepth(opt.id as 'quick' | 'deep' | 'surprise')}
                            className={`px-3 py-2 border text-xs font-mono text-left transition-all ${
                              contentDepth === opt.id 
                                ? 'border-primary bg-primary text-primary-foreground' 
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-mono py-2">
                        {contentDepth === 'quick' ? '⚡ Quick Reads' 
                          : contentDepth === 'deep' ? '📚 Deep Dives' 
                          : '🎁 Surprise Me'}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Taste Signals */}
              <section className="border border-border p-6 md:p-8">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-6">
                  Taste Signals
                </h2>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Content you love <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={contentLikesText}
                        onChange={(e) => setContentLikesText(e.target.value)}
                        placeholder="Case studies, breakdowns, data-driven takes"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.contentPreferences?.likes?.length ? profile.contentPreferences.likes.join(', ') : 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Content you dislike <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={contentDislikesText}
                        onChange={(e) => setContentDislikesText(e.target.value)}
                        placeholder="Fluffy hype, low context, clickbait"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.contentPreferences?.dislikes?.length ? profile.contentPreferences.dislikes.join(', ') : 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Favorite sources <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={favoriteSourcesText}
                        onChange={(e) => setFavoriteSourcesText(e.target.value)}
                        placeholder="Stratechery, Lenny's, Ali Abdaal"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.favoriteSources?.length ? profile.favoriteSources.join(', ') : 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Personality traits <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={personalityTraitsText}
                        onChange={(e) => setPersonalityTraitsText(e.target.value)}
                        placeholder="Curious, detail-oriented, impatient"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.personalityTraits?.length ? profile.personalityTraits.join(', ') : 'Not set'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-secondary mb-2">
                      Pet peeves <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                    </label>
                    {isEditing ? (
                      <textarea
                        value={petPeevesText}
                        onChange={(e) => setPetPeevesText(e.target.value)}
                        placeholder="Clickbait without value, corporate fluff"
                        rows={2}
                        className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                      />
                    ) : (
                      <p className="text-lg font-serif py-3 text-secondary">{profile?.petPeeves?.length ? profile.petPeeves.join(', ') : 'Not set'}</p>
                    )}
                  </div>
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
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="border border-border"
            >
              {/* Chat Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                      <Bot size={20} />
                    </div>
                    <div>
                      <h2 className="font-serif font-bold">Trace</h2>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-secondary">
                        Profile Assistant
                      </p>
                    </div>
                  </div>
                  {chatMessages.length > 0 && (
                    <button
                      onClick={async () => {
                        if (user) {
                          await clearChatHistory(user.uid);
                          setChatMessages([]);
                          startChat();
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 border border-border hover:border-red-500 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={12} />
                      New Chat
                    </button>
                  )}
                </div>
                <p className="mt-4 text-sm font-mono text-secondary">
                  Chat with me to help personalize your feed even more. The more I know about you, the better your recommendations get!
                </p>
              </div>

              {/* Chat Messages */}
              <div className="h-[400px] overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-4 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-border'
                    }`}>
                      <p className="text-sm font-mono whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
                
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-border p-4">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type your message..."
                    disabled={isChatLoading}
                    className="flex-1 bg-transparent border border-border px-4 py-3 text-sm font-mono outline-none focus:border-primary transition-colors placeholder:text-secondary/50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="px-6 py-3 bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
