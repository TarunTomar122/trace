"use client";

import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';
import Footer from '@/components/Footer';
import { ArticleImage } from '@/components/ArticleImage';
import { WireFeedLoadingSkeleton } from './FeedBootShell';
import { organizeEditionFeed, type EditionSection } from './FeedEditionOrganizer';
import {
  FeedListItem,
  INTEREST_LABEL,
  getTimeLabel,
  getTodayLabel,
} from './FeedUi';

function storyMeta(item: FeedListItem): string {
  const parts: string[] = [];
  if (item.sourceCount > 1) parts.push(`${item.sourceCount} sources`);
  else if (item.source) parts.push(item.source);
  if (item.timestamp) parts.push(getTimeLabel(item.timestamp));
  return parts.join(' · ');
}

function categoryLabel(item: FeedListItem): string {
  const id = item.interestId ?? item.tags?.[0];
  if (id && INTEREST_LABEL[id]) return INTEREST_LABEL[id].toUpperCase();
  if (item.type === 'topic' && item.sourceCount > 1) return 'GROUPED';
  return 'TECH';
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="wire-section-head">
      <span className="wire-section-label">{label}</span>
      <span className="wire-section-rule" aria-hidden />
    </div>
  );
}

function StoryByline({ item }: { item: FeedListItem }) {
  const meta = storyMeta(item);
  const line = [categoryLabel(item), meta].filter(Boolean).join(" · ");
  if (!line) return null;
  return <p className="wire-byline">{line}</p>;
}

function HeroLead({
  item,
  locked,
  onClick,
}: {
  item: FeedListItem;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="wire-hero-lead group text-left">
      <div className="wire-hero-lead-media">
        <ArticleImage
          thumbnail={item.thumbnail}
          title={item.title}
          className="wire-hero-lead-img"
          loading="eager"
        />
      </div>
      <div className="wire-hero-lead-copy">
        <h2 className="wire-hero-lead-title">{item.title}</h2>
        <StoryByline item={item} />
        {locked && (
          <span className="wire-lock">
            <Lock size={11} /> Pro
          </span>
        )}
      </div>
    </button>
  );
}

function HeroSidebarStory({
  item,
  locked,
  onClick,
}: {
  item: FeedListItem;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="wire-hero-side group text-left">
      <div className="wire-hero-side-media">
        <ArticleImage
          thumbnail={item.thumbnail}
          title={item.title}
          className="wire-hero-side-img"
          loading="lazy"
        />
      </div>
      <div className="wire-hero-side-copy">
        <h3 className="wire-hero-side-title">{item.title}</h3>
        <StoryByline item={item} />
        {locked && (
          <span className="wire-lock">
            <Lock size={11} />
          </span>
        )}
      </div>
    </button>
  );
}

function SectionCard({
  item,
  locked,
  onClick,
}: {
  item: FeedListItem;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="wire-section-card group text-left">
      <div className="wire-section-card-media">
        <ArticleImage
          thumbnail={item.thumbnail}
          title={item.title}
          className="wire-section-card-img"
          loading="lazy"
        />
      </div>
      <div className="wire-section-card-copy">
        <h3 className="wire-section-card-title">{item.title}</h3>
        <StoryByline item={item} />
        {locked && (
          <span className="wire-lock wire-lock--inline">
            <Lock size={11} /> Pro
          </span>
        )}
      </div>
    </button>
  );
}

function EditionSectionBlock({
  section,
  isItemLocked,
  onSelectStory,
}: {
  section: EditionSection;
  isItemLocked: (id: string) => boolean;
  onSelectStory: (item: FeedListItem) => void;
}) {
  return (
    <section className="wire-module">
      <SectionHead label={section.label} />
      <div className="wire-section-grid">
        {section.stories.map((item) => (
          <SectionCard
            key={item.id}
            item={item}
            locked={isItemLocked(item.id)}
            onClick={() => onSelectStory(item)}
          />
        ))}
      </div>
    </section>
  );
}

function LatestRow({
  item,
  locked,
  onClick,
}: {
  item: FeedListItem;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="wire-latest-row group text-left">
      <div className="wire-latest-thumb">
        <ArticleImage
          thumbnail={item.thumbnail}
          title={item.title}
          className="wire-latest-thumb-img"
          loading="lazy"
          fallbackWidth={400}
          fallbackHeight={300}
        />
      </div>
      <div className="wire-latest-copy">
        <h3 className="wire-latest-title">{item.title}</h3>
        <StoryByline item={item} />
        {locked && (
          <span className="wire-lock wire-lock--inline">
            <Lock size={11} /> Pro
          </span>
        )}
      </div>
    </button>
  );
}

export default function FeedOneScreen({
  isLoading,
  storyList,
  interestOrder,
  onSelectStory,
  isItemLocked,
}: {
  isLoading: boolean;
  storyList: FeedListItem[];
  hotTweets?: HotTweet[];
  interestOrder: string[];
  userInterests?: Set<string>;
  onSelectStory: (item: FeedListItem) => void;
  isItemLocked: (id: string) => boolean;
}) {
  const edition = useMemo(
    () => organizeEditionFeed(storyList, interestOrder),
    [storyList, interestOrder],
  );

  if (isLoading && storyList.length === 0) {
    return <WireFeedLoadingSkeleton />;
  }

  return (
    <div className="wire-feed-page">
      <div className="wire-feed-inner">
        <header className="wire-masthead">
          <p className="wire-masthead-eyebrow">Today&apos;s Pulse</p>
          <h1 className="wire-masthead-title">{getTodayLabel()}</h1>
          <p className="wire-masthead-meta">
            {edition.totalCount} stories · ~{edition.readMinutes} min read
          </p>
        </header>

        {edition.hero && (
          <section className="wire-module wire-module--hero">
            <div className="wire-hero-grid">
              <HeroLead
                item={edition.hero.lead}
                locked={isItemLocked(edition.hero.lead.id)}
                onClick={() => onSelectStory(edition.hero!.lead)}
              />
              {edition.hero.sidebar.length > 0 && (
                <div className="wire-hero-sidebar">
                  {edition.hero.sidebar.map((item) => (
                    <HeroSidebarStory
                      key={item.id}
                      item={item}
                      locked={isItemLocked(item.id)}
                      onClick={() => onSelectStory(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {edition.sections.map((section) => (
          <EditionSectionBlock
            key={section.interestId}
            section={section}
            isItemLocked={isItemLocked}
            onSelectStory={onSelectStory}
          />
        ))}

        {edition.latest.length > 0 && (
          <section className="wire-module wire-module--latest">
            <SectionHead label="Latest" />
            <div className="wire-latest-list">
              {edition.latest.map((item) => (
                <LatestRow
                  key={item.id}
                  item={item}
                  locked={isItemLocked(item.id)}
                  onClick={() => onSelectStory(item)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="wire-feed-footer-wrap">
          <Footer />
        </div>
      </div>
    </div>
  );
}

export type HotTweet = {
  id: string;
  title: string;
  url: string;
  description: string;
  pubDate: string;
  category: string;
};
