import { StyleSheet, View, Pressable, Image, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

const PRIVACY_URL = 'https://www.yourtrace.online/privacy-policy';
const TERMS_URL = 'https://www.yourtrace.online/terms';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const isOnboarded = profile?.onboarded ?? false;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors[colorScheme].border }]}>
        <ThemedText style={styles.headerTitle}>Profile</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <ThemedView
          style={[
            styles.profileCard,
            {
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            },
          ]}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: Colors[colorScheme].border },
              ]}>
              <ThemedText style={styles.avatarInitial}>
                {user?.displayName?.charAt(0) || '?'}
              </ThemedText>
            </View>
          )}
          <View style={styles.profileInfo}>
            <ThemedText type="subtitle" style={styles.profileName}>
              {profile?.name || user?.displayName || 'User'}
            </ThemedText>
            <ThemedText style={[styles.profileEmail, { color: Colors[colorScheme].muted }]}>
              {user?.email || 'No email'}
            </ThemedText>
            {profile?.role && (
              <View style={[styles.roleBadge, { backgroundColor: Colors[colorScheme].foreground + '15' }]}>
                <ThemedText style={[styles.roleText, { color: Colors[colorScheme].foreground }]}>
                  {profile.role}
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>

        {/* Onboarding Callout */}
        {!isOnboarded && (
          <Pressable 
            onPress={() => router.push('/onboarding')}
            style={[styles.calloutCard, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}>
            <View style={styles.calloutIcon}>
              <ThemedText style={{ fontSize: 24 }}>✨</ThemedText>
            </View>
            <View style={styles.calloutContent}>
              <ThemedText style={styles.calloutTitle}>
                Complete your profile
              </ThemedText>
              <ThemedText style={[styles.calloutSubtitle, { color: '#7c3aed' }]}>
                Set up your interests to get a personalized feed.
              </ThemedText>
            </View>
            <ThemedText style={[styles.calloutArrow, { color: '#7c3aed' }]}>→</ThemedText>
          </Pressable>
        )}

        {/* Interests Section */}
        {isOnboarded && profile?.interests && profile.interests.length > 0 && (
          <View style={styles.section}>
            <ThemedText
              style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
              Interests
            </ThemedText>
            <ThemedView
              style={[
                styles.pillsCard,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                },
              ]}>
              <View style={styles.pillsContainer}>
                {profile.interests.map((interest, index) => (
                  <View 
                    key={index} 
                    style={[styles.pill, { backgroundColor: Colors[colorScheme].foreground + '10' }]}>
                    <ThemedText style={styles.pillText}>
                      {interest.replace(/-/g, ' ')}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          </View>
        )}

        {/* Skills Section */}
        {isOnboarded && profile?.skills && profile.skills.length > 0 && (
          <View style={styles.section}>
            <ThemedText
              style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
              Skills
            </ThemedText>
            <ThemedView
              style={[
                styles.pillsCard,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                },
              ]}>
              <View style={styles.pillsContainer}>
                {profile.skills.map((skill, index) => (
                  <View 
                    key={index} 
                    style={[styles.pill, { backgroundColor: Colors[colorScheme].foreground + '10' }]}>
                    <ThemedText style={styles.pillText}>
                      {skill.replace(/-/g, ' ')}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.section}>
          <ThemedText
            style={[styles.sectionLabel, { color: Colors[colorScheme].muted }]}>
            Settings
          </ThemedText>
          <ThemedView
            style={[
              styles.settingsCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
              },
            ]}>
            {isOnboarded && (
              <Pressable
                style={[styles.settingsRow, { borderBottomColor: Colors[colorScheme].border }]}
                onPress={() => router.push('/onboarding')}>
                <View style={styles.settingsRowLeft}>
                  <MaterialIcons name="tune" size={20} color={Colors[colorScheme].foreground} />
                  <ThemedText style={styles.settingsText}>Edit Preferences</ThemedText>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors[colorScheme].muted} />
              </Pressable>
            )}
            <Pressable
              style={[styles.settingsRow, { borderBottomColor: Colors[colorScheme].border }]}
              onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available in a future update.')}>
              <View style={styles.settingsRowLeft}>
                <MaterialIcons name="notifications-none" size={20} color={Colors[colorScheme].foreground} />
                <ThemedText style={styles.settingsText}>Notifications</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors[colorScheme].muted} />
            </Pressable>
            <Pressable 
              style={[styles.settingsRow, { borderBottomColor: Colors[colorScheme].border }]}
              onPress={() => Linking.openURL(PRIVACY_URL)}>
              <View style={styles.settingsRowLeft}>
                <MaterialIcons name="privacy-tip" size={20} color={Colors[colorScheme].foreground} />
                <ThemedText style={styles.settingsText}>Privacy Policy</ThemedText>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={Colors[colorScheme].muted} />
            </Pressable>
            <Pressable 
              style={styles.settingsRow}
              onPress={() => Linking.openURL(TERMS_URL)}>
              <View style={styles.settingsRowLeft}>
                <MaterialIcons name="description" size={20} color={Colors[colorScheme].foreground} />
                <ThemedText style={styles.settingsText}>Terms of Service</ThemedText>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={Colors[colorScheme].muted} />
            </Pressable>
          </ThemedView>
        </View>

        {/* Sign Out Button */}
        <Pressable
          style={[
            styles.signOutButton,
            { borderColor: Colors[colorScheme].border },
          ]}
          onPress={handleSignOut}>
          <ThemedText style={[styles.signOutText, { color: '#b91c1c' }]}>
            Sign Out
          </ThemedText>
        </Pressable>

        {/* Footer */}
        <ThemedText style={[styles.footer, { color: Colors[colorScheme].muted }]}>
          Trace v1.0.0
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  calloutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutContent: {
    flex: 1,
    gap: 4,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  calloutSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  calloutArrow: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  pillsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  settingsCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsText: {
    fontSize: 15,
  },
  signOutButton: {
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
