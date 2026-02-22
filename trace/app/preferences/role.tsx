import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ROLES, SENIORITY_LEVELS, updateUserProfile } from '@/lib/firestore';

const ACCENT = '#F59E0B';

export default function EditRoleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [role, setRole] = useState(profile?.role || '');
  const [seniority, setSeniority] = useState(profile?.seniority || '');
  const [saving, setSaving] = useState(false);

  const canSave = role !== '' && seniority !== '';
  const hasChanges = role !== (profile?.role || '') || seniority !== (profile?.seniority || '');

  const handleSave = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { role, seniority } as any);
      await refreshProfile();
      showToast('Role updated', 'success');
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
        <ThemedText style={styles.headerTitle}>Role & Experience</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
          What do you do?
        </ThemedText>
        {ROLES.map((r) => {
          const sel = role === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setRole(r.id)}
              style={[
                styles.option,
                {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                },
              ]}>
              <View style={styles.optionText}>
                <ThemedText style={styles.optionLabel}>{r.label}</ThemedText>
                <ThemedText style={[styles.optionSub, { color: Colors[colorScheme].muted }]}>
                  {r.subtitle}
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

        <ThemedText style={[styles.sectionLabel, { color: Colors[colorScheme].muted, marginTop: 28 }]}>
          Experience level
        </ThemedText>
        {SENIORITY_LEVELS.map((s) => {
          const sel = seniority === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSeniority(s.id)}
              style={[
                styles.option,
                {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                },
              ]}>
              <View style={styles.optionText}>
                <ThemedText style={styles.optionLabel}>{s.label}</ThemedText>
                <ThemedText style={[styles.optionSub, { color: Colors[colorScheme].muted }]}>
                  {s.subtitle}
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
          disabled={saving || !hasChanges || !canSave}
          style={[
            styles.saveBtn,
            { backgroundColor: ACCENT, opacity: saving || !hasChanges || !canSave ? 0.4 : 1 },
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
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
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
