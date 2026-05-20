"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import Image from 'next/image';
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

  useEffect(() => {
    if (!isAlphaMode()) {
      router.push(user ? '/waitlist' : '/');
      return;
    }

    if (loading || !profileResolved) return;

    if (user && profile?.onboarded) {
      router.push('/feed');
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
    if (step === 4) return true;
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

  const handleSignInAndComplete = async () => {
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
      JSON.stringify({ role, seniority, interests, careerGoals, checkoutIntent }),
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
      'relative rounded-2xl border p-4 text-left transition-all',
      selected
        ? 'border-[#2563eb] bg-white ring-2 ring-[#2563eb]/30 shadow-[0_4px_20px_rgba(37,99,235,0.12)]'
        : 'landing-card border-[#e5e7eb] bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]',
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
    <div className="landing-page landing-grid-bg min-h-screen text-[#111827]">
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/90 px-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline" style={{ color: 'inherit' }}>
            <Image src="/trace.webp" alt="Trace" width={22} height={22} priority className="h-[22px] w-auto" />
            <span className="text-[13px] font-bold tracking-[0.12em]">TRACE</span>
          </Link>
          <span className="text-[12px] font-medium text-[#9ca3af]">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-10 h-1 overflow-hidden rounded-full bg-[#e5e7eb]">
          <div
            className="h-full rounded-full bg-[#2563eb] transition-all duration-500 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <h1 className="text-3xl font-bold leading-tight tracking-[-0.03em] sm:text-4xl">
          {meta.title}
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed landing-muted">
          {meta.subtitle}
        </p>

        <div className="mt-10">
          {step === 1 && (
            <div className="space-y-10">
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563eb]">
                  Your role
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ROLES.map((r) => {
                    const sel = role === r.id;
                    return (
                      <button key={r.id} type="button" onClick={() => setRole(r.id)} className={optionCardClass(sel)}>
                        {sel && (
                          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb]">
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

              {role && (
                <div>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563eb]">
                    Experience level
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {SENIORITY_LEVELS.map((s) => {
                      const sel = seniority === s.id;
                      return (
                        <button key={s.id} type="button" onClick={() => setSeniority(s.id)} className={optionCardClass(sel)}>
                          <div className="text-sm font-semibold text-[#111827]">{s.label}</div>
                          <div className="mt-0.5 text-xs landing-muted">{s.subtitle}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                      className={`rounded-full px-5 py-3 text-sm font-semibold transition-all ${
                        selected
                          ? 'bg-[#2563eb] text-white shadow-[0_4px_16px_rgba(37,99,235,0.25)]'
                          : 'border border-[#e5e7eb] bg-white text-[#111827] hover:border-[#d1d5db] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
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
                  {interests.length < 3 ? ` — pick ${3 - interests.length} more` : interests.length === 5 ? ' (max)' : ''}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAREER_GOALS.map((goal) => {
                const selected = careerGoals.includes(goal.id);
                const disabled = !selected && careerGoals.length >= 3;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    disabled={disabled}
                    className={optionCardClass(selected, disabled)}
                  >
                    {selected && (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb]">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    <div className="text-sm font-semibold text-[#111827]">{goal.label}</div>
                    <div className="mt-0.5 text-xs landing-muted">{goal.subtitle}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="landing-card space-y-3 p-5">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563eb]">
                  Your profile
                </p>
                {[
                  `${ROLES.find((r) => r.id === role)?.label ?? role}${seniority ? ` · ${SENIORITY_LEVELS.find((s) => s.id === seniority)?.label}` : ''}`,
                  `${interests.length} topic${interests.length !== 1 ? 's' : ''} selected`,
                  `${careerGoals.length} goal${careerGoals.length !== 1 ? 's' : ''} set`,
                ].map((line) => (
                  <div key={line} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563eb]">
                      <Check size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-[#374151]">{line}</span>
                  </div>
                ))}
              </div>

              <p className="px-4 text-center text-sm landing-muted">
                Your personalized feed is ready — sign in to save your profile and start reading.
              </p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#e5e7eb] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#111827] disabled:opacity-0"
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
              disabled={isSubmitting}
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
