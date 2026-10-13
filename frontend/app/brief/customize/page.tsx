import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import NewsletterBuilder from './NewsletterBuilder';
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
    <div className="min-h-screen">
      <PublicHeader variant="landing" hideCta />
      <main className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl pt-10 pb-20 sm:pt-14">
          <h1 className="max-w-[20ch] text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]">
            Make it yours
          </h1>
          <p className="mt-2 max-w-[60ch] text-[17px] leading-relaxed text-secondary">
            Pick topics, length and format. The preview is today&rsquo;s real email.
          </p>
          <div className="mt-10">
            {/* /brief lives outside the (auth) group, so it brings its own provider. */}
            <AuthProvider>
              <NewsletterBuilder />
            </AuthProvider>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
