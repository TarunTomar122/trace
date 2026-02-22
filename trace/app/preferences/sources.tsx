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
import { LEARNING_SOURCE_CATEGORIES, updateUserProfile } from '@/lib/firestore';

const ACCENT = '#F59E0B';

export default function EditSourcesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [selected, setSelected] = useState<string[]>(
    Array.isArray(profile?.selectedLearningSources) ? [...profile.selectedLearningSources] : [],
  );
  const [saving, setSaving] = useState(false);

  const original = (profile?.selectedLearningSources || []).slice().sort().join(',');
  const current = [...selected].sort().join(',');
  const hasChanges = original !== current;

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  const handleSave = async () => {
    if (!user || selected.length === 0) {
      showToast('Pick at least one source.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { selectedLearningSources: selected } as any);
      await refreshProfile();
      showToast('Sources updated', 'success');
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
        <ThemedText style={styles.headerTitle}>Deep Dive Sources</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.desc, { color: Colors[colorScheme].muted }]}>
          Choose expert blogs and publications for your "Deep Dives" tab.
        </ThemedText>

        {LEARNING_SOURCE_CATEGORIES.map((cat) => (
          <View key={cat.id} style={styles.catGroup}>
            <ThemedText style={[styles.catLabel, { color: Colors[colorScheme].muted }]}>
              {cat.label}
            </ThemedText>
            {cat.sources.map((src) => {
              const sel = selected.includes(src.name);
              return (
                <Pressable
                  key={src.name}
                  onPress={() => toggle(src.name)}
                  style={[
                    styles.sourceRow,
                    {
                      backgroundColor: sel ? ACCENT + '12' : Colors[colorScheme].card,
                      borderColor: sel ? ACCENT : Colors[colorScheme].border,
                    },
                  ]}>
                  <View style={styles.sourceText}>
                    <ThemedText style={styles.sourceName}>{src.name}</ThemedText>
                    <ThemedText
                      style={[styles.sourceDesc, { color: Colors[colorScheme].muted }]}
                      numberOfLines={1}>
                      {src.description}
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
          </View>
        ))}

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
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  catGroup: { marginBottom: 24 },
  catLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  sourceText: { flex: 1, gap: 2 },
  sourceName: { fontSize: 14, fontWeight: '600' },
  sourceDesc: { fontSize: 12 },
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
