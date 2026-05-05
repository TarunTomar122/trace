import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

type Topic = Record<string, unknown>;

type CarouselCategory = 'all' | 'ai' | 'tech' | 'world';
type CarouselStyle = 'mixed' | 'editorial' | 'signal' | 'spotlight';
type CarouselMode = 'smart' | 'browse' | 'auto';

type Slide = {
  id: string;
  slideType: 'cover' | 'story' | 'detail';
  style: Exclude<CarouselStyle, 'mixed'>;
  headline: string;
  kicker: string;
  body: string;
  imageUrl: string;
  coverImages?: string[]; // top story thumbnails for cover collage
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
  'tech', 'engineering', 'startups', 'business', 'science', 'ux-design', 'product-design', 'design',
]);
const WORLD_INTEREST_IDS = new Set(['world', 'the-world', 'markets', 'policy', 'politics', 'geopolitics']);

function norm(value: unknown): string {
  return String(value || '')
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanSentence(value: string): string {
  return norm(value)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ').trim();
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
  if (!parts.length) parts.push('This story is gaining momentum across multiple sources and signals today.');
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
  const id = String(topic.interest_id || '').trim().toLowerCase();
  if (AI_INTEREST_IDS.has(id)) return 'ai';
  if (WORLD_INTEREST_IDS.has(id)) return 'world';
  if (TECH_INTEREST_IDS.has(id)) return 'tech';
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

function rotateBuckets(
  buckets: Record<Exclude<CarouselCategory, 'all'>, Topic[]>,
  storyCount: number,
): Topic[] {
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
    .filter((s) => s.slideType === 'story')
    .slice(0, 5)
    .map((s) => `• ${s.headline}`);
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

function titlePromptContext(topic: Topic, index: number): string {
  const summary = cleanSentence(String(topic.summary || topic.overview || '')).slice(0, 420);
  const points = detailPoints(topic)
    .slice(0, 3)
    .map((point, pointIndex) => `  - ${pointIndex + 1}. ${point}`)
    .join('\n');

  return [
    `${index} | ${inferCategory(topic).toUpperCase()} | ${norm(String(topic.title || ''))}`,
    summary ? `Summary: ${summary}` : '',
    points ? `Key points:\n${points}` : '',
  ].filter(Boolean).join('\n');
}

async function aiSmartPickAndRewrite(
  topics: Topic[],
  count: number,
): Promise<Array<{ topic: Topic; headline: string }> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !topics.length) return null;

  const eligible = topics.slice(0, 50);
  const prompt = `You are a social media editor for Trace, a bold AI/tech news app. Pick the ${count} most juicy, surprising stories from this list and rewrite their headlines to be punchy and fun.

PICK: most surprising, specific, dramatic. Real names, numbers, shocking twists beat vague stories.
Use the summary/key points to find the weirdest or most specific hook. Do not merely shorten the original title.

HEADLINE RULES:
- 5-8 words max. Short = bold.
- Conversational and punchy — write like a friend texting you breaking news
- Use strong active verbs: fired, dropped, banned, bought, leaked, killed, exposed
- Make it feel urgent or surprising. Raise eyebrows.
- Prefer concrete details from key points: dollars, percentages, names, deadlines, product names, surprising comparisons
- NO purpose clauses ("to improve X", "in order to Y")
- NO boring filler ("enhances", "improves", "advances", "updates", "boosts")
- If the key points contain a better hook than the original title, use that.

GREAT EXAMPLES:
- "Google quietly killed your favorite Chrome feature"
- "OpenAI just fired the guy who built ChatGPT"
- "Apple banned 14 apps and won't say why"
- "Sam Altman made $300B appear out of thin air"
- "Meta is reading your WhatsApp messages now"
- "This AI just beat every human at coding"

BAD (avoid):
- "OpenAI advances its AI assistant capabilities" (bland)
- "Anthropic launches Claude Design to boost visual creation" (too long, filler)

Stories:
${eligible.map((t, i) => titlePromptContext(t, i)).join('\n\n')}

Return JSON: {"picks": [{"i": 0, "h": "rewritten"}, ...]} with exactly ${count} items, most important first.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return null;
    const parsed = JSON.parse(text) as { picks?: Array<{ i: number; h: string }> };
    const picks = parsed.picks;
    if (!Array.isArray(picks)) return null;
    return picks
      .filter((p) => typeof p.i === 'number' && typeof p.h === 'string' && eligible[p.i])
      .slice(0, count)
      .map((p) => ({ topic: eligible[p.i], headline: cleanSentence(p.h) }));
  } catch {
    return null;
  }
}

async function aiRewriteHeadlines(topics: Topic[]): Promise<Map<string, string> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !topics.length) return null;

  const prompt = `You are a social media editor for Trace, a bold AI/tech news app. Rewrite these headlines to be punchy and fun.

RULES:
- 5-8 words max. Short = bold.
- Conversational — write like a friend texting you breaking news
- Strong active verbs: fired, dropped, banned, bought, leaked, killed, exposed
- Make it feel urgent or surprising
- Use summary/key points to find the funniest, weirdest, or most specific detail
- Prefer numbers, names, sharp comparisons, and stakes over generic product wording
- NO filler: no "enhances", "improves", "advances", "updates", "boosts", "to do X"

GREAT EXAMPLES:
- "Google quietly killed your favorite Chrome feature"
- "Apple banned 14 apps and won't say why"
- "This AI just beat every human at coding"
- "Meta is reading your WhatsApp messages now"

Stories:
${topics.map((t, i) => titlePromptContext(t, i)).join('\n\n')}

Return JSON: {"rewrites": [{"i": 0, "h": "rewritten"}, ...]} for all ${topics.length} items.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return null;
    const parsed = JSON.parse(text) as { rewrites?: Array<{ i: number; h: string }> };
    const rewrites = parsed.rewrites;
    if (!Array.isArray(rewrites)) return null;
    const map = new Map<string, string>();
    for (const r of rewrites) {
      if (typeof r.i === 'number' && typeof r.h === 'string' && topics[r.i]) {
        const id = String(topics[r.i].id || `topic-${r.i}`);
        map.set(id, cleanSentence(r.h));
      }
    }
    return map;
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
      tagline: morning ? 'What AI shipped while you were offline' : evening ? 'The AI stories worth catching up on tonight' : 'The AI moves worth knowing today',
      supportLine: 'Swipe through the strongest grouped AI reporting in Trace today.',
    };
  }
  if (category === 'tech') {
    return {
      title: 'Tech stories shaping today',
      tagline: morning ? 'Things in tech that happened while you were asleep' : evening ? 'What moved in tech today' : 'The tech moves worth knowing today',
      supportLine: 'Swipe through the strongest grouped tech reporting in Trace today.',
    };
  }
  if (category === 'world') {
    return {
      title: 'World stories shaping today',
      tagline: morning ? 'What changed in the world while you were asleep' : evening ? 'The world stories worth catching up on tonight' : 'The world stories shaping today',
      supportLine: 'Swipe through the strongest grouped world reporting in Trace today.',
    };
  }
  return {
    title: 'AI, tech, and world stories shaping today',
    tagline: morning ? 'Things in tech that happened while you were asleep' : evening ? 'What moved across AI, tech, and the world today' : 'The stories shaping AI, tech, and the world today',
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
  const usable = topics.filter((t) => norm(t.title));
  if (category !== 'all') {
    return usable.filter((t) => inferCategory(t) === category).slice(0, storyCount);
  }
  const buckets: Record<Exclude<CarouselCategory, 'all'>, Topic[]> = { ai: [], tech: [], world: [] };
  for (const topic of usable) buckets[inferCategory(topic)].push(topic);
  const selected = rotateBuckets(
    { ai: [...buckets.ai], tech: [...buckets.tech], world: [...buckets.world] },
    storyCount,
  );
  if (selected.length >= storyCount) return selected;
  const seen = new Set(selected.map((t) => String(t.id || t.title)));
  for (const topic of usable) {
    const key = String(topic.id || topic.title);
    if (seen.has(key)) continue;
    selected.push(topic);
    seen.add(key);
    if (selected.length >= storyCount) break;
  }
  return selected;
}


function buildSlides(
  origin: string,
  styleMode: CarouselStyle,
  topicList: Topic[],
  headlineOverrides?: Map<string, string>,
): Slide[] {
  const slides: Slide[] = [];

  topicList.forEach((topic, index) => {
    const topicCategory = inferCategory(topic);
    const topicId = String(topic.id || `topic-${index + 1}`);
    const headline =
      headlineOverrides?.get(topicId) ?? cleanSentence(String(topic.title || `Story ${index + 1}`));
    const style = pickStoryStyle(styleMode, index);
    const common = {
      style,
      headline,
      kicker: topicCategory.toUpperCase(),
      category: topicCategory,
      sourceNames: sourceNames(topic),
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
    const rawMode = (searchParams.get('mode') || 'smart').toLowerCase();
    const carouselMode: CarouselMode = (['smart', 'browse', 'auto'] as const).includes(rawMode as CarouselMode)
      ? (rawMode as CarouselMode)
      : 'smart';

    const requestedCategory = (searchParams.get('category') || 'all').toLowerCase() as CarouselCategory;
    const category: CarouselCategory = ['all', 'ai', 'tech', 'world'].includes(requestedCategory)
      ? requestedCategory : 'all';

    const requestedStyle = (searchParams.get('style') || 'mixed').toLowerCase() as CarouselStyle;
    const style: CarouselStyle = ['mixed', 'editorial', 'signal', 'spotlight'].includes(requestedStyle)
      ? requestedStyle : 'mixed';

    const slideCount = clampSlides(Number(searchParams.get('slides') || '6'));

    const { date, topics, trending } = await loadLatestFeed();
    const candidates = storyCandidates(topics, trending);
    if (!candidates.length) {
      return NextResponse.json({ error: 'No trending stories available' }, { status: 404 });
    }

    let selectedTopics: Topic[];
    let headlineOverrides: Map<string, string> | undefined;

    if (carouselMode === 'browse') {
      const topicIds = new Set(
        (searchParams.get('topicIds') || '').split(',').map((s) => s.trim()).filter(Boolean),
      );
      if (!topicIds.size) {
        return NextResponse.json({ error: 'No topic IDs provided for browse mode' }, { status: 400 });
      }
      // Preserve user's selection order
      const idOrder = (searchParams.get('topicIds') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const topicMap = new Map(candidates.map((t) => [String(t.id || ''), t]));
      selectedTopics = idOrder.map((id) => topicMap.get(id)).filter((t): t is Topic => !!t);
      if (!selectedTopics.length) {
        return NextResponse.json({ error: 'None of the selected stories were found' }, { status: 404 });
      }
      const rewrites = await aiRewriteHeadlines(selectedTopics);
      if (rewrites) headlineOverrides = rewrites;

    } else if (carouselMode === 'smart') {
      const storyCount = slideCount;
      const pool = category !== 'all'
        ? candidates.filter((t) => norm(t.title) && inferCategory(t) === category)
        : candidates.filter((t) => norm(t.title));
      const aiPicks = await aiSmartPickAndRewrite(pool, storyCount);
      if (aiPicks && aiPicks.length > 0) {
        selectedTopics = aiPicks.map((p) => p.topic);
        headlineOverrides = new Map(
          aiPicks.map((p) => [String(p.topic.id || ''), p.headline]),
        );
      } else {
        selectedTopics = selectTopics(candidates, category, storyCount);
      }

    } else {
      // legacy auto mode — original behavior
      selectedTopics = selectTopics(candidates, category, slideCount);
    }

    const messaging = buildDeckMessaging(category);
    const rawSlides = buildSlides(origin, style, selectedTopics, headlineOverrides);
    const slides = rawSlides;

    return NextResponse.json({
      ok: true,
      date,
      category,
      style,
      mode: carouselMode,
      title: messaging.title,
      tagline: messaging.tagline,
      count: slides.length,
      caption: buildCaption(slides),
      slides,
    });
  } catch (error) {
    console.error('instagram studio carousel error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build carousel' },
      { status: 500 },
    );
  }
}
