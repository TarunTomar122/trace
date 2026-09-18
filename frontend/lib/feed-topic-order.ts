/** Rank topic/standalone slots in `trending` order so #1 flat items are not buried. */

export type RankedTopic = {
  id?: string;
  articles?: Array<{ url?: string }>;
};

export type RankedItem = {
  url?: string;
};

export type RankedSlot<TTopic, TItem> =
  | { kind: 'topic'; topic: TTopic }
  | { kind: 'item'; item: TItem };

function topicUrls(topic: RankedTopic): string[] {
  return (topic.articles || [])
    .map((article) => String(article?.url || '').trim())
    .filter(Boolean);
}

export function slotsFromRankedItems<TTopic extends RankedTopic, TItem extends RankedItem>(
  trending: TItem[] | undefined,
  topics: TTopic[] | undefined,
  urlKey: (url: string) => string = (url) => url,
): RankedSlot<TTopic, TItem>[] {
  const topicList = topics || [];
  const itemList = trending || [];
  const topicByUrl = new Map<string, TTopic>();
  for (const topic of topicList) {
    for (const url of topicUrls(topic)) {
      const key = urlKey(url);
      if (key && !topicByUrl.has(key)) topicByUrl.set(key, topic);
    }
  }

  const emitted = new Set<TTopic>();
  const seenItemUrls = new Set<string>();
  const slots: RankedSlot<TTopic, TItem>[] = [];

  for (const item of itemList) {
    const url = String(item?.url || '').trim();
    const key = urlKey(url);
    if (!key || seenItemUrls.has(key)) continue;
    seenItemUrls.add(key);
    const topic = topicByUrl.get(key);
    if (topic) {
      if (emitted.has(topic)) continue;
      emitted.add(topic);
      slots.push({ kind: 'topic', topic });
      continue;
    }
    slots.push({ kind: 'item', item });
  }

  for (const topic of topicList) {
    if (emitted.has(topic)) continue;
    slots.push({ kind: 'topic', topic });
  }

  return slots;
}
