import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageShell from '@/components/LegalPageShell';
import { CONTACT_EMAIL, GITHUB_REPO_URL } from '@/lib/site-links';
import { DEFAULT_OPEN_GRAPH } from '@/lib/seo';

const DESCRIPTION =
  'Who builds Trace, how its daily stories are picked and written, and how the comparisons on this site are put together.';

export const metadata: Metadata = {
  title: 'About Trace',
  description: DESCRIPTION,
  alternates: { canonical: 'https://www.yourtrace.online/about' },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: 'About Trace',
    description: DESCRIPTION,
    url: 'https://www.yourtrace.online/about',
    type: 'profile',
  },
  twitter: { card: 'summary_large_image', title: 'About Trace', description: DESCRIPTION },
};

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Tarun Tomar',
  url: 'https://www.yourtrace.online/about',
  sameAs: ['https://x.com/tarat_211'],
  worksFor: { '@type': 'Organization', name: 'Trace', url: 'https://www.yourtrace.online' },
};

const h2 = 'mt-10 mb-3 text-lg font-semibold text-[#111827]';
const p = 'mb-4 text-[15px] leading-7 text-[#374151]';
const a = 'text-[#1634cc] underline underline-offset-2';

export default function AboutPage() {
  return (
    <LegalPageShell activeTab="about" title="About Trace" subtitle="A free daily read of the tech and AI news that matters.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />

      <h2 className={h2}>Who makes it</h2>
      <p className={p}>
        Trace is built and run by Tarun Tomar, a developer who wanted one short, sourced read of the day&rsquo;s tech news instead of a dozen
        tabs and newsletters. The guides and comparisons on this site are written by him. You can reach him at{' '}
        <a className={a} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or on{' '}
        <a className={a} href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer">X</a>.
      </p>

      <h2 className={h2}>How the daily stories are made</h2>
      <p className={p}>
        Every morning Trace reads more than 100 tech sources. Reports about the same event are grouped into one story, so a launch covered by
        ten outlets shows up once, with a link to each report. The summaries are written with AI from that linked reporting, and stories are
        ordered by how much they matter to people who build and invest in tech. The result is the <Link className={a} href="/feed">web feed</Link>{' '}
        and a daily email at 08:30 UK time, with past editions in the <Link className={a} href="/brief">brief archive</Link>.
      </p>
      <p className={p}>
        AI summaries can get things wrong. Every story links its sources so you can check, and a reply to the email reaches a person who fixes it.
      </p>

      <h2 className={h2}>Free and open source</h2>
      <p className={p}>
        Trace is free, with no paid tier. Its code is open source under the AGPL
        {GITHUB_REPO_URL ? (
          <>
            {' '}on <a className={a} href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          </>
        ) : null}
        . A few labelled sponsor slots in the feed and email help cover hosting.
      </p>

      <h2 className={h2}>How our comparisons are written</h2>
      <p className={p}>
        We make Trace, so in our comparisons it is listed separately from the tools we compare and never ranked among them. Prices, free-plan
        limits and features come from each product&rsquo;s own public pages at the time a guide is updated; the date at the top of a guide is
        the last time it was revised. Sponsors don&rsquo;t pay for placement in any guide. If something is out of date, email us and we&rsquo;ll fix it.
      </p>
    </LegalPageShell>
  );
}
