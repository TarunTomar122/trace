"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { completeOnboarding, getUserProfile, INTERESTS, INTEREST_SUBTOPICS } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import { trackOnboardingStarted, trackOnboardingCompleted } from '@/lib/posthog';

type FocusMap = Record<string, string[]>;

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

const MAX_INTERESTS = 4;
const MIN_INTERESTS = 4;
const MAX_SUBTOPICS_PER_INTEREST = 2;
const MAX_FOCUS_INTERESTS = 4;
const TOTAL_STEPS = 3;

const FEED_PREVIEWS: Record<string, { title: string; summary: string }> = {
  technology: {
    title: "AI copilots are becoming the default in every workflow",
    summary: "From coding to docs, teams are shipping faster with practical AI + automation stacks.",
  },
  'business-market': {
    title: "Why product strategy is replacing growth hacks",
    summary: "Operators are shifting from short-term spikes to durable market positioning and retention.",
  },
  experience: {
    title: "Great UX now starts before the first screen",
    summary: "Top product teams are combining storytelling, trust signals, and clear user psychology.",
  },
  productivity: {
    title: "The best teams are optimizing energy, not just time",
    summary: "Career growth, wellbeing, and execution systems are converging into one operating model.",
  },
};

// Subtopic-specific previews that override base interest previews
const SUBTOPIC_PREVIEWS: Record<string, { title: string; summary: string }> = {
  ai: {
    title: "The new AI moat is workflow integration, not model quality",
    summary: "Winners are embedding AI where work already happens instead of shipping standalone chat.",
  },
  automation: {
    title: "Automation is moving from no-code experiments to core operations",
    summary: "Teams now treat automations like product features with owners, monitoring, and iteration.",
  },
  'software-tech': {
    title: "Dev teams are standardizing on leaner, faster software stacks",
    summary: "Fewer tools, better observability, and AI-assisted debugging are driving throughput.",
  },
  'productivity-tools': {
    title: "Tool fatigue is real: bundles are replacing bloated app stacks",
    summary: "Operators want fewer tabs and tighter workflows across docs, tasks, and communication.",
  },
  'future-tech': {
    title: "Ambient AI and interfaces beyond screens are getting real",
    summary: "Voice, agents, and contextual computing are moving from demos into daily use.",
  },
  'product-strategy': {
    title: "Product strategy now starts with sharper wedge positioning",
    summary: "Teams are winning by solving one painful workflow deeply before expanding.",
  },
  'market-trends': {
    title: "AI-native products are reshaping software buying behavior",
    summary: "Budgets are moving to tools that show measurable speed and decision quality gains.",
  },
  'economy-impact': {
    title: "Economic pressure is forcing faster, evidence-based product bets",
    summary: "Leaders are cutting low-signal initiatives and doubling down on defensible execution.",
  },
  startups: {
    title: "Startups are scaling with smaller teams than ever before",
    summary: "AI leverage + tighter focus is changing the old headcount-to-growth playbook.",
  },
  marketing: {
    title: "Distribution is becoming the main product moat",
    summary: "The strongest companies are pairing clear positioning with repeatable audience loops.",
  },
  'creative-process': {
    title: "Creative process is becoming a system, not a mystery",
    summary: "Top teams structure ideation, critique, and iteration like any other core workflow.",
  },
  'design-tools': {
    title: "Design tools are getting smarter and more collaborative",
    summary: "AI-assisted exploration helps teams test more directions without sacrificing craft.",
  },
  'ux-design': {
    title: "UX design is shifting toward measurable behavioral outcomes",
    summary: "Teams are evaluating UX by completion quality, confidence, and long-term retention.",
  },
  'brand-storytelling': {
    title: "Brand storytelling is now product storytelling",
    summary: "The best brands communicate value directly through onboarding and in-product language.",
  },
  'user-psychology': {
    title: "User psychology is the missing layer in most product decisions",
    summary: "Behavioral patterns now inform copy, flows, and feature prioritization.",
  },
  'career-growth': {
    title: "Career growth now rewards leverage over hours worked",
    summary: "People who ship systems and compound impact are advancing fastest.",
  },
  'personal-finance': {
    title: "Personal finance habits are becoming a productivity advantage",
    summary: "Better cash-flow clarity reduces stress and improves long-term decision making.",
  },
  'soft-skills': {
    title: "Soft skills are becoming hard requirements in AI-native teams",
    summary: "Communication, prioritization, and judgment are differentiating top performers.",
  },
  investments: {
    title: "Investments are shifting toward conviction-based portfolios",
    summary: "People are trading impulse bets for frameworks tied to goals and risk tolerance.",
  },
  wellbeing: {
    title: "Wellbeing is now treated as an execution metric",
    summary: "Sustainable output depends on recovery, sleep quality, and attention protection.",
  },
};

// How skills modify the angle of content
const SKILL_ANGLES: Record<string, string> = {
  'design': 'with a design lens',
  'writing': 'for writers',
  'marketing': 'through a marketing lens',
  'business': 'with business implications',
  'software-tech': 'with technical depth',
  'data-analytics': 'backed by data',
  'finance': 'with financial analysis',
  'education': 'with learning insights',
  'health-wellness': 'for wellbeing',
  'creative-arts': 'through a creative lens',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const hasTrackedOnboardingStart = useRef(false);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<FocusMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
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
      getUserProfile(user.uid).then((profile) => {
        if (profile?.onboarded) {
          if (isAlphaMode()) {
            router.push('/feed');
          } else {
            router.push('/waitlist');
          }
        } else if (!hasTrackedOnboardingStart.current) {
          trackOnboardingStarted();
          hasTrackedOnboardingStart.current = true;
        }
      });
    }
  }, [user, loading, router]);

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== id));
      if (selectedFocus[id]) {
        const next = { ...selectedFocus };
        delete next[id];
        setSelectedFocus(next);
      }
    } else if (selectedInterests.length < MAX_INTERESTS) {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const toggleSkill = (id: string) => {
    if (selectedSkills.includes(id)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== id));
    } else {
      setSelectedSkills([...selectedSkills, id]);
    }
  };

  const focusInterestCount = Object.values(selectedFocus).filter((list) => list.length > 0).length;
  const signalScore = Math.min(
    100,
    Math.round(
      (selectedInterests.length / MIN_INTERESTS) * 50
        + focusInterestCount * 12
        + selectedSkills.length * 4
    )
  );
  const signalLabel =
    signalScore >= 80 ? 'Highly targeted' : signalScore >= 55 ? 'Getting specific' : 'Warming up';

  const toggleSubtopic = (interestId: string, subtopicId: string) => {
    if (!selectedInterests.includes(interestId)) return;

    const current = selectedFocus[interestId] || [];
    const isSelected = current.includes(subtopicId);

    if (!isSelected) {
      const isNewInterest = current.length === 0;
      if (isNewInterest && focusInterestCount >= MAX_FOCUS_INTERESTS) return;
      if (current.length >= MAX_SUBTOPICS_PER_INTEREST) return;
      setSelectedFocus({
        ...selectedFocus,
        [interestId]: [...current, subtopicId],
      });
      return;
    }

    const nextList = current.filter((id) => id !== subtopicId);
    if (nextList.length === 0) {
      const next = { ...selectedFocus };
      delete next[interestId];
      setSelectedFocus(next);
      return;
    }
    setSelectedFocus({
      ...selectedFocus,
      [interestId]: nextList,
    });
  };

  const handleNext = () => {
    if (step === 1 && selectedInterests.length < MIN_INTERESTS) return;
    setStep(Math.min(TOTAL_STEPS, step + 1));
  };

  const handleBack = () => {
    setStep(Math.max(1, step - 1));
  };

  const handleComplete = async () => {
    if (!user) return;
    if (selectedInterests.length < MIN_INTERESTS) return;

    setIsSubmitting(true);
    try {
      await completeOnboarding(user.uid, {
        name: user.displayName || '',
        interests: selectedInterests,
        interestQueries: Object.keys(selectedFocus).length ? selectedFocus : undefined,
        skills: selectedSkills,
        sourcePreferences: {
          articles: 7,
          discussions: 4,
          youtube: 5,
          papers: 2,
          repos: 3,
          tweets: 3,
        },
        contentDepth: 'surprise',
        hobbies: [],
        dislikedTopics: [],
      });

      trackOnboardingCompleted({
        interests_count: selectedInterests.length,
        hobbies_count: selectedSkills.length,
      });

      await refreshProfile();

      if (isAlphaMode()) {
        router.push('/profile?tab=subscription&subscription=required');
      } else {
        router.push('/waitlist');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground bg-[radial-gradient(circle_at_top,_#f9f5ff_0%,_#ffffff_45%,_#f6f8ff_100%)] dark:bg-none dark:bg-background">
      <div className="container mx-auto px-4 max-w-5xl py-8 md:py-12">
        <div className="text-center mb-10">
          <div className="text-base text-foreground uppercase flex items-center justify-center gap-2 tracking-[0.15em] font-semibold mb-6">
            <img src="/trace.png" alt="Trace" className="h-5 md:h-6 w-auto" />
            TRACE
          </div>
          <h1
            className="text-2xl md:text-3xl font-semibold mb-2"
            style={{ fontFamily: '"Space Grotesk", "DM Sans", sans-serif' }}
          >
            Tell us what you care about
          </h1>
          <p className="text-sm text-secondary/70 max-w-xl mx-auto">
            We pull from hundreds of sources — pick your topics so we know what to find for you.
          </p>
          
          {/* Signal strength - always visible */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-secondary/60">Feed precision</span>
              <span className={`font-medium ${signalScore >= 80 ? 'text-emerald-600' : signalScore >= 55 ? 'text-amber-600' : 'text-secondary/60'}`}>
                {signalLabel} · {signalScore}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  signalScore >= 80 ? 'bg-emerald-500' : signalScore >= 55 ? 'bg-amber-500' : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(100, signalScore)}%` }}
              />
            </div>
          </div>
        </div>

          <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-8 items-start">
          <div className="space-y-8">
            {step === 1 && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-secondary/60">Step 1</div>
                    <h2 className="text-lg font-semibold">Choose your topics</h2>
                    <p className="text-xs text-secondary/60 mt-1">
                      We&apos;ll scan YouTube, Reddit, HN, blogs, and hundreds more for these topics daily.
                    </p>
                  </div>
                  <div className="text-xs text-secondary/60">
                    {selectedInterests.length}/{MAX_INTERESTS} selected
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest.id);
                    const isMaxed = !isSelected && selectedInterests.length >= MAX_INTERESTS;
                    return (
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
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/80 border border-amber-100 dark:border-amber-900">
                  <span className="text-amber-500 text-sm">💡</span>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                    More topics = more sources we can pull from. Most users pick all 4 for the best feed.
                  </p>
                </div>

                {selectedInterests.length < MIN_INTERESTS && (
                  <p className="text-xs text-red-500">
                    Select at least {MIN_INTERESTS} interests
                  </p>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-secondary/60">Step 2</div>
                    <h2 className="text-lg font-semibold">Get specific (optional)</h2>
                    <p className="text-xs text-secondary/60 mt-1">
                      Narrowing down helps us pull the most relevant content from across the web.
                    </p>
                  </div>
                  <div className="text-xs text-secondary/60">
                    {focusInterestCount}/{MAX_FOCUS_INTERESTS} refined
                  </div>
                </div>
                <div className="space-y-8 mt-2">
                  {selectedInterests.map((interestId, index) => {
                    const interest = INTERESTS.find((i) => i.id === interestId);
                    const subtopics = INTEREST_SUBTOPICS[interestId] || [];
                    if (!interest || subtopics.length === 0) return null;
                    const selectedSubtopics = selectedFocus[interestId] || [];
                    const isFocusFull = selectedSubtopics.length === 0 && focusInterestCount >= MAX_FOCUS_INTERESTS;
                    
                    const prompts = [
                      <>You like <span className="font-semibold text-foreground">{interest.label.toLowerCase()}</span>... what about it interests you the most?</>,
                      <><span className="font-semibold text-foreground">{interest.label}</span> is broad—any angle you&apos;re drawn to?</>,
                      <>Anything specific about <span className="font-semibold text-foreground">{interest.label.toLowerCase()}</span> you want to dive into?</>,
                      <>Last one! What&apos;s your <span className="font-semibold text-foreground">{interest.label.toLowerCase()}</span> sweet spot?</>,
                    ];
                    const prompt = prompts[index] || prompts[0];
                    
                    return (
                      <div key={interestId}>
                        <p className="text-sm text-foreground/70 mb-3">
                          {prompt}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {subtopics.map((subtopic) => {
                            const isSelected = selectedSubtopics.includes(subtopic.id);
                            const isDisabled =
                              (!isSelected && selectedSubtopics.length >= MAX_SUBTOPICS_PER_INTEREST) || isFocusFull;
                            return (
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
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {selectedInterests.length === 0 && (
                    <p className="text-xs text-secondary/60">Select interests first to refine them.</p>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-secondary/60">Step 3</div>
                    <h2 className="text-lg font-semibold">Your skills (optional)</h2>
                    <p className="text-xs text-secondary/60 mt-1">
                      This helps us pick the right angle and depth when curating content for you.
                    </p>
                  </div>
                  <div className="text-xs text-secondary/60">
                    {selectedSkills.length} selected
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill.id);
                    return (
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
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className="text-xs text-secondary/70 disabled:opacity-40"
              >
                Back
              </button>
              {step < TOTAL_STEPS ? (
                <button
                  onClick={handleNext}
                  disabled={step === 1 && selectedInterests.length < MIN_INTERESTS}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting || selectedInterests.length < MIN_INTERESTS}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Building your feed...' : 'Build my feed'}
                </button>
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-10 hidden lg:block">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/60 dark:bg-gray-950/60 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-secondary/50 mb-5">
                Your feed preview
              </div>
              <div className="space-y-5">
                {selectedInterests.slice(0, 3).map((id, index) => {
                  const interest = INTERESTS.find((i) => i.id === id);
                  const focusIds = selectedFocus[id] || [];
                  const primaryFocus = focusIds[0];
                  const focusLabel = primaryFocus
                    ? (INTEREST_SUBTOPICS[id] || []).find((s) => s.id === primaryFocus)?.label
                    : null;
                  
                  // Use subtopic preview if available, otherwise fall back to interest preview
                  const subtopicPreview = primaryFocus ? SUBTOPIC_PREVIEWS[primaryFocus] : null;
                  const basePreview = FEED_PREVIEWS[id];
                  const preview = subtopicPreview || basePreview;
                  
                  // Get skill angle if any skills selected
                  const skillAngle = selectedSkills.length > 0 ? SKILL_ANGLES[selectedSkills[0]] : null;
                  
                  const hasChanges = !!subtopicPreview || !!skillAngle;
                  
                  return (
                    <div 
                      key={`${id}-${primaryFocus || 'base'}-${selectedSkills[0] || 'none'}`} 
                      className={`transition-all duration-300 ${index > 0 ? 'pt-5 border-t border-gray-100 dark:border-gray-800' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-secondary/50">
                        <span className="uppercase tracking-[0.15em]">
                          {interest?.label}
                          {focusLabel ? ` · ${focusLabel}` : ''}
                        </span>
                        {hasChanges && (
                          <span className="text-violet-500">✦</span>
                        )}
                      </div>
                      <div className="mt-1.5 text-sm font-medium leading-snug text-foreground/90">
                        {preview?.title || 'Curated insight for you'}
                      </div>
                      <div className="mt-1 text-xs text-secondary/60 leading-relaxed">
                        {preview?.summary || 'Short, clear summary of what\'s worth your time today.'}
                      </div>
                    </div>
                  );
                })}
                {selectedInterests.length === 0 && (
                  <div className="text-xs text-secondary/40 italic">
                    Pick topics to see your feed
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
