import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DEV_MODE,
  DEV_SUBSCRIPTION_STATUS,
  getDevOverride,
  devLog,
} from './devConfig';

const SubscriptionContext = createContext(null);

// Subscription tiers and their features
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    maxCardsPerDay: 5,
    offlineAccess: false,
    noAds: false,
    allContent: false,
  },
  pro: {
    name: 'Pro',
    maxCardsPerDay: Infinity,
    offlineAccess: true,
    noAds: true,
    allContent: true,
  },
  premium: {
    name: 'Premium',
    maxCardsPerDay: Infinity,
    offlineAccess: true,
    noAds: true,
    allContent: true,
    earlyAccess: true,
  },
};

export function SubscriptionProvider({ children }) {
  // In a real app, this would come from your backend/IAP
  const [realSubscription, setRealSubscription] = useState('free');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate loading subscription status
    // In real app: fetch from backend or check IAP status
    setTimeout(() => {
      setRealSubscription('free');
      setIsLoaded(true);
      devLog('Subscription loaded:', 'free');
    }, 100);
  }, []);

  // Apply dev override
  const subscription = getDevOverride(DEV_SUBSCRIPTION_STATUS, realSubscription);
  const tier = SUBSCRIPTION_TIERS[subscription] || SUBSCRIPTION_TIERS.free;

  const value = {
    subscription,
    tier,
    isLoaded,
    isPro: subscription === 'pro' || subscription === 'premium',
    isFree: subscription === 'free',
    // Helper to check feature access
    hasFeature: (feature) => tier[feature] === true,
    // For debugging
    _realSubscription: realSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
