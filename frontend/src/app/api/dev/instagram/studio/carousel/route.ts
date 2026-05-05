import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

type Topic = Record<string, unknown>;

type CarouselCategory = 'all' | 'ai' | 'tech' | 'world';
type CarouselStyle = 'mixed' | 'editorial' | 'signal' | 'spotlight';

type Slide = {
  id: string;
  slideType: 'cover' | 'story' | 'detail';
  style: Exclude<CarouselStyle, 'mixed'>;
  headline: string;
  kicker: string;
  body: string;
  imageUrl: string;
  category: Exclude<CarouselCategory, 'all'>;
  topicId?: string;
  articleCount?: number;
  sourceCount?: number;
  sourceNames: string[];
  storyUrl?: string;
};

type DeckMessaging = {
  title: string;
  tagline: string;
  supportLine: string;
};

const STORY_STYLES: Array<Exclude<CarouselStyle, 'mixed'>> = ['editorial', 'signal', 'spotlight'];
const AI_INTEREST_IDS = new Set(['ai']);
const TECH_INTEREST_IDS = new Set([
  'tech',
  'engineering',
  'startups',
  'business',
  'science',
  'ux-design',
  'product-design',
  'design',
]);
const WORLD_INTEREST_IDS = new Set(['world', 'the-world', 'markets', 'policy', 'politics', 'geopolitics']);

function norm(value: unknown): string {
  return String(value || '')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSentence(value: string): string {
  return norm(value)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove summarizer prefixes like "Slide 1:" / "slide2:" from bullet lines */
function stripSlidePrefixes(text: string): string {
  let line = String(text || '').trim();
  for (let i = 0; i < 5; i++) {
    const next = line
      .replace(/^slide\s*\d+\s*:\s*/i, '')
      .replace(/^slide\s*\d+\s*[-–—.)]\s*/i, '')
      .trim();
    if (next === line) break;
    line = next;
  }
  return line;
}

function deckLine(raw: string): string {
  return cleanSentence(stripSlidePrefixes(String(raw || '')));
}

function clampSlides(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return Math.max(4, Math.min(8, Math.round(value)));
}

function paragraphize(topic: Topic): string {
  const parts: string[] = [];
  const summary = deckLine(String(topic.summary || topic.overview || ''));
  if (summary) parts.push(summary);

  const keyPoints = Array.isArray(topic.key_points) ? topic.key_points : [];
  for (const raw of keyPoints.slice(0, 2)) {
    const point = deckLine(String(raw || ''));
    if (point) parts.push(point);
  }

  if (!parts.length) {
    parts.push('This story is gaining momentum across multiple sources and signals today.');
  }

  return parts.slice(0, 3).join('\n\n');
}

function detailPoints(topic: Topic): string[] {
  const keyPoints = Array.isArray(topic.key_points) ? topic.key_points : [];
  const points = keyPoints
    .map((raw) => deckLine(String(raw || '')))
    .filter(Boolean)
    .slice(0, 3);
  if (points.length > 0) return points;

  const fallback = deckLine(String(topic.summary || topic.overview || ''));
  if (!fallback) return ['This story is gaining momentum across multiple sources and signals today.'];
  return fallback
    .split(/(?<=[.!?])\s+/)
    .map((part) => deckLine(part.trim()))
    .filter(Boolean)
    .slice(0, 3);
}

function inferCategory(topic: Topic): Exclude<CarouselCategory, 'all'> {
  const interestId = String(topic.interest_id || '').trim().toLowerCase();

  if (AI_INTEREST_IDS.has(interestId)) return 'ai';
  if (WORLD_INTEREST_IDS.has(interestId)) return 'world';
  if (TECH_INTEREST_IDS.has(interestId)) return 'tech';
  return 'tech';
}

function sourceNames(topic: Topic): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const timeline = Array.isArray(topic.timeline) ? topic.timeline : [];
  for (const raw of timeline) {
    if (!raw || typeof raw !== 'object') continue;
    const name = cleanSentence(String((raw as Record<string, unknown>).source_name || ''));
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.slice(0, 5);
}

function coveredTrendingKeys(topics: Topic[]): { ids: Set<string>; urls: Set<string> } {
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const topic of topics) {
    const articles = Array.isArray(topic.articles) ? topic.articles : [];
    for (const raw of articles) {
      if (!raw || typeof raw !== 'object') continue;
      const article = raw as Record<string, unknown>;
      const id = String(article.id || '').trim();
      const url = String(article.url || '').trim();
      if (id) ids.add(id);
      if (url) urls.add(url);
    }
    const timeline = Array.isArray(topic.timeline) ? topic.timeline : [];
    for (const raw of timeline) {
      if (!raw || typeof raw !== 'object') continue;
      const event = raw as Record<string, unknown>;
      const id = String(event.id || '').trim();
      const url = String(event.article_url || '').trim();
      if (id) ids.add(id);
      if (url) urls.add(url);
    }
  }
  return { ids, urls };
}

function shortArticle(item: Topic): Record<string, unknown> {
  const summary = item.summary;
  if (!summary || typeof summary !== 'object') return {};
  const nested = (summary as Record<string, unknown>).short_article;
  return nested && typeof nested === 'object' ? nested as Record<string, unknown> : {};
}

function trendingItemSummary(item: Topic): string {
  const short = shortArticle(item);
  const slides = Array.isArray(short.slides)
    ? short.slides.map((slide) => deckLine(String(slide || ''))).filter(Boolean)
    : [];
  const body = deckLine(String(short.body || ''));
  const subtitle = deckLine(String(short.subtitle || ''));
  return slides.join(' ') || body || subtitle || deckLine(String(item.description || ''));
}

function trendingItemKeyPoints(item: Topic): string[] {
  const short = shortArticle(item);
  const keyPoints = Array.isArray(short.key_points) ? short.key_points : [];
  const fromKeys = keyPoints.map((point) => deckLine(String(point || ''))).filter(Boolean).slice(0, 3);
  if (fromKeys.length) return fromKeys;
  const slides = Array.isArray(short.slides) ? short.slides : [];
  const fromSlides = slides.map((slide) => deckLine(String(slide || ''))).filter(Boolean).slice(0, 3);
  if (fromSlides.length) return fromSlides;
  const fallback = trendingItemSummary(item);
  return fallback
    .split(/(?<=[.!?])\s+/)
    .map((part) => deckLine(part.trim()))
    .filter(Boolean)
    .slice(0, 3);
}

function standaloneTrendingTopic(item: Topic, index: number): Topic {
  const rawId = String(item.id || item.url || `trending-item-${index}`);
  const sourceName = cleanSentence(String(item.source_name || item.source || ''));
  return {
    ...item,
    id: rawId,
    title: cleanSentence(String(item.title || '')),
    summary: trendingItemSummary(item),
    key_points: trendingItemKeyPoints(item),
    article_count: 1,
    source_count: sourceName ? 1 : 0,
    timeline: sourceName ? [{ id: rawId, source_name: sourceName, article_url: item.url }] : [],
    __studio_kind: 'item',
  };
}

function storyCandidates(topics: Topic[], trending: Topic[]): Topic[] {
  const covered = coveredTrendingKeys(topics);
  const uncoveredItems = trending
    .filter((item) => {
      const id = String(item.id || '').trim();
      const url = String(item.url || '').trim();
      return norm(item.title) && !covered.ids.has(id) && !covered.urls.has(url);
    })
    .map(standaloneTrendingTopic);
  return [...topics, ...uncoveredItems];
}

function pickStoryStyle(mode: CarouselStyle, index: number): Exclude<CarouselStyle, 'mixed'> {
  if (mode !== 'mixed') return mode;
  return STORY_STYLES[index % STORY_STYLES.length];
}

function rotateBuckets(buckets: Record<Exclude<CarouselCategory, 'all'>, Topic[]>, storyCount: number): Topic[] {
  const out: Topic[] = [];
  const order: Array<Exclude<CarouselCategory, 'all'>> = ['ai', 'tech', 'world'];
  let cursor = 0;
  while (out.length < storyCount) {
    const category = order[cursor % order.length];
    const next = buckets[category].shift();
    if (next) out.push(next);
    cursor += 1;
    if (!buckets.ai.length && !buckets.tech.length && !buckets.world.length) break;
  }
  return out;
}

function buildCaption(slides: Slide[]): string {
  const headlines = slides
    .filter((slide) => slide.slideType === 'story')
    .slice(0, 5)
    .map((slide) => `• ${slide.headline}`);
  return [
    'Top stories from Trace today:',
    '',
    ...headlines,
    '',
    'Follow Trace for grouped AI, tech, and world stories without the noise.',
  ].join('\n');
}

function currentHourInTimezone(): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: process.env.INSTAGRAM_STUDIO_TIMEZONE || 'Asia/Kolkata',
  });
  const hour = Number(formatter.format(new Date()));
  return Number.isFinite(hour) ? hour : 9;
}

function timeOfDayLabel(): string {
  const hour = currentHourInTimezone();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 18) return 'evening';
  return 'afternoon';
}

async function generateCoverHeadline(
  headlines: string[],
): Promise<{ title: string; tagline: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !headlines.length) return null;

  const tod = timeOfDayLabel();
  const rest = headlines.length - 1;
  const prompt = `Write an Instagram carousel cover for Trace (a news app). There are ${headlines.length} stories today.

Stories:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

RULES:
1. Pick the juiciest story — use a specific detail from it (a name, number, or action).
2. You MUST end with a tease like "and ${rest} more" or "plus ${rest} more stories" — never just one story.
3. Keep it 10-16 words total. Conversational, not a news headline.

Good:
- "Apple dropped $400M on U.S. factories — plus ${rest} more stories"
- "Google shipped Gemini 3.1, and ${rest} other things you missed today"
- "TikTok got a new deadline, and ${rest} more moves worth knowing"

Bad (no tease of other stories):
- "Google launches Gemini 3.1 Flash Live to boost audio AI capabilities"
Bad (too vague):
- "AI ramps up, TikTok plans bigger moves"

Return ONLY the title, one line, no quotes.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.95,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return null;
    const title = text.split('\n')[0].trim().replace(/^["']|["']$/g, '');
    if (title.length < 10) return null;
    const taglines = [
      `Your ${tod} catch-up in ${headlines.length} slides`,
      `The ${tod} rundown — swipe through`,
      `${headlines.length} stories, explained`,
    ];
    const tagline = taglines[Math.floor(Math.random() * taglines.length)];
    return { title, tagline };
  } catch {
    return null;
  }
}

function buildDeckMessaging(category: CarouselCategory): DeckMessaging {
  const tod = timeOfDayLabel();
  const morning = tod === 'morning';
  const evening = tod === 'evening';

  if (category === 'ai') {
    return {
      title: 'AI stories shaping today',
      tagline: morning
        ? 'What AI shipped while you were offline'
        : evening
          ? 'The AI stories worth catching up on tonight'
          : 'The AI moves worth knowing today',
      supportLine: 'Swipe through the strongest grouped AI reporting in Trace today.',
    };
  }

  if (category === 'tech') {
    return {
      title: 'Tech stories shaping today',
      tagline: morning
        ? 'Things in tech that happened while you were asleep'
        : evening
          ? 'What moved in tech today'
          : 'The tech moves worth knowing today',
      supportLine: 'Swipe through the strongest grouped tech reporting in Trace today.',
    };
  }

  if (category === 'world') {
    return {
      title: 'World stories shaping today',
      tagline: morning
        ? 'What changed in the world while you were asleep'
        : evening
          ? 'The world stories worth catching up on tonight'
          : 'The world stories shaping today',
      supportLine: 'Swipe through the strongest grouped world reporting in Trace today.',
    };
  }

  return {
    title: 'AI, tech, and world stories shaping today',
    tagline: morning
      ? 'Things in tech that happened while you were asleep'
      : evening
        ? 'What moved across AI, tech, and the world today'
        : 'The stories shaping AI, tech, and the world today',
    supportLine: 'Swipe through the strongest grouped reporting in Trace today.',
  };
}

async function loadLatestFeed(): Promise<{ date: string; topics: Topic[]; trending: Topic[] }> {
  if (!adminDb) return { date: '', topics: [], trending: [] };
  const snap = await adminDb
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(1)
    .get();
  if (snap.empty) return { date: '', topics: [], trending: [] };
  const doc = snap.docs[0];
  const data = doc.data() || {};
  return {
    date: doc.id,
    topics: Array.isArray(data.trending_topics) ? (data.trending_topics as Topic[]) : [],
    trending: Array.isArray(data.trending) ? (data.trending as Topic[]) : [],
  };
}

function selectTopics(topics: Topic[], category: CarouselCategory, storyCount: number): Topic[] {
  const usable = topics.filter((topic) => norm(topic.title));
  if (category !== 'all') {
    return usable.filter((topic) => inferCategory(topic) === category).slice(0, storyCount);
  }

  const buckets: Record<Exclude<CarouselCategory, 'all'>, Topic[]> = {
    ai: [],
    tech: [],
    world: [],
  };
  for (const topic of usable) {
    buckets[inferCategory(topic)].push(topic);
  }

  const selected = rotateBuckets(
    {
      ai: [...buckets.ai],
      tech: [...buckets.tech],
      world: [...buckets.world],
    },
    storyCount
  );

  if (selected.length >= storyCount) return selected;

  const seen = new Set(selected.map((topic) => String(topic.id || topic.title)));
  for (const topic of usable) {
    const key = String(topic.id || topic.title);
    if (seen.has(key)) continue;
    selected.push(topic);
    seen.add(key);
    if (selected.length >= storyCount) break;
  }
  return selected;
}

async function validateImageUrl(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok && res.status !== 206) return '';
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return '';
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 8) return '';
    const bytes = new Uint8Array(buf);
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const isWebp =
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (isJpeg || isPng || isGif || isWebp) return url;
    if (ct.startsWith('image/')) return url;
    return '';
  } catch {
    return '';
  }
}

function buildSlides(
  origin: string,
  styleMode: CarouselStyle,
  topicList: Topic[],
): Slide[] {
  const slides: Slide[] = [];

  topicList.forEach((topic, index) => {
    const topicCategory = inferCategory(topic);
    const sourceList = sourceNames(topic);
    const topicId = String(topic.id || `topic-${index + 1}`);
    const style = pickStoryStyle(styleMode, index);
    const common = {
      style,
      headline: cleanSentence(String(topic.title || `Story ${index + 1}`)),
      kicker: topicCategory.toUpperCase(),
      category: topicCategory,
      sourceNames: sourceList,
      articleCount: Number(topic.article_count || 0),
      sourceCount: Number(topic.source_count || 0),
      topicId,
      storyUrl: topic.__studio_kind === 'item'
        ? String(topic.url || '')
        : `${origin}/topics/${encodeURIComponent(topicId)}`,
    };
    slides.push({
      ...common,
      id: `${topicId}-intro`,
      slideType: 'story',
      body: paragraphize(topic),
      imageUrl: String(topic.thumbnail || ''),
    });
    slides.push({
      ...common,
      id: `${topicId}-detail`,
      slideType: 'detail',
      body: detailPoints(topic).join('\n\n'),
      imageUrl: '',
    });
  });

  return slides;
}

export async function GET(request: NextRequest) {
  try {
    if (!isInstagramStudioAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server Firebase Admin not configured' }, { status: 500 });
    }

    const { searchParams, origin } = new URL(request.url);
    const requestedCategory = (searchParams.get('category') || 'all').toLowerCase() as CarouselCategory;
    const category: CarouselCategory = ['all', 'ai', 'tech', 'world'].includes(requestedCategory)
      ? requestedCategory
      : 'all';
    const requestedStyle = (searchParams.get('style') || 'mixed').toLowerCase() as CarouselStyle;
    const style: CarouselStyle = ['mixed', 'editorial', 'signal', 'spotlight'].includes(requestedStyle)
      ? requestedStyle
      : 'mixed';
    const slideCount = clampSlides(Number(searchParams.get('slides') || '6'));

    const { date, topics, trending } = await loadLatestFeed();
    const candidates = storyCandidates(topics, trending);
    if (!candidates.length) {
      return NextResponse.json({ error: 'No trending stories available' }, { status: 404 });
    }

    const selectedTopics = selectTopics(candidates, category, slideCount);
    const messaging = buildDeckMessaging(category);

    const storyHeadlines = selectedTopics.map((t) => cleanSentence(String(t.title || '')));
    const aiCover = await generateCoverHeadline(storyHeadlines);
    if (aiCover) {
      messaging.title = aiCover.title;
      messaging.tagline = aiCover.tagline;
    }

    const slides = buildSlides(origin, style, selectedTopics);

    await Promise.all(
      slides.map(async (slide) => {
        if (slide.imageUrl) {
          slide.imageUrl = await validateImageUrl(slide.imageUrl);
        }
      }),
    );

    const caption = buildCaption(slides);

    return NextResponse.json({
      ok: true,
      date,
      category,
      style,
      title: messaging.title,
      tagline: messaging.tagline,
      count: slides.length,
      caption,
      slides,
    });
  } catch (error) {
    console.error('instagram studio carousel error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build carousel' },
      { status: 500 }
    );
  }
}
