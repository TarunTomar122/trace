"use client";

import React from "react";
import StoryBottomRelated from "@/components/StoryBottomRelated";
import StoryWireFooter from "@/components/StoryWireFooter";
import type { FeedListItem } from "@/app/(auth)/feed/FeedUi";

export { feedStoryCategoryLabel, storyEyebrow } from "@/lib/feed-story-labels";

export function StoryRelatedRailsLayout({
  currentItem,
  children,
}: {
  currentItem: FeedListItem;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="story-page-content">{children}</div>
      <StoryBottomRelated currentItem={currentItem} />
      <StoryWireFooter />
    </>
  );
}
