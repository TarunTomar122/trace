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
    title: "OpenAI's GPT-5 leak reveals multimodal breakthroughs",
    summary: "Internal documents suggest real-time video understanding and 10x context windows coming Q2.",
  },
  science: {
    title: "CRISPR trial reverses blindness in 12 patients",
    summary: "Gene therapy restored partial vision within weeks—first successful in-vivo human editing.",
  },
  psychology: {
    title: "Why your brain resists change (and how to hack it)",
    summary: "Neuroscience research shows the amygdala treats new habits as threats. Here's the workaround.",
  },
  ideas: {
    title: "The case against infinite growth",
    summary: "Economist Kate Raworth's doughnut model is reshaping how cities think about prosperity.",
  },
  business: {
    title: "How Notion hit $10B without a sales team",
    summary: "Product-led growth playbook: community loops, templates, and strategic patience.",
  },
  money: {
    title: "The 4% rule is dead—here's what replaced it",
    summary: "New withdrawal strategies adapt to sequence-of-returns risk and longer retirements.",
  },
  design: {
    title: "Apple's design language is shifting again",
    summary: "iOS 19 leaks show bolder typography, reduced glass effects, and spatial UI cues.",
  },
  career: {
    title: "Senior engineers who mass-applied got 0 offers",
    summary: "Hiring managers reveal why targeted applications beat volume—and what actually works.",
  },
  'self-development': {
    title: "James Clear on the 2-minute rule's hidden power",
    summary: "Atomic Habits author explains why starting small compounds into identity change.",
  },
  health: {
    title: "Zone 2 cardio is overhyped (for most people)",
    summary: "New meta-analysis suggests high-intensity intervals deliver better longevity markers.",
  },
  cooking: {
    title: "The science of perfect crispy rice",
    summary: "Why the Maillard reaction needs 15 minutes undisturbed—and the ideal pan for it.",
  },
  culture: {
    title: "Why Gen Z is abandoning Instagram for group chats",
    summary: "The shift from performance to intimacy is reshaping how online identity works.",
  },
  relationships: {
    title: "Gottman's new research on conflict repair",
    summary: "40 years of data shows the 5:1 ratio matters less than how you reconnect after fights.",
  },
  society: {
    title: "Remote work reshaped American geography",
    summary: "Census data reveals which cities gained, which lost, and why the trend is accelerating.",
  },
};

// Subtopic-specific previews that override base interest previews
const SUBTOPIC_PREVIEWS: Record<string, { title: string; summary: string }> = {
  // Technology subtopics
  'ai': { title: "Claude 4 benchmarks leak—and it's not what anyone expected", summary: "Anthropic's new model shows reasoning gains but trades off speed. Here's what it means for devs." },
  'automation': { title: "Zapier vs Make vs n8n: the 2026 automation stack wars", summary: "Which no-code platform actually scales? We tested all three with real workflows." },
  'software': { title: "Why senior devs are mass-quitting FAANG for climate startups", summary: "The great talent migration: compensation down, meaning up. The math might actually work." },
  'productivity-tools': { title: "Notion AI just killed 5 apps in my stack", summary: "The new features that made Todoist, Calendly, and others redundant overnight." },
  'future-tech': { title: "Neuralink's first non-medical implant approved for trials", summary: "Cognitive enhancement for healthy adults is no longer sci-fi. Here's the timeline." },
  // Science subtopics
  'space': { title: "SpaceX Starship reaches Mars orbit—now what?", summary: "The 7-month journey succeeded. The real challenges start when humans follow." },
  'biology': { title: "Lab-grown organs hit 90% transplant success rate", summary: "Synthetic kidneys from your own cells are now outperforming donor matches." },
  'physics': { title: "Quantum computers just factored a 2048-bit number", summary: "RSA encryption's days are numbered. Cryptographers are scrambling." },
  'climate': { title: "Ocean iron seeding worked—but created a new problem", summary: "Carbon capture success triggered unexpected algae blooms. Scientists debate next steps." },
  'explained': { title: "Why time moves slower for your face than your feet", summary: "Gravitational time dilation explained with zero equations. Yes, it's been measured." },
  // Psychology subtopics
  'mental-health': { title: "Psilocybin therapy FDA-approved for treatment-resistant depression", summary: "After decades of stigma, psychedelics enter mainstream psychiatry. What to expect." },
  'habits': { title: "The 'habit stacking' backlash: why it fails for most people", summary: "New research suggests context beats routine. Here's the better framework." },
  'learning': { title: "Spaced repetition apps are using the wrong algorithm", summary: "A PhD student's side project outperforms Anki. The learning science is clear." },
  'relationships': { title: "Attachment theory is getting a major update", summary: "The original categories were too rigid. Here's the nuanced model therapists now use." },
  'emotions': { title: "Why naming your emotions makes them less intense", summary: "The neuroscience of affect labeling—and why 'I'm fine' backfires." },
  // Ideas subtopics
  'philosophy': { title: "Effective altruism after the FTX collapse: what remains", summary: "The movement's core ideas survive, but trust takes decades to rebuild." },
  'essays': { title: "Paul Graham on the death of credentialism", summary: "Why degrees matter less each year—and what's replacing them." },
  'creativity': { title: "Why constraints breed better creative work", summary: "The research on 'freedom paradox' and how limitations unlock original thinking." },
  'meaning': { title: "The meaning crisis has a surprising solution", summary: "John Vervaeke's decade of research points to embodied practices, not beliefs." },
  'big-ideas': { title: "What if consciousness is a spectrum, not a switch?", summary: "The panpsychism debate is going mainstream. Here's why serious scientists care." },
  // Business subtopics
  'startups': { title: "YC's latest batch has 40% solo founders—here's why", summary: "Co-founder matching is broken. The new playbook is build first, partner later." },
  'product': { title: "The 'jobs to be done' framework has a fatal flaw", summary: "Why JTBD fails for novel products—and the alternative top PMs now use." },
  'marketing': { title: "SEO is dead. Long live... whatever this is", summary: "AI search is reshaping discovery. The new playbook for getting found." },
  'operations': { title: "How Stripe runs 10,000 A/B tests per year", summary: "Inside their experimentation culture: tooling, velocity, and learning loops." },
  'leadership': { title: "Why 'radical candor' created toxic cultures at scale", summary: "The framework worked for small teams. Here's what breaks at 500+ people." },
  // Money subtopics
  'personal-finance': { title: "The 50/30/20 budget rule needs an update for 2026", summary: "Housing costs broke the formula. Financial planners share the new ratios." },
  'investing': { title: "Index funds are distorting markets—and your returns", summary: "Passive investing's success created a paradox. Active managers see opportunity." },
  'income': { title: "The creator middle class is finally emerging", summary: "Not everyone needs millions of followers. The $50K-$150K tier is thriving." },
  'markets': { title: "Why the yield curve inversion didn't predict recession this time", summary: "The indicator that's been reliable for 50 years just failed. What changed." },
  'crypto': { title: "Bitcoin ETF inflows just passed gold", summary: "Institutional adoption hit an inflection point. What the flows tell us." },
  // Design subtopics
  'visual-design': { title: "The anti-minimalism movement is picking up steam", summary: "Maximalism, texture, and chaos are back. See the portfolios leading the shift." },
  'ux': { title: "Dark patterns are getting regulated—finally", summary: "EU's new enforcement actions and what designers need to change now." },
  'branding': { title: "Why every brand looks the same (and how to break out)", summary: "The 'blanding' phenomenon explained—and the rebellious counter-trend." },
  'creative-process': { title: "Designers who sketch first produce better work", summary: "The research is in: hand-drawing before digital leads to more original solutions." },
  'tools': { title: "Figma's AI features are changing how designers think", summary: "Auto-layout suggestions and component generation: helpful or homogenizing?" },
  // Career subtopics
  'job-search': { title: "The hidden job market is 70% of all roles now", summary: "Referrals dominate. Here's how to get them without being awkward." },
  'skills': { title: "The skills that actually compound over a career", summary: "Writing, selling, and learning how to learn. Everything else is temporary." },
  'portfolio': { title: "Case studies that actually get you hired", summary: "Recruiters reveal what they skim, what they read, and what makes them reach out." },
  'career-growth': { title: "Staff engineer vs. manager: the decision framework", summary: "Both paths have hidden costs. How to choose based on your actual priorities." },
  'workplace': { title: "Remote work policies are quietly reversing", summary: "The 'return to office' wave and how to negotiate if you want to stay remote." },
  // Self-development subtopics
  'focus': { title: "Deep work is harder than ever—here's the new research", summary: "Attention spans aren't shrinking; demands are increasing. The updated strategies." },
  'routines': { title: "Morning routines are overrated (evening routines aren't)", summary: "What you do before bed predicts tomorrow's performance better than sunrise rituals." },
  'mindset': { title: "Growth mindset has been oversimplified", summary: "Dweck's original research is more nuanced. Here's what actually changes outcomes." },
  'confidence': { title: "Confidence comes from evidence, not affirmations", summary: "The 'confidence-competence loop' and why small wins beat positive self-talk." },
  'life-design': { title: "The 'Odyssey Plan' exercise that changed how I see my future", summary: "Stanford's life design approach: three versions of your next five years." },
  // Health subtopics
  'workouts': { title: "The minimum effective dose for strength is lower than you think", summary: "New meta-analysis: 2 sets to failure beats 4+ sets for naturals. Here's why." },
  'nutrition': { title: "Protein timing matters less than total intake", summary: "The 'anabolic window' myth is dead. What the research actually supports." },
  'sleep': { title: "The 8-hour sleep myth and what to aim for instead", summary: "Sleep need varies wildly. Here's how to find your actual number." },
  'recovery': { title: "Cold plunges might be hurting your gains", summary: "The inflammation you're suppressing is part of the adaptation signal." },
  'fitness': { title: "VO2 max is the best predictor of longevity we have", summary: "Better than cholesterol, blood pressure, or BMI. Here's how to improve it." },
  // Cooking subtopics
  'recipes': { title: "The one-pan dinner formula that actually works", summary: "Protein + veg + starch + fat + acid. Master the ratios, skip the recipes." },
  'healthy-meals': { title: "Meal prep is dead. 'Ingredient prep' is the move", summary: "Prepping components instead of full meals keeps things flexible and fresh." },
  'baking': { title: "Why your bread isn't rising (it's probably the water)", summary: "Chlorine kills yeast. The filtered water fix bakers wish they knew sooner." },
  'drinks': { title: "The science of clear ice (and why it matters)", summary: "Directional freezing explained. Your cocktails will never be cloudy again." },
  'food-culture': { title: "Why Korean food is having its global moment", summary: "Beyond K-pop: the culinary infrastructure that made Korean cuisine exportable." },
  // Culture subtopics
  'movies': { title: "Why every movie looks orange and teal", summary: "The color grading trend that took over Hollywood—and the directors fighting back." },
  'music': { title: "Spotify's algorithm is homogenizing pop music", summary: "Data shows songs are getting more similar. The economics driving convergence." },
  'games': { title: "Why shorter games are winning", summary: "The 100-hour RPG is dying. Players want complete experiences in 10 hours." },
  'books': { title: "The BookTok effect on publishing is permanent", summary: "How TikTok remade bestseller lists and what gets published next." },
  'internet': { title: "The 'dead internet' theory has some truth to it", summary: "Bot traffic is 50%+ now. The implications for online discourse are real." },
  // Relationships subtopics
  'dating': { title: "Dating app fatigue is reshaping how people meet", summary: "IRL is back: run clubs, pottery classes, and 'third places' are the new Hinge." },
  'family': { title: "The 'invisible load' in parenting finally has solutions", summary: "Fair Play and other systems for splitting cognitive labor. They actually work." },
  'friendships': { title: "Adult friendships require 200 hours—here's how to get there", summary: "The research on friendship formation and why most adults don't invest enough." },
  'communication': { title: "Why 'I feel' statements backfire in some situations", summary: "The popular technique has limits. When to use it and when it escalates." },
  'conflict': { title: "The '5:1 ratio' for relationships needs context", summary: "Gottman's famous rule applies differently across cultures and conflict styles." },
  // Society subtopics
  'politics': { title: "Political polarization is worse online than in person", summary: "New study shows neighbors across party lines get along fine. Algorithms don't help." },
  'economics': { title: "UBI pilots are producing unexpected results", summary: "Recipients don't quit working—but they do change what work means to them." },
  'history': { title: "What the 1918 pandemic teaches us about 'normalcy'", summary: "The 'roaring 20s' didn't happen immediately. Recovery took longer than memory suggests." },
  'media': { title: "Local news collapse is creating 'news deserts'", summary: "1,800 papers closed since 2004. The civic consequences are measurable." },
  'technology-impact': { title: "Screen time research is more nuanced than headlines suggest", summary: "The moral panic vs. the data. What parents and policymakers should actually worry about." },
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

      try {
        await fetch('/api/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid }),
        });
      } catch (e) {
        console.warn('Onboard trigger failed:', e);
      }

      await refreshProfile();

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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground bg-[radial-gradient(circle_at_top,_#f9f5ff_0%,_#ffffff_45%,_#f6f8ff_100%)]">
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
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
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
                            : 'border-gray-200 bg-white text-foreground/80 hover:border-foreground/40'
                        } ${isMaxed ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span>{interest.label}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-amber-50/80 border border-amber-100">
                  <span className="text-amber-500 text-sm">💡</span>
                  <p className="text-xs text-amber-800/80 leading-relaxed">
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
                                    : 'border-gray-200 bg-white text-foreground/80 hover:border-foreground/40'
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
                            : 'border-gray-200 bg-white text-foreground/80 hover:border-foreground/40'
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
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background shadow-sm hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting || selectedInterests.length < MIN_INTERESTS}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background shadow-sm hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Building your feed...' : 'Build my feed'}
                </button>
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-10 hidden lg:block">
            <div className="rounded-xl border border-gray-100 bg-white/60 p-5">
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
                      className={`transition-all duration-300 ${index > 0 ? 'pt-5 border-t border-gray-100' : ''}`}
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
