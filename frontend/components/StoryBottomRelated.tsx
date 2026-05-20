"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArticleImage } from "@/components/ArticleImage";
import {
  feedStoryCategoryLabel,
  storyBottomSectionLabel,
  storyEyebrow,
} from "@/lib/feed-story-labels";
import {
  type FeedListItem,
  getFeedRelatedPool,
  getFeedStoryPath,
  getTimeLabel,
  pickFeedRelatedStories,
  prepareFeedStoryNavigation,
} from "@/app/(auth)/feed/FeedUi";

const BOTTOM_STORY_COUNT = 4;

function cardByline(item: FeedListItem): string {
  const parts: string[] = [feedStoryCategoryLabel(item)];
  if (item.sourceCount > 1) parts.push(`${item.sourceCount} sources`);
  else if (item.source) parts.push(item.source);
  if (item.timestamp) parts.push(getTimeLabel(item.timestamp));
  return storyEyebrow(...parts);
}

function BottomStoryCard({
  item,
  onOpen,
}: {
  item: FeedListItem;
  onOpen: (item: FeedListItem) => void;
}) {
  return (
    <button type="button" onClick={() => onOpen(item)} className="wire-section-card group text-left">
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
        <p className="wire-byline">{cardByline(item)}</p>
      </div>
    </button>
  );
}

export function useStoryBottomRelated(currentItem: FeedListItem) {
  return useMemo(() => {
    const pool = getFeedRelatedPool();
    return pickFeedRelatedStories(pool, currentItem.id, currentItem, {
      limit: BOTTOM_STORY_COUNT,
    });
  }, [currentItem]);
}

export default function StoryBottomRelated({ currentItem }: { currentItem: FeedListItem }) {
  const router = useRouter();
  const stories = useStoryBottomRelated(currentItem);

  if (stories.length === 0) return null;

  const openStory = (item: FeedListItem) => {
    const pool = getFeedRelatedPool();
    prepareFeedStoryNavigation(item, pool.length > 0 ? pool : undefined);
    router.push(getFeedStoryPath(item));
  };

  return (
    <section className="story-bottom-related" aria-label={storyBottomSectionLabel(currentItem)}>
      <div className="wire-section-head">
        <span className="wire-section-label">{storyBottomSectionLabel(currentItem)}</span>
        <span className="wire-section-rule" aria-hidden />
      </div>
      <div className="wire-section-grid story-bottom-related-grid">
        {stories.map((item) => (
          <BottomStoryCard key={item.id} item={item} onOpen={openStory} />
        ))}
      </div>
    </section>
  );
}
