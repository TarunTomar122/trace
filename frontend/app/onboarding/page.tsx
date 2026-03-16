"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  completeOnboarding,
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
} from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import { trackOnboardingStarted, trackOnboardingCompleted } from '@/lib/posthog';

const TOTAL_STEPS = 3;

const STEP_META = [
  { label: 'Role', title: 'What do you do?', subtitle: 'We tailor articles and depth to your perspective.' },
  { label: 'Interests', title: 'Pick your beats', subtitle: 'Choose 3–5 topics. We build grouped briefings around them.' },
  { label: 'Goals', title: "What's your next move?", subtitle: 'Pick up to 3. We surface content that gets you there.' },
];

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [careerGoals, setCareerGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTracked, setHasTracked] = useState(false);
  const checkoutIntent = searchParams.get('intent') === 'checkout';

  useEffect(() => {
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }
    if (!loading && !user) {
      router.push('/');
      return;
    }
    if (!user || !profileResolved) return;
    if (profile?.onboarded) {
      router.push('/feed');
    } else if (!hasTracked) {
      trackOnboardingStarted();
      setHasTracked(true);
    }
  }, [user, loading, router, hasTracked, profile, profileResolved]);

  const canContinue = (() => {
    if (step === 1) return !!role;
    if (step === 2) return interests.length >= 3;
    if (step === 3) return careerGoals.length >= 1;
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
        careerGoals,
      });
      trackOnboardingCompleted({ interests_count: interests.length, hobbies_count: 0, role });
      await refreshProfile();
      router.push(checkoutIntent ? '/profile?tab=subscription&intent=checkout' : '/feed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const meta = STEP_META[step - 1];

  return (
    <div className="min-h-screen bg-[#f4efe7] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#f4efe7]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
          </Link>
          <span className="text-xs text-secondary/50">Step {step} of {TOTAL_STEPS}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-8 sm:pt-14 pb-32">
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-black/6 mb-10">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] leading-tight">
          {meta.title}
        </h1>
        <p className="mt-3 text-[15px] text-secondary/70 max-w-lg">
          {meta.subtitle}
        </p>

        {/* Content */}
        <div className="mt-10">
          {/* Step 1: Role & Seniority */}
          {step === 1 && (
            <div className="space-y-10">
              <div>
                <p className="text-[11px] font-semibold text-secondary/40 uppercase tracking-[0.12em] mb-4">Your role</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROLES.map((r) => {
                    const sel = role === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setRole(r.id)}
                        className={`relative p-4 rounded-2xl text-left transition-all ${
                          sel
                            ? 'bg-white ring-2 ring-foreground shadow-sm'
                            : 'bg-white/60 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        {sel && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        <div className="font-semibold text-sm">{r.label}</div>
                        <div className="text-xs text-secondary/50 mt-0.5">{r.subtitle}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {role && (
                <div>
                  <p className="text-[11px] font-semibold text-secondary/40 uppercase tracking-[0.12em] mb-4">Experience level</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SENIORITY_LEVELS.map((s) => {
                      const sel = seniority === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSeniority(s.id)}
                          className={`p-4 rounded-2xl text-left transition-all ${
                            sel
                              ? 'bg-white ring-2 ring-foreground shadow-sm'
                              : 'bg-white/60 hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          <div className="font-semibold text-sm">{s.label}</div>
                          <div className="text-xs text-secondary/50 mt-0.5">{s.subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Interests */}
          {step === 2 && (
            <div>
              <div className="flex flex-wrap gap-2.5">
                {ONBOARDING_INTERESTS.map((interest) => {
                  const selected = interests.includes(interest.id);
                  const disabled = !selected && interests.length >= 5;
                  return (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      disabled={disabled}
                      className={`px-5 py-3 rounded-full text-sm font-semibold transition-all ${
                        selected
                          ? 'bg-foreground text-white shadow-sm'
                          : 'bg-white/70 text-foreground hover:bg-white hover:shadow-sm'
                      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        {interest.label}
                        {selected && <Check size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {interests.length > 0 && (
                <p className="text-xs text-secondary/50 mt-5">
                  {interests.length}/5 selected{interests.length < 3 ? ` — pick ${3 - interests.length} more` : interests.length === 5 ? ' (max)' : ''}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Career Goals */}
          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAREER_GOALS.map((goal) => {
                const selected = careerGoals.includes(goal.id);
                const disabled = !selected && careerGoals.length >= 3;
                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    disabled={disabled}
                    className={`relative p-4 rounded-2xl text-left transition-all ${
                      selected
                        ? 'bg-white ring-2 ring-foreground shadow-sm'
                        : 'bg-white/60 hover:bg-white hover:shadow-sm'
                    } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {selected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    <div className="font-semibold text-sm">{goal.label}</div>
                    <div className="text-xs text-secondary/50 mt-0.5">{goal.subtitle}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Fixed footer */}
      <div className="fixed bottom-0 inset-x-0 bg-[#f4efe7]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm text-secondary/50 hover:text-foreground disabled:opacity-0 transition-all"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canContinue}
              className="flex items-center gap-2.5 rounded-full bg-foreground px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isSubmitting || !canContinue}
              className="rounded-full bg-foreground px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {isSubmitting ? 'Saving...' : "Let's go"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}
