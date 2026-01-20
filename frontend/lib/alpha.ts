/**
 * Alpha release mode utilities
 * App is permanently in alpha mode (no waitlist gating).
 */

export const isAlphaMode = (): boolean => true;

export const getAlphaStatus = () => {
  const alpha = isAlphaMode();
  return {
    isAlpha: alpha,
    isWaitlist: !alpha,
  };
};

