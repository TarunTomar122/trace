import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';

import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TARUN_URL = 'https://tarat.space';
const MONISHA_URL = 'https://monfolio.framer.website/';

function BuilderLink({ label, url, color }: { label: string; url: string; color: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [styles.linkRow, { borderColor: color }, pressed && styles.pressed]}>
      <Text style={[styles.linkText, { color }]}>{label}</Text>
      <ExternalLink size={18} color={color} strokeWidth={1.8} />
    </Pressable>
  );
}

export default function BuildersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>The builders</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.body, { color: colors.muted }]}>
          Trace is built by Tarun and Monisha, who are deeply in love with each other and also engaged.
        </Text>
        <Text style={[styles.body, styles.paragraph, { color: colors.muted }]}>
          Tarun is the engineer behind this app, an indie app developer, and a master&apos;s student in AI at the University of Edinburgh. Monisha is an experienced UX designer. She designed the entire experience, shaping the visual language and everything from the first to last screen.
        </Text>
        <Text style={[styles.body, styles.paragraph, { color: colors.muted }]}>
          Together they wanted to build something that can help them stay on top of tech and AI news without having to scroll through ten different things every single day.
        </Text>

        <View style={styles.links}>
          <BuilderLink label="🌱 Tarun&apos;s digital garden" url={TARUN_URL} color={colors.text} />
          <BuilderLink label="🎨 Monisha&apos;s portfolio" url={MONISHA_URL} color={colors.text} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamilySerif.semiBold, fontSize: 19, lineHeight: 25 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 },
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 25 },
  paragraph: { marginTop: 18 },
  links: { gap: 12, marginTop: 28 },
  linkRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
  pressed: { opacity: 0.7 },
});
