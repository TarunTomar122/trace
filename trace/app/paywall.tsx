import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Check, Zap, Sparkles } from 'lucide-react-native';
import { PurchasesPackage } from 'react-native-purchases';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useToast } from '@/contexts/ToastContext';

// ─── Benefit list (3 clear outcomes) ───
const BENEFITS = [
  'Every article distilled into 2-min notes & lessons',
  'A daily feed built around what you actually care about',
  'The more you read, the smarter your recommendations get',
];

const ONBOARDING_BENEFITS = [
  'Get a daily feed curated to your interests',
  'Every article with 2-min AI summaries & key takeaways',
  'Cancel anytime in the first 4 days - no charge',
];

// ─── Package display config ───
type PlanId = 'weekly' | 'monthly' | 'yearly';

const PLAN_CONFIG: Record<PlanId, { label: string; badge?: string }> = {
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  yearly: { label: 'Yearly', badge: 'Best value' },
};

const PLAN_ORDER: PlanId[] = ['yearly', 'monthly', 'weekly'];

function getPackagePlanId(pkg: PurchasesPackage): PlanId | null {
  const id = pkg.identifier?.toLowerCase() ?? '';
  if (id.includes('year') || id.includes('annual')) return 'yearly';
  if (id.includes('month')) return 'monthly';
  if (id.includes('week')) return 'weekly';
  // Fallback: check packageType
  const type = pkg.packageType;
  if (type === 'ANNUAL') return 'yearly';
  if (type === 'MONTHLY') return 'monthly';
  if (type === 'WEEKLY') return 'weekly';
  return null;
}

function formatPrice(pkg: PurchasesPackage): string {
  return pkg.product.priceString;
}

function formatPeriod(planId: PlanId): string {
  if (planId === 'yearly') return '/year';
  if (planId === 'monthly') return '/month';
  return '/week';
}

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const { showToast } = useToast();
  const { offerings, purchasePackage, restorePurchases, isProUser } = useRevenueCat();

  const fromOnboarding = params.fromOnboarding === 'true';
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Extract available packages from current offering
  const currentOffering = offerings?.current;
  const packages: { planId: PlanId; pkg: PurchasesPackage }[] = [];

  if (currentOffering) {
    for (const pkg of currentOffering.availablePackages) {
      const planId = getPackagePlanId(pkg);
      if (planId) {
        packages.push({ planId, pkg });
      }
    }
  }

  // Sort by our preferred order
  packages.sort(
    (a, b) => PLAN_ORDER.indexOf(a.planId) - PLAN_ORDER.indexOf(b.planId)
  );

  const selectedPackage = packages.find((p) => p.planId === selectedPlan)?.pkg;

  const handlePurchase = async () => {
    if (!selectedPackage || isPurchasing) return;
    setIsPurchasing(true);
    try {
      const success = await purchasePackage(selectedPackage);
      if (success) {
        if (fromOnboarding) {
          router.replace('/(tabs)');
        } else {
          router.back();
        }
      } else {
        showToast('Purchase not completed.', 'info');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    // Don't allow closing if from onboarding without subscribing
    if (fromOnboarding) {
      return;
    }
    router.back();
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        router.back();
      } else {
        showToast('No purchases to restore.', 'info');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // If they become pro (purchase just succeeded), dismiss the paywall
  useEffect(() => {
    if (isProUser) {
      router.back();
    }
  }, [isProUser]);

  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>
      {/* Close button - only show X if not from onboarding */}
      {!fromOnboarding && (
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={styles.closeButton}>
          <X size={24} color={Colors[colorScheme].muted} strokeWidth={1.8} />
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* ─── Hero ─── */}
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/trace-logo.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <ThemedText style={styles.heroTitle}>
            {fromOnboarding ? 'Get a personalized\nfeed' : 'Unlock smarter\nmornings'}
          </ThemedText>
        </View>

        {/* ─── Benefits ─── */}
        <View style={styles.benefitsList}>
          {(fromOnboarding ? ONBOARDING_BENEFITS : BENEFITS).map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.checkCircle, { backgroundColor: '#22c55e18' }]}>
                <Check size={14} color="#22c55e" strokeWidth={3} />
              </View>
              <ThemedText style={[styles.benefitText, { color: Colors[colorScheme].text }]}>
                {benefit}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* ─── Plan cards ─── */}
        {packages.length > 0 ? (
          <View style={styles.plansContainer}>
            {packages.map(({ planId, pkg }) => {
              const config = PLAN_CONFIG[planId];
              const isSelected = selectedPlan === planId;
              return (
                <Pressable
                  key={planId}
                  onPress={() => setSelectedPlan(planId)}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: isDark ? '#151515' : '#fff',
                      borderColor: isSelected ? '#22c55e' : Colors[colorScheme].border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}>
                  {/* Radio + label */}
                  <View style={styles.planLeft}>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: isSelected ? '#22c55e' : Colors[colorScheme].border,
                        },
                      ]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <View style={styles.planLabelRow}>
                        <ThemedText style={styles.planLabel}>{config.label}</ThemedText>
                        {config.badge && (
                          <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>{config.badge}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Price */}
                  <View style={styles.planRight}>
                    <ThemedText style={styles.planPrice}>
                      {formatPrice(pkg)}
                    </ThemedText>
                    <ThemedText style={[styles.planPeriod, { color: Colors[colorScheme].muted }]}>
                      {formatPeriod(planId)}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.loadingPlans}>
            <ActivityIndicator size="small" color={Colors[colorScheme].muted} />
            <ThemedText style={[styles.loadingText, { color: Colors[colorScheme].muted }]}>
              Loading plans...
            </ThemedText>
          </View>
        )}

        {/* ─── CTA ─── */}
        <Pressable
          onPress={handlePurchase}
          disabled={!selectedPackage || isPurchasing}
          style={[
            styles.ctaButton,
            (!selectedPackage || isPurchasing) && { opacity: 0.5 },
          ]}>
          {isPurchasing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Zap size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.ctaText}>
                Start subscription
              </Text>
            </>
          )}
        </Pressable>

        {/* ─── Restore ─── */}
        <Pressable onPress={handleRestore} disabled={isRestoring} style={styles.restoreButton}>
          <ThemedText style={[styles.restoreText, { color: Colors[colorScheme].muted }]}>
            {isRestoring ? 'Restoring...' : 'Restore purchases'}
          </ThemedText>
        </Pressable>

        {/* ─── Legal ─── */}
        <ThemedText style={[styles.legal, { color: Colors[colorScheme].muted }]}>
          {fromOnboarding 
            ? 'Start your free trial. Cancel anytime in the first 4 days to avoid being charged. After that, your subscription auto-renews unless cancelled at least 24 hours before the end of the current period.'
            : 'Payment will be charged to your App Store account. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.'
          }
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 68,
    paddingBottom: 40,
  },

  // ─── Hero ───
  hero: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 14,
  },
  heroLogo: {
    width: 56,
    height: 56,
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // ─── Benefits ───
  benefitsList: {
    gap: 16,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },

  // ─── Plans ───
  plansContainer: {
    gap: 10,
    marginBottom: 28,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  planBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planRight: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 12,
    fontWeight: '500',
  },

  loadingPlans: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
  },

  // ─── CTA ───
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 999,
    marginBottom: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ─── Restore ───
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ─── Legal ───
  legal: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
