"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Check, MessageCircle, Sparkles, HelpCircle, Plus, X, Lightbulb, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, INTERESTS, completeOnboarding, getUserProfile, addChatMessage } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import { trackOnboardingStarted, trackOnboardingCompleted } from '@/lib/posthog';

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

// Sample feed items per interest (for real-time preview)
const INTEREST_FEED_SAMPLES: Record<string, { title: string; category: string }[]> = {
  'ai-tools': [
    { title: 'I Spent $28K Testing Every AI Tool for Product Managers', category: 'AI Tools' },
    { title: 'The Best AI Coding Assistants in 2026 Compared', category: 'AI Tools' },
    { title: 'How to Build Your Own AI Agent in 30 Minutes', category: 'AI Tools' },
  ],
  'frontend-performance': [
    { title: 'Core Web Vitals: The Ultimate 2026 Optimization Guide', category: 'Frontend' },
    { title: 'Why Your React App is Slow (And How to Fix It)', category: 'Frontend' },
    { title: 'Edge Computing Changed How I Think About Performance', category: 'Frontend' },
  ],
  'ux-design': [
    { title: 'Top 15 AI Animation Tools for Creators & Professionals', category: 'Design' },
    { title: 'The Psychology Behind Addictive Product Design', category: 'Design' },
    { title: 'Figma Tips That Will 10x Your Design Workflow', category: 'Design' },
  ],
  'finance': [
    { title: 'The Complete Guide to Angel Investing in 2026', category: 'Finance' },
    { title: 'How I Built a $10K/month Dividend Portfolio', category: 'Finance' },
    { title: 'Crypto Market Analysis: What Smart Money is Buying', category: 'Finance' },
  ],
  'writing': [
    { title: 'How I Grew My Newsletter to 50K Subscribers', category: 'Writing' },
    { title: 'The Science of Writing Headlines That Convert', category: 'Writing' },
    { title: 'Why Every Founder Should Write in Public', category: 'Writing' },
  ],
  'startups': [
    { title: 'Five Growth Strategies Every Early-Stage Startup Should Explore', category: 'Startups' },
    { title: 'How We Got Our First 1000 Users Without Paid Ads', category: 'Startups' },
    { title: 'The Fundraising Playbook That Got Us $5M Seed', category: 'Startups' },
  ],
  'indie-dev': [
    { title: 'From Side Project to $20K MRR: A Solo Dev Journey', category: 'Indie Dev' },
    { title: 'The Tech Stack I Use to Ship Fast as a Solo Founder', category: 'Indie Dev' },
    { title: 'Why I Quit My FAANG Job to Build Indie Products', category: 'Indie Dev' },
  ],
  'productivity': [
    { title: '9 Lesser-Known AI Productivity Tools You Wish You Knew', category: 'Productivity' },
    { title: 'The Morning Routine That Doubled My Output', category: 'Productivity' },
    { title: 'How Top Performers Structure Their Deep Work Sessions', category: 'Productivity' },
  ],
  'ux-research': [
    { title: 'User Interview Techniques That Reveal Real Insights', category: 'UX Research' },
    { title: 'How to Run Effective Usability Tests on a Budget', category: 'UX Research' },
    { title: 'Quantitative vs Qualitative: When to Use Which', category: 'UX Research' },
  ],
  'gaming': [
    { title: 'The Economics of Free-to-Play Game Design', category: 'Gaming' },
    { title: 'How Indie Games Are Disrupting AAA Studios', category: 'Gaming' },
    { title: 'Building Immersive Worlds: Lessons from Top Game Designers', category: 'Gaming' },
  ],
};

// Sample feed items per hobby (for real-time preview)
const HOBBY_FEED_SAMPLES: Record<string, { title: string; category: string }[]> = {
  'running': [
    { title: 'How I Went from Couch to Marathon in 12 Months', category: 'Running' },
    { title: 'The Science of Zone 2 Training for Endurance', category: 'Running' },
    { title: 'Best Running Apps and Gear for 2026', category: 'Running' },
  ],
  'cycling': [
    { title: 'Indoor vs Outdoor Cycling: What the Data Says', category: 'Cycling' },
    { title: 'How Pro Cyclists Train in the Off-Season', category: 'Cycling' },
    { title: 'The Best Cycling Routes You Haven\'t Discovered Yet', category: 'Cycling' },
  ],
  'pottery': [
    { title: 'From Beginner to Selling on Etsy: A Potter\'s Journey', category: 'Pottery' },
    { title: 'The Meditative Practice of Throwing Clay', category: 'Pottery' },
    { title: 'Glazing Techniques That Transform Your Work', category: 'Pottery' },
  ],
  'sketching': [
    { title: 'Daily Sketching Habits of Professional Artists', category: 'Sketching' },
    { title: 'How to Develop Your Unique Drawing Style', category: 'Sketching' },
    { title: 'iPad vs Traditional: Which is Better for Sketching?', category: 'Sketching' },
  ],
  'photography': [
    { title: 'Street Photography Tips from National Geographic Shooters', category: 'Photography' },
    { title: 'The Art of Editing: Lightroom Presets That Actually Work', category: 'Photography' },
    { title: 'How to Build a Photography Portfolio That Gets Noticed', category: 'Photography' },
  ],
  'music': [
    { title: 'Home Studio Setup for Under $500', category: 'Music' },
    { title: 'How Top Producers Find Their Sound', category: 'Music' },
    { title: 'The Psychology of Why Certain Songs Get Stuck in Your Head', category: 'Music' },
  ],
  'reading': [
    { title: 'How to Read 50 Books a Year Without Burning Out', category: 'Reading' },
    { title: 'The Best Non-Fiction Books CEOs Are Reading in 2026', category: 'Reading' },
    { title: 'Building a Second Brain Through Strategic Reading', category: 'Reading' },
  ],
  'fitness': [
    { title: 'The Minimum Effective Dose for Strength Training', category: 'Fitness' },
    { title: 'How Sleep Affects Your Gains More Than You Think', category: 'Fitness' },
    { title: 'Nutrition Myths Debunked by Sports Scientists', category: 'Fitness' },
  ],
};

// Default items shown when no interests selected
const DEFAULT_FEED_SAMPLES = [
  { title: 'How AI is Transforming Every Industry in 2026', category: 'AI' },
  { title: 'The Future of Remote Work: What Top Companies Are Doing', category: 'Work' },
  { title: 'Building Products People Actually Want to Use', category: 'Product' },
  { title: 'Why the Best Ideas Come from Diverse Teams', category: 'Culture' },
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
  const [step, setStep] = useState(0);
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

  const hasTrackedOnboardingStart = useRef(false);
  
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
        } else if (!hasTrackedOnboardingStart.current) {
          // Track onboarding started for non-onboarded users
          trackOnboardingStarted();
          hasTrackedOnboardingStart.current = true;
        }
      });
    }
  }, [user, loading, router]);

  // Compute preview feed items based on selected interests and hobbies
  const previewItems = useMemo(() => {
    if (selectedInterests.length === 0 && selectedHobbies.length === 0) {
      return DEFAULT_FEED_SAMPLES;
    }
    
    const items: { title: string; category: string }[] = [];
    let itemIndex = 0;
    
    // Interleave interests and hobbies for variety
    while (items.length < 4 && itemIndex < 12) {
      // Add from interests
      for (const interest of selectedInterests) {
        if (items.length >= 4) break;
        const interestItems = INTEREST_FEED_SAMPLES[interest];
        if (interestItems && interestItems[itemIndex % interestItems.length]) {
          const item = interestItems[itemIndex % interestItems.length];
          if (!items.some(i => i.title === item.title)) {
            items.push(item);
          }
        }
      }
      // Add from hobbies
      for (const hobby of selectedHobbies) {
        if (items.length >= 4) break;
        const hobbyItems = HOBBY_FEED_SAMPLES[hobby];
        if (hobbyItems && hobbyItems[itemIndex % hobbyItems.length]) {
          const item = hobbyItems[itemIndex % hobbyItems.length];
          if (!items.some(i => i.title === item.title)) {
            items.push(item);
          }
        }
      }
      itemIndex++;
    }
    
    return items.length > 0 ? items : DEFAULT_FEED_SAMPLES;
  }, [selectedInterests, selectedHobbies]);

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
    if (step === 0) return selectedInterests.length >= 4 && role;
    if (step === 1) return selectedSkills.length >= 1;
    if (step === 2) return name.trim().length > 0;
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
      
      // Track onboarding completed
      trackOnboardingCompleted({
        interests_count: selectedInterests.length,
        hobbies_count: selectedHobbies.length,
        role: role,
      });
      
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
    
    if (step < 2) {
      setStep(step + 1);
    } else if (step === 2) {
      handleSubmit();
    }
  };

  const startOnboarding = () => {
    setStep(1);
  };

  const skipOnboarding = () => {
    router.push('/feed');
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground onboarding-page">
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-gray-100 z-50">
        <motion.div 
          className="h-full bg-foreground rounded-r-full"
          initial={{ width: '33%' }}
          animate={{ width: `${((step + 1) / 3) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-12 md:py-20">
        <div className="text-center mb-10">
          <div className="text-lg text-foreground uppercase flex items-center justify-center gap-3 tracking-[0.15em] font-semibold mb-6">
            <img 
              src="/trace.png" 
              alt="Trace" 
              className="h-6 md:h-7 w-auto"
            />
            TRACE
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm text-secondary mb-3">
            Step {step + 1} of 3
          </div>
          <p className="text-sm text-secondary/70 mt-3 max-w-md mx-auto">
            🔒 Your data powers your personalized feed. Read our{' '}
            <a href="/privacy-policy" target="_blank" className="text-primary hover:underline">privacy policy</a>
            {' '}and{' '}
            <a href="/terms" target="_blank" className="text-primary hover:underline">terms</a>
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] items-start">
                <div className="space-y-6">
                 
                  <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-2">
                      What are you interested in? <span className="text-primary">(minimum 4)</span>
                    </label>
                    <p className="text-sm text-secondary/70 mb-4">
                      These topics shape your daily feed • {selectedInterests.length}/8 selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map((interest) => {
                        const isSelected = selectedInterests.includes(interest.id);
                        return (
                          <button
                            key={interest.id}
                            onClick={() => toggleInterest(interest.id)}
                            className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-foreground text-background'
                                : 'bg-gray-100 text-secondary hover:bg-gray-200'
                            }`}
                          >
                            <span>{interest.label}</span>
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}

                      {selectedInterests
                        .filter(id => !INTERESTS.some(i => i.id === id))
                        .map(customId => (
                          <button
                            key={customId}
                            onClick={() => toggleInterest(customId)}
                            className="px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <span>{customId.replace(/-/g, ' ')}</span>
                            <X size={14} />
                          </button>
                        ))}

                      {!showCustomInterestInput ? (
                        <button
                          onClick={() => setShowCustomInterestInput(true)}
                          className="px-4 py-2.5 rounded-full border-2 border-dashed border-gray-200 hover:border-gray-300 text-sm font-medium transition-all flex items-center gap-2 text-secondary cursor-pointer"
                        >
                          <Plus size={14} />
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
                            className="px-4 py-2.5 rounded-full border-2 border-foreground bg-transparent text-sm font-medium outline-none w-36"
                          />
                          <button onClick={addCustomInterest} className="p-2.5 rounded-full bg-foreground text-background cursor-pointer">
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setShowCustomInterestInput(false); setCustomInterest(''); }} className="p-2.5 rounded-full bg-gray-100 cursor-pointer">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="relative mb-2">
                      <label className="block text-sm font-medium text-foreground/80">
                        What do you do?
                        <HelpTooltip content="Helps us understand your professional context and match content difficulty to your expertise level" />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRole(r)}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                            role === r 
                              ? 'bg-foreground text-background' 
                              : 'bg-gray-100 text-secondary hover:bg-gray-200'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                </div>

                <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Your feed preview</p>
                  <span className="text-xs text-secondary/60">{(selectedInterests.length > 0 || selectedHobbies.length > 0) ? 'Based on your picks' : 'Sample topics'}</span>
                </div>
                <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    {previewItems.map((item, index) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="p-4"
                      >
                        <p className="text-sm font-medium text-foreground mb-1.5">{item.title}</p>
                        <p className="text-xs text-secondary/70">Trending in {item.category}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <p className="text-sm text-secondary/80 leading-relaxed bg-white rounded-2xl p-6">
                    <Lightbulb size={16} className="text-primary inline-block mr-2" />
                    <span className="text-foreground font-semibold">82% of early users</span> say their feed feels
                    noticeably better after they pick 4+ interests.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: The Basics */}
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
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
                  The <span className="text-secondary/50">Basics</span>
                </h1>
                <p className="text-secondary text-base">
                  Let&apos;s get to know you a bit
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-3">
                    What should we call you?
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Hobbies <span className="text-secondary/50 text-xs ml-2">(optional, max 3)</span>
                  </label>
                  <p className="text-sm text-secondary/70 mb-4">
                    Adds a personal layer to your feed • {selectedHobbies.length}/3 selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {HOBBY_SUGGESTIONS.map((hobby) => {
                      const isSelected = selectedHobbies.includes(hobby.id);
                      return (
                        <button
                          key={hobby.id}
                          onClick={() => toggleHobby(hobby.id)}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-foreground text-background'
                              : 'bg-gray-100 text-secondary hover:bg-gray-200'
                          }`}
                        >
                          <span>{hobby.label}</span>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })}

                    {selectedHobbies
                      .filter(id => !HOBBY_SUGGESTIONS.some(h => h.id === id))
                      .map(customId => (
                        <button
                          key={customId}
                          onClick={() => toggleHobby(customId)}
                          className="px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <span>{customId.replace(/-/g, ' ')}</span>
                          <X size={14} />
                        </button>
                      ))}

                    {!showCustomHobbyInput ? (
                      <button
                        onClick={() => setShowCustomHobbyInput(true)}
                        className="px-4 py-2.5 rounded-full border-2 border-dashed border-gray-200 hover:border-gray-300 text-sm font-medium transition-all flex items-center gap-2 text-secondary cursor-pointer"
                      >
                        <Plus size={14} />
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
                          className="px-4 py-2.5 rounded-full border-2 border-foreground bg-transparent text-sm font-medium outline-none w-36"
                        />
                        <button onClick={addCustomHobby} className="p-2.5 rounded-full bg-foreground text-background cursor-pointer">
                          <Check size={14} />
                        </button>
                        <button onClick={() => { setShowCustomHobbyInput(false); setCustomHobby(''); }} className="p-2.5 rounded-full bg-gray-100 cursor-pointer">
                          <X size={14} />
                        </button>
                      </div>
                    )}
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

          

          {/* Step 1: Skills & Goals */}
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
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
                  Skills <span className="text-secondary/50">&</span> Goals
                </h1>
                <p className="text-secondary text-base">
                  Help us match content to your level
                </p>
              </div>

              <div className="space-y-8">
                {/* Skills */}
                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-medium text-foreground/80">
                      Your skills <span className="text-primary">(minimum 1)</span>
                      <HelpTooltip content="Calibrates content difficulty - experts get architecture deep-dives, beginners get practical tutorials" />
                    </label>
                  </div>
                  <p className="text-sm text-secondary/70 mb-4">
                    🎯 Helps us calibrate content difficulty • {selectedSkills.length} selected
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {SKILL_SUGGESTIONS.map((skill) => {
                      const isSelected = selectedSkills.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => toggleSkill(skill.id)}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-foreground text-background'
                              : 'bg-gray-100 text-secondary hover:bg-gray-200'
                          }`}
                        >
                          <span>{skill.label}</span>
                          {isSelected && <Check size={14} />}
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
                          className="px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium transition-all flex items-center gap-2"
                        >
                          <span>{customId.replace(/-/g, ' ')}</span>
                          <X size={14} />
                        </button>
                      ))}

                    {/* Add custom skill */}
                    {!showCustomSkillInput ? (
                      <button
                        onClick={() => setShowCustomSkillInput(true)}
                        className="px-4 py-2.5 rounded-full border-2 border-dashed border-gray-200 hover:border-gray-300 text-sm font-medium transition-all flex items-center gap-2 text-secondary"
                      >
                        <Plus size={14} />
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
                          className="px-4 py-2.5 rounded-full border-2 border-foreground bg-transparent text-sm font-medium outline-none w-36"
                        />
                        <button onClick={addCustomSkill} className="p-2.5 rounded-full bg-foreground text-background">
                          <Check size={14} />
                        </button>
                        <button onClick={() => { setShowCustomSkillInput(false); setCustomSkill(''); }} className="p-2.5 rounded-full bg-gray-100">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
             

                <div>
                  <div className="relative mb-2">
                    <label className="block text-sm font-medium text-foreground/80">
                      Short-term goals <span className="text-secondary/50 text-xs ml-2">(optional)</span>
                      <HelpTooltip content="Surfaces content aligned with your immediate objectives - like promotion prep, product launches, or skill acquisition" />
                    </label>
                  </div>
                  <p className="text-sm text-secondary/70 mb-4">
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
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-foreground text-background'
                              : 'bg-gray-100 text-secondary hover:bg-gray-200'
                          }`}
                        >
                          <span>{goal.label}</span>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                  
                  <input
                    type="text"
                    value={goalsShortTerm}
                    onChange={(e) => setGoalsShortTerm(e.target.value)}
                    placeholder="Or type your own goals..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40"
                  />
                </div>

              

               

              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <div className="flex justify-between items-center mt-12">
          {step > 0 ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium transition-all text-secondary hover:text-foreground hover:bg-gray-100"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <button
              onClick={skipOnboarding}
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium transition-all text-secondary hover:text-foreground hover:bg-gray-100"
            >
              Skip for now
            </button>
          )}

          <button
            onClick={nextStep}
            disabled={!canProceed() || isSubmitting}
            className={`flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium transition-all ${
              canProceed() && !isSubmitting
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-gray-200 text-secondary cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
