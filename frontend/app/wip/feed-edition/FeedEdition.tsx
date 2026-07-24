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
import { AnimatePresence, motion } from 'framer-motion';
import type { FeedListItem } from '@/app/(auth)/feed/FeedUi';
import {
  BLUE,
  HAIRLINE,
  INK,
  MUTED,
  PAPER,
  ExpandedStory,
  EditionFooter,
  EditionHeader,
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
  scrollElementToTop,
  sentencePreview,
  type EditionModel,
} from './edition-shared';

function StoryRow({
  item,
  number,
  locked,
  onToggle,
  expanded,
  showImages,
}: {
  item: FeedListItem;
  number: number;
  locked: boolean;
  expanded: boolean;
  onToggle: () => void;
  showImages: boolean;
}) {
  const headerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (expanded) scrollElementToTop(headerRef.current);
  }, [expanded]);

  if (locked) return null; // locked rendering is handled by the section (wireframe)

  const title = (
    <span
      className={`${editionSerif.className} block text-[25px] leading-[1.18] transition-colors sm:text-[31px]`}
      style={{ color: expanded ? BLUE : INK }}
    >
      {item.title}
    </span>
  );
  const details = () => (
    <>
      {!expanded && item.preview && (
        <span className="mt-1.5 block text-[14px] leading-[1.6]" style={{ color: MUTED }}>
          {sentencePreview(item.preview, 1)}
        </span>
      )}
      <span className="mt-2 flex items-center gap-2">
        <StoryMeta item={item} />
        {expanded && (
          <StoryShareButton
            item={item}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          />
        )}
      </span>
    </>
  );

  return (
    <div className="relative border-t" style={{ borderColor: HAIRLINE }}>
      <div
        ref={headerRef}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
        className="group flex w-full cursor-pointer items-start gap-0 py-5 text-left transition-colors hover:bg-[#f5f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2557d6] sm:gap-7"
      >
        <span
          className={`${editionSerif.className} hidden w-8 shrink-0 pt-2 text-[24px] leading-none sm:block`}
          style={{ color: BLUE }}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          {showImages && !expanded ? (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_92px] items-start gap-4 md:grid-cols-[minmax(0,1fr)_128px] md:gap-7">
                <div>
                  {title}
                  <div className="hidden md:block">{details()}</div>
                </div>
                <div className="md:self-center">
                  <StoryImage item={item} className="aspect-[4/3] w-full" />
                </div>
              </div>
              <div className="md:hidden">{details()}</div>
            </>
          ) : (
            <>
              {title}
              {details()}
            </>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="story-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.42, ease: [0.32, 0.72, 0, 1] },
              opacity: { duration: 0.28, ease: 'easeOut' },
            }}
            style={{ overflow: 'hidden' }}
          >
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              exit={{ y: -6 }}
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
              className="pb-7"
            >
              <ExpandedStory item={item} showImages={showImages} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const firstVisibleRef = React.useRef<HTMLElement>(null);
  const userChangedFilterRef = React.useRef(false);

  const selectFilter = (filter: string) => {
    userChangedFilterRef.current = true;
    setExpandedId(null);
    setActiveFilter(filter);
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
    const all = [
      ...edition.sections.map((s) => ({ id: s.interestId, label: s.label, stories: s.stories })),
      ...(edition.latest.length > 0
        ? [{ id: '__latest', label: 'LATEST', stories: edition.latest }]
        : []),
    ];
    if (activeFilter === 'all') return all;
    return all.filter((s) => s.id === activeFilter);
  }, [edition, activeFilter]);

  const showHero = activeFilter === 'all' && edition.hero;
  const visibleStoryNumber = useMemo(() => {
    const visibleStories = [
      ...(showHero && edition.hero ? [edition.hero.lead, ...edition.hero.sidebar] : []),
      ...visibleSections.flatMap((section) => section.stories),
    ];
    return new Map(visibleStories.map((item, index) => [item.id, index + 1]));
  }, [edition.hero, showHero, visibleSections]);
  const freeCount = model.freeIds.size;
  let paywallShown = false;

  React.useEffect(() => {
    if (!userChangedFilterRef.current) return;
    requestAnimationFrame(() => scrollElementToTop(firstVisibleRef.current));
  }, [activeFilter]);

  return (
    <div className="mx-auto max-w-[880px] px-5 sm:px-8">
      <EditionHeader view="edition" />

      {/* hero */}
      <div className="pb-10 pt-14 sm:pt-20">
        <MonoLabel>{model.dateLabel}</MonoLabel>
        <h1
          className={`${editionSerif.className} mt-5 text-[56px] leading-[0.98] tracking-[-0.01em] sm:text-[88px]`}
          style={{ color: INK }}
        >
          Today&rsquo;s Trace
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
        className="sticky top-0 z-50 isolate -mx-5 overflow-x-auto border-y px-5 py-4 shadow-[0_10px_18px_rgba(250,249,245,0.98)] [scrollbar-width:none] sm:-mx-8 sm:px-8"
        style={{ borderColor: HAIRLINE, backgroundColor: PAPER }}
      >
        <div className="flex min-w-max items-baseline gap-x-6">
          <button
            onClick={() => selectFilter('all')}
            className="text-[13.5px] font-medium transition-opacity hover:opacity-70"
            style={{
              color: activeFilter === 'all' ? BLUE : MUTED,
              textDecoration: activeFilter === 'all' ? 'underline' : 'none',
              textUnderlineOffset: 5,
            }}
          >
            All ({edition.totalCount})
          </button>
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => selectFilter(f.id)}
              className="text-[13.5px] font-medium capitalize transition-opacity hover:opacity-70"
              style={{
                color: activeFilter === f.id ? BLUE : MUTED,
                textDecoration: activeFilter === f.id ? 'underline' : 'none',
                textUnderlineOffset: 5,
              }}
            >
              {f.label.toLowerCase()} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* lead story — a row like the others, just bigger */}
      {showHero && edition.hero && (
        <section ref={firstVisibleRef} className="pt-10">
          <MonoLabel>Lead story</MonoLabel>
          <div className="mt-3">
            <StoryRow
              item={edition.hero.lead}
              number={visibleStoryNumber.get(edition.hero.lead.id) ?? 1}
              locked={false}
              expanded={expandedId === edition.hero.lead.id}
              onToggle={() =>
                setExpandedId(expandedId === edition.hero!.lead.id ? null : edition.hero!.lead.id)
              }
              showImages={model.showImages}
            />
            {edition.hero.sidebar.map((item) => (
              <StoryRow
                key={item.id}
                item={item}
                number={visibleStoryNumber.get(item.id) ?? 0}
                locked={false}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                showImages={model.showImages}
              />
            ))}
          </div>
        </section>
      )}

      {/* numbered topic sections */}
      {visibleSections.map((section, sectionIndex) => {
        if (!isPro && paywallShown) return null;
        const openStories = section.stories.filter((s) => !isLocked(model, s.id));
        const lockedCount = section.stories.length - openStories.length;
        const fullyLocked = openStories.length === 0;
        const showAccessBoundary = !isPro && lockedCount > 0;
        const showProNote = showAccessBoundary && !accessPending;
        if (showAccessBoundary) paywallShown = true;

        return (
          <section ref={!showHero && sectionIndex === 0 ? firstVisibleRef : undefined} key={section.id} className="pt-12">
            <div className="flex items-baseline justify-between gap-4">
              <MonoLabel>
                {pad2(sectionIndex + 1)} · {section.label}
              </MonoLabel>
              <span className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
                {section.stories.length} stories
                {fullyLocked && <ProTag />}
              </span>
            </div>

            <div className="mt-2">
              {openStories.map((item) => (
                <StoryRow
                  key={item.id}
                  item={item}
                  number={visibleStoryNumber.get(item.id) ?? 0}
                  locked={false}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
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
    </div>
  );
}
