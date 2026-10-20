import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import NewsletterBuilder from './NewsletterBuilder';
import { HOME_CSS } from '@/lib/home-css';
import { HOME_FONT_VARS } from '@/lib/home-fonts';
import { CUSTOMIZE_CSS } from '@/lib/customize-css';
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE, metadataTitle, SITE_BASE_URL } from '@/lib/seo';

const TITLE = 'Build your daily brief';
const DESCRIPTION =
  'Choose your topics, how many stories, and how you read them. See exactly what tomorrow morning’s email will look like before you save it.';

export const metadata: Metadata = {
  title: metadataTitle(TITLE),
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_BASE_URL}/brief/customize` },
  openGraph: { ...DEFAULT_OPEN_GRAPH, title: TITLE, description: DESCRIPTION, url: `${SITE_BASE_URL}/brief/customize` },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [DEFAULT_TWITTER_IMAGE] },
};

export default function CustomizeBriefPage() {
  return (
    <div className={`hp ${HOME_FONT_VARS} min-h-screen`}>
      <style>{HOME_CSS}</style>
      <style>{CUSTOMIZE_CSS}</style>
      <PublicHeader />
      <main>
        <section className="cz-head">
          <h1 className="hp-h1">Make it yours</h1>
          <p>Pick your topics, how many stories you get and how you read them. The preview is today&rsquo;s real email.</p>
        </section>
        <div className="cz">
          {/* /brief lives outside the (auth) group, so it brings its own provider. */}
          <AuthProvider>
            <NewsletterBuilder />
          </AuthProvider>
        </div>
      </main>
      <Footer variant="landing" />
    </div>
  );
}
