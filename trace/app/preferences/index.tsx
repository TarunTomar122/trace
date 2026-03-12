import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Sparkles,
  Target,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import {
  ROLES,
  SENIORITY_LEVELS,
  ONBOARDING_INTERESTS,
  CAREER_GOALS,
} from '@/lib/firestore';

function lookupLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((i) => i.id === id)?.label || id.replace(/-/g, ' ');
}

type PrefRowProps = {
  icon: typeof Briefcase;
  label: string;
  value?: string;
  colorScheme: 'light' | 'dark';
  onPress: () => void;
  danger?: boolean;
};

function PrefRow({ icon: Icon, label, value, colorScheme, onPress, danger }: PrefRowProps) {
  const iconColor = danger ? '#EF4444' : Colors[colorScheme].muted;
  const labelColor = danger ? '#EF4444' : Colors[colorScheme].text;

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? '#EF444410' : Colors[colorScheme].foreground + '08' }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.5} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowLabel, { color: labelColor }]}>{label}</ThemedText>
        {value && value !== '' && (
          <ThemedText
            style={[styles.rowValue, { color: Colors[colorScheme].muted }]}
            numberOfLines={1}>
            {value}
          </ThemedText>
        )}
      </View>
      <ChevronRight size={18} color={Colors[colorScheme].border} strokeWidth={1.5} />
    </Pressable>
  );
}

export default function PreferencesHub() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { profile } = useAuth();

  const roleValue = [
    profile?.role ? lookupLabel(ROLES as any, profile.role) : '',
    profile?.seniority ? lookupLabel(SENIORITY_LEVELS as any, profile.seniority) : '',
  ].filter(Boolean).join(' · ');

  const interestValue = (profile?.interests || [])
    .map((id: string) => lookupLabel(ONBOARDING_INTERESTS as any, id))
    .join(', ');

  const goalsValue = (profile?.careerGoals || [])
    .map((id: string) => lookupLabel(CAREER_GOALS as any, id))
    .join(', ');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
          Feed preferences
        </ThemedText>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <PrefRow
            icon={Briefcase}
            label="Role & Experience"
            value={roleValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/role')}
          />
          <View style={[styles.rowDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <PrefRow
            icon={Sparkles}
            label="Interests"
            value={interestValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/interests')}
          />
          <View style={[styles.rowDivider, { backgroundColor: Colors[colorScheme].border }]} />
          <PrefRow
            icon={Target}
            label="Career Goals"
            value={goalsValue}
            colorScheme={colorScheme}
            onPress={() => router.push('/preferences/goals')}
          />
        </View>

              </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 13,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
});
