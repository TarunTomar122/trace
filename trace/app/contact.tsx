import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';

import { TRACE_CONTACT_PAGE_URL, TRACE_SUPPORT_EMAIL } from '@/constants/contact';
import { Colors, FontFamily, FontFamilySerif } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ContactScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const bg = Colors[colorScheme].background;
  const text = isDark ? '#fff' : '#0A0A0A';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.6)';
  const link = isDark ? '#7CB8FF' : '#2563EB';
  const cardBg = isDark ? '#1c1c1c' : '#f5f5f5';

  const openMail = () => {
    Linking.openURL(
      `mailto:${TRACE_SUPPORT_EMAIL}?subject=${encodeURIComponent('Trace app — contact')}`,
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={isDark ? '#fff' : '#0A0A0A'} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#312D2D' }]}>Contact us</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: muted }]}>
          Questions about Trace, editorial feedback, or technical support? Email us below or open our
          contact page for the same details as on the web.
        </Text>

        <Text style={[styles.sectionTitle, { color: text }]}>Contact us</Text>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.label, { color: muted }]}>Email</Text>
          <Pressable onPress={openMail}>
            <Text style={[styles.emailLine, { color: link }]}>{TRACE_SUPPORT_EMAIL}</Text>
          </Pressable>
          <Text style={[styles.hint, { color: muted }]}>
            Tap the address to send email from your device.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>Contact page</Text>
        <Pressable
          style={[styles.linkRow, { backgroundColor: cardBg }]}
          onPress={() => WebBrowser.openBrowserAsync(TRACE_CONTACT_PAGE_URL)}>
          <Text style={[styles.linkText, { color: link }]} selectable>
            {TRACE_CONTACT_PAGE_URL}
          </Text>
          <ExternalLink size={18} color={muted} strokeWidth={1.8} />
        </Pressable>
        <Text style={[styles.hint, { color: muted, marginTop: 8 }]}>
          Privacy, terms, subscription help, and more contact options.
        </Text>

        <Text style={[styles.sectionTitle, { color: text, marginTop: 28 }]}>Article sources</Text>
        <Text style={[styles.body, { color: muted }]}>
          Stories credit the original publisher or outlet where available. Open any article and check the
          byline and the Sources section for links to original reporting.
        </Text>
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
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 19,
    lineHeight: 25,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  lead: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  sectionTitle: {
    fontFamily: FontFamilySerif.semiBold,
    fontSize: 17,
    lineHeight: 23,
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    padding: 16,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  emailLine: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
  },
});
