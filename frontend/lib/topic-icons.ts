import {
  Bot, Cpu, Globe, Package, PenTool, Rocket, Sparkles, TrendingUp, type LucideIcon,
} from 'lucide-react';

/** One icon per lane, the same set as the feed's sidebar (FeedApp CAT_ICONS). */
export const TOPIC_ICONS: Record<string, LucideIcon> = {
  'model-releases': Sparkles,
  ai: Sparkles,
  markets: TrendingUp,
  tech: Cpu,
  'ux-design': PenTool,
  startups: Rocket,
  robotics: Bot,
  products: Package,
  'the-world': Globe,
};

export function topicIcon(lane: string): LucideIcon {
  return TOPIC_ICONS[lane] ?? Sparkles;
}

/** Publisher favicon, the same service the email uses for its source stacks. */
export function faviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
