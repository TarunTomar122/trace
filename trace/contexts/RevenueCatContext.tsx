import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
import { getOrCreateUserProfile, triggerFeedGeneration, updateUserProfile } from '@/lib/firestore';

// ─── Config ───
const RC_API_KEY =
  Platform.OS === 'ios'
    ? 'appl_wxLpHRKnErnnHufdxErbGxwmavE'
    : 'goog_KNVMTAxIZiOOVXIEZhptsqjFMEU';
const ENTITLEMENT_ID = 'trace Premium';
const RC_SNAPSHOT_PREFIX = 'trace_rc_access_v1:';

function rcSnapshotKey(uid: string): string {
  return `${RC_SNAPSHOT_PREFIX}${uid}`;
}

async function readRcAccessSnapshot(uid: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(rcSnapshotKey(uid));
    return raw === 'true';
  } catch (error) {
    console.warn('[RevenueCat] Failed to read cached access snapshot:', error);
    return false;
  }
}

async function writeRcAccessSnapshot(uid: string, hasAccess: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(rcSnapshotKey(uid), hasAccess ? 'true' : 'false');
  } catch (error) {
    console.warn('[RevenueCat] Failed to write cached access snapshot:', error);
  }
}

async function clearRcAccessSnapshot(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(rcSnapshotKey(uid));
  } catch (error) {
    console.warn('[RevenueCat] Failed to clear cached access snapshot:', error);
  }
}

// ─── Types ───
interface RevenueCatContextType {
  /** True if the user has access via RevenueCat (app), Dodo (web), or Early Adopter. */
  isProUser: boolean;
  /** True only if the user has an active RevenueCat entitlement (app purchase). */
  hasRCEntitlement: boolean;
  /** True if the stored profile already indicates app subscription access. */
  hasAppSubscriptionSnapshot: boolean;
  /** True only if the user has an active web subscription via Dodo/Firestore. */
  hasWebSubscription: boolean;
  /** True if user signed up during the early adopter promo period. */
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

const RevenueCatContext = createContext<RevenueCatContextType>({
  isProUser: false,
  hasRCEntitlement: false,
  hasAppSubscriptionSnapshot: false,
  hasWebSubscription: false,
  isEarlyAdopter: false,
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
  const { user, profile, profileResolved, refreshProfile } = useAuth();
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
  const lastSnapshotUid = useRef<string | null>(null);

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedRcAccess, setCachedRcAccess] = useState(false);

  // ─── Access from RevenueCat (app purchases) ───
  const hasRCEntitlement = !!customerInfo?.entitlements.active[ENTITLEMENT_ID];

  // ─── Access from persisted app-subscription state in Firestore ───
  const appStatus = profile?.appSubscriptionStatus || 'none';
  const hasAppSubscriptionSnapshot = appStatus === 'active' || appStatus === 'trial';

  // ─── Access from Dodo/web (Firestore subscriptionStatus) ───
  const webStatus = profile?.subscriptionStatus || 'none';
  const hasWebSubscription = webStatus === 'active' || webStatus === 'trial';

  // ─── Access from Early Adopter program (launch promo) ───
  const isEarlyAdopter = profile?.isEarlyAdopter === true;

  // ─── Combined: user has access if ANY source grants it ───
  const isProUser =
    hasRCEntitlement ||
    cachedRcAccess ||
    hasAppSubscriptionSnapshot ||
    hasWebSubscription ||
    isEarlyAdopter;

  // - Sync appSubscriptionStatus to Firestore (stable - uses refs) -
  const syncAppSubStatus = useCallback(async (info: CustomerInfo) => {
    const currentUser = userRef.current;
    const uid = currentUser?.uid;
    if (!uid) return;
    if (!profileResolved) {
      console.log('[RevenueCat] Skipping appSubscriptionStatus sync until profile resolves');
      return;
    }
    const status = deriveAppSubStatus(info);
    try {
      // Prevent merge-creating skeletal user_profiles docs when RC sync wins the race.
      await getOrCreateUserProfile(
        uid,
        currentUser?.email || '',
        currentUser?.displayName || '',
        currentUser?.photoURL || null
      );
      await updateUserProfile(uid, { appSubscriptionStatus: status } as any);
      refreshProfileRef.current();
      console.log('[RevenueCat] Synced appSubscriptionStatus =', status);
    } catch (error) {
      console.error('[RevenueCat] Error syncing appSubscriptionStatus:', error);
    }
  }, [profileResolved]);

  const cacheRcAccess = useCallback(async (uid: string | null, info: CustomerInfo | null) => {
    if (!uid) return;
    const hasAccess = !!info?.entitlements.active[ENTITLEMENT_ID];
    setCachedRcAccess(hasAccess);
    await writeRcAccessSnapshot(uid, hasAccess);
  }, []);

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
          lastSnapshotUid.current = uid;
          const cached = await readRcAccessSnapshot(uid);
          setCachedRcAccess(cached);
          const { customerInfo: info } = await Purchases.logIn(uid);
          setCustomerInfo(info);
          await cacheRcAccess(uid, info);
          syncAppSubStatus(info);
          console.log('[RevenueCat] Logged in as', uid);
        } else {
          if (lastSnapshotUid.current) {
            await clearRcAccessSnapshot(lastSnapshotUid.current);
            lastSnapshotUid.current = null;
          }
          setCachedRcAccess(false);
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
      void cacheRcAccess(userRef.current?.uid ?? null, info);
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
        await cacheRcAccess(userRef.current?.uid ?? null, info);
        const success = !!info.entitlements.active[ENTITLEMENT_ID];

        if (success) {
          await syncAppSubStatus(info);
          const uid = userRef.current?.uid;
          if (uid) {
            await updateUserProfile(uid, { feedBuildStatus: 'building' } as any);
            await triggerFeedGeneration(uid, { reason: 'purchase', force: true });
          }
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
      await cacheRcAccess(userRef.current?.uid ?? null, info);
      const success = !!info.entitlements.active[ENTITLEMENT_ID];
      await syncAppSubStatus(info);
      if (success) {
        const uid = userRef.current?.uid;
        if (uid) {
          await updateUserProfile(uid, { feedBuildStatus: 'building' } as any);
          await triggerFeedGeneration(uid, { reason: 'restore', force: true });
        }
        showToast('Purchase restored — your full feed is building!', 'success');
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
      await cacheRcAccess(userRef.current?.uid ?? null, info);
      await syncAppSubStatus(info);
    } catch (error) {
      console.error('[RevenueCat] Error refreshing customer info:', error);
    }
  }, [cacheRcAccess, syncAppSubStatus]);

  return (
    <RevenueCatContext.Provider
      value={{
        isProUser,
        hasRCEntitlement,
        hasAppSubscriptionSnapshot,
        hasWebSubscription,
        isEarlyAdopter,
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
