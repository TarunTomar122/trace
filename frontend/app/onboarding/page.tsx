"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
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

const STEP_TITLES = [
  { title: 'Role', subtitle: 'What do you do?' },
  { title: 'Interests', subtitle: 'What fires you up?' },
  { title: 'Goals', subtitle: 'What are you working towards?' },
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Step Tabs */}
      <div className="flex items-end mb-0">
        {STEP_TITLES.map((s, i) => (
          <button
            key={i}
            onClick={() => i + 1 < step && setStep(i + 1)}
            disabled={i + 1 > step}
            className={`
              relative px-5 py-2.5 text-sm font-medium transition-colors
              ${step === i + 1 ? 'text-foreground bg-surface z-10' : 'text-tab-inactive bg-surface-tertiary'}
              ${i + 1 > step ? 'cursor-not-allowed opacity-50' : 'hover:text-foreground'}
              ${i === 0 ? 'rounded-tl-lg' : ''}
            `}
            style={{
              clipPath: i === 0
                ? 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)'
                : 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
              marginLeft: i === 0 ? 0 : '-6px',
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Main Container */}
      <div className="bg-surface rounded-tr-lg rounded-b-lg min-h-[calc(100vh-140px)] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3 text-xs text-secondary/50 mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {STEP_TITLES[step - 1].subtitle}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Step 1: Role & Seniority */}
          {step === 1 && (
            <div className="space-y-8 max-w-2xl">
              <div>
                <p className="text-sm font-medium text-secondary/60 mb-4">Pick your role</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`
                        relative p-4 rounded-xl text-left transition-all border-2
                        ${role === r.id
                          ? 'border-foreground bg-surface-secondary shadow-sm'
                          : 'border-transparent bg-surface-secondary/50 hover:bg-surface-secondary hover:shadow-sm'}
                      `}
                    >
                      {role === r.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                          <Check size={12} className="text-background" />
                        </div>
                      )}
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-secondary/50 mt-0.5">{r.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {role && (
                <div>
                  <p className="text-sm font-medium text-secondary/60 mb-4">Experience level</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SENIORITY_LEVELS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSeniority(s.id)}
                        className={`
                          p-4 rounded-xl text-left transition-all border-2
                          ${seniority === s.id
                            ? 'border-foreground bg-surface-secondary shadow-sm'
                            : 'border-transparent bg-surface-secondary/50 hover:bg-surface-secondary hover:shadow-sm'}
                        `}
                      >
                        <div className="font-medium text-sm">{s.label}</div>
                        <div className="text-xs text-secondary/50">{s.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Interests */}
          {step === 2 && (
            <div className="max-w-2xl">
              <p className="text-sm text-secondary/60 mb-4">
                Pick 3-5 topics. These help us tune your feed.
              </p>
              <div className="flex flex-wrap gap-2">
                {ONBOARDING_INTERESTS.map((interest) => {
                  const selected = interests.includes(interest.id);
                  const disabled = !selected && interests.length >= 5;
                  return (
                    <button
                      key={interest.id}
                      onClick={() => toggleInterest(interest.id)}
                      disabled={disabled}
                      className={`
                        px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2
                        ${selected
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-surface-secondary text-foreground/80 hover:bg-surface-tertiary'}
                        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
                      `}
                    >
                      {interest.label}
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-secondary/50 mt-4">
                {interests.length}/5 selected (minimum 3)
              </p>
            </div>
          )}

          {/* Step 3: Career Goals */}
          {step === 3 && (
            <div className="max-w-2xl">
              <p className="text-sm text-secondary/60 mb-4">
                Pick up to 3. We'll boost content that helps you get there.
              </p>
              <div className="space-y-3">
                {CAREER_GOALS.map((goal) => {
                  const selected = careerGoals.includes(goal.id);
                  const disabled = !selected && careerGoals.length >= 3;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      disabled={disabled}
                      className={`
                        relative w-full p-4 rounded-xl text-left transition-all border-2
                        ${selected
                          ? 'border-foreground bg-surface-secondary shadow-sm'
                          : 'border-transparent bg-surface-secondary/50 hover:bg-surface-secondary hover:shadow-sm'}
                        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
                      `}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                          <Check size={12} className="text-background" />
                        </div>
                      )}
                      <div className="font-medium text-sm">{goal.label}</div>
                      <div className="text-xs text-secondary/50 mt-0.5">{goal.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sidebar-border flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm text-secondary/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canContinue}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isSubmitting || !canContinue}
              className="px-6 py-3 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {isSubmitting ? 'Building your feed...' : 'Build my feed'}
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}
