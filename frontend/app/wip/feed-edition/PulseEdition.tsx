"use client";

import React from 'react';
import { BookOpen, ExternalLink, MessagesSquare, Play, Wrench, X } from 'lucide-react';
import type { FeedItem, V3UserFeed } from '@/lib/firestore';
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

function isVideoItem(item: FeedListItem): boolean {
  const url = item.url || (item.data as { url?: string }).url || '';
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function SignalCard({
  item,
  position,
  section,
  tier,
  compact = false,
  onOpen,
  lockedPreview = false,
}: {
  item: FeedListItem;
  position: number;
  section: string;
  tier: 'free' | 'pro';
  compact?: boolean;
  onOpen?: () => void;
  lockedPreview?: boolean;
}) {
  const url = item.url || (item.data as { url?: string }).url;
  const isVideo = isVideoItem(item);
  const signalLabel = item.signalCount || item.sourceCount;
  const content = (
    <>
      <div className="relative">
        <StoryImage item={item} className={`w-full ${compact ? 'aspect-[3/2]' : 'aspect-[16/9]'}`} />
        {isVideo && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-[#faf9f5] px-2.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: INK }}>
            <Play size={10} fill="currentColor" /> Video
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        {!lockedPreview && <StoryMeta item={item} />}
        <h2 className={`${editionSerif.className} mt-4 leading-[1.18] transition-colors group-hover:text-[#2557d6] ${compact ? 'text-[19px]' : 'text-[23px]'}`} style={{ color: INK }}>
          {item.title}
        </h2>
        {!lockedPreview && !onOpen && item.preview && (
          <p className={`mt-3 leading-[1.6] ${compact ? 'text-[12.5px]' : 'text-[13.5px]'}`} style={{ color: MUTED }}>
            {compact ? sentencePreview(item.preview, 1) : item.preview}
          </p>
        )}
        {!lockedPreview && <div className="mt-auto pt-5">
          {signalLabel > 0 ? (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: BLUE }}>
              {signalLabel} signal{signalLabel === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>}
      </div>
    </>
  );

  return (
    <article className="h-full">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="group flex h-full w-full flex-col gap-5 p-4 text-left transition-colors hover:bg-[#f5f3ed] sm:p-5"
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
          className="group flex h-full flex-col gap-5 p-4 transition-colors hover:bg-[#f5f3ed] sm:p-5"
        >
          {content}
        </a>
      ) : (
        <div className="flex h-full flex-col gap-5 p-4 sm:p-5">{content}</div>
      )}
    </article>
  );
}

function ReadModal({ item, onClose }: { item: FeedListItem; onClose: () => void }) {
  const url = item.url || (item.data as { url?: string }).url;
  const isVideo = isVideoItem(item);
  const article = item.data as FeedItem;
  const body = article.summary?.short_article?.body || item.preview;
  const keyTakeaways = article.summary?.short_article?.key_takeaways || [];
  const dialogRef = React.useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/65 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulse-read-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <article ref={dialogRef} tabIndex={-1} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#faf9f5] sm:h-auto sm:max-h-[90vh] sm:max-w-[760px] sm:border" style={{ borderColor: HAIRLINE }}>
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7" style={{ borderColor: HAIRLINE }}>
          <MonoLabel>{isVideo ? 'Trace video' : 'Trace read'}</MonoLabel>
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
            {body && (
              <div className="mt-6 whitespace-pre-line text-[16px] leading-[1.8]" style={{ color: '#3d3a33' }}>
                {body}
              </div>
            )}
            {keyTakeaways.length > 0 && (
              <div className="mt-7">
                <MonoLabel>Key takeaways</MonoLabel>
                <ul className="mt-3 space-y-2.5">
                  {keyTakeaways.map((point, index) => (
                    <li key={index} className="flex items-start gap-4">
                      <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BLUE }} />
                      <span className="text-[14.5px] leading-[1.65]" style={{ color: '#3d3a33' }}>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 bg-[#2557d6] px-5 py-3 text-[13px] font-semibold text-white"
              >
                {isVideo ? 'Watch original' : 'Read original'} <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function LockedSignalPreview({
  remaining,
  section,
  accessPending,
  accessVerificationFailed,
  onRetryAccess,
}: {
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
    <div className="flex min-h-[220px] items-end border-t px-5 py-5" style={{ borderColor: HAIRLINE }}>
      <div>
        <MonoLabel>{accessPending ? 'Access check' : 'Trace Pro'}</MonoLabel>
        <p className={`${editionSerif.className} mt-2 text-[21px] leading-[1.2]`} style={{ color: INK }}>
          {accessPending
            ? accessVerificationFailed
              ? 'Trace could not verify your subscription.'
              : 'Checking your subscription before opening this desk.'
            : `Get ${remaining} more signal${remaining === 1 ? '' : 's'} with Trace Pro.`}
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
            className="mt-4 inline-flex bg-[#2557d6] px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d48b4]"
          >
            Try Trace Pro free for 3 days
          </button>
        )}
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
  const visibleItems = isPro ? section.items : section.items.slice(0, 2);
  const hiddenCount = Math.max(0, section.items.length - visibleItems.length);

  return (
    <section id={`pulse-section-${section.id}`} className="scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2" style={{ color: BLUE }}>
            <Icon size={14} strokeWidth={1.8} />
            <MonoLabel>{String(index).padStart(2, '0')}</MonoLabel>
          </div>
          <h2 className={`${editionSerif.className} mt-3 text-[31px] leading-[1.12]`} style={{ color: INK }}>
            {section.label}
          </h2>
        </div>
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
          {section.items.length} signal{section.items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div
        className="mt-5 grid grid-cols-1 border md:grid-cols-2 lg:grid-cols-4"
        style={{ borderColor: HAIRLINE }}
      >
        {visibleItems.map((item, itemIndex) => (
          <div
            key={item.id}
            className="border-b border-r last:border-r-0"
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
          <div className="relative self-start grid grid-cols-1 md:col-span-2 md:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
            {section.items.slice(2, 4).map((item, itemIndex) => (
              <div
                key={`locked-${item.id}`}
                aria-hidden
                className="pointer-events-none select-none border-b border-r blur-[5px] opacity-60"
                style={{ borderColor: HAIRLINE }}
              >
                <SignalCard
                  item={item}
                  position={itemIndex + 3}
                  section={section.id}
                  tier="free"
                  compact={compact}
                  lockedPreview
                />
              </div>
            ))}
            <div className="absolute inset-0 z-10 flex items-end bg-[#faf9f5]/80">
              <LockedSignalPreview
                remaining={hiddenCount}
                section={section.id}
                accessPending={accessPending}
                accessVerificationFailed={accessVerificationFailed}
                onRetryAccess={onRetryAccess}
              />
            </div>
          </div>
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
  const [activeSection, setActiveSection] = React.useState(sections[0]?.id || '');
  const [selectedRead, setSelectedRead] = React.useState<FeedListItem | null>(null);

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-16 lg:px-24">
      <EditionHeader view="pulse" />

      <div className="pb-12 pt-14 sm:pt-20">
        <MonoLabel>{dateLabel}</MonoLabel>
        <div className="mt-5 max-w-[820px]">
          <h1 className={`${editionSerif.className} text-[56px] leading-[0.98] sm:text-[88px]`} style={{ color: INK }}>
            A feed for builders.
          </h1>
          <p className="mt-6 max-w-[760px] text-[16.5px] leading-[1.7]" style={{ color: MUTED }}>
            Build logs, architecture, open source, design, and product thinking for builders.
          </p>
        </div>
        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BLUE }}>
          {totalSignals} signals · aggregated hourly
        </p>
      </div>

      {sections.length > 0 && (
        <nav
          className="sticky top-0 z-50 -mx-4 mb-10 flex gap-6 overflow-x-auto border-y bg-[#faf9f5] px-4 py-4 [scrollbar-width:none] sm:-mx-16 sm:px-16 lg:-mx-24 lg:px-24"
          style={{ borderColor: HAIRLINE }}
          aria-label="Pulse sections"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#pulse-section-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              className="shrink-0 text-[13.5px] font-medium transition-opacity hover:opacity-70"
              style={{
                color: activeSection === section.id ? BLUE : MUTED,
                textDecoration: activeSection === section.id ? 'underline' : 'none',
                textUnderlineOffset: 5,
              }}
            >
              {section.label} ({section.items.length})
            </a>
          ))}
        </nav>
      )}

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
