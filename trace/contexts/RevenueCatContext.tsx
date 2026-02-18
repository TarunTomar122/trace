import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Purchases, {
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { triggerFeedGeneration, updateUserProfile } from '@/lib/firestore';

// ─── Config ───
const RC_API_KEY = 'goog_KNVMTAxIZiOOVXIEZhptsqjFMEU';
const ENTITLEMENT_ID = 'trace Premium';

// ─── Types ───
interface RevenueCatContextType {
  /** True if the user has access via EITHER RevenueCat (app) OR Dodo (web). */
  isProUser: boolean;
  /** True only if the user has an active RevenueCat entitlement (app purchase). */
  hasRCEntitlement: boolean;
  /** True only if the user has an active web subscription via Dodo/Firestore. */
  hasWebSubscription: boolean;
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

const RevenueCatContext = createContext<RevenueCatContextType>({
  isProUser: false,
  hasRCEntitlement: false,
  hasWebSubscription: false,
  customerInfo: null,
  offerings: null,
  loading: true,
  presentPaywall: async () => false,
  presentPaywallIfNeeded: async () => false,
  presentCustomerCenter: async () => {},
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  refreshCustomerInfo: async () => {},
});

export const useRevenueCat = () => useContext(RevenueCatContext);

// ─── Derive app subscription status from RevenueCat CustomerInfo ───
function deriveAppSubStatus(
  info: CustomerInfo | null
): 'none' | 'trial' | 'active' | 'expired' {
  if (!info) return 'none';
  const ent = info.entitlements.active[ENTITLEMENT_ID];
  if (!ent) {
    const past = info.entitlements.all[ENTITLEMENT_ID];
    if (past && !past.isActive) return 'expired';
    return 'none';
  }
  if (ent.periodType === 'TRIAL') return 'trial';
  return 'active';
}

// ─── Provider ───
export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const userRef = useRef(user);
  userRef.current = user;
  const refreshProfileRef = useRef(refreshProfile);
  refreshProfileRef.current = refreshProfile;

  const lastIdentifiedUid = useRef<string | null>(null);
  const configuredRef = useRef(false);

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Access from RevenueCat (app purchases) ───
  const hasRCEntitlement = !!customerInfo?.entitlements.active[ENTITLEMENT_ID];

  // ─── Access from Dodo/web (Firestore subscriptionStatus) ───
  const webStatus = profile?.subscriptionStatus || 'none';
  const hasWebSubscription = webStatus === 'active' || webStatus === 'trial';

  // ─── Combined: user has access if EITHER source grants it ───
  const isProUser = hasRCEntitlement || hasWebSubscription;

  // - Sync appSubscriptionStatus to Firestore (stable - uses refs) -
  const syncAppSubStatus = useCallback(async (info: CustomerInfo) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const status = deriveAppSubStatus(info);
    try {
      await updateUserProfile(uid, { appSubscriptionStatus: status } as any);
      refreshProfileRef.current();
      console.log('[RevenueCat] Synced appSubscriptionStatus =', status);
    } catch (error) {
      console.error('[RevenueCat] Error syncing appSubscriptionStatus:', error);
    }
  }, []); // stable - no deps, uses refs

  // ─── Initialize SDK (once) ───
  useEffect(() => {
    if (configuredRef.current) return;
    configuredRef.current = true;

    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: RC_API_KEY });
    console.log('[RevenueCat] SDK configured');

    // Fetch offerings once
    Purchases.getOfferings()
      .then((offs) => {
        setOfferings(offs);
        console.log('[RevenueCat] Offerings loaded:', Object.keys(offs.all));
      })
      .catch((error) => {
        console.error('[RevenueCat] Error fetching offerings:', error);
      });
  }, []);

  // ─── Identify user when Firebase UID changes ───
  useEffect(() => {
    if (!configuredRef.current) return;

    const uid = user?.uid ?? null;
    if (uid === lastIdentifiedUid.current) return;
    lastIdentifiedUid.current = uid;

    const identify = async () => {
      setLoading(true);
      try {
        if (uid) {
          const { customerInfo: info } = await Purchases.logIn(uid);
          setCustomerInfo(info);
          syncAppSubStatus(info);
          console.log('[RevenueCat] Logged in as', uid);
        } else {
          const info = await Purchases.logOut();
          setCustomerInfo(info);
          console.log('[RevenueCat] Logged out');
        }
      } catch (error) {
        console.error('[RevenueCat] Error identifying user:', error);
      } finally {
        setLoading(false);
      }
    };

    identify();
  }, [user?.uid, syncAppSubStatus]);

  // ─── Listen for customer info changes (renewal, expiry, etc.) ───
  useEffect(() => {
    if (!configuredRef.current) return;

    const listener = (info: CustomerInfo) => {
      console.log('[RevenueCat] Customer info updated');
      setCustomerInfo(info);
      syncAppSubStatus(info);
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [syncAppSubStatus]);

  // ─── Present custom paywall screen ───
  const presentPaywall = useCallback(async (): Promise<boolean> => {
    try {
      routerRef.current?.push('/paywall');
      return true;
    } catch (error) {
      console.error('[RevenueCat] Error presenting paywall:', error);
      return false;
    }
  }, []);

  // ─── Present paywall only if not entitled ───
  const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    if (isProUser) return false;
    return presentPaywall();
  }, [isProUser, presentPaywall]);

  // ─── Present Customer Center (for managing RC subscriptions) ───
  const presentCustomerCenter = useCallback(async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (error) {
      console.error('[RevenueCat] Error presenting customer center:', error);
    }
  }, []);

  // ─── Purchase a specific package ───
  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      try {
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        const success = !!info.entitlements.active[ENTITLEMENT_ID];

        if (success) {
          // Ensure Firestore reflects app subscription before backend hook runs.
          await syncAppSubStatus(info);
          const uid = userRef.current?.uid;
          if (uid) {
            await triggerFeedGeneration(uid, { reason: 'purchase' });
          }
          
          // Navigate to welcome screen
          routerRef.current?.replace('/welcome-pro');
        }

        return success;
      } catch (error: any) {
        if (error.userCancelled) {
          console.log('[RevenueCat] User cancelled purchase');
          return false;
        }
        console.error('[RevenueCat] Purchase error:', error);
        showToast('Purchase failed. Please try again.', 'error');
        return false;
      }
    },
    [showToast, syncAppSubStatus]
  );

  // ─── Restore purchases ───
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const success = !!info.entitlements.active[ENTITLEMENT_ID];
      await syncAppSubStatus(info);
      if (success) {
        const uid = userRef.current?.uid;
        if (uid) {
          await triggerFeedGeneration(uid, { reason: 'restore' });
        }
        showToast('Purchase restored!', 'success');
      } else {
        showToast('No active purchases found to restore.', 'info');
      }
      return success;
    } catch (error) {
      console.error('[RevenueCat] Restore error:', error);
      showToast('Restore failed. Please try again.', 'error');
      return false;
    }
  }, [showToast, syncAppSubStatus]);

  // ─── Refresh customer info ───
  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (error) {
      console.error('[RevenueCat] Error refreshing customer info:', error);
    }
  }, []);

  return (
    <RevenueCatContext.Provider
      value={{
        isProUser,
        hasRCEntitlement,
        hasWebSubscription,
        customerInfo,
        offerings,
        loading,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        purchasePackage,
        restorePurchases,
        refreshCustomerInfo,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}
