import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { CAREER_GOALS, updateUserProfile, triggerFeedGeneration } from '@/lib/firestore';

const ACCENT = '#F59E0B';

export default function EditGoalsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [selected, setSelected] = useState<string[]>(
    Array.isArray(profile?.careerGoals) ? [...profile.careerGoals] : [],
  );
  const [saving, setSaving] = useState(false);

  const originalRef = useRef<string>(
    (Array.isArray(profile?.careerGoals) ? [...profile.careerGoals] : []).sort().join(',')
  );
  const current = [...selected].sort().join(',');
  const hasChanges = originalRef.current !== current;

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!user || selected.length === 0) {
      showToast('Pick at least one goal.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        careerGoals: selected,
        feedBuildStatus: 'building',
        feedBuildRequestedAt: new Date().toISOString(),
      } as any);
      await triggerFeedGeneration(user.uid, { reason: 'preferences_edit', force: true });
      await refreshProfile();
      showToast('Goals saved — feed is rebuilding!', 'success');
      router.back();
    } catch {
      showToast('Could not save. Try again.', 'error');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Career Goals</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.desc, { color: Colors[colorScheme].muted }]}>
          What are you working toward? This helps us prioritize content.
        </ThemedText>

        {CAREER_GOALS.map((goal) => {
          const sel = selected.includes(goal.id);
          return (
            <Pressable
              key={goal.id}
              onPress={() => toggle(goal.id)}
              style={[
                styles.option,
                {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                },
              ]}>
              <View style={styles.optionText}>
                <ThemedText style={styles.optionLabel}>{goal.label}</ThemedText>
                <ThemedText style={[styles.optionSub, { color: Colors[colorScheme].muted }]}>
                  {goal.subtitle}
                </ThemedText>
              </View>
              {sel && (
                <View style={[styles.checkCircle, { backgroundColor: ACCENT }]}>
                  <Check size={12} color="#fff" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: Colors[colorScheme].border }]}>
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasChanges || selected.length === 0}
          style={[
            styles.saveBtn,
            { backgroundColor: ACCENT, opacity: saving || !hasChanges || selected.length === 0 ? 0.4 : 1 },
          ]}>
          {saving && <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />}
          <ThemedText style={styles.saveBtnText}>Save</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionSub: { fontSize: 12 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
