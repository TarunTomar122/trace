// Shared item shapes for the public daily editorial layout.

export type PublicFeedCardItem = {
  id: string;
  title: string;
  preview?: string;
  summary?: string;
  source?: string;
  sourceCount?: number;
  timestamp?: string;
  thumbnail?: string | null;
  url?: string;
  keyPoints?: string[];
};

export type PublicTopicCardItem = {
  id: string;
  title: string;
  summary?: string;
  sourceCount: number;
  articleCount: number;
  keyPoints?: string[];
  slug?: string;
};
