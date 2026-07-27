"use client";

/**
 * PROTOTYPE — "The Edition" (winning variant, chosen 2026-07-22).
 * Centered masthead + compact stat line + contents filter + numbered topic
 * sections. The page IS the 2-minute catch-up.
 *
 * Row anatomy: [number] [title / preview / compact meta] [thumb right].
 * Images reveal on expand only — nothing always-on. Expanded = full width.
 */

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { FeedListItem } from '@/app/(auth)/feed/FeedUi';
import {
  trackFeedFilterChanged,
  trackFeedStoryExpanded,
} from '@/lib/posthog';
import {
  BLUE,
  HAIRLINE,
  INK,
  MUTED,
  PAPER,
  ExpandedStory,
  EditionFooter,
  EditionHeader,
  DailyBriefNote,
  LockedWireRows,
  MonoLabel,
  ProEditionNote,
  ProTag,
  StoryShareButton,
  StoryImage,
  StoryMeta,
  editionSerif,
  isLocked,
  pad2,
  sentencePreview,
  type EditionModel,
  useDialogFocus,
} from './edition-shared';

function StoryCard({
  item,
  number,
  onOpen,
  showImages,
}: {
  item: FeedListItem;
  number: number;
  onOpen: () => void;
  showImages: boolean;
}) {
  return (
    <article className="border-b border-r" style={{ borderColor: HAIRLINE }}>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col gap-5 p-5 text-left transition-colors hover:bg-[#f5f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2557d6]"
      >
        {showImages && <StoryImage item={item} className="aspect-[16/9] w-full" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: BLUE }}>
            {pad2(number)}
          </span>
          <h2 className={`${editionSerif.className} mt-3 text-[23px] leading-[1.18] transition-colors group-hover:text-[#2557d6]`} style={{ color: INK }}>
            {item.title}
          </h2>
          {item.preview && (
            <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: MUTED }}>
              {sentencePreview(item.preview, 1)}
            </p>
          )}
          <span className="mt-auto pt-5"><StoryMeta item={item} /></span>
        </div>
      </button>
    </article>
  );
}

function EditionStoryModal({
  item,
  number,
  section,
  tier,
  onClose,
}: {
  item: FeedListItem;
  number: number;
  section: string;
  tier: 'free' | 'pro';
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edition-story-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <article ref={dialogRef} tabIndex={-1} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#faf9f5] sm:h-auto sm:max-h-[90vh] sm:max-w-[760px] sm:border" style={{ borderColor: HAIRLINE }}>
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7" style={{ borderColor: HAIRLINE }}>
          <div className="flex items-center gap-4">
            <MonoLabel>Story {pad2(number)}</MonoLabel>
            <StoryShareButton item={item} />
          </div>
          <button type="button" onClick={onClose} className="p-2" aria-label="Close story">
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-7 sm:px-10 sm:py-9">
          <StoryMeta item={item} />
          <h2 id="edition-story-title" className={`${editionSerif.className} mt-4 text-[30px] leading-[1.12] sm:text-[38px]`} style={{ color: INK }}>
            {item.title}
          </h2>
          <div className="mt-5 sm:hidden">
            <StoryImage item={item} className="aspect-[16/9] w-full" />
          </div>
          <div className="mt-5">
            <ExpandedStory
              item={item}
              showImages={false}
              className="max-w-none"
              tracking={{ position: number, section, tier }}
            />
          </div>
        </div>
      </article>
    </div>
  );
}

function AccessVerificationNote({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => Promise<unknown>;
}) {
  return (
    <div className="mt-7 border px-5 py-4" style={{ borderColor: HAIRLINE, color: MUTED }} role="status">
      <p className="text-[13.5px] leading-[1.6]">
        {failed
          ? 'Trace could not verify your subscription. Your edition stays locked without showing an upgrade prompt.'
          : 'Checking your subscription before opening the rest of today’s edition.'}
      </p>
      {failed && (
        <button
          type="button"
          onClick={() => void onRetry()}
          className="mt-3 text-[12px] font-semibold hover:underline"
          style={{ color: BLUE }}
        >
          Retry access check
        </button>
      )}
    </div>
  );
}

export default function FeedEdition({
  model,
  onRetryAccess,
}: {
  model: EditionModel;
  onRetryAccess: () => Promise<unknown>;
}) {
  const { edition, isPro, accessPending, accessVerificationFailed } = model;
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedStory, setSelectedStory] = useState<{
    item: FeedListItem;
    number: number;
    section: string;
  } | null>(null);

  const selectSection = (filter: string) => {
    if (filter === activeFilter) return;
    trackFeedFilterChanged(filter, activeFilter);
    setSelectedStory(null);
    setActiveFilter(filter);
  };

  const openStory = (item: FeedListItem, position: number, section: string) => {
    trackFeedStoryExpanded({
      itemId: item.id,
      itemType: item.type,
      source: item.source,
      position,
      section,
      tier: isPro ? 'pro' : 'free',
    });
    setSelectedStory({ item, number: position, section });
  };

  const filters = useMemo(() => {
    const entries = edition.sections.map((s) => ({
      id: s.interestId,
      label: s.label,
      count: s.stories.length,
    }));
    if (edition.latest.length > 0) {
      entries.push({ id: '__latest', label: 'LATEST', count: edition.latest.length });
    }
    return entries;
  }, [edition]);

  const visibleSections = useMemo(() => {
    return [
      ...edition.sections.map((s) => ({ id: s.interestId, label: s.label, stories: s.stories })),
      ...(edition.latest.length > 0
        ? [{ id: '__latest', label: 'LATEST', stories: edition.latest }]
        : []),
    ];
  }, [edition]);

  const visibleStoryNumber = useMemo(() => {
    const visibleStories = visibleSections.flatMap((section) => section.stories);
    return new Map(visibleStories.map((item, index) => [item.id, index + 1]));
  }, [visibleSections]);
  const freeCount = model.freeIds.size;
  let paywallShown = false;

  return (
    <div id="edition-top" className="mx-auto max-w-[1500px] scroll-mt-24 px-6 sm:px-10 lg:px-12">
      <EditionHeader view="edition" />

      {/* hero */}
      <div className="pb-10 pt-14 sm:pt-20">
        <MonoLabel>{model.dateLabel}</MonoLabel>
        <h1
          className={`${editionSerif.className} mt-5 text-[56px] leading-[0.98] tracking-[-0.01em] sm:text-[88px]`}
          style={{ color: INK }}
        >
          Today in tech.
        </h1>
        {/* the 2-minute promise, one compact line */}
        <p
          className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: BLUE }}
        >
          {edition.readMinutes} min to catch up · {edition.totalCount} stories · {model.topicCount} topics · {model.totalSources} sources
        </p>
      </div>

      {/* topic filter */}
      <div
        data-edition-filter
        className="sticky top-0 z-50 isolate -mx-6 overflow-x-auto border-y px-6 py-4 shadow-[0_10px_18px_rgba(250,249,245,0.98)] [scrollbar-width:none] sm:-mx-10 sm:px-10 lg:-mx-12 lg:px-12"
        style={{ borderColor: HAIRLINE, backgroundColor: PAPER }}
      >
        <div className="flex min-w-max items-baseline gap-x-6">
          <a
            href="#edition-top"
            onClick={() => selectSection('all')}
            className="text-[13.5px] font-medium transition-opacity hover:opacity-70"
            style={{
              color: activeFilter === 'all' ? BLUE : MUTED,
              textDecoration: activeFilter === 'all' ? 'underline' : 'none',
              textUnderlineOffset: 5,
            }}
          >
            All ({edition.totalCount})
          </a>
          {filters.map((f) => (
            <a
              key={f.id}
              href={`#edition-section-${f.id}`}
              onClick={() => selectSection(f.id)}
              className="text-[13.5px] font-medium capitalize transition-opacity hover:opacity-70"
              style={{
                color: activeFilter === f.id ? BLUE : MUTED,
                textDecoration: activeFilter === f.id ? 'underline' : 'none',
                textUnderlineOffset: 5,
              }}
            >
              {f.label.toLowerCase()} ({f.count})
            </a>
          ))}
        </div>
      </div>

      {/* numbered topic sections */}
      {visibleSections.map((section, sectionIndex) => {
        if (!isPro && paywallShown) return null;
        const sectionStories = section.stories;
        if (sectionStories.length === 0) return null;
        const openStories = sectionStories.filter((s) => !isLocked(model, s.id));
        const lockedCount = sectionStories.length - openStories.length;
        const fullyLocked = openStories.length === 0;
        const showAccessBoundary = !isPro && lockedCount > 0;
        const showProNote = showAccessBoundary && !accessPending;
        if (showAccessBoundary) paywallShown = true;

        return (
          <section
            id={`edition-section-${section.id}`}
            key={section.id}
            className="scroll-mt-20 pt-12"
          >
            <div className="flex items-baseline justify-between gap-4">
              <MonoLabel>
                {pad2(sectionIndex + 1)} · {section.label}
              </MonoLabel>
              <span className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
                {sectionStories.length} stories
                {fullyLocked && <ProTag />}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 border md:grid-cols-2 lg:grid-cols-4" style={{ borderColor: HAIRLINE }}>
              {openStories.map((item) => (
                <StoryCard
                  key={item.id}
                  item={item}
                  number={visibleStoryNumber.get(item.id) ?? 0}
                  onOpen={() => openStory(
                    item,
                    visibleStoryNumber.get(item.id) ?? 1,
                    section.id,
                  )}
                  showImages={model.showImages}
                />
              ))}
            </div>

            {lockedCount > 0 && <LockedWireRows count={lockedCount} showImages={model.showImages} />}
            {showAccessBoundary && accessPending && (
              <AccessVerificationNote failed={accessVerificationFailed} onRetry={onRetryAccess} />
            )}
            {showProNote && (
              <ProEditionNote visibleCount={freeCount} totalCount={edition.totalCount} />
            )}
            <div className="border-t" style={{ borderColor: HAIRLINE }} />
          </section>
        );
      })}

      <DailyBriefNote />

      <section className="mt-16 border-t pt-10" style={{ borderColor: HAIRLINE }}>
        <MonoLabel>Colophon</MonoLabel>
        <p
          className={`${editionSerif.className} mt-4 max-w-[560px] text-[24px] leading-[1.4]`}
          style={{ color: INK }}
        >
          {edition.totalCount} stories reconciled from {model.totalSources} sources.
        </p>
        <p className="mt-4 max-w-[520px] text-[13.5px] leading-[1.8]" style={{ color: MUTED }}>
          Edition of {model.dateLabel.toLowerCase()}. Stories are grouped from primary
          sources, deduplicated, and summarized; claims that cannot be verified are
          omitted. Trace is an independent daily reference, not affiliated with the
          companies it covers. Found an error? Write to the editor.
        </p>
      </section>
      <EditionFooter />
      {selectedStory && (
        <EditionStoryModal
          item={selectedStory.item}
          number={selectedStory.number}
          section={selectedStory.section}
          tier={isPro ? 'pro' : 'free'}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </div>
  );
}
