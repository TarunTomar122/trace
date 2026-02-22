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
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useToast } from '@/contexts/ToastContext';

const TRIAL_DAYS = 4;
const REMINDER_DAY = 3;

const FREE_FEATURES = [
  'Full Trending feed across all topics',
  'Preview of For You & Deep Dives',
  'Bookmark articles to read later',
];

const PRO_FEATURES = [
  'Unlimited For You articles matched to your interests',
  'Full Deep Dives from experts you trust',
  'Summaries tailored to your preferred reading style',
];

const BENEFITS = [
  'Unlimited For You articles matched to your interests',
  'Full Deep Dives from the industry sources you trust',
  'Personalized summaries in your preferred reading style',
];

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
  const isDark = colorScheme === 'dark';
  return (
    <View style={tlStyles.row}>
      {/* Left: icon + line */}
      <View style={tlStyles.leftCol}>
        <View style={[tlStyles.iconWrap, { backgroundColor: isDark ? '#1a1408' : '#fffbeb' }]}>
          {icon}
        </View>
        {!isLast && (
          <View style={[tlStyles.line, { backgroundColor: isDark ? '#1f2937' : '#e5e7eb' }]} />
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
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
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
  const isDark = colorScheme === 'dark';
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <AppLogo style={styles.heroLogo} />
        <ThemedText style={styles.heroTitle}>
          {"You're all set!"}
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
          Your feed is being built right now. Here{"'"}s what you get:
        </ThemedText>
      </View>

      <ThemedText style={[primerStyles.sectionLabel, { color: Colors[colorScheme].muted }]}>
        INCLUDED FREE
      </ThemedText>
      <View style={styles.benefitsList}>
        {FREE_FEATURES.map((f, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={[styles.checkCircle, { backgroundColor: isDark ? '#1a1408' : '#fffbeb' }]}>
              <Check size={14} color="#F59E0B" strokeWidth={3} />
            </View>
            <ThemedText style={[styles.benefitText, { color: Colors[colorScheme].text }]}>
              {f}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText style={[primerStyles.sectionLabel, { color: '#F59E0B', marginTop: 20 }]}>
        WITH PRO (FREE FOR {TRIAL_DAYS} DAYS)
      </ThemedText>
      <View style={styles.benefitsList}>
        {PRO_FEATURES.map((f, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={[styles.checkCircle, { backgroundColor: '#F59E0B18' }]}>
              <Zap size={14} color="#F59E0B" strokeWidth={2.5} />
            </View>
            <ThemedText style={[styles.benefitText, { color: Colors[colorScheme].text }]}>
              {f}
            </ThemedText>
          </View>
        ))}
      </View>

      <Pressable onPress={onNext} style={[styles.ctaButton, { marginTop: 28 }]}>
        <Gift size={18} color="#fff" strokeWidth={2} />
        <Text style={styles.ctaText}>Try Pro free for {TRIAL_DAYS} days</Text>
        <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <Pressable onPress={onClose} style={styles.skipButton}>
        <ThemedText style={[styles.skipText, { color: Colors[colorScheme].muted }]}>
          Skip, I{"'"}ll use the free version
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const primerStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
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
          {"No surprises,\nwe promise"}
        </ThemedText>
        <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
          Here{"'"}s exactly how your free trial works:
        </ThemedText>
      </View>

      <View style={{ marginBottom: 36 }}>
        <TimelineItem
          icon={<Gift size={18} color="#F59E0B" strokeWidth={2} />}
          label="Today"
          title="Full Pro access starts"
          desc="Unlimited articles, deep dives, personalized summaries."
          colorScheme={colorScheme}
        />
        <TimelineItem
          icon={<Bell size={18} color="#F59E0B" strokeWidth={2} />}
          label={`Day ${REMINDER_DAY}`}
          title="We'll remind you"
          desc="You'll get a heads-up before anything is charged."
          colorScheme={colorScheme}
        />
        <TimelineItem
          icon={<Calendar size={18} color="#F59E0B" strokeWidth={2} />}
          label={`Day ${TRIAL_DAYS + 1}`}
          title="Your call"
          desc="Keep Pro or cancel — no hard feelings either way."
          isLast
          colorScheme={colorScheme}
        />
      </View>

      <Pressable onPress={onNext} style={styles.ctaButton}>
        <Text style={styles.ctaText}>Sounds good, show me plans</Text>
        <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <Pressable onPress={onClose} style={styles.skipButton}>
        <ThemedText style={[styles.skipText, { color: Colors[colorScheme].muted }]}>
          Skip, I{"'"}ll use the free version
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
  fromOnboarding: boolean;
}) {
  const isDark = colorScheme === 'dark';
  const selectedPackage = packages.find((p) => p.planId === selectedPlan)?.pkg;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <AppLogo style={styles.heroLogo} />
        <ThemedText style={styles.heroTitle}>
          {fromOnboarding ? 'Choose your plan' : 'Unlock smarter\nmornings'}
        </ThemedText>
        {fromOnboarding && (
          <ThemedText style={[styles.heroSub, { color: Colors[colorScheme].muted }]}>
            All plans include your {TRIAL_DAYS}-day free trial.
          </ThemedText>
        )}
      </View>

      {!fromOnboarding && (
        <View style={styles.benefitsList}>
          {BENEFITS.map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.checkCircle, { backgroundColor: '#F59E0B18' }]}>
                <Check size={14} color="#F59E0B" strokeWidth={3} />
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
                    backgroundColor: isDark ? '#151515' : '#fff',
                    borderColor: isSelected ? '#F59E0B' : Colors[colorScheme].border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}>
                <View style={styles.planLeft}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: isSelected ? '#F59E0B' : Colors[colorScheme].border },
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
              {fromOnboarding ? `Start ${TRIAL_DAYS}-day free trial` : 'Start subscription'}
            </Text>
          </>
        )}
      </Pressable>

      <Pressable onPress={onRestore} disabled={isRestoring} style={styles.restoreButton}>
        <ThemedText style={[styles.restoreText, { color: Colors[colorScheme].muted }]}>
          {isRestoring ? 'Restoring...' : 'Restore purchases'}
        </ThemedText>
      </Pressable>

      <ThemedText style={[styles.legal, { color: Colors[colorScheme].muted }]}>
        {fromOnboarding
          ? `Start your ${TRIAL_DAYS}-day free trial. Cancel anytime before Day ${TRIAL_DAYS + 1} to avoid being charged. After that, your subscription auto-renews unless cancelled at least 24 hours before the end of the current period.`
          : 'Payment will be charged to your App Store account. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.'}
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
  const { offerings, purchasePackage, restorePurchases, isProUser } = useRevenueCat();

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
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 999,
    marginBottom: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ─── Skip ───
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
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
