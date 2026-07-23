"use client";

import { useMemo } from 'react';
import type { V3UserFeed } from '@/lib/firestore';
import type { FeedListItem } from '@/app/(auth)/feed/FeedUi';
import {
  BLUE,
  HAIRLINE,
  INK,
  StoryMeta,
  buildEditionModel,
  editionSerif,
} from '@/app/wip/feed-edition/edition-shared';
import { ArticleImage } from '@/components/ArticleImage';

function PreviewRow({ item, number }: { item: FeedListItem; number: number }) {
  return (
    <article className="group flex items-start gap-4 border-t py-5 transition-colors hover:bg-[#f5f3ed] sm:gap-6" style={{ borderColor: HAIRLINE }}>
      <span className={editionSerif.className + ' hidden w-7 shrink-0 pt-1 text-[22px] leading-none sm:block'} style={{ color: BLUE }}>{number}</span>
      <div className="min-w-0 flex-1">
        <h3 className={editionSerif.className + ' text-[23px] leading-[1.16] sm:text-[29px]'} style={{ color: INK }}>{item.title}</h3>
        <div className="mt-2"><StoryMeta item={item} /></div>
      </div>
      {item.thumbnail ? (
        <ArticleImage
          thumbnail={item.thumbnail}
          title={item.title}
          alt=""
          className="shrink-0 self-center border border-[#e4e1d8] object-cover"
          style={{ width: 118, height: 88, objectFit: 'cover' }}
        />
      ) : null}
    </article>
  );
}

export default function HomeEditionPreview({ feed }: { feed: V3UserFeed | null }) {
  const stories = useMemo(() => buildEditionModel(feed, true, '', true).orderedItems.slice(0, 3), [feed]);

  if (!stories.length) return null;

  return (
    <section className="border border-[#e4e1d8] bg-[#faf9f5] px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex items-center justify-between border-b border-[#e4e1d8] pb-5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2557d6]">Today&rsquo;s edition</span>
        <a href="/feed" className="text-[12px] font-semibold text-[#2557d6] hover:underline">Open Edition</a>
      </div>
      <div className="pt-6">
        {stories.map((item, index) => <PreviewRow key={item.id} item={item} number={index + 1} />)}
      </div>
    </section>
  );
}
