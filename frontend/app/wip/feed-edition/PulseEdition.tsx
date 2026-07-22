"use client";

import { BookOpen, MessagesSquare, Wrench } from 'lucide-react';
import type { V3UserFeed } from '@/lib/firestore';
import type { FeedListItem } from '@/app/(auth)/feed/FeedUi';
import {
  BLUE,
  HAIRLINE,
  INK,
  MUTED,
  EditionFooter,
  EditionHeader,
  MonoLabel,
  StoryImage,
  StoryMeta,
  buildPulseEdition,
  editionSerif,
  type PulseEditionSection,
} from './edition-shared';

const SECTION_ICON = {
  discussions: MessagesSquare,
  tools: Wrench,
  reads: BookOpen,
};

function SignalCard({ item }: { item: FeedListItem }) {
  const url = item.url || (item.data as { url?: string }).url;
  const signalLabel = item.signalCount || item.sourceCount;
  const hasSourceImage = Boolean(item.thumbnail?.trim());
  const content = (
    <div className={hasSourceImage ? 'grid gap-5 md:grid-cols-[minmax(0,1fr)_168px] md:gap-7' : ''}>
      <div className="flex min-w-0 flex-col">
        <StoryMeta item={item} />
        <h2 className={`${editionSerif.className} mt-4 text-[23px] leading-[1.18] transition-colors group-hover:text-[#2557d6]`} style={{ color: INK }}>
          {item.title}
        </h2>
        {item.preview && (
          <p className="mt-3 text-[13.5px] leading-[1.65]" style={{ color: MUTED }}>
            {item.preview}
          </p>
        )}
        <div className="mt-auto pt-5">
          {signalLabel > 0 ? (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: BLUE }}>
              {signalLabel} signal{signalLabel === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </div>
      {hasSourceImage && <StoryImage item={item} useFallback={false} className="aspect-[4/3] w-full self-start" />}
    </div>
  );

  return (
    <article>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex h-full flex-col px-5 py-6 transition-colors hover:bg-[#f5f3ed]"
        >
          {content}
        </a>
      ) : (
        <div className="flex h-full flex-col px-5 py-6">{content}</div>
      )}
    </article>
  );
}

function LockedSignalPreview({ item, remaining }: { item: FeedListItem; remaining: number }) {
  return (
    <div className="relative overflow-hidden border-t" style={{ borderColor: HAIRLINE }}>
      <div className="pointer-events-none select-none opacity-35 blur-[4px]" aria-hidden="true">
        <SignalCard item={item} />
      </div>
      <div className="absolute inset-0 flex items-end bg-gradient-to-b from-transparent via-[#faf9f5]/45 to-[#faf9f5]/95 px-5 py-5">
        <div>
          <MonoLabel>Trace Pro</MonoLabel>
          <p className={`${editionSerif.className} mt-2 text-[21px] leading-[1.2]`} style={{ color: INK }}>
            {remaining} more signal{remaining === 1 ? '' : 's'} in this desk.
          </p>
          <a
            href="/onboarding?intent=checkout"
            className="mt-3 inline-block text-[12px] font-semibold text-[#2557d6] hover:underline"
          >
            Unlock the full Pulse
          </a>
        </div>
      </div>
    </div>
  );
}

function SignalSection({
  section,
  index,
  isPro,
}: {
  section: PulseEditionSection;
  index: number;
  isPro: boolean;
}) {
  const Icon = SECTION_ICON[section.id];
  const visibleItems = isPro ? section.items : section.items.slice(0, 1);
  const hiddenCount = Math.max(0, section.items.length - visibleItems.length);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[500px]">
          <div className="flex items-center gap-2" style={{ color: BLUE }}>
            <Icon size={14} strokeWidth={1.8} />
            <MonoLabel>{String(index).padStart(2, '0')} · {section.label}</MonoLabel>
          </div>
          <h2 className={`${editionSerif.className} mt-3 text-[31px] leading-[1.12]`} style={{ color: INK }}>
            {section.description}
          </h2>
        </div>
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
          {section.items.length} signal{section.items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-5 border" style={{ borderColor: HAIRLINE }}>
        {visibleItems.map((item, itemIndex) => (
          <div
            key={item.id}
            className={itemIndex > 0 ? 'border-t' : ''}
            style={{ borderColor: HAIRLINE }}
          >
            <SignalCard item={item} />
          </div>
        ))}
        {!isPro && hiddenCount > 0 && (
          <LockedSignalPreview item={section.items[visibleItems.length]} remaining={hiddenCount} />
        )}
      </div>
    </section>
  );
}

export default function PulseEdition({ feed, dateLabel, isPro }: { feed: V3UserFeed | null; dateLabel: string; isPro: boolean }) {
  const sections = buildPulseEdition(feed).filter((section) => section.items.length > 0);
  const totalSignals = sections.reduce((total, section) => total + section.items.length, 0);
  const [conversations, ...referenceDesks] = sections;

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8">
      <EditionHeader view="pulse" />

      <div className="pb-12 pt-14 sm:pt-20">
        <MonoLabel>{dateLabel}</MonoLabel>
        <div className="mt-5 max-w-[680px]">
          <h1 className={`${editionSerif.className} text-[56px] leading-[0.98] sm:text-[88px]`} style={{ color: INK }}>
            The Pulse
          </h1>
          <p className="mt-6 max-w-[580px] text-[16.5px] leading-[1.7]" style={{ color: MUTED }}>
            The live edge of tech: what builders are debating, trying, and passing around right now.
          </p>
        </div>
        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BLUE }}>
          {totalSignals} signals · {sections.length} desks · refreshed through the day
        </p>
      </div>

      {sections.length > 0 ? (
        <div>
          {conversations && <SignalSection section={conversations} index={1} isPro={isPro} />}
          {referenceDesks.length > 0 && (
            <div className="mt-14 space-y-14">
              {referenceDesks.map((section, index) => (
                <SignalSection key={section.id} section={section} index={index + 2} isPro={isPro} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="border-y py-16 text-center" style={{ borderColor: HAIRLINE }}>
          <MonoLabel>Pulse</MonoLabel>
          <p className={`${editionSerif.className} mt-4 text-[28px]`} style={{ color: INK }}>Signals are being gathered.</p>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-[1.65]" style={{ color: MUTED }}>
            Check back shortly for the conversations, tools, and reads gaining momentum.
          </p>
        </div>
      )}

      <EditionFooter />
    </div>
  );
}
