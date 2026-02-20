import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  INTERESTS,
  INTEREST_SUBTOPICS,
  SKILL_SUGGESTIONS,
  triggerFeedGeneration,
  updateUserProfile,
} from '@/lib/firestore';

const ACCENT = '#22c55e';

function Chip({
  label,
  selected,
  onPress,
  colorScheme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? {
              backgroundColor: colorScheme === 'dark' ? '#052e16' : '#f0fdf4',
              borderColor: ACCENT,
            }
          : {
              backgroundColor: 'transparent',
              borderColor: Colors[colorScheme].border,
            },
      ]}
    >
      {selected && (
        <View style={styles.chipCheck}>
          <Check size={10} color="white" strokeWidth={3} />
        </View>
      )}
      <ThemedText
        style={[
          styles.chipText,
          { color: selected ? ACCENT : Colors[colorScheme].text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function PreferencesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<Record<string, string[]>>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const interests = Array.isArray(profile.interests) ? profile.interests : [];
    const focus = (profile.interestQueries || {}) as Record<string, string[]>;
    setSelectedInterests(interests);
    setSelectedFocus(focus);
    setSelectedSkills(Array.isArray(profile.skills) ? profile.skills : []);
  }, [profile]);

  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleSubtopic = useCallback((interestId: string, subtopicId: string) => {
    setSelectedFocus((prev) => {
      const current = prev[interestId] || [];
      if (current.includes(subtopicId)) {
        const nextList = current.filter((s) => s !== subtopicId);
        if (nextList.length === 0) {
          const copy = { ...prev };
          delete copy[interestId];
          return copy;
        }
        return { ...prev, [interestId]: nextList };
      }
      return { ...prev, [interestId]: [...current, subtopicId] };
    });
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const hasAnyInterest = useMemo(() => {
    return (
      selectedInterests.length > 0
      || Object.values(selectedFocus).some((subs) => subs.length > 0)
    );
  }, [selectedInterests, selectedFocus]);

  const handleSave = useCallback(async () => {
    if (!user || !hasAnyInterest) {
      showToast('Pick at least one interest or sub-topic.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const finalInterests = [...new Set([
        ...selectedInterests,
        ...Object.keys(selectedFocus).filter((id) => (selectedFocus[id] || []).length > 0),
      ])];

      const normalizedFocus = Object.fromEntries(
        Object.entries(selectedFocus).filter(([, subs]) => Array.isArray(subs) && subs.length > 0),
      );

      await updateUserProfile(user.uid, {
        interests: finalInterests,
        interestQueries: normalizedFocus,
        skills: selectedSkills,
      });

      await refreshProfile();
      await triggerFeedGeneration(user.uid, { reason: 'preferences_edit', force: true });
      router.replace('/(tabs)?feedUpdating=1');
    } catch (error) {
      console.error('Error saving preferences:', error);
      showToast('Could not save preferences. Please try again.', 'error');
      setIsSaving(false);
    }
  }, [
    user,
    hasAnyInterest,
    selectedInterests,
    selectedFocus,
    selectedSkills,
    refreshProfile,
    showToast,
    router,
  ]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Edit preferences</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Interests ── */}
        {INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest.id);
          const subtopics = INTEREST_SUBTOPICS[interest.id] || [];
          const focusList = selectedFocus[interest.id] || [];

          return (
            <View key={interest.id} style={styles.group}>
              <Pressable
                onPress={() => toggleInterest(interest.id)}
                style={styles.interestRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    isSelected
                      ? { backgroundColor: ACCENT, borderColor: ACCENT }
                      : { backgroundColor: 'transparent', borderColor: Colors[colorScheme].border },
                  ]}
                >
                  {isSelected && <Check size={13} color="white" strokeWidth={3} />}
                </View>
                <ThemedText style={styles.interestLabel}>{interest.label}</ThemedText>
              </Pressable>

              {subtopics.length > 0 && (
                <View style={styles.subtopicArea}>
                  <View style={styles.chipsWrap}>
                    {subtopics.map((sub) => (
                      <Chip
                        key={sub.id}
                        label={sub.label}
                        selected={focusList.includes(sub.id)}
                        onPress={() => toggleSubtopic(interest.id, sub.id)}
                        colorScheme={colorScheme}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Divider ── */}
        <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

        {/* ── Skills ── */}
        <View style={styles.group}>
          <ThemedText style={styles.groupTitle}>Skills</ThemedText>
          <ThemedText style={[styles.groupSub, { color: Colors[colorScheme].muted }]}>
            Helps us adjust content depth for you.
          </ThemedText>
          <View style={[styles.chipsWrap, { marginTop: 6 }]}>
            {SKILL_SUGGESTIONS.map((skill) => (
              <Chip
                key={skill.id}
                label={skill.label}
                selected={selectedSkills.includes(skill.id)}
                onPress={() => toggleSkill(skill.id)}
                colorScheme={colorScheme}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { borderTopColor: Colors[colorScheme].border }]}>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[
            styles.saveButton,
            { backgroundColor: isSaving ? Colors[colorScheme].card : ACCENT },
          ]}
        >
          {isSaving && (
            <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
          )}
          <ThemedText style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save preferences'}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },

  group: {
    marginBottom: 28,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupSub: {
    fontSize: 13,
    lineHeight: 18,
  },

  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestLabel: {
    fontSize: 16,
    fontWeight: '600',
  },

  subtopicArea: {
    marginTop: 14,
    marginLeft: 34,
  },

  chipsWrap: {
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
    paddingVertical: 9,
  },
  chipCheck: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },

  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
});
