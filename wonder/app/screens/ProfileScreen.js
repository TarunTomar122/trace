import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  BookOpen,
  Trophy,
  Settings,
  Clock,
  Target,
  Heart,
  Check,
  X,
} from 'lucide-react-native';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../lib/AuthContext';
import { useMascot } from '../lib/MascotContext';
import { loadUserPreferences, saveUserPreferences } from '../lib/userPreferences';

const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 0;

const TOPIC_EMOJIS = {
  Technology: '🚀',
  Science: '🔬',
  Psychology: '🧠',
  Ideas: '💡',
  Business: '💼',
  Money: '💰',
  Design: '🎨',
  Career: '🎓',
  'Self-development': '🌱',
  Health: '🏃',
  Cooking: '🍳',
  Culture: '🎭',
  Relationships: '❤️',
  Society: '🌍',
};

const ALL_TOPICS = Object.keys(TOPIC_EMOJIS);

const TIME_GOALS = [
  { value: '5', label: '5 min/day', description: 'Quick learner' },
  { value: '10', label: '10 min/day', description: 'Steady pace' },
  { value: '15', label: '15 min/day', description: 'Dedicated' },
  { value: '20', label: '20 min/day', description: 'Power reader' },
];

function PreferenceRow({ icon: Icon, iconColor, label, value, onPress, colors }) {
  return (
    <TouchableOpacity
      style={[styles.prefRow, { backgroundColor: colors.surface }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.prefIconWrap, { backgroundColor: iconColor + '15' }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={styles.prefInfo}>
        <Text style={[styles.prefLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[styles.prefValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function TopicChip({ topic, selected, onToggle, colors }) {
  const emoji = TOPIC_EMOJIS[topic] || '📚';
  return (
    <TouchableOpacity
      style={[
        styles.topicChip,
        {
          backgroundColor: selected ? colors.accent + '20' : colors.background,
          borderColor: selected ? colors.accent : colors.surfaceBorder,
        },
      ]}
      activeOpacity={0.7}
      onPress={() => onToggle(topic)}
    >
      <Text style={styles.topicEmoji}>{emoji}</Text>
      <Text style={[styles.topicText, { color: selected ? colors.accent : colors.textSecondary }]}>
        {topic}
      </Text>
      {selected && <Check size={14} color={colors.accent} strokeWidth={2.5} />}
    </TouchableOpacity>
  );
}

function EditTopicsModal({ visible, topics, onSave, onClose, colors }) {
  const [selected, setSelected] = useState(topics || []);

  useEffect(() => {
    setSelected(topics || []);
  }, [topics, visible]);

  const toggleTopic = (topic) => {
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Your Interests
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.topicsGrid}>
              {ALL_TOPICS.map((topic) => (
                <TopicChip
                  key={topic}
                  topic={topic}
                  selected={selected.includes(topic)}
                  onToggle={toggleTopic}
                  colors={colors}
                />
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={() => onSave(selected)}
          >
            <Text style={[styles.saveButtonText, { color: colors.background }]}>
              Save Changes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function EditTimeGoalModal({ visible, currentGoal, onSave, onClose, colors }) {
  const [selected, setSelected] = useState(currentGoal);

  useEffect(() => {
    setSelected(currentGoal);
  }, [currentGoal, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Daily Goal
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.timeOptions}>
            {TIME_GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.value}
                style={[
                  styles.timeOption,
                  {
                    backgroundColor: selected === goal.value ? colors.accent + '15' : colors.surface,
                    borderColor: selected === goal.value ? colors.accent : colors.surfaceBorder,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => setSelected(goal.value)}
              >
                <View style={styles.timeOptionLeft}>
                  <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>
                    {goal.label}
                  </Text>
                  <Text style={[styles.timeDesc, { color: colors.textTertiary }]}>
                    {goal.description}
                  </Text>
                </View>
                {selected === goal.value && (
                  <Check size={20} color={colors.accent} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={() => onSave(selected)}
          >
            <Text style={[styles.saveButtonText, { color: colors.background }]}>
              Save Changes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { session, signOut, signInWithGoogle } = useAuth();
  const { mascotImage, mascotMessage, mascotState, activity } = useMascot();

  const [prefs, setPrefs] = useState(null);
  const [editingTopics, setEditingTopics] = useState(false);
  const [editingTime, setEditingTime] = useState(false);

  const user = session?.user;
  const name = user?.user_metadata?.full_name || user?.email || 'Reader';
  const email = user?.email || '';

  // Load preferences
  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = useCallback(async () => {
    const data = await loadUserPreferences();
    setPrefs(data);
  }, []);

  const saveTopics = useCallback(async (topics) => {
    if (!prefs) return;
    const updated = {
      ...prefs,
      onboarding: { ...prefs.onboarding, topics },
    };
    await saveUserPreferences(updated);
    setPrefs(updated);
    setEditingTopics(false);
  }, [prefs]);

  const saveTimeGoal = useCallback(async (timeGoal) => {
    if (!prefs) return;
    const updated = {
      ...prefs,
      onboarding: { ...prefs.onboarding, timeGoal },
    };
    await saveUserPreferences(updated);
    setPrefs(updated);
    setEditingTime(false);
  }, [prefs]);

  // Determine mascot mood label
  const moodLabels = {
    happy: 'Thriving!',
    base: 'Content',
    sad1: 'A bit lonely',
    sad2: 'Missing you',
    sad3: 'Very sad',
    dead: 'Help me...',
  };
  const moodLabel = moodLabels[mascotState] || 'Content';

  // Format topics for display
  const topicsDisplay = prefs?.onboarding?.topics?.length
    ? prefs.onboarding.topics.slice(0, 3).join(', ') +
      (prefs.onboarding.topics.length > 3 ? ` +${prefs.onboarding.topics.length - 3}` : '')
    : 'Not set';

  // Format time goal for display
  const timeGoalDisplay = prefs?.onboarding?.timeGoal
    ? `${prefs.onboarding.timeGoal} min/day`
    : 'Not set';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Profile
        </Text>
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: colors.surface }]}
          activeOpacity={0.7}
        >
          <Settings size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mascot Section */}
        <View style={[styles.mascotCard, { backgroundColor: colors.surface }]}>
          <Image source={mascotImage} style={styles.mascotImage} />
          <View style={styles.mascotInfo}>
            <Text style={[styles.mascotMood, { color: colors.accent }]}>
              {moodLabel}
            </Text>
            <Text style={[styles.mascotMessage, { color: colors.textSecondary }]}>
              "{mascotMessage}"
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Flame size={20} color="#FF6B6B" strokeWidth={2} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {activity.currentStreak || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              Day streak
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <BookOpen size={20} color="#4ECDC4" strokeWidth={2} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {activity.totalCardsRead || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              Ideas read
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Trophy size={20} color="#FFE66D" strokeWidth={2} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {activity.longestStreak || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              Best streak
            </Text>
          </View>
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Your Preferences
        </Text>

        <View style={styles.prefsSection}>
          <PreferenceRow
            icon={Heart}
            iconColor="#FF6B6B"
            label="Interests"
            value={topicsDisplay}
            onPress={() => setEditingTopics(true)}
            colors={colors}
          />
          <PreferenceRow
            icon={Clock}
            iconColor="#4ECDC4"
            label="Daily Goal"
            value={timeGoalDisplay}
            onPress={() => setEditingTime(true)}
            colors={colors}
          />
        </View>

        {/* User Info or Sign In Prompt */}
        {session ? (
          <>
            <View style={styles.userSection}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {name}
              </Text>
              {email ? (
                <Text style={[styles.userEmail, { color: colors.textTertiary }]}>
                  {email}
                </Text>
              ) : null}
            </View>

            {/* Sign out */}
            <TouchableOpacity
              style={[styles.signOutButton, { borderColor: colors.surfaceBorder }]}
              activeOpacity={0.7}
              onPress={signOut}
            >
              <Text style={[styles.signOutText, { color: colors.textSecondary }]}>
                Sign out
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.signInCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.signInEmoji}>🔐</Text>
            <Text style={[styles.signInTitle, { color: colors.textPrimary }]}>
              Save your progress
            </Text>
            <Text style={[styles.signInDesc, { color: colors.textTertiary }]}>
              Sign in to sync your streaks, bookmarks, and preferences across devices
            </Text>
            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
              onPress={signInWithGoogle}
            >
              <Text style={[styles.signInButtonText, { color: colors.background }]}>
                Sign in with Google
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Modals */}
      <EditTopicsModal
        visible={editingTopics}
        topics={prefs?.onboarding?.topics}
        onSave={saveTopics}
        onClose={() => setEditingTopics(false)}
        colors={colors}
      />
      <EditTimeGoalModal
        visible={editingTime}
        currentGoal={prefs?.onboarding?.timeGoal}
        onSave={saveTimeGoal}
        onClose={() => setEditingTime(false)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Mascot card
  mascotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    marginTop: 8,
  },
  mascotImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  mascotInfo: {
    flex: 1,
    marginLeft: 16,
  },
  mascotMood: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  mascotMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Preferences
  prefsSection: {
    gap: 10,
    marginBottom: 28,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  prefIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefInfo: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  prefValue: {
    fontSize: 15,
    fontWeight: '600',
  },

  // User info
  userSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },

  // Sign out
  signOutButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignSelf: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Sign in card
  signInCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  signInEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  signInTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  signInDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  signInButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  signInButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  bottomPadding: {
    height: 40,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScroll: {
    maxHeight: 400,
  },

  // Topics grid
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  topicEmoji: {
    fontSize: 16,
  },
  topicText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Time options
  timeOptions: {
    gap: 12,
    marginBottom: 20,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  timeOptionLeft: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeDesc: {
    fontSize: 13,
  },

  // Save button
  saveButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
