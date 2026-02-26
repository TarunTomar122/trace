"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  completeOnboarding,
  getUserProfile,
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  LEARNING_SOURCE_CATEGORIES,
  CAREER_GOALS,
  SUMMARY_STYLES,
} from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import { trackOnboardingStarted, trackOnboardingCompleted } from '@/lib/posthog';

const ACCENT = '#F59E0B';
const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [careerGoals, setCareerGoals] = useState<string[]>([]);
  const [summaryStyle, setSummaryStyle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTracked, setHasTracked] = useState(false);

  useEffect(() => {
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }
    if (!loading && !user) {
      router.push('/');
      return;
    }
    if (user) {
      getUserProfile(user.uid).then((profile) => {
        if (profile?.onboarded) {
          router.push('/feed');
        } else if (!hasTracked) {
          trackOnboardingStarted();
          setHasTracked(true);
        }
      });
    }
  }, [user, loading, router, hasTracked]);

  const canContinue = (() => {
    if (step === 1) return !!role;
    if (step === 2) return interests.length >= 3;
    if (step === 3) return selectedSources.length >= 1;
    if (step === 4) return careerGoals.length >= 1;
    if (step === 5) return !!summaryStyle;
    return false;
  })();

  const handleNext = () => {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleInterest = (id: string) => {
    if (interests.includes(id)) {
      setInterests(interests.filter((i) => i !== id));
    } else if (interests.length < 5) {
      setInterests([...interests, id]);
    }
  };

  const toggleSource = (name: string) => {
    if (selectedSources.includes(name)) {
      setSelectedSources(selectedSources.filter((s) => s !== name));
    } else {
      setSelectedSources([...selectedSources, name]);
    }
  };

  const toggleGoal = (id: string) => {
    if (careerGoals.includes(id)) {
      setCareerGoals(careerGoals.filter((g) => g !== id));
    } else if (careerGoals.length < 3) {
      setCareerGoals([...careerGoals, id]);
    }
  };

  const handleComplete = async () => {
    if (!user || !canContinue) return;
    setIsSubmitting(true);
    try {
      await completeOnboarding(user.uid, {
        name: user.displayName || '',
        role,
        seniority: seniority || 'mid',
        interests,
        selectedLearningSources: selectedSources,
        careerGoals,
        summaryStyle: summaryStyle || 'practitioner',
      });
      trackOnboardingCompleted({ interests_count: interests.length, hobbies_count: 0, role });
      await refreshProfile();
      router.push('/feed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground bg-background">
      <div className="container mx-auto px-4 max-w-2xl py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-2">
          <div className="text-base text-foreground uppercase flex items-center justify-center gap-2 tracking-[0.15em] font-semibold mb-4">
            <img src="/trace.webp" alt="Trace" width={120} height={32} className="h-5 md:h-6 w-auto" />
            TRACE
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i < step ? ACCENT : 'var(--color-border, #e5e7eb)',
              }}
            />
          ))}
        </div>

        {/* Step 1: Role & Seniority */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary/60 mb-1">Step 1</p>
              <h2 className="text-xl font-semibold">What do you do?</h2>
              <p className="text-sm text-secondary/70 mt-1">Pick the role that best describes you.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    role === r.id
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {role === r.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <div className="font-medium text-sm">{r.label}</div>
                  <div className="text-xs text-secondary/60 mt-0.5">{r.subtitle}</div>
                </button>
              ))}
            </div>

            {role && (
              <div>
                <p className="text-sm font-medium mb-3">Experience level</p>
                <div className="grid grid-cols-2 gap-3">
                  {SENIORITY_LEVELS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSeniority(s.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        seniority === s.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className="text-xs text-secondary/60">{s.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary/60 mb-1">Step 2</p>
              <h2 className="text-xl font-semibold">What fires you up?</h2>
              <p className="text-sm text-secondary/70 mt-1">
                Pick 3-5 topics. These drive your For You feed.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {ONBOARDING_INTERESTS.map((interest) => {
                const selected = interests.includes(interest.id);
                const disabled = !selected && interests.length >= 5;
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    disabled={disabled}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 border ${
                      selected
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-foreground/80 hover:border-amber-300'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {interest.label}
                    {selected && <Check size={14} />}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-secondary/60">
              {interests.length}/5 selected (minimum 3)
            </div>
          </div>
        )}

        {/* Step 3: Deep Dive Sources */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary/60 mb-1">Step 3</p>
              <h2 className="text-xl font-semibold">Your deep dive sources</h2>
              <p className="text-sm text-secondary/70 mt-1">
                Pick blogs and experts you want in-depth summaries from.
              </p>
            </div>

            <div className="space-y-6">
              {LEARNING_SOURCE_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <h3 className="text-sm font-semibold mb-3 text-secondary/80">{cat.label}</h3>
                  <div className="space-y-2">
                    {cat.sources.map((source) => {
                      const selected = selectedSources.includes(source.name);
                      return (
                        <button
                          key={source.name}
                          onClick={() => toggleSource(source.name)}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                            selected
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{source.name}</div>
                            <div className="text-xs text-secondary/60 truncate">{source.description}</div>
                          </div>
                          {selected && (
                            <div className="w-5 h-5 rounded-full bg-amber-500 flex-shrink-0 flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Career Goals */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary/60 mb-1">Step 4</p>
              <h2 className="text-xl font-semibold">What are you working towards?</h2>
              <p className="text-sm text-secondary/70 mt-1">
                Pick up to 3. We&apos;ll boost content that helps you get there.
              </p>
            </div>

            <div className="grid gap-3">
              {CAREER_GOALS.map((goal) => {
                const selected = careerGoals.includes(goal.id);
                const disabled = !selected && careerGoals.length >= 3;
                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    disabled={disabled}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {selected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    <div className="font-medium text-sm">{goal.label}</div>
                    <div className="text-xs text-secondary/60 mt-0.5">{goal.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Summary Style */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-secondary/60 mb-1">Step 5</p>
              <h2 className="text-xl font-semibold">How should we write for you?</h2>
              <p className="text-sm text-secondary/70 mt-1">
                Choose your preferred summary tone.
              </p>
            </div>

            <div className="grid gap-3">
              {SUMMARY_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSummaryStyle(style.id)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    summaryStyle === style.id
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  {summaryStyle === style.id && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <div className="font-medium text-sm">{style.label}</div>
                  <div className="text-xs text-secondary/60 mt-0.5">{style.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-8 mt-8 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="text-sm text-secondary/70 flex items-center gap-1 disabled:opacity-30"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canContinue}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              style={{ backgroundColor: ACCENT }}
            >
              Continue
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isSubmitting || !canContinue}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: ACCENT }}
            >
              {isSubmitting ? 'Building your feed...' : 'Build my feed'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
