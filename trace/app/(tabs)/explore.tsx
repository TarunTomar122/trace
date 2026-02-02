import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { profile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        <ThemedText style={[styles.subtitle, { color: Colors[colorScheme].secondary }]}>
          Manage your Trace preferences.
        </ThemedText>
      </View>

      <ThemedView
        style={[
          styles.card,
          { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
        ]}>
        <ThemedText type="defaultSemiBold">Signed in as</ThemedText>
        <ThemedText style={[styles.cardText, { color: Colors[colorScheme].muted }]}>
          {profile?.email ?? 'Unknown'}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  cardText: {
    fontSize: 13,
  },
});
