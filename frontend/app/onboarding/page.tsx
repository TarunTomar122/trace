"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Check, MessageCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, completeOnboarding, getUserProfile, addChatMessage } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';

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
  
  // Step 4: Content Preferences
  const [sourcePreferences, setSourcePreferences] = useState({
    youtube: 30,
    articles: 25,
    papers: 10,
    repos: 15,
    tweets: 10,
    discussions: 10,
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
    if (step === 5) return true; // Chat is optional
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
      
      // Redirect based on alpha mode
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
    
    if (step < 5) {
      setStep(step + 1);
    } else if (step === 5) {
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
          initial={{ width: '20%' }}
          animate={{ width: `${(step / 5) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="container mx-auto px-4 max-w-3xl py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-lg text-foreground uppercase flex items-center justify-center gap-3 tracking-[0.15em] font-serif font-black mb-6">
            <div className="flex flex-col gap-1">
              <div className="w-5 h-[2px] bg-primary"></div>
              <div className="w-6 h-[2px] bg-primary/30"></div>
            </div>
            TRACE
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary">
            Step {step} of 5
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
                  Let'ss get to know you a bit
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
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    What do you do?
                  </label>
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
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    Company / Context <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Where you work or what you're working on"
                    className="w-full bg-transparent border-b-2 border-border py-4 text-lg font-serif text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    Location <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, country"
                    className="w-full bg-transparent border-b-2 border-border py-4 text-lg font-serif text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    Years of experience <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full bg-transparent border-b-2 border-border py-4 text-lg font-serif text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    Current work / project <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={currentWorkProject}
                    onChange={(e) => setCurrentWorkProject(e.target.value)}
                    placeholder="What are you working on right now?"
                    className="w-full bg-transparent border-b-2 border-border py-4 text-lg font-serif text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-foreground/70 mb-3 font-medium">
                    Current focus <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
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
                  Help us curate content you'sll love
                </p>
              </div>

              <div className="space-y-8">
                {/* Interests */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    What are you interested in? <span className="text-primary">(min 2)</span>
                  </label>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    💡 These drive 70% of your feed content
                  </p>
                  
                  <textarea
                    value={interestsText}
                    onChange={(e) => setInterestsText(e.target.value)}
                    placeholder="AI, design systems, frontend engineering, performance"
                    rows={3}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                  <p className="text-xs text-secondary/60 mt-2 font-mono">
                    Separate with commas • {parseCommaSeparated(interestsText).length} added
                  </p>
                </div>

                {/* Hobbies */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Hobbies <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    ✨ We'sll sprinkle in some fun content (~20%)
                  </p>
                  
                  <textarea
                    value={hobbiesText}
                    onChange={(e) => setHobbiesText(e.target.value)}
                    placeholder="photography, cooking, running, painting"
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
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Projects <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    🧩 Comma-separated list of things you're building
                  </p>
                  <textarea
                    value={projectsText}
                    onChange={(e) => setProjectsText(e.target.value)}
                    placeholder="portfolio site, side project, newsletter"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Favorite sources <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    ⭐ Channels, blogs, newsletters, or communities you love
                  </p>
                  <textarea
                    value={favoriteSourcesText}
                    onChange={(e) => setFavoriteSourcesText(e.target.value)}
                    placeholder="Stratechery, Lenny's Newsletter, a YouTube channel"
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
                  Skills <span className="text-secondary/40">&</span> Dislikes
                </h1>
                <p className="text-secondary font-mono text-sm">
                  Help us match content to your level
                </p>
              </div>

              <div className="space-y-8">
                {/* Skills */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Your skills <span className="text-primary">(min 1)</span>
                  </label>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    🎯 Helps us calibrate content difficulty
                  </p>
                  
                  <textarea
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="React, Python, UX research, Figma"
                    rows={3}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                  <p className="text-xs text-secondary/60 mt-2 font-mono">
                    Separate with commas • {parseCommaSeparated(skillsText).length} added
                  </p>
                </div>

                {/* Disliked Topics */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Topics to avoid <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <p className="text-xs text-secondary/70 mb-4 font-mono">
                    🚫 We'sll filter these out completely
                  </p>
                  
                  <textarea
                    value={dislikedTopicsText}
                    onChange={(e) => setDislikedTopicsText(e.target.value)}
                    placeholder="crypto, blockchain, NFTs"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                  {dislikedTopicsText.trim() && (
                    <p className="text-xs text-secondary/60 mt-2 font-mono">
                      {parseCommaSeparated(dislikedTopicsText).length} topics to filter
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Short-term goals <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={goalsShortTerm}
                    onChange={(e) => setGoalsShortTerm(e.target.value)}
                    placeholder="What are you trying to achieve in the next few months?"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Long-term goals <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={goalsLongTerm}
                    onChange={(e) => setGoalsLongTerm(e.target.value)}
                    placeholder="Where do you want to be in a year or two?"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Learning style <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={learningStyle}
                    onChange={(e) => setLearningStyle(e.target.value)}
                    placeholder="e.g., visual examples > long text"
                    className="w-full bg-transparent border-b-2 border-border py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Attention constraints <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={attentionConstraints}
                    onChange={(e) => setAttentionConstraints(e.target.value)}
                    placeholder="e.g., low tolerance for long content"
                    className="w-full bg-transparent border-b-2 border-border py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Motivation triggers <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={motivationTriggersText}
                    onChange={(e) => setMotivationTriggersText(e.target.value)}
                    placeholder="strong hooks, clear ROI, aesthetics"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Personality traits <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={personalityTraitsText}
                    onChange={(e) => setPersonalityTraitsText(e.target.value)}
                    placeholder="curious, detail-oriented, impatient with fluff"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Pet peeves <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={petPeevesText}
                    onChange={(e) => setPetPeevesText(e.target.value)}
                    placeholder="clickbait without value, overly corporate content"
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
                <p className="text-sm text-secondary/80 mb-6 font-mono text-center">
                  🎚️ Adjust the sliders to set your preferred content mix (total: {Object.values(sourcePreferences).reduce((a, b) => a + b, 0)}%)
                </p>

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
                      <span className="text-sm font-mono text-primary font-bold">{sourcePreferences[key]}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sourcePreferences[key]}
                      onChange={(e) => updateSlider(key, parseInt(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                ))}

                {/* Content Depth */}
                <div className="pt-6 border-t border-border">
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-4 font-medium">
                    Content depth <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
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

                <div className="pt-6 border-t border-border">
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Content you love <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={contentLikesText}
                    onChange={(e) => setContentLikesText(e.target.value)}
                    placeholder="case studies, product breakdowns, data-driven takes"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>

                <div className="pt-4">
                  <label className="block text-sm font-mono uppercase tracking-wider text-foreground/80 mb-2 font-medium">
                    Content you dislike <span className="text-secondary/50 text-[9px] normal-case tracking-normal ml-2">(optional)</span>
                  </label>
                  <textarea
                    value={contentDislikesText}
                    onChange={(e) => setContentDislikesText(e.target.value)}
                    placeholder="fluffy hype, overly long content, low context"
                    rows={2}
                    className="w-full bg-transparent border-2 border-border px-4 py-3 text-base font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Optional Chat */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase mb-3 flex items-center justify-center gap-3">
                  <MessageCircle className="text-primary" size={40} />
                  Chat <span className="text-secondary/40">with</span> Trace
                </h1>
                <p className="text-secondary font-mono text-sm">
                  Let'ss have a quick conversation (100% optional)
                </p>
                <p className="text-xs text-secondary/60 mt-3 max-w-xl mx-auto font-mono">
                  💬 I can learn more about your projects, goals, and preferences through natural conversation. Skip if you prefer!
                </p>
              </div>

              {!skipChat ? (
                <div className="border border-border p-6 min-h-[400px] flex flex-col">
                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center text-secondary/60 font-mono text-sm py-12">
                        <Sparkles className="mx-auto mb-3 text-primary" size={24} />
                        Start the conversation by typing below...
                      </div>
                    )}
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 text-sm font-mono ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground ml-8'
                            : 'bg-secondary/10 mr-8'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="p-3 text-sm font-mono bg-secondary/10 mr-8">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat input */}
                  <div className="flex gap-2 border-t border-border pt-4">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && sendChatMessage()}
                      placeholder="Type your message..."
                      disabled={isChatLoading}
                      className="flex-1 bg-transparent border border-border px-4 py-3 text-sm font-mono text-foreground outline-none focus:border-primary transition-colors placeholder:text-secondary/30 disabled:opacity-50"
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="px-6 py-3 bg-primary text-primary-foreground text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed hover:tracking-wider transition-all"
                    >
                      Send
                    </button>
                  </div>

                  <button
                    onClick={() => setSkipChat(true)}
                    className="mt-4 text-xs font-mono text-secondary/60 hover:text-secondary transition-colors text-center w-full"
                  >
                    Skip this step →
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Check className="mx-auto mb-4 text-primary" size={48} />
                  <p className="text-secondary font-mono text-sm">
                    No problem! You can always chat with me later from your profile.
                  </p>
                  <button
                    onClick={() => setSkipChat(false)}
                    className="mt-4 text-xs font-mono text-primary hover:underline"
                  >
                    Actually, let'ss chat
                  </button>
                </div>
              )}
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
            ) : step === 5 ? (
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
