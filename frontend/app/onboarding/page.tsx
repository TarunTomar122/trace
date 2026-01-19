"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Check, MessageCircle, Sparkles, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, completeOnboarding, getUserProfile, addChatMessage } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';

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
  const { user, loading } = useAuth();
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
  
  // Step 2: Interests & Hobbies
  const [interestsText, setInterestsText] = useState('');
  const [hobbiesText, setHobbiesText] = useState('');
  const [projectsText, setProjectsText] = useState('');
  const [favoriteSourcesText, setFavoriteSourcesText] = useState('');
  
  // Step 3: Skills & Dislikes
  const [skillsText, setSkillsText] = useState('');
  const [dislikedTopicsText, setDislikedTopicsText] = useState('');
  const [goalsShortTerm, setGoalsShortTerm] = useState('');
  const [goalsLongTerm, setGoalsLongTerm] = useState('');
  const [learningStyle, setLearningStyle] = useState('');
  const [attentionConstraints, setAttentionConstraints] = useState('');
  const [motivationTriggersText, setMotivationTriggersText] = useState('');
  const [personalityTraitsText, setPersonalityTraitsText] = useState('');
  const [petPeevesText, setPetPeevesText] = useState('');
  
  // Step 4: Content Preferences (0-10 scale, will be normalized to percentages)
  const [sourcePreferences, setSourcePreferences] = useState({
    youtube: 6,
    articles: 7,
    papers: 2,
    repos: 5,
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
  const parseCommaSeparated = (text: string): string[] => {
    return text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  // Slider helper
  const updateSlider = (key: keyof typeof sourcePreferences, value: number) => {
    setSourcePreferences(prev => ({ ...prev, [key]: value }));
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
            interests: parseCommaSeparated(interestsText), 
            hobbies: parseCommaSeparated(hobbiesText), 
            skills: parseCommaSeparated(skillsText), 
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
    if (step === 2) return parseCommaSeparated(interestsText).length >= 2;
    if (step === 3) return parseCommaSeparated(skillsText).length >= 1;
    if (step === 4) return true;
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const onboardingData: Parameters<typeof completeOnboarding>[1] = {
        name: name.trim(),
        role,
        interests: parseCommaSeparated(interestsText),
        hobbies: parseCommaSeparated(hobbiesText),
        skills: parseCommaSeparated(skillsText),
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
        onboardingData.currentWork = {
          project: currentWorkProject.trim() || undefined,
          focus: currentWorkFocus.trim() || undefined,
        };
      }
      const parsedProjects = parseCommaSeparated(projectsText);
      if (parsedProjects.length > 0) {
        onboardingData.projects = parsedProjects;
      }
      if (goalsShortTerm.trim() || goalsLongTerm.trim()) {
        onboardingData.goals = {
          shortTerm: goalsShortTerm.trim() || undefined,
          longTerm: goalsLongTerm.trim() || undefined,
        };
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
        onboardingData.contentPreferences = {
          likes: contentLikes.length > 0 ? contentLikes : undefined,
          dislikes: contentDislikes.length > 0 ? contentDislikes : undefined,
        };
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
      
      // Redirect to profile subscription tab to start subscription
      if (isAlphaMode()) {
        router.push('/profile?tab=subscription');
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
    
    if (step < 4) {
      setStep(step + 1);
    } else if (step === 4) {
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
          initial={{ width: '25%' }}
          animate={{ width: `${(step / 4) * 100}%` }}
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
            Step {step} of 4
          </p>
          <p className="text-xs text-secondary/60 mt-2 max-w-md mx-auto font-mono">
            🔒 Your data stays private and powers your personalized feed
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

                <div>
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
                </div>
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
                {/* Interests */}
                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      What are you interested in? <span className="text-primary">(minimum 2)</span>
                      <HelpTooltip content="These create your content 'umbrellas' - Trace searches for articles, videos, repos, and discussions matching each interest daily" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    💡 These drive 70% of your feed content
                  </p>
                  
                  <textarea
                    value={interestsText}
                    onChange={(e) => setInterestsText(e.target.value)}
                    placeholder="React performance, fintech APIs, product teardowns, typography"
                    rows={3}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                  <p className="text-xs text-secondary/60 mt-2 font-mono">
                    Separate with commas • {parseCommaSeparated(interestsText).length} added
                  </p>
                </div>

                {/* Hobbies */}
                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Hobbies <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                      <HelpTooltip content="Balances your professional feed with personal interests - helps you discover content outside your work bubble" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    ✨ We&apos;ll sprinkle in some fun content (~20%)
                  </p>
                  
                  <textarea
                    value={hobbiesText}
                    onChange={(e) => setHobbiesText(e.target.value)}
                    placeholder="marathon training, sourdough baking, film photography, ceramics"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                  {hobbiesText.trim() && (
                    <p className="text-xs text-secondary/60 mt-2 font-mono">
                      {parseCommaSeparated(hobbiesText).length} added
                    </p>
                  )}
                </div>

                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Projects <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                      <HelpTooltip content="Helps us find case studies, technical deep-dives, and tools specific to what you're actively building" />
                    </label>
                  </div>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    🧩 Comma-separated list of things you&apos;re building
                  </p>
                  <textarea
                    value={projectsText}
                    onChange={(e) => setProjectsText(e.target.value)}
                    placeholder="building a fintech app, redesigning checkout flows, crypto analytics tool"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
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
                    🎯 Helps us calibrate content difficulty
                  </p>
                  
                  <textarea
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="TypeScript, Figma, financial modeling, user interviews"
                    rows={3}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                  <p className="text-xs text-secondary/60 mt-2 font-mono">
                    Separate with commas • {parseCommaSeparated(skillsText).length} added
                  </p>
                </div>

                {/* Disliked Topics */}
             

                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Short-term goals <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                      <HelpTooltip content="Surfaces content aligned with your immediate objectives - like promotion prep, product launches, or skill acquisition" />
                    </label>
                  </div>
                  <textarea
                    value={goalsShortTerm}
                    onChange={(e) => setGoalsShortTerm(e.target.value)}
                    placeholder="Ship my side project, get promoted, learn system design"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

              

               

              </div>
            </motion.div>
          )}

          {/* Step 4: Content Preferences */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase mb-3">
                  Content <span className="text-secondary/40">Mix</span>
                </h1>
                <p className="text-secondary font-mono text-sm">
                  Fine-tune your content sources
                </p>
              </div>

              <div className="space-y-6">
                <div className="relative mb-6 text-center">
                  <p className="text-sm text-secondary/80 font-mono inline-flex items-center gap-2 flex-wrap justify-center">
                    🎚️ Rate your preference for each content type (0 = skip, 10 = love it)
                    <HelpTooltip content="Set your preference level for each content type - we'll automatically balance your feed based on these ratings" />
                  </p>
                </div>

                {/* Sliders */}
                {(Object.keys(sourcePreferences) as Array<keyof typeof sourcePreferences>).map(key => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-mono uppercase tracking-wide text-foreground/80 font-medium">
                        {key === 'youtube' && '📹 YouTube Videos'}
                        {key === 'articles' && '📰 Articles & Blogs'}
                        {key === 'papers' && '📄 Research Papers'}
                        {key === 'repos' && '💻 GitHub Repos'}
                        {key === 'tweets' && '🐦 Tweets & Threads'}
                        {key === 'discussions' && '💬 HN & Discussions'}
                      </label>
                      <span className="text-sm font-mono text-primary font-bold flex items-center gap-2">
                        <span className="text-secondary/50 text-xs">Preference:</span>
                        {sourcePreferences[key]}/10
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={sourcePreferences[key]}
                      onChange={(e) => updateSlider(key, parseInt(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-secondary/40 mt-1">
                      <span>Skip</span>
                      <span>Some</span>
                      <span>Love it</span>
                    </div>
                  </div>
                ))}

                {/* Content Depth */}
                <div className="pt-6 border-t border-border">
                  <div className="relative mb-4">
                    <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 font-medium">
                      Content depth <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                      <HelpTooltip content="'Quick' = actionable tips & tutorials. 'Deep' = architecture & systems thinking. 'Surprise' = we&apos;ll mix it up!" />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { value: 'quick', label: 'Quick & practical' },
                      { value: 'deep', label: 'Deep dives' },
                      { value: 'surprise', label: 'Surprise me' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setContentDepth(option.value as typeof contentDepth)}
                        className={`px-4 py-4 border text-sm font-mono transition-all ${
                          contentDepth === option.value
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
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
            ) : step === 4 ? (
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
