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
import { SUMMARY_STYLES, updateUserProfile } from '@/lib/firestore';

const ACCENT = '#F59E0B';

export default function EditSummaryStyleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [selected, setSelected] = useState(profile?.summaryStyle || '');
  const [saving, setSaving] = useState(false);

  const hasChanges = selected !== (profile?.summaryStyle || '');

  const handleSave = async () => {
    if (!user || !selected) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { summaryStyle: selected } as any);
      await refreshProfile();
      showToast('Summary style updated', 'success');
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
        <ThemedText style={styles.headerTitle}>Summary Style</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.desc, { color: Colors[colorScheme].muted }]}>
          How should we write your article summaries?
        </ThemedText>

        {SUMMARY_STYLES.map((style) => {
          const sel = selected === style.id;
          return (
            <Pressable
              key={style.id}
              onPress={() => setSelected(style.id)}
              style={[
                styles.card,
                {
                  backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                  borderColor: sel ? ACCENT : Colors[colorScheme].border,
                },
              ]}>
              <View style={styles.cardHeader}>
                <ThemedText style={[styles.cardLabel, sel && { color: ACCENT }]}>
                  {style.label}
                </ThemedText>
                {sel && (
                  <View style={[styles.checkCircle, { backgroundColor: ACCENT }]}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </View>
              <ThemedText style={[styles.cardSub, { color: Colors[colorScheme].muted }]}>
                {style.subtitle}
              </ThemedText>
            </Pressable>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: Colors[colorScheme].border }]}>
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasChanges || !selected}
          style={[
            styles.saveBtn,
            { backgroundColor: ACCENT, opacity: saving || !hasChanges || !selected ? 0.4 : 1 },
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
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardLabel: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, lineHeight: 19 },
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
