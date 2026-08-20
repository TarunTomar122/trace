import { useState, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Check, Zap, ArrowRight, Bell, Calendar, Gift } from 'lucide-react-native';
import { PurchasesPackage } from 'react-native-purchases';

import { ThemedText } from '@/components/themed-text';
import { AppLogo } from '@/components/app-logo';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useToast } from '@/contexts/ToastContext';

const TRIAL_DAYS = 3;
const REMINDER_DAY = 3;

const FREE_FEATURES = [
  'Big stories across AI, tech, and world news',
  'Duplicate coverage grouped into one clear storyline',
  'Short summaries so you know what matters fast',
];

const PRO_FEATURES = [
  'Your full personalized pulse, updated daily',
  'Key takeaways and context without the tab-hopping',
  'Signal over noise in one calm feed',
];

const BENEFITS = [
  'Full summaries and context',
  'Live updates as stories change',
  'A feed built around your interests',
];

type PlanId = 'weekly' | 'monthly' | 'yearly';

const PLAN_CONFIG: Record<PlanId, { label: string; badge?: string }> = {
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  yearly: { label: 'Yearly', badge: 'Save 20%' },
};

const PLAN_ORDER: PlanId[] = ['yearly', 'monthly', 'weekly'];

function getPackagePlanId(pkg: PurchasesPackage): PlanId | null {
  const id = pkg.identifier?.toLowerCase() ?? '';
  if (id.includes('year') || id.includes('annual')) return 'yearly';
  if (id.includes('month')) return 'monthly';
  if (id.includes('week')) return 'weekly';
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

// ─── Timeline item ───
function TimelineItem({
  icon,
  label,
  title,
  desc,
  isLast,
  colorScheme,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  desc: string;
  isLast?: boolean;
  colorScheme: 'light' | 'dark';
}) {
  return (
    <View style={tlStyles.row}>
      {/* Left: icon + line */}
      <View style={tlStyles.leftCol}>
        <View style={[tlStyles.iconWrap, { backgroundColor: `${Colors[colorScheme].accent}18` }]}>
          {icon}
        </View>
        {!isLast && (
          <View style={[tlStyles.line, { backgroundColor: Colors[colorScheme].border }]} />
        )}
      </View>
      {/* Right: text */}
      <View style={tlStyles.textCol}>
        <Text style={[tlStyles.label, { color: '#F59E0B' }]}>{label}</Text>
        <ThemedText style={tlStyles.title}>{title}</ThemedText>
        <ThemedText style={[tlStyles.desc, { color: Colors[colorScheme].muted }]}>{desc}</ThemedText>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
    minHeight: 72,
  },
  leftCol: {
    alignItems: 'center',
    width: 40,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 1,
  },
  textCol: {
    flex: 1,
    paddingBottom: 24,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    lineHeight: 22,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
  },
});

// ─── Step 1: Welcome + What you get ───
function StepPrimer({
  colorScheme,
  onNext,
  onClose,
}: {
  colorScheme: 'light' | 'dark';
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <AppLogo style={styles.heroLogo} />
        <ThemedText style={styles.heroTitle}>
          {"You're in!"}
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
          Your setup is done. Unlock full Trace to get your complete daily pulse in one place.
        </ThemedText>
      </View>

      <ThemedText style={[primerStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>
        WHAT TRACE DOES
      </ThemedText>
      <View style={styles.benefitsList}>
        {FREE_FEATURES.map((f, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={[styles.checkCircle, { backgroundColor: `${Colors[colorScheme].accent}18` }]}>
              <Check size={14} color={Colors[colorScheme].accent} strokeWidth={3} />
            </View>
            <ThemedText style={[styles.benefitText, { color: Colors[colorScheme].text }]}>
              {f}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText style={[primerStyles.sectionLabel, { color: '#F59E0B', marginTop: 20 }]}>
        FULL ACCESS (TRY FOR {TRIAL_DAYS} DAYS)
      </ThemedText>
      <View style={styles.benefitsList}>
        {PRO_FEATURES.map((f, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={[styles.checkCircle, { backgroundColor: `${Colors[colorScheme].accent}18` }]}>
              <Zap size={14} color={Colors[colorScheme].accent} strokeWidth={2.5} />
            </View>
            <ThemedText style={[styles.benefitText, { color: Colors[colorScheme].text }]}>
              {f}
            </ThemedText>
          </View>
        ))}
      </View>

      <Pressable onPress={onNext} style={[styles.ctaButton, { marginTop: 28, backgroundColor: Colors[colorScheme].foreground }]}>
        <Gift size={18} color={Colors[colorScheme].background} strokeWidth={2} />
        <Text style={[styles.ctaText, { color: Colors[colorScheme].background }]}>Try the full app for {TRIAL_DAYS} days</Text>
        <ArrowRight size={18} color={Colors[colorScheme].background} strokeWidth={2.5} />
      </Pressable>

      <Pressable onPress={onClose} style={styles.skipButton}>
        <ThemedText style={[styles.skipText, { color: Colors[colorScheme].muted }]}>
          Not now
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const primerStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 1,
    marginBottom: 14,
  },
});

// ─── Step 2: Transparency Promise ───
function StepReminder({
  colorScheme,
  onNext,
  onClose,
}: {
  colorScheme: 'light' | 'dark';
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { marginBottom: 36 }]}>
        <ThemedText style={styles.heroTitle}>
          {"Use it for real.\nThen decide."}
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
          Don’t pay because a paywall asked you to. Pay only if the full version genuinely saves you time this week.
        </ThemedText>
      </View>

      <View style={{ marginBottom: 36 }}>
        <TimelineItem
          icon={<Gift size={18} color="#F59E0B" strokeWidth={2} />}
          label="Today"
          title="Unlock full Trace"
          desc="Get the full daily pulse across AI, tech, and global stories, already grouped and summarized."
          colorScheme={colorScheme}
        />
        <TimelineItem
          icon={<Bell size={18} color="#F59E0B" strokeWidth={2} />}
          label={`Day ${REMINDER_DAY}`}
          title="Get a reminder"
          desc="We remind you before the trial ends so you have time to decide without guessing."
          colorScheme={colorScheme}
        />
        <TimelineItem
          icon={<Calendar size={18} color="#F59E0B" strokeWidth={2} />}
          label={`Day ${TRIAL_DAYS + 1}`}
          title="Keep it only if it helps"
          desc="If Trace becomes part of your daily routine, keep it. If not, cancel in Settings in a couple taps."
          isLast
          colorScheme={colorScheme}
        />
      </View>

      <Pressable onPress={onNext} style={[styles.ctaButton, { backgroundColor: Colors[colorScheme].foreground }]}>
        <Text style={[styles.ctaText, { color: Colors[colorScheme].background }]}>Show me the plans</Text>
        <ArrowRight size={18} color={Colors[colorScheme].background} strokeWidth={2.5} />
      </Pressable>

      <Pressable onPress={onClose} style={styles.skipButton}>
        <ThemedText style={[styles.skipText, { color: Colors[colorScheme].muted }]}>
          Not now
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

// ─── Step 3: Hard Close (the actual paywall) ───
function StepPaywall({
  colorScheme,
  packages,
  selectedPlan,
  onSelectPlan,
  onPurchase,
  onRestore,
  onClose,
  isPurchasing,
  isRestoring,
  isBillingReady,
  fromOnboarding,
}: {
  colorScheme: 'light' | 'dark';
  packages: { planId: PlanId; pkg: PurchasesPackage }[];
  selectedPlan: PlanId;
  onSelectPlan: (p: PlanId) => void;
  onPurchase: () => void;
  onRestore: () => void;
  onClose: () => void;
  isPurchasing: boolean;
  isRestoring: boolean;
  isBillingReady: boolean;
  fromOnboarding: boolean;
}) {
  const selectedPackage = packages.find((p) => p.planId === selectedPlan)?.pkg;
  const ctaDisabled = !selectedPackage || isPurchasing || !isBillingReady;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <AppLogo style={styles.heroLogo} />
        <ThemedText style={styles.heroTitle}>
          Read the full story.
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
          Trace groups coverage from 100+ sources so you can actually understand what happened.
        </ThemedText>
      </View>

      {!fromOnboarding && (
        <View style={styles.benefitsList}>
          {BENEFITS.map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.checkCircle, { backgroundColor: `${Colors[colorScheme].accent}18` }]}>
                <Check size={14} color={Colors[colorScheme].accent} strokeWidth={3} />
              </View>
              <ThemedText style={[styles.benefitText, { color: Colors[colorScheme].text }]}>
                {benefit}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {packages.length > 0 ? (
        <View style={styles.plansContainer}>
          {packages.map(({ planId, pkg }) => {
            const config = PLAN_CONFIG[planId];
            const isSelected = selectedPlan === planId;
            return (
              <Pressable
                key={planId}
                onPress={() => onSelectPlan(planId)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isSelected ? `${Colors[colorScheme].accent}18` : Colors[colorScheme].card,
                    borderColor: isSelected ? Colors[colorScheme].accent : Colors[colorScheme].border,
                  },
                ]}>
                <View style={styles.planLeft}>
                  <View>
                    <View style={styles.planLabelRow}>
                      <ThemedText style={styles.planLabel}>{config.label}</ThemedText>
                      {config.badge && (
                        <View style={[styles.planBadge, { backgroundColor: Colors[colorScheme].accent }]}>
                          <Text style={[styles.planBadgeText, { color: Colors[colorScheme].accentForeground }]}>{config.badge}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.planRight}>
                  <ThemedText style={styles.planPrice}>{formatPrice(pkg)}</ThemedText>
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

      <Pressable
        onPress={onPurchase}
        disabled={ctaDisabled}
        style={[
          styles.ctaButton,
          { backgroundColor: Colors[colorScheme].foreground },
          ctaDisabled && { opacity: 0.5 },
        ]}>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors[colorScheme].background} />
        ) : (
          <>
            <Zap size={18} color={Colors[colorScheme].background} strokeWidth={2} />
            <Text style={[styles.ctaText, { color: Colors[colorScheme].background }]}>
              {!isBillingReady
                ? 'Preparing billing...'
                : fromOnboarding
                  ? `Start my ${TRIAL_DAYS}-day trial`
                  : `Start ${TRIAL_DAYS}-day trial`}
            </Text>
          </>
        )}
      </Pressable>

      <Pressable onPress={onRestore} disabled={isRestoring || !isBillingReady} style={styles.restoreButton}>
        <ThemedText style={[styles.restoreText, { color: Colors[colorScheme].muted }]}>
          {isRestoring ? 'Restoring...' : !isBillingReady ? 'Preparing purchases...' : 'Restore purchases'}
        </ThemedText>
      </Pressable>

      <ThemedText style={[styles.legal, { color: Colors[colorScheme].muted }]}>
        {fromOnboarding
          ? `Nothing charged today. Try the full app for ${TRIAL_DAYS} days, then your plan starts unless you cancel first in Settings.`
          : `Try the full app for ${TRIAL_DAYS} days. After that, billing goes through your App Store account unless you cancel in Settings.`}
      </ThemedText>
    </ScrollView>
  );
}

// ─── Root ───
export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const { showToast } = useToast();
  const { offerings, purchasePackage, restorePurchases, isProUser, loading: rcLoading } = useRevenueCat();

  // Paywall disabled — redirect all users straight to the app
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);

  const fromOnboarding = params.fromOnboarding === 'true';

  // Start at step 1 only for the onboarding flow
  const [step, setStep] = useState<1 | 2 | 3>(fromOnboarding ? 1 : 3);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const currentOffering = offerings?.current;
  const packages: { planId: PlanId; pkg: PurchasesPackage }[] = [];

  if (currentOffering) {
    for (const pkg of currentOffering.availablePackages) {
      const planId = getPackagePlanId(pkg);
      if (planId) packages.push({ planId, pkg });
    }
  }
  packages.sort((a, b) => PLAN_ORDER.indexOf(a.planId) - PLAN_ORDER.indexOf(b.planId));

  const selectedPackage = packages.find((p) => p.planId === selectedPlan)?.pkg;

  const advanceTo = (nextStep: 1 | 2 | 3) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // small delay so fade-out finishes before content switches
    setTimeout(() => setStep(nextStep), 180);
  };

  const handlePurchase = async () => {
    if (!selectedPackage || isPurchasing) return;
    if (rcLoading) {
      showToast('Still preparing billing. Try again in a moment.', 'info');
      return;
    }
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
    if (fromOnboarding) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    if (rcLoading) {
      showToast('Still preparing purchases. Try again in a moment.', 'info');
      return;
    }
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

  useEffect(() => {
    if (isProUser) {
      router.back();
    }
  }, [isProUser]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}>
      {/* Close button — always visible */}
      <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
        <X size={24} color={Colors[colorScheme].muted} strokeWidth={1.8} />
      </Pressable>

      {/* Step indicator dots — only for the onboarding flow */}
      {fromOnboarding && (
        <View style={styles.dots}>
          {([1, 2, 3] as const).map((s) => (
            <View
              key={s}
              style={[
                styles.dot,
                {
                  backgroundColor: step >= s ? '#F59E0B' : Colors[colorScheme].border,
                  width: step === s ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
      )}

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        {step === 1 && (
          <StepPrimer
            colorScheme={colorScheme}
            onNext={() => advanceTo(2)}
            onClose={handleClose}
          />
        )}
        {step === 2 && (
          <StepReminder
            colorScheme={colorScheme}
            onNext={() => advanceTo(3)}
            onClose={handleClose}
          />
        )}
        {step === 3 && (
          <StepPaywall
            colorScheme={colorScheme}
            packages={packages}
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
            onPurchase={handlePurchase}
            onRestore={handleRestore}
            onClose={handleClose}
            isPurchasing={isPurchasing}
            isRestoring={isRestoring}
            isBillingReady={!rcLoading}
            fromOnboarding={fromOnboarding}
          />
        )}
      </Animated.View>
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
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 20,
    paddingBottom: 4,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
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
    fontFamily: FontFamilySerif.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  heroSub: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // ─── Benefits ───
  benefitsList: {
    gap: 16,
    marginBottom: 32,
    paddingHorizontal: 32,
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
    fontFamily: FontFamily.semiBold,
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
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planLabel: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  planBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planRight: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  planPeriod: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
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
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 999,
    marginBottom: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },

  // ─── Skip ───
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  skipText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  // ─── Restore ───
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  restoreText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  // ─── Legal ───
  legal: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
