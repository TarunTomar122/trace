"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  completeOnboarding,
  ROLES,
  ONBOARDING_INTERESTS,
} from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import {
  trackDailyBriefPreferenceChanged,
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingCompleted,
} from '@/lib/posthog';

const TOTAL_STEPS = 2;
const PENDING_ONBOARDING_KEY = 'trace_pending_onboarding';

const STEP_META = [
  { label: 'Role',      title: 'What do you do?',        subtitle: 'We tailor articles and depth to your perspective.' },
  { label: 'Interests', title: 'Pick your beats',         subtitle: 'Choose 3–5 topics. We build your edition around them.' },
];

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved, signInWithGoogle, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [dailyBriefEnabled, setDailyBriefEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTracked, setHasTracked] = useState(false);
  const checkoutIntent = searchParams.get('intent') === 'checkout';

  useEffect(() => {
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }

    if (loading || !profileResolved) return;

    if (user && profile?.onboarded) {
      router.push(checkoutIntent ? '/profile?tab=subscription&intent=checkout' : '/feed');
      return;
    }

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
            seniority: 'mid',
            interests: pending.interests,
            careerGoals: [],
            dailyNewsletterEnabled: pending.dailyBriefEnabled === true,
          })
            .then(() => {
              trackOnboardingCompleted({
                interests_count: pending.interests.length,
                hobbies_count: 0,
                role: pending.role,
                daily_brief_enabled: pending.dailyBriefEnabled === true,
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
  }, [user, loading, router, hasTracked, profile, profileResolved, refreshProfile, checkoutIntent]);

  const canContinue = (() => {
    if (step === 1) return !!role;
    if (step === 2) return interests.length >= 3;
    return false;
  })();

  const handleNext = () => {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) {
      trackOnboardingStepCompleted(step, STEP_META[step - 1].label.toLowerCase());
      setStep(step + 1);
    }
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

  const finishOnboarding = async (uid: string, displayName: string | null) => {
    await completeOnboarding(uid, {
      name: displayName || '',
      role,
      seniority: 'mid',
      interests,
      careerGoals: [],
      dailyNewsletterEnabled: dailyBriefEnabled,
    });
    trackOnboardingCompleted({
      interests_count: interests.length,
      hobbies_count: 0,
      role,
      daily_brief_enabled: dailyBriefEnabled,
    });
    await refreshProfile();
    router.push(checkoutIntent ? '/profile?tab=subscription&intent=checkout' : '/feed');
  };

  const handleSignInAndComplete = async () => {
    if (!canContinue) return;
    setIsSubmitting(true);

    if (user) {
      try {
        await finishOnboarding(user.uid, user.displayName);
      } catch (err) {
        console.error('Error completing onboarding:', err);
        setIsSubmitting(false);
      }
      return;
    }

    localStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({ role, interests, checkoutIntent, dailyBriefEnabled }),
    );

    const result = await signInWithGoogle(checkoutIntent ? 'checkout' : 'read');

    if (result.status === 'success') {
      localStorage.removeItem(PENDING_ONBOARDING_KEY);
      try {
        await finishOnboarding(result.user.uid, result.user.displayName);
      } catch (err) {
        console.error('Error completing onboarding after sign-in:', err);
        setIsSubmitting(false);
      }
    } else if (result.status === 'redirecting') {
      /* useEffect handles completion */
    } else {
      localStorage.removeItem(PENDING_ONBOARDING_KEY);
      setIsSubmitting(false);
    }
  };

  const optionCardClass = (selected: boolean, disabled = false) =>
    [
      'relative border p-4 text-left transition-colors',
      selected
        ? 'border-[#2557d6] bg-[#faf9f5]'
        : 'border-[#e4e1d8] bg-transparent hover:bg-[#f5f3ed]',
      disabled ? 'opacity-30 cursor-not-allowed' : '',
    ].join(' ');

  if (loading) {
    return (
      <div className="landing-page landing-grid-bg flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563eb]/20 border-t-[#2563eb]" />
      </div>
    );
  }

  const meta = STEP_META[step - 1];

  return (
    <div className="landing-page landing-grid-bg min-h-screen text-[#1b1a17]">
      <header className="sticky top-0 z-50 bg-[#faf9f5] px-5 sm:px-8">
        <div className="mx-auto flex max-w-[880px] items-center justify-between border-b border-[#e4e1d8] py-4">
          <Link href="/" className="font-mono text-[12.5px] font-bold tracking-[0.28em]">TRACE</Link>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#75705f]">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-5 pb-32 pt-14 sm:px-8 sm:pt-20">
        <div className="mb-10 h-px overflow-hidden bg-[#e4e1d8]">
          <div
            className="h-full bg-[#2557d6] transition-all duration-500 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">{meta.label}</p>
        <h1 className="mt-4 font-serif text-[46px] leading-[0.98] tracking-[-0.03em] sm:text-[64px]">
          {meta.title}
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed landing-muted">
          {meta.subtitle}
        </p>

        <div className="mt-10">
          {step === 1 && (
            <div>
              <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2557d6]">
                Your role
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ROLES.map((r) => {
                  const sel = role === r.id;
                  return (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)} className={optionCardClass(sel)}>
                      {sel && (
                        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center bg-[#2557d6]">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className="text-sm font-semibold text-[#111827]">{r.label}</div>
                      <div className="mt-0.5 text-xs landing-muted">{r.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex flex-wrap gap-2.5">
                {ONBOARDING_INTERESTS.map((interest) => {
                  const selected = interests.includes(interest.id);
                  const disabled = !selected && interests.length >= 5;
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      disabled={disabled}
                      className={`border px-5 py-3 text-sm font-semibold transition-colors ${
                        selected
                          ? 'border-[#2557d6] bg-[#2557d6] text-white'
                          : 'border-[#e4e1d8] bg-transparent text-[#1b1a17] hover:bg-[#f5f3ed]'
                      } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
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
                <p className="mt-5 text-xs text-[#9ca3af]">
                  {interests.length}/5 selected
                  {interests.length < 3 ? ` · pick ${3 - interests.length} more` : interests.length === 5 ? ' (max)' : ''}
                </p>
              )}
              <button
                type="button"
                role="checkbox"
                aria-checked={dailyBriefEnabled}
                onClick={() => {
                  const enabled = !dailyBriefEnabled;
                  setDailyBriefEnabled(enabled);
                  trackDailyBriefPreferenceChanged(enabled, 'onboarding');
                }}
                className={`mt-8 flex w-full items-start gap-4 border p-4 text-left transition-colors ${
                  dailyBriefEnabled
                    ? 'border-[#2557d6] bg-[#f3f6ff]'
                    : 'border-[#e4e1d8] bg-transparent hover:bg-[#f5f3ed]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
                    dailyBriefEnabled ? 'border-[#2557d6] bg-[#2557d6] text-white' : 'border-[#b8b3a6]'
                  }`}
                >
                  {dailyBriefEnabled ? <Check size={12} /> : <Mail size={12} />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[#111827]">
                    Email me my personal edition each morning
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed landing-muted">
                    One brief based on these beats. Optional, and you can unsubscribe anytime.
                  </span>
                </span>
              </button>
            </div>
          )}

        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#e4e1d8] bg-[#faf9f5]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[880px] items-center justify-between px-5 py-5 sm:px-8">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm font-medium text-[#75705f] transition-colors hover:text-[#1b1a17] disabled:opacity-0"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canContinue}
              className={`landing-btn landing-btn-lg flex items-center gap-2 ${
                canContinue ? 'landing-btn-primary' : 'landing-btn-secondary cursor-not-allowed opacity-50'
              }`}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignInAndComplete}
              disabled={isSubmitting || !canContinue}
              className="landing-btn landing-btn-primary landing-btn-lg flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                'Saving...'
              ) : user ? (
                "Let's go"
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
    <Suspense
      fallback={
        <div className="landing-page landing-grid-bg flex min-h-screen items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563eb]/20 border-t-[#2563eb]" />
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
