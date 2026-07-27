"use client";

import { useMemo } from 'react';
import { Play } from 'lucide-react';
import type { V3UserFeed } from '@/lib/firestore';
import type { FeedListItem } from '@/app/(auth)/feed/FeedUi';
import {
  INK,
  MUTED,
  buildPulseEdition,
  editionSerif,
  sentencePreview,
} from '@/app/wip/feed-edition/edition-shared';
import { ArticleImage } from '@/components/ArticleImage';

type PreviewSignal = {
  item: FeedListItem;
  section: string;
};

const FEATURED_MATCHES = [
  (signal: PreviewSignal) => signal.item.title.includes('moeru-ai / airi'),
  (signal: PreviewSignal) => signal.item.title.includes('PGSimCity'),
  (signal: PreviewSignal) => signal.item.source === 'AI Engineer',
];

function isVideo(item: FeedListItem): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(item.url || '');
}

function previewThumbnail(item: FeedListItem): string | null | undefined {
  if (item.thumbnail) return item.thumbnail;
  try {
    const url = new URL(item.url || '');
    const videoId = url.hostname.includes('youtu.be')
      ? url.pathname.slice(1)
      : url.searchParams.get('v');
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
  } catch {
    return undefined;
  }
}

function pickSignals(feed: V3UserFeed | null): PreviewSignal[] {
  const sections = buildPulseEdition(feed);
  const signals = sections.flatMap((section) =>
    section.items.map((item) => ({ item, section: section.label })),
  );
  const selected: PreviewSignal[] = [];

  for (const match of FEATURED_MATCHES) {
    const signal = signals.find((candidate) =>
      !selected.some(({ item }) => item.id === candidate.item.id) && match(candidate),
    );
    if (signal) selected.push(signal);
  }
  for (const section of sections) {
    const signal = signals.find((candidate) =>
      candidate.section === section.label
      && !selected.some(({ item }) => item.id === candidate.item.id),
    );
    if (signal && selected.length < 3) selected.push(signal);
  }
  return selected.slice(0, 3);
}

function PreviewCard({ signal }: { signal: PreviewSignal }) {
  const { item, section } = signal;
  const video = isVideo(item);

  return (
    <a href="/feed?view=pulse" className="group flex h-full flex-col border-r border-[#e4e1d8] p-5 last:border-r-0 hover:bg-[#f5f3ed]">
      <div className="relative">
        <ArticleImage
          thumbnail={previewThumbnail(item)}
          title={item.title}
          alt=""
          className="aspect-[16/9] w-full border border-[#e4e1d8] object-cover"
        />
        {video && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-[#faf9f5] px-2.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">
            <Play size={10} fill="currentColor" /> Video
          </span>
        )}
      </div>
      <span className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2557d6]">
        {section}
      </span>
      <h3 className={`${editionSerif.className} mt-3 text-[23px] leading-[1.16] group-hover:text-[#2557d6]`} style={{ color: INK }}>
        {item.title}
      </h3>
      {item.preview && (
        <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: MUTED }}>
          {sentencePreview(item.preview, 1)}
        </p>
      )}
      <span className="mt-auto pt-5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
        {item.source}
      </span>
    </a>
  );
}

export default function HomeEditionPreview({ feed }: { feed: V3UserFeed | null }) {
  const signals = useMemo(() => pickSignals(feed), [feed]);

  if (!signals.length) return null;

  return (
    <section className="border border-[#e4e1d8] bg-[#faf9f5]">
      <div className="flex items-center justify-between border-b border-[#e4e1d8] px-5 py-5 sm:px-8">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2557d6]">Live from Trace</span>
        <a href="/feed?view=pulse" className="text-[12px] font-semibold text-[#2557d6] hover:underline">Open feed</a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3">
        {signals.map((signal) => <PreviewCard key={signal.item.id} signal={signal} />)}
      </div>
    </section>
  );
}
