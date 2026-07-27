"use client";

import React from 'react';
import { BookOpen, ExternalLink, MessagesSquare, Wrench, X } from 'lucide-react';
import type { V3UserFeed } from '@/lib/firestore';
import type { FeedListItem } from '@/app/(auth)/feed/FeedUi';
import { getPostAuthDestination, useAuth } from '@/contexts/AuthContext';
import {
  trackCheckoutClicked,
  trackFeedSourceClicked,
  trackPaywallShown,
} from '@/lib/posthog';
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
  sentencePreview,
  type PulseEditionSection,
  useDialogFocus,
} from './edition-shared';

const SECTION_ICON = {
  discussions: MessagesSquare,
  tools: Wrench,
  reads: BookOpen,
};

function SignalCard({
  item,
  position,
  section,
  tier,
  compact = false,
  onOpen,
}: {
  item: FeedListItem;
  position: number;
  section: string;
  tier: 'free' | 'pro';
  compact?: boolean;
  onOpen?: () => void;
}) {
  const url = item.url || (item.data as { url?: string }).url;
  const signalLabel = item.signalCount || item.sourceCount;
  const content = (
    <>
      <StoryImage item={item} className={`w-full ${compact ? 'aspect-[3/2]' : 'aspect-[16/9]'}`} />
      <div className="flex min-w-0 flex-col">
        <StoryMeta item={item} />
        <h2 className={`${editionSerif.className} mt-4 leading-[1.18] transition-colors group-hover:text-[#2557d6] ${compact ? 'text-[19px]' : 'text-[23px]'}`} style={{ color: INK }}>
          {item.title}
        </h2>
        {!onOpen && item.preview && (
          <p className={`mt-3 leading-[1.6] ${compact ? 'text-[12.5px]' : 'text-[13.5px]'}`} style={{ color: MUTED }}>
            {compact ? sentencePreview(item.preview, 1) : item.preview}
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
    </>
  );

  return (
    <article>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="group flex h-full w-full flex-col gap-5 p-5 text-left transition-colors hover:bg-[#f5f3ed]"
        >
          {content}
        </button>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackFeedSourceClicked({
            itemId: item.id,
            itemType: item.type,
            source: item.source,
            position,
            section,
            tier,
          })}
          className="group flex h-full flex-col gap-5 p-5 transition-colors hover:bg-[#f5f3ed]"
        >
          {content}
        </a>
      ) : (
        <div className="flex h-full flex-col gap-5 p-5">{content}</div>
      )}
    </article>
  );
}

function ReadModal({ item, onClose }: { item: FeedListItem; onClose: () => void }) {
  const url = item.url || (item.data as { url?: string }).url;
  const dialogRef = React.useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulse-read-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <article ref={dialogRef} tabIndex={-1} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#faf9f5] sm:h-auto sm:max-h-[90vh] sm:max-w-[760px] sm:border" style={{ borderColor: HAIRLINE }}>
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7" style={{ borderColor: HAIRLINE }}>
          <MonoLabel>Trace read</MonoLabel>
          <button type="button" onClick={onClose} className="p-2" aria-label="Close article">
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto">
          <StoryImage item={item} className="aspect-[16/9] w-full border-x-0 border-t-0" />
          <div className="px-5 py-7 sm:px-10 sm:py-9">
            <StoryMeta item={item} />
            <h2 id="pulse-read-title" className={`${editionSerif.className} mt-4 text-[30px] leading-[1.12] sm:text-[38px]`} style={{ color: INK }}>
              {item.title}
            </h2>
            {item.preview && (
              <div className="mt-6 whitespace-pre-line text-[16px] leading-[1.8]" style={{ color: '#3d3a33' }}>
                {item.preview}
              </div>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 bg-[#2557d6] px-5 py-3 text-[13px] font-semibold text-white"
              >
                Read original <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function LockedSignalPreview({
  item,
  remaining,
  section,
  accessPending,
  accessVerificationFailed,
  onRetryAccess,
}: {
  item: FeedListItem;
  remaining: number;
  section: string;
  accessPending: boolean;
  accessVerificationFailed: boolean;
  onRetryAccess: () => Promise<unknown>;
}) {
  const tracked = React.useRef(false);
  const { user, profile, profileResolved, signInWithGoogle } = useAuth();
  const openCheckout = async () => {
    if (user && profileResolved) {
      window.location.href = getPostAuthDestination(profile, 'checkout');
      return;
    }
    const result = await signInWithGoogle('checkout');
    if (result.status === 'success') {
      window.location.href = getPostAuthDestination(result.profile, result.intent);
    }
  };
  React.useEffect(() => {
    if (tracked.current || accessPending) return;
    tracked.current = true;
    trackPaywallShown('feed_pulse', {
      surface: 'web',
      section,
      hidden_count: remaining,
    });
  }, [accessPending, remaining, section]);

  return (
    <div className="relative overflow-hidden border-t" style={{ borderColor: HAIRLINE }}>
      <div className="pointer-events-none select-none opacity-35 blur-[4px]" aria-hidden="true">
        <SignalCard item={item} position={1} section={section} tier="free" />
      </div>
      <div className="absolute inset-0 flex items-end bg-gradient-to-b from-transparent via-[#faf9f5]/45 to-[#faf9f5]/95 px-5 py-5">
        <div>
          <MonoLabel>{accessPending ? 'Access check' : 'Trace Pro'}</MonoLabel>
          <p className={`${editionSerif.className} mt-2 text-[21px] leading-[1.2]`} style={{ color: INK }}>
            {accessPending
              ? accessVerificationFailed
                ? 'Trace could not verify your subscription.'
                : 'Checking your subscription before opening this desk.'
              : `${remaining} more signal${remaining === 1 ? '' : 's'} in this desk.`}
          </p>
          {accessPending ? (
            accessVerificationFailed && (
              <button
                type="button"
                onClick={() => void onRetryAccess()}
                className="mt-3 inline-block text-[12px] font-semibold text-[#2557d6] hover:underline"
              >
                Retry access check
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                trackCheckoutClicked('feed_pulse', {
                  surface: 'web',
                  section,
                  hidden_count: remaining,
                });
                void openCheckout();
              }}
              className="mt-3 inline-block text-[12px] font-semibold text-[#2557d6] hover:underline"
            >
              Unlock the full Pulse
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SignalSection({
  section,
  index,
  isPro,
  accessPending,
  accessVerificationFailed,
  onRetryAccess,
  onOpenRead,
}: {
  section: PulseEditionSection;
  index: number;
  isPro: boolean;
  accessPending: boolean;
  accessVerificationFailed: boolean;
  onRetryAccess: () => Promise<unknown>;
  onOpenRead: (item: FeedListItem) => void;
}) {
  const Icon = SECTION_ICON[section.id];
  const compact = section.id !== 'reads';
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
      <div
        className={compact
          ? 'mt-5 flex snap-x snap-mandatory overflow-x-auto border lg:grid lg:grid-cols-4 lg:overflow-visible'
          : 'mt-5 grid grid-cols-1 border md:grid-cols-2 lg:grid-cols-4'}
        style={{ borderColor: HAIRLINE }}
      >
        {visibleItems.map((item, itemIndex) => (
          <div
            key={item.id}
            className={compact
              ? 'w-[82vw] max-w-[320px] shrink-0 snap-start border-r lg:w-auto lg:max-w-none'
              : 'border-b border-r last:border-r-0'}
            style={{ borderColor: HAIRLINE }}
          >
            <SignalCard
              item={item}
              position={itemIndex + 1}
              section={section.id}
              tier={isPro ? 'pro' : 'free'}
              compact={compact}
              onOpen={section.id === 'reads' ? () => onOpenRead(item) : undefined}
            />
          </div>
        ))}
        {!isPro && hiddenCount > 0 && (
          <LockedSignalPreview
            item={section.items[visibleItems.length]}
            remaining={hiddenCount}
            section={section.id}
            accessPending={accessPending}
            accessVerificationFailed={accessVerificationFailed}
            onRetryAccess={onRetryAccess}
          />
        )}
      </div>
    </section>
  );
}

export default function PulseEdition({
  feed,
  dateLabel,
  isPro,
  accessPending = false,
  accessVerificationFailed = false,
  onRetryAccess = async () => {},
}: {
  feed: V3UserFeed | null;
  dateLabel: string;
  isPro: boolean;
  accessPending?: boolean;
  accessVerificationFailed?: boolean;
  onRetryAccess?: () => Promise<unknown>;
}) {
  const sections = buildPulseEdition(feed).filter((section) => section.items.length > 0);
  const totalSignals = sections.reduce((total, section) => total + section.items.length, 0);
  const [selectedRead, setSelectedRead] = React.useState<FeedListItem | null>(null);

  return (
    <div className="mx-auto max-w-[1500px] px-5 sm:px-8">
      <EditionHeader view="pulse" />

      <div className="pb-12 pt-14 sm:pt-20">
        <MonoLabel>{dateLabel}</MonoLabel>
        <div className="mt-5 max-w-[820px]">
          <h1 className={`${editionSerif.className} text-[56px] leading-[0.98] sm:text-[88px]`} style={{ color: INK }}>
            A feed for builders.
          </h1>
          <p className="mt-6 max-w-[760px] text-[16.5px] leading-[1.7]" style={{ color: MUTED }}>
            Build logs, architecture, open source, design, and product thinking for developers, designers, PMs, and founders.
          </p>
        </div>
        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BLUE }}>
          {totalSignals} signals · aggregated hourly
        </p>
      </div>

      {sections.length > 0 ? (
        <div className="space-y-14">
          {sections.map((section, index) => (
            <SignalSection
              key={section.id}
              section={section}
              index={index + 1}
              isPro={isPro}
              accessPending={accessPending}
              accessVerificationFailed={accessVerificationFailed}
              onRetryAccess={onRetryAccess}
              onOpenRead={setSelectedRead}
            />
          ))}
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
      {selectedRead && <ReadModal item={selectedRead} onClose={() => setSelectedRead(null)} />}
    </div>
  );
}
