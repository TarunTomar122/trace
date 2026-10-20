/**
 * The reader's own daily brief. Mirrors `newsletter_prefs` and
 * `_email_enabled` in backend/v3/flows/send_audience_newsletter.py: change both.
 */

export const NEWSLETTER_TOPICS = [
  { id: 'ai', label: 'AI', blurb: 'Models, labs, and the companies racing them' },
  { id: 'markets', label: 'Markets', blurb: 'Rates, stocks, and the macro picture' },
  { id: 'tech', label: 'Tech', blurb: 'Big Tech, devices, and platforms' },
  { id: 'ux-design', label: 'Design', blurb: 'Product and interface design' },
  { id: 'startups', label: 'Startups', blurb: 'Funding rounds, launches, and founders' },
  { id: 'robotics', label: 'Robotics', blurb: 'Robots, humanoids, and self-driving cars' },
] as const;
// Only the lanes the pipeline publishes (FeedApp ALL_INTERESTS); a topic with
// no stories behind it would quietly fill the brief with other topics.

export type NewsletterTopic = (typeof NEWSLETTER_TOPICS)[number]['id'];
export const STORY_COUNTS = [5, 10, 15] as const;
export type StoryCount = (typeof STORY_COUNTS)[number];
export const STORY_FORMATS = ['summaries', 'headlines', 'images'] as const;
export type StoryFormat = (typeof STORY_FORMATS)[number];

export const DEFAULT_STORY_COUNT: StoryCount = 10;

export type NewsletterPrefs = {
  enabled: boolean;
  topics: NewsletterTopic[];
  count: StoryCount;
  format: StoryFormat;
};

const TOPIC_IDS = new Set<string>(NEWSLETTER_TOPICS.map((topic) => topic.id));

// Every lane a story can carry (pickable or backfilled), as the email names
// them (INTEREST_LABELS in backend/v3/flows/send_audience_newsletter.py).
const LANE_LABELS: Record<string, string> = {
  'model-releases': 'Model releases',
  ai: 'AI',
  markets: 'Markets',
  tech: 'Tech',
  'ux-design': 'Design',
  startups: 'Startups',
  robotics: 'Robotics',
  // Retired lane, kept so archived /brief editions still label it.
  engineering: 'Engineering',
  products: 'Products',
  'the-world': 'World',
};

export function topicLabel(id: string): string {
  return LANE_LABELS[id] ?? NEWSLETTER_TOPICS.find((topic) => topic.id === id)?.label ?? id;
}

/** Section kicker for a lane: "Model releases", "Top in AI", or "More stories". */
export function laneKicker(lane: string): string {
  if (lane === 'model-releases') return 'Model releases';
  return LANE_LABELS[lane] ? `Top in ${LANE_LABELS[lane]}` : 'More stories';
}

function cleanTopics(value: unknown): NewsletterTopic[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: NewsletterTopic[] = [];
  for (const raw of value) {
    const id = String(raw).trim().toLowerCase();
    if (TOPIC_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id as NewsletterTopic);
    }
  }
  return out;
}

/** Email is on unless the reader explicitly turned it off (sender rule). */
export function emailEnabled(profile: Record<string, unknown>): boolean {
  if ('dailyNewsletterEnabled' in profile) return profile.dailyNewsletterEnabled === true;
  if ('newsletterOptIn' in profile) return profile.newsletterOptIn === true;
  return true;
}

export function prefsFromProfile(profile: Record<string, unknown> | null | undefined): NewsletterPrefs {
  const data = profile ?? {};
  // A saved list, even an empty one ("all topics"), wins over feed interests.
  const topics = Array.isArray(data.newsletterTopics)
    ? cleanTopics(data.newsletterTopics)
    : cleanTopics(data.interests);
  const count = Number(data.newsletterStoryCount);
  return {
    enabled: profile ? emailEnabled(data) : true,
    topics,
    count: (STORY_COUNTS as readonly number[]).includes(count) ? (count as StoryCount) : DEFAULT_STORY_COUNT,
    format: (STORY_FORMATS as readonly unknown[]).includes(data.newsletterFormat)
      ? (data.newsletterFormat as StoryFormat)
      : 'summaries',
  };
}

/** Validate a client update. Returns the profile fields to write, or an error. */
export function profilePatchFromInput(input: unknown): { patch: Record<string, unknown> } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid body' };
  const body = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ('topics' in body) {
    if (!Array.isArray(body.topics)) return { error: 'topics must be a list' };
    patch.newsletterTopics = cleanTopics(body.topics);
  }
  if ('count' in body) {
    if (!(STORY_COUNTS as readonly unknown[]).includes(body.count)) return { error: 'count must be 5, 10, or 15' };
    patch.newsletterStoryCount = body.count;
  }
  if ('format' in body) {
    if (!(STORY_FORMATS as readonly unknown[]).includes(body.format)) return { error: 'format must be summaries, headlines, or images' };
    patch.newsletterFormat = body.format;
  }
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return { error: 'enabled must be true or false' };
    // Both flags, so the sender and older clients agree (see unsubscribe route).
    patch.dailyNewsletterEnabled = body.enabled;
    patch.newsletterOptIn = body.enabled;
  }
  if (Object.keys(patch).length === 0) return { error: 'Nothing to update' };
  return { patch };
}
