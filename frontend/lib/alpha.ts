/**
 * Alpha release mode utilities
 * When ALPHA_MODE=true: Only homepage accessible, all other routes show WIP
 * When ALPHA_MODE=false: Users can sign up but see waitlist after sign in
 */

export const isAlphaMode = (): boolean => {
  // Check both server-side and client-side env vars
  console.log('process.env.ALPHA_MODE', process.env.ALPHA_MODE);
  console.log('process.env.NEXT_PUBLIC_ALPHA_MODE', process.env.NEXT_PUBLIC_ALPHA_MODE);
  if (typeof window === 'undefined') {
    return process.env.ALPHA_MODE === 'true';
  }
  return process.env.NEXT_PUBLIC_ALPHA_MODE === 'true';
};

export const getAlphaStatus = () => {
  const alpha = isAlphaMode();
  return {
    isAlpha: alpha,
    isWaitlist: !alpha,
  };
};

