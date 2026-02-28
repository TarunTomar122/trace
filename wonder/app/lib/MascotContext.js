import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loadReadingActivity,
  getMascotState,
  recordCardRead,
  MASCOT_IMAGES,
  getMascotMessage,
} from './mascot';
import {
  DEV_MODE,
  DEV_MASCOT_STATE,
  DEV_STREAK_COUNT,
  DEV_CARDS_READ_TODAY,
  DEV_TOTAL_CARDS_READ,
  DEV_DAYS_SINCE_READ,
  getDevOverride,
  devLog,
} from './devConfig';

const MascotContext = createContext(null);

export function MascotProvider({ children }) {
  const [activity, setActivity] = useState({
    lastReadTimestamp: null,
    cardsReadToday: 0,
    todayDate: null,
    totalCardsRead: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [mascotState, setMascotState] = useState('base');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load activity on mount
  useEffect(() => {
    loadReadingActivity().then((data) => {
      setActivity(data);
      const today = new Date().toDateString();
      const cardsToday = data.todayDate === today ? data.cardsReadToday : 0;

      // Calculate mascot state (can be overridden by dev config)
      let calculatedState;
      if (DEV_MODE && DEV_DAYS_SINCE_READ !== null) {
        // Simulate days since read
        const fakeTimestamp = new Date();
        fakeTimestamp.setDate(fakeTimestamp.getDate() - DEV_DAYS_SINCE_READ);
        calculatedState = getMascotState(fakeTimestamp.toISOString(), DEV_DAYS_SINCE_READ === 0 ? 1 : 0);
      } else {
        calculatedState = getMascotState(data.lastReadTimestamp, cardsToday);
      }

      // Direct state override takes precedence
      const finalState = getDevOverride(DEV_MASCOT_STATE, calculatedState);
      setMascotState(finalState);

      devLog('Mascot state:', finalState, '| Real state:', calculatedState);
      setIsLoaded(true);
    });
  }, []);

  // Record a card read
  const onCardRead = useCallback(async () => {
    const updated = await recordCardRead();
    setActivity(updated);
    // In dev mode with forced state, don't change mascot on read
    if (!DEV_MODE || DEV_MASCOT_STATE === null) {
      setMascotState('happy');
    }
  }, []);

  // Apply dev overrides to activity
  const displayActivity = {
    ...activity,
    currentStreak: getDevOverride(DEV_STREAK_COUNT, activity.currentStreak),
    cardsReadToday: getDevOverride(DEV_CARDS_READ_TODAY, activity.cardsReadToday),
    totalCardsRead: getDevOverride(DEV_TOTAL_CARDS_READ, activity.totalCardsRead),
    // Keep longestStreak in sync with currentStreak override if applicable
    longestStreak: DEV_MODE && DEV_STREAK_COUNT !== null
      ? Math.max(DEV_STREAK_COUNT, activity.longestStreak)
      : activity.longestStreak,
  };

  // Get current mascot image (with dev override support)
  const displayState = getDevOverride(DEV_MASCOT_STATE, mascotState);
  const mascotImage = MASCOT_IMAGES[displayState] || MASCOT_IMAGES.base;

  // Get a message for current state
  const mascotMessage = getMascotMessage(displayState);

  const value = {
    activity: displayActivity,
    mascotState: displayState,
    mascotImage,
    mascotMessage,
    onCardRead,
    isLoaded,
    // Expose real values for debugging
    _realActivity: activity,
    _realMascotState: mascotState,
  };

  return (
    <MascotContext.Provider value={value}>
      {children}
    </MascotContext.Provider>
  );
}

export function useMascot() {
  const context = useContext(MascotContext);
  if (!context) {
    throw new Error('useMascot must be used within a MascotProvider');
  }
  return context;
}
