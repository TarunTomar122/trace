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

const TOTAL_STEPS = 4;
const PENDING_ONBOARDING_KEY = 'trace_pending_onboarding';

const STEP_META = [
  { label: 'Role',      title: 'What do you do?',        subtitle: 'We tailor articles and depth to your perspective.' },
  { label: 'Interests', title: 'Pick your beats',         subtitle: 'Choose 3–5 topics. We build grouped briefings around them.' },
  { label: 'Goals',     title: "What's your next move?",  subtitle: 'Pick up to 3. We surface content that gets you there.' },
  { label: 'Account',   title: 'Almost there',            subtitle: 'Create your account to save your profile and unlock your feed.' },
];

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved, signInWithGoogle, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [careerGoals, setCareerGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTracked, setHasTracked] = useState(false);
  const checkoutIntent = searchParams.get('intent') === 'checkout';

  // Handle post-auth routing and redirect-based sign-in recovery
  useEffect(() => {
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }

    // Wait until auth + profile are resolved
    if (loading || !profileResolved) return;

    // Already onboarded → straight to feed
    if (user && profile?.onboarded) {
      router.push('/feed');
      return;
    }

    // Redirect sign-in recovery: user just returned from Google OAuth redirect
    // and we have pending onboarding data saved in localStorage
    if (user && !profile?.onboarded) {
      const pendingRaw = localStorage.getItem(PENDING_ONBOARDING_KEY);
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          localStorage.removeItem(PENDING_ONBOARDING_KEY);
          setIsSubmitting(true);
          completeOnboarding(user.uid, {
            name: user.displayName || '',
            role: pending.role,
            seniority: pending.seniority || 'mid',
            interests: pending.interests,
            careerGoals: pending.careerGoals,
          })
            .then(() => {
              trackOnboardingCompleted({
                interests_count: pending.interests.length,
                hobbies_count: 0,
                role: pending.role,
              });
              return refreshProfile();
            })
            .then(() => {
              router.push(
                pending.checkoutIntent
                  ? '/profile?tab=subscription&intent=checkout'
                  : '/feed',
              );
            })
            .catch((err) => {
              console.error('Error completing onboarding after redirect:', err);
              setIsSubmitting(false);
            });
          return;
        } catch {
          localStorage.removeItem(PENDING_ONBOARDING_KEY);
        }
      }
    }

    if (!hasTracked) {
      trackOnboardingStarted();
      setHasTracked(true);
    }
  }, [user, loading, router, hasTracked, profile, profileResolved, refreshProfile]);

  const canContinue = (() => {
    if (step === 1) return !!role;
    if (step === 2) return interests.length >= 3;
    if (step === 3) return careerGoals.length >= 1;
    if (step === 4) return true; // sign-in step — always ready
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

  // Called once we have a confirmed Firebase user (popup or already signed-in)
  const finishOnboarding = async (uid: string, displayName: string | null) => {
    await completeOnboarding(uid, {
      name: displayName || '',
      role,
      seniority: seniority || 'mid',
      interests,
      careerGoals,
    });
    trackOnboardingCompleted({ interests_count: interests.length, hobbies_count: 0, role });
    await refreshProfile();
    router.push(checkoutIntent ? '/profile?tab=subscription&intent=checkout' : '/feed');
  };

  // Step 4 action: sign in (or complete directly if already signed in)
  const handleSignInAndComplete = async () => {
    setIsSubmitting(true);

    // Already signed in (e.g. arrived here via nav sign-in or dev flow)
    if (user) {
      try {
        await finishOnboarding(user.uid, user.displayName);
      } catch (err) {
        console.error('Error completing onboarding:', err);
        setIsSubmitting(false);
      }
      return;
    }

    // Save selections so we can recover them after a redirect-based sign-in
    localStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({ role, seniority, interests, careerGoals, checkoutIntent }),
    );

    const result = await signInWithGoogle(checkoutIntent ? 'checkout' : 'read');

    if (result.status === 'success') {
      // Popup flow: we have the user right here
      localStorage.removeItem(PENDING_ONBOARDING_KEY);
      try {
        await finishOnboarding(result.user.uid, result.user.displayName);
      } catch (err) {
        console.error('Error completing onboarding after sign-in:', err);
        setIsSubmitting(false);
      }
    } else if (result.status === 'redirecting') {
      // Redirect flow: page will reload; useEffect above handles completion
    } else {
      // Cancelled / error — clean up
      localStorage.removeItem(PENDING_ONBOARDING_KEY);
      setIsSubmitting(false);
    }
  };

  // Only block render during the very first auth check
  if (loading) {
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

          {/* Step 4: Sign in */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Summary of selections */}
              <div className="rounded-2xl bg-white/60 p-5 space-y-3">
                <p className="text-[11px] font-semibold text-secondary/40 uppercase tracking-[0.12em] mb-4">Your profile</p>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {ROLES.find((r) => r.id === role)?.label ?? role}
                    {seniority ? ` · ${SENIORITY_LEVELS.find((s) => s.id === seniority)?.label}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {interests.length} topic{interests.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {careerGoals.length} goal{careerGoals.length !== 1 ? 's' : ''} set
                  </span>
                </div>
              </div>

              <p className="text-sm text-secondary/55 text-center px-4">
                Your personalized feed is ready — sign in to save your profile and start reading.
              </p>
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
              onClick={handleSignInAndComplete}
              disabled={isSubmitting}
              className="flex items-center gap-2.5 rounded-full bg-foreground px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {isSubmitting ? (
                'Saving...'
              ) : user ? (
                "Let's go"
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="rgba(255,255,255,0.7)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="rgba(255,255,255,0.7)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="rgba(255,255,255,0.7)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
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
