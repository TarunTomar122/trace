import { type FeedListItem, INTEREST_LABEL } from "@/app/(auth)/feed/FeedUi";

export function feedStoryCategoryLabel(item: FeedListItem): string {
  const id = item.interestId ?? item.tags?.[0];
  if (id && INTEREST_LABEL[id]) return INTEREST_LABEL[id].toUpperCase();
  if (item.type === "topic" && item.sourceCount > 1) return "GROUPED";
  return "TECH";
}

export function storyEyebrow(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(" · ");
}

export function storyBottomSectionLabel(item: FeedListItem): string {
  const interestId = item.interestId ?? item.tags?.[0];
  if (interestId && INTEREST_LABEL[interestId]) {
    return `More in ${INTEREST_LABEL[interestId]}`;
  }
  const category = feedStoryCategoryLabel(item);
  return `More in ${category.charAt(0) + category.slice(1).toLowerCase()}`;
}
