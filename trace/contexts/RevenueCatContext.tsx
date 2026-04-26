import React, { createContext, useContext } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Platform } from 'react-native';
// import Purchases, {
//   LOG_LEVEL,
//   CustomerInfo,
//   PurchasesOfferings,
//   PurchasesPackage,
// } from 'react-native-purchases';
// import RevenueCatUI from 'react-native-purchases-ui';
// import { useRouter } from 'expo-router';
// import { useAuth } from '@/contexts/AuthContext';
// import { useToast } from '@/contexts/ToastContext';
// import { getOrCreateUserProfile, triggerFeedGeneration, updateUserProfile } from '@/lib/firestore';
import { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

// ─── PAYWALL DISABLED — all users get full access ───
// const RC_API_KEY = Platform.OS === 'ios'
//   ? 'appl_wxLpHRKnErnnHufdxErbGxwmavE'
//   : 'goog_KNVMTAxIZiOOVXIEZhptsqjFMEU';
// const ENTITLEMENT_ID = 'trace Premium';
// const RC_SNAPSHOT_PREFIX = 'trace_rc_access_v1:';
//
// function rcSnapshotKey(uid: string) { return `${RC_SNAPSHOT_PREFIX}${uid}`; }
// async function readRcAccessSnapshot(uid: string) { ... }
// async function writeRcAccessSnapshot(uid: string, hasAccess: boolean) { ... }
// async function clearRcAccessSnapshot(uid: string) { ... }

// ─── Types ───
interface RevenueCatContextType {
  isProUser: boolean;
  hasRCEntitlement: boolean;
  hasAppSubscriptionSnapshot: boolean;
  hasWebSubscription: boolean;
  isEarlyAdopter: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  loading: boolean;
  presentPaywall: () => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

// ─── PAYWALL DISABLED — stub context, all users get full access ───
const STUB_VALUE: RevenueCatContextType = {
  isProUser: true,
  hasRCEntitlement: false,
  hasAppSubscriptionSnapshot: false,
  hasWebSubscription: false,
  isEarlyAdopter: false,
  customerInfo: null,
  offerings: null,
  loading: false,
  presentPaywall: async () => false,
  presentPaywallIfNeeded: async () => false,
  presentCustomerCenter: async () => {},
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  refreshCustomerInfo: async () => {},
};

const RevenueCatContext = createContext<RevenueCatContextType>(STUB_VALUE);

export const useRevenueCat = () => useContext(RevenueCatContext);

// ─── Provider (paywall logic commented out — re-enable when subscriptions return) ───
export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  // All RC SDK initialization, identify, purchase, and restore logic is commented out.
  // To re-enable: restore the full provider body from git history.

  // const { user, profile, refreshProfile } = useAuth();
  // const { showToast } = useToast();
  // const router = useRouter();
  // ... (full RC init, identify, syncAppSubStatus, cacheRcAccess, useEffects, callbacks)

  return (
    <RevenueCatContext.Provider value={STUB_VALUE}>
      {children}
    </RevenueCatContext.Provider>
  );
}
