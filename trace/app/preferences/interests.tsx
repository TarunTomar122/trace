import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ONBOARDING_INTERESTS, updateUserProfile } from '@/lib/firestore';

const ACCENT = '#F59E0B';

export default function EditInterestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [selected, setSelected] = useState<string[]>(
    Array.isArray(profile?.interests) ? [...profile.interests] : [],
  );
  const [saving, setSaving] = useState(false);

  const original = (profile?.interests || []).slice().sort().join(',');
  const current = [...selected].sort().join(',');
  const hasChanges = original !== current;

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!user || selected.length === 0) {
      showToast('Pick at least one interest.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { interests: selected } as any);
      await refreshProfile();
      showToast('Interests updated', 'success');
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
        <ThemedText style={styles.headerTitle}>Interests</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.desc, { color: Colors[colorScheme].muted }]}>
          Choose topics you want in your "For You" feed. Pick as many as you like.
        </ThemedText>

        <View style={styles.grid}>
          {ONBOARDING_INTERESTS.map((item) => {
            const sel = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: sel ? ACCENT + '18' : Colors[colorScheme].card,
                    borderColor: sel ? ACCENT : Colors[colorScheme].border,
                  },
                ]}>
                {sel && (
                  <View style={[styles.checkDot, { backgroundColor: ACCENT }]}>
                    <Check size={10} color="#fff" strokeWidth={3} />
                  </View>
                )}
                <ThemedText
                  style={[styles.chipText, { color: sel ? ACCENT : Colors[colorScheme].text }]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
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
