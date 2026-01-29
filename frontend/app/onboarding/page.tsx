"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Check, MessageCircle, Sparkles, HelpCircle, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, INTERESTS, completeOnboarding, getUserProfile, addChatMessage } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';

// Suggested hobbies for pills
const HOBBY_SUGGESTIONS = [
  { id: 'running', label: 'Running' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'pottery', label: 'Pottery' },
  { id: 'sketching', label: 'Sketching' },
  { id: 'photography', label: 'Photography' },
  { id: 'music', label: 'Music' },
  { id: 'reading', label: 'Reading' },
  { id: 'fitness', label: 'Fitness' },
];

// Suggested skills for pills
const SKILL_SUGGESTIONS = [
  { id: 'software-engineering', label: 'Software Engineering' },
  { id: 'ai-engineer', label: 'AI Engineer' },
  { id: 'ux-designer', label: 'UX Designer' },
  { id: 'quant-researcher', label: 'Quant Researcher' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'trading', label: 'Trading' },
  { id: 'marketing', label: 'Marketing' },
];

// Suggested short-term goals for pills
const GOAL_SUGGESTIONS = [
  { id: 'scale-a-startup', label: 'Scale a Startup' },
  { id: 'build-an-online-brand', label: 'Build an Online Brand' },
  { id: 'get-promoted-at-work', label: 'Get Promoted at Work' },
];

// Tooltip component - Desktop: hover popup, Mobile: inline accordion
function HelpTooltip({ content }: { content: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <>
      {/* Tooltip trigger button */}
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        className="inline-block ml-1.5 text-secondary/40 hover:text-primary transition-colors align-middle"
        aria-label="Help"
      >
        <HelpCircle size={14} strokeWidth={1.5} />
      </button>
      
      {/* Desktop: Floating tooltip */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="hidden md:block absolute left-0 top-full mt-2 z-50 w-64 bg-background border border-border p-3 shadow-lg"
          >
            <p className="text-xs font-mono text-secondary leading-relaxed">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mobile: Inline accordion */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden mt-2 mb-1"
          >
            <div className="bg-primary/5 border-l-2 border-primary/30 p-3">
              <p className="text-xs font-mono text-secondary/80 leading-relaxed">{content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data - Step 1: Basics
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [currentWorkProject, setCurrentWorkProject] = useState('');
  const [currentWorkFocus, setCurrentWorkFocus] = useState('');
  
  // Step 2: Interests & Hobbies (pills-based)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [showCustomInterestInput, setShowCustomInterestInput] = useState(false);
  const [customHobby, setCustomHobby] = useState('');
  const [showCustomHobbyInput, setShowCustomHobbyInput] = useState(false);
  const [projectsText, setProjectsText] = useState('');
  const [favoriteSourcesText, setFavoriteSourcesText] = useState('');
  
  // Step 3: Skills & Goals (pills-based)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [showCustomSkillInput, setShowCustomSkillInput] = useState(false);
  const [dislikedTopicsText, setDislikedTopicsText] = useState('');
  const [goalsShortTerm, setGoalsShortTerm] = useState('');
  const [goalsLongTerm, setGoalsLongTerm] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [attentionConstraints, setAttentionConstraints] = useState('');
  const [motivationTriggersText, setMotivationTriggersText] = useState('');
  const [personalityTraitsText, setPersonalityTraitsText] = useState('');
  const [petPeevesText, setPetPeevesText] = useState('');
  
  // Step 4: Content Preferences (0-10 scale, will be normalized to percentages)
  // Defaults: youtube:5, articles:7 = ~30% video, ~42% articles (closer to 30/40 split)
  const [sourcePreferences, setSourcePreferences] = useState({
    youtube: 5,
    articles: 7,
    papers: 2,
    repos: 3,
    tweets: 3,
    discussions: 4,
  });
  const [contentDepth, setContentDepth] = useState<'quick' | 'deep' | 'surprise' | null>(null);
  const [contentLikesText, setContentLikesText] = useState('');
  const [contentDislikesText, setContentDislikesText] = useState('');
  
  // Step 5: Optional Chat
  const [skipChat, setSkipChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInsights, setChatInsights] = useState<Record<string, unknown>>({});

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
    }
    if (user) {
      setName(user.displayName || '');
      // Check if already onboarded
      getUserProfile(user.uid).then(profile => {
        if (profile?.onboarded) {
          if (isAlphaMode()) {
            router.push('/feed');
          } else {
            router.push('/waitlist');
          }
        }
      });
    }
  }, [user, loading, router]);

  // Parse comma-separated strings into arrays
  const parseCommaSeparated = (text: string, maxItems?: number): string[] => {
    const items = text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return typeof maxItems === 'number' ? items.slice(0, maxItems) : items;
  };

  // Slider helper
  const updateSlider = (key: keyof typeof sourcePreferences, value: number) => {
    setSourcePreferences(prev => ({ ...prev, [key]: value }));
  };

  // Toggle functions for pills
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
      setShowCustomInterestInput(false);
    }
  };

  const toggleHobby = (id: string) => {
    if (selectedHobbies.includes(id)) {
      setSelectedHobbies(selectedHobbies.filter(h => h !== id));
    } else if (selectedHobbies.length < 3) {
      setSelectedHobbies([...selectedHobbies, id]);
    }
  };

  const addCustomHobby = () => {
    if (customHobby.trim() && selectedHobbies.length < 3) {
      const customId = customHobby.toLowerCase().trim().replace(/\s+/g, '-');
      if (!selectedHobbies.includes(customId)) {
        setSelectedHobbies([...selectedHobbies, customId]);
      }
      setCustomHobby('');
      setShowCustomHobbyInput(false);
    }
  };

  const toggleSkill = (id: string) => {
    if (selectedSkills.includes(id)) {
      setSelectedSkills(selectedSkills.filter(s => s !== id));
    } else {
      setSelectedSkills([...selectedSkills, id]);
    }
  };

  const addCustomSkill = () => {
    if (customSkill.trim()) {
      const customId = customSkill.toLowerCase().trim().replace(/\s+/g, '-');
      if (!selectedSkills.includes(customId)) {
        setSelectedSkills([...selectedSkills, customId]);
      }
      setCustomSkill('');
      setShowCustomSkillInput(false);
    }
  };

  // Chat functionality
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !user) return;

    const userMessage = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Save to Firestore
      await addChatMessage(user.uid, userMessage);

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          profile: { 
            name, 
            role, 
            company, 
            location,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            currentWork: {
              project: currentWorkProject || undefined,
              focus: currentWorkFocus || undefined,
            },
            projects: parseCommaSeparated(projectsText),
            interests: selectedInterests, 
            hobbies: selectedHobbies, 
            skills: selectedSkills, 
            goals: {
              shortTerm: goalsShortTerm || undefined,
              longTerm: goalsLongTerm || undefined,
            },
            learningStyle: learningStyle || undefined,
            attentionConstraints: attentionConstraints || undefined,
            motivationTriggers: parseCommaSeparated(motivationTriggersText),
            contentPreferences: {
              likes: parseCommaSeparated(contentLikesText),
              dislikes: parseCommaSeparated(contentDislikesText),
            },
            favoriteSources: parseCommaSeparated(favoriteSourcesText),
            personalityTraits: parseCommaSeparated(personalityTraitsText),
            petPeeves: parseCommaSeparated(petPeevesText),
            insights: chatInsights 
          }
        }),
      });

      const data = await response.json();
      const assistantMessage = { role: 'assistant' as const, content: data.message };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      await addChatMessage(user.uid, assistantMessage);

      // Merge insights
      if (data.insights && Object.keys(data.insights).length > 0) {
        setChatInsights((prev) => {
          const prevTyped = prev as Record<string, unknown>;
          const insightsTyped = data.insights as Record<string, unknown>;
          return {
            ...prevTyped,
            ...insightsTyped,
            currentProjects: [...((prevTyped.currentProjects as string[]) || []), ...((insightsTyped.currentProjects as string[]) || [])],
            goals: [...((prevTyped.goals as string[]) || []), ...((insightsTyped.goals as string[]) || [])],
            hobbies: [...((prevTyped.hobbies as string[]) || []), ...((insightsTyped.hobbies as string[]) || [])],
            preferredSources: [...((prevTyped.preferredSources as string[]) || []), ...((insightsTyped.preferredSources as string[]) || [])],
            dislikedTopics: [...((prevTyped.dislikedTopics as string[]) || []), ...((insightsTyped.dislikedTopics as string[]) || [])],
          };
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Validation
  const canProceed = () => {
    if (step === 1) return name.trim() && role;
    if (step === 2) return selectedInterests.length >= 4;
    if (step === 3) return selectedSkills.length >= 1;
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const onboardingData: Parameters<typeof completeOnboarding>[1] = {
        name: name.trim(),
        role,
        interests: selectedInterests,
        hobbies: selectedHobbies,
        skills: selectedSkills,
        dislikedTopics: parseCommaSeparated(dislikedTopicsText),
        sourcePreferences,
        contentDepth,
      };

      // Only add optional fields if they have values
      if (company.trim()) {
        onboardingData.company = company.trim();
      }
      if (location.trim()) {
        onboardingData.location = location.trim();
      }
      if (experienceYears.trim()) {
        const parsedYears = Number(experienceYears);
        if (!Number.isNaN(parsedYears)) {
          onboardingData.experienceYears = parsedYears;
        }
      }
      if (currentWorkProject.trim() || currentWorkFocus.trim()) {
        const currentWork: { project?: string; focus?: string } = {};
        if (currentWorkProject.trim()) currentWork.project = currentWorkProject.trim();
        if (currentWorkFocus.trim()) currentWork.focus = currentWorkFocus.trim();
        onboardingData.currentWork = currentWork;
      }
      const parsedProjects = parseCommaSeparated(projectsText);
      if (parsedProjects.length > 0) {
        onboardingData.projects = parsedProjects;
      }
      if (goalsShortTerm.trim() || goalsLongTerm.trim()) {
        const goals: { shortTerm?: string; longTerm?: string } = {};
        if (goalsShortTerm.trim()) goals.shortTerm = goalsShortTerm.trim();
        if (goalsLongTerm.trim()) goals.longTerm = goalsLongTerm.trim();
        onboardingData.goals = goals;
      }
      if (learningStyle.trim()) {
        onboardingData.learningStyle = learningStyle.trim();
      }
      if (attentionConstraints.trim()) {
        onboardingData.attentionConstraints = attentionConstraints.trim();
      }
      const parsedMotivationTriggers = parseCommaSeparated(motivationTriggersText);
      if (parsedMotivationTriggers.length > 0) {
        onboardingData.motivationTriggers = parsedMotivationTriggers;
      }
      const contentLikes = parseCommaSeparated(contentLikesText);
      const contentDislikes = parseCommaSeparated(contentDislikesText);
      if (contentLikes.length > 0 || contentDislikes.length > 0) {
        const contentPreferences: { likes?: string[]; dislikes?: string[] } = {};
        if (contentLikes.length > 0) contentPreferences.likes = contentLikes;
        if (contentDislikes.length > 0) contentPreferences.dislikes = contentDislikes;
        onboardingData.contentPreferences = contentPreferences;
      }
      const parsedFavoriteSources = parseCommaSeparated(favoriteSourcesText);
      if (parsedFavoriteSources.length > 0) {
        onboardingData.favoriteSources = parsedFavoriteSources;
      }
      const parsedPersonalityTraits = parseCommaSeparated(personalityTraitsText);
      if (parsedPersonalityTraits.length > 0) {
        onboardingData.personalityTraits = parsedPersonalityTraits;
      }
      const parsedPetPeeves = parseCommaSeparated(petPeevesText);
      if (parsedPetPeeves.length > 0) {
        onboardingData.petPeeves = parsedPetPeeves;
      }
      if (Object.keys(chatInsights).length > 0) {
        onboardingData.insights = chatInsights as Record<string, unknown>;
      }
      if (chatMessages.length > 0) {
        onboardingData.chatHistory = chatMessages.map(m => ({ ...m, timestamp: null }));
      }

      await completeOnboarding(user.uid, onboardingData);
      
      // Trigger Python onboarding hook via GitHub Action
      try {
        await fetch('/api/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid }),
        });
      } catch (e) {
        // Don't block redirect if trigger fails - feed will generate in daily batch
        console.warn('Onboard trigger failed:', e);
      }
      
      // Refresh profile to update onboarded status before redirect
      await refreshProfile();
      
      // Redirect to feed after onboarding
      if (isAlphaMode()) {
        router.push('/feed');
      } else {
        router.push('/waitlist');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (!canProceed()) return;
    
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
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
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-border z-50">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: '33.33%' }}
          animate={{ width: `${(step / 3) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="container mx-auto px-4 max-w-3xl py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-lg text-foreground uppercase flex items-center justify-center gap-3 tracking-[0.15em] font-serif font-black mb-6">
            <img 
              src="/trace.png" 
              alt="Trace" 
              className="h-6 md:h-7 w-auto"
            />
            TRACE
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary">
            Step {step} of 3
          </p>
          <p className="text-xs text-secondary/60 mt-2 max-w-md mx-auto font-mono">
            🔒 Your data powers your personalized feed. Read our{' '}
            <a href="/privacy-policy" target="_blank" className="text-primary hover:underline">privacy policy</a>
            {' '}and{' '}
            <a href="/terms" target="_blank" className="text-primary hover:underline">terms</a>
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: The Basics */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase mb-3">
                  The <span className="text-secondary/40">Basics</span>
                </h1>
                <p className="text-secondary font-mono text-sm">
                  Let&apos;s get to know you a bit
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    What should we call you?
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-transparent border-b-2 border-border py-4 text-lg font-serif text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

                <div>
                  <div className="relative mb-3">
                    <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 font-medium">
                      What do you do?
                      <HelpTooltip content="Helps us understand your professional context and match content difficulty to your expertise level" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`px-4 py-3 border text-sm font-mono transition-all ${
                          role === r 
                            ? 'border-primary bg-primary text-primary-foreground' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* <div>
                  <div className="relative mb-3">
                    <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 font-medium">
                      Current focus <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                      <HelpTooltip content="Tells us what you're actively working on so we can surface timely, actionable content that helps you right now" />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={currentWorkFocus}
                    onChange={(e) => setCurrentWorkFocus(e.target.value)}
                    placeholder="What are you trying to improve or learn?"
                    className="w-full bg-transparent border-b-2 border-border py-4 text-lg font-serif text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div> */}
              </div>
            </motion.div>
          )}

          {/* Step 2: Interests & Hobbies */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase mb-3">
                  Interests <span className="text-secondary/40">&</span> Hobbies
                </h1>
                <p className="text-secondary font-mono text-sm">
                  Help us curate content you&apos;ll love
                </p>
              </div>

              <div className="space-y-8">
                {/* Interests - Pills */}
                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      What are you interested in? <span className="text-primary">(minimum 4)</span>
                      <HelpTooltip content="These create your content topics - Trace searches for articles, videos, repos, and discussions matching each interest daily" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    💡 These drive 70% of your feed content • {selectedInterests.length}/8 selected
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {INTERESTS.map((interest) => {
                      const isSelected = selectedInterests.includes(interest.id);
                      return (
                        <button
                          key={interest.id}
                          onClick={() => toggleInterest(interest.id)}
                          className={`px-3 py-2 border text-sm font-mono transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span>{interest.label}</span>
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })}

                    {/* Custom interests that were added */}
                    {selectedInterests
                      .filter(id => !INTERESTS.some(i => i.id === id))
                      .map(customId => (
                        <button
                          key={customId}
                          onClick={() => toggleInterest(customId)}
                          className="px-3 py-2 border border-primary bg-primary text-primary-foreground text-sm font-mono transition-all flex items-center gap-2"
                        >
                          <span>{customId.replace(/-/g, ' ')}</span>
                          <X size={12} />
                        </button>
                      ))}

                    {/* Add custom interest */}
                    {!showCustomInterestInput ? (
                      <button
                        onClick={() => setShowCustomInterestInput(true)}
                        className="px-3 py-2 border border-dashed border-border hover:border-primary/50 text-sm font-mono transition-all flex items-center gap-2 text-secondary"
                      >
                        <Plus size={12} />
                        Add custom
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customInterest}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomInterest()}
                          placeholder="Your interest"
                          autoFocus
                          className="px-3 py-2 border border-primary bg-transparent text-sm font-mono outline-none w-32"
                        />
                        <button onClick={addCustomInterest} className="p-2 border border-primary bg-primary text-primary-foreground">
                          <Check size={12} />
                        </button>
                        <button onClick={() => { setShowCustomInterestInput(false); setCustomInterest(''); }} className="p-2 border border-border">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hobbies - Pills */}
                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Hobbies <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional, max 3)</span>
                      <HelpTooltip content="Balances your professional feed with personal interests - helps you discover content outside your work bubble" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    ✨ We&apos;ll sprinkle in some fun content (~20%) • {selectedHobbies.length}/3 selected
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {HOBBY_SUGGESTIONS.map((hobby) => {
                      const isSelected = selectedHobbies.includes(hobby.id);
                      return (
                        <button
                          key={hobby.id}
                          onClick={() => toggleHobby(hobby.id)}
                          className={`px-3 py-2 border text-sm font-mono transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span>{hobby.label}</span>
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })}

                    {/* Custom hobbies that were added */}
                    {selectedHobbies
                      .filter(id => !HOBBY_SUGGESTIONS.some(h => h.id === id))
                      .map(customId => (
                        <button
                          key={customId}
                          onClick={() => toggleHobby(customId)}
                          className="px-3 py-2 border border-primary bg-primary text-primary-foreground text-sm font-mono transition-all flex items-center gap-2"
                        >
                          <span>{customId.replace(/-/g, ' ')}</span>
                          <X size={12} />
                        </button>
                      ))}

                    {/* Add custom hobby */}
                    {!showCustomHobbyInput ? (
                      <button
                        onClick={() => setShowCustomHobbyInput(true)}
                        className="px-3 py-2 border border-dashed border-border hover:border-primary/50 text-sm font-mono transition-all flex items-center gap-2 text-secondary"
                      >
                        <Plus size={12} />
                        Add custom
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customHobby}
                          onChange={(e) => setCustomHobby(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomHobby()}
                          placeholder="Your hobby"
                          autoFocus
                          className="px-3 py-2 border border-primary bg-transparent text-sm font-mono outline-none w-32"
                        />
                        <button onClick={addCustomHobby} className="p-2 border border-primary bg-primary text-primary-foreground">
                          <Check size={12} />
                        </button>
                        <button onClick={() => { setShowCustomHobbyInput(false); setCustomHobby(''); }} className="p-2 border border-border">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Skills & Dislikes */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase mb-3">
                  Skills <span className="text-secondary/40">&</span> Goals
                </h1>
                <p className="text-secondary font-mono text-sm">
                  Help us match content to your level
                </p>
              </div>

              <div className="space-y-8">
                {/* Skills */}
                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Your skills <span className="text-primary">(minimum 1)</span>
                      <HelpTooltip content="Calibrates content difficulty - experts get architecture deep-dives, beginners get practical tutorials" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    🎯 Helps us calibrate content difficulty • {selectedSkills.length} selected
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {SKILL_SUGGESTIONS.map((skill) => {
                      const isSelected = selectedSkills.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => toggleSkill(skill.id)}
                          className={`px-3 py-2 border text-sm font-mono transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span>{skill.label}</span>
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })}

                    {/* Custom skills that were added */}
                    {selectedSkills
                      .filter(id => !SKILL_SUGGESTIONS.some(s => s.id === id))
                      .map(customId => (
                        <button
                          key={customId}
                          onClick={() => toggleSkill(customId)}
                          className="px-3 py-2 border border-primary bg-primary text-primary-foreground text-sm font-mono transition-all flex items-center gap-2"
                        >
                          <span>{customId.replace(/-/g, ' ')}</span>
                          <X size={12} />
                        </button>
                      ))}

                    {/* Add custom skill */}
                    {!showCustomSkillInput ? (
                      <button
                        onClick={() => setShowCustomSkillInput(true)}
                        className="px-3 py-2 border border-dashed border-border hover:border-primary/50 text-sm font-mono transition-all flex items-center gap-2 text-secondary"
                      >
                        <Plus size={12} />
                        Add custom
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customSkill}
                          onChange={(e) => setCustomSkill(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()}
                          placeholder="Your skill"
                          autoFocus
                          className="px-3 py-2 border border-primary bg-transparent text-sm font-mono outline-none w-32"
                        />
                        <button onClick={addCustomSkill} className="p-2 border border-primary bg-primary text-primary-foreground">
                          <Check size={12} />
                        </button>
                        <button onClick={() => { setShowCustomSkillInput(false); setCustomSkill(''); }} className="p-2 border border-border">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
             

                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Short-term goals <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                      <HelpTooltip content="Surfaces content aligned with your immediate objectives - like promotion prep, product launches, or skill acquisition" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    What are you working towards?
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {GOAL_SUGGESTIONS.map((goal) => {
                      const isSelected = goalsShortTerm.toLowerCase().includes(goal.label.toLowerCase());
                      return (
                        <button
                          key={goal.id}
                          onClick={() => {
                            if (isSelected) {
                              // Remove from goals
                              const regex = new RegExp(goal.label + ',?\\s*', 'gi');
                              setGoalsShortTerm(prev => prev.replace(regex, '').trim().replace(/,\s*$/, ''));
                            } else {
                              // Add to goals
                              setGoalsShortTerm(prev => prev ? `${prev}, ${goal.label}` : goal.label);
                            }
                          }}
                          className={`px-3 py-2 border text-sm font-mono transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span>{goal.label}</span>
                          {isSelected && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                  
                  <input
                    type="text"
                    value={goalsShortTerm}
                    onChange={(e) => setGoalsShortTerm(e.target.value)}
                    placeholder="Or type your own goals..."
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

              

               

              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-12">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className={`flex items-center gap-2 px-6 py-3 text-[10px] font-mono uppercase tracking-[0.25em] transition-all ${
              step === 1 
                ? 'opacity-0 pointer-events-none' 
                : 'text-foreground hover:text-primary'
            }`}
          >
            <ChevronLeft size={14} />
            Back
          </button>

          <button
            onClick={nextStep}
            disabled={!canProceed() || isSubmitting}
            className={`flex items-center gap-2 px-8 py-4 text-[10px] font-mono uppercase tracking-[0.25em] transition-all ${
              canProceed() && !isSubmitting
                ? 'bg-primary text-primary-foreground hover:tracking-[0.4em]'
                : 'bg-border text-secondary cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : step === 3 ? (
              <>
                Start Exploring
                <Check size={14} />
              </>
            ) : (
              <>
                Continue
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
