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
  slideType: 'cover' | 'story';
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

function clampSlides(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return Math.max(4, Math.min(8, Math.round(value)));
}

function paragraphize(topic: Topic): string {
  const parts: string[] = [];
  const summary = cleanSentence(String(topic.summary || topic.overview || ''));
  if (summary) parts.push(summary);
  const keyPoints = Array.isArray(topic.key_points) ? topic.key_points : [];
  for (const raw of keyPoints.slice(0, 2)) {
    const point = cleanSentence(String(raw || ''));
    if (point) parts.push(point);
  }
  if (!parts.length) parts.push('This story is gaining momentum across multiple sources and signals today.');
  return parts.slice(0, 3).join('\n\n');
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

async function aiSmartPickAndRewrite(
  topics: Topic[],
  count: number,
): Promise<Array<{ topic: Topic; headline: string }> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !topics.length) return null;

  const eligible = topics.slice(0, 50);
  const prompt = `You are a social media editor for Trace, a bold AI/tech news app. Pick the ${count} most juicy, surprising stories from this list and rewrite their headlines to be punchy and fun.

PICK: most surprising, specific, dramatic. Real names, numbers, shocking twists beat vague stories.

HEADLINE RULES:
- 5-8 words max. Short = bold.
- Conversational and punchy — write like a friend texting you breaking news
- Use strong active verbs: fired, dropped, banned, bought, leaked, killed, exposed
- Make it feel urgent or surprising. Raise eyebrows.
- NO purpose clauses ("to improve X", "in order to Y")
- NO boring filler ("enhances", "improves", "advances", "updates", "boosts")

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

Stories (index | category | original title):
${eligible.map((t, i) => `${i} | ${inferCategory(t).toUpperCase()} | ${norm(String(t.title || ''))}`).join('\n')}

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
- NO filler: no "enhances", "improves", "advances", "updates", "boosts", "to do X"

GREAT EXAMPLES:
- "Google quietly killed your favorite Chrome feature"
- "Apple banned 14 apps and won't say why"
- "This AI just beat every human at coding"
- "Meta is reading your WhatsApp messages now"

Headlines (index | original):
${topics.map((t, i) => `${i} | ${norm(String(t.title || ''))}`).join('\n')}

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

async function generateCoverHeadline(
  headlines: string[],
): Promise<{ title: string; tagline: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !headlines.length) return null;

  const rest = headlines.length - 1;
  const prompt = `Write a punchy cover headline for a Trace Instagram carousel. There are ${headlines.length} stories inside.

Stories:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

RULES:
1. Lead with the most shocking/specific story — use a real name, number, or bold action.
2. End with a short count tag like "— +${rest} more" or "& ${rest} others" (max 3 words for the tag).
3. Total: 8-14 words. Bold, declarative. No filler endings like "you need to know" or "you need to see".
4. Strong action verbs: dropped, fired, banned, bought, revealed, launched.

GOOD:
- "Google just killed its AI search deal — +${rest} more"
- "Sam Altman doubles OpenAI's valuation to $300B — +${rest} inside"
- "Apple bans 14 apps overnight & ${rest} other stories"

BAD:
- "stories you need to know today" (no subject, filler)
- "the top AI stories you need to see" (no verb, no name)

Return ONLY the headline, one line, no quotes.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
    const tod2 = timeOfDayLabel();
    const taglines = [
      `Your ${tod2} catch-up in ${headlines.length} slides`,
      `The ${tod2} rundown — swipe through`,
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

async function loadLatestTopics(): Promise<{ date: string; topics: Topic[] }> {
  if (!adminDb) return { date: '', topics: [] };
  const snap = await adminDb
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(1)
    .get();
  if (snap.empty) return { date: '', topics: [] };
  const doc = snap.docs[0];
  const data = doc.data() || {};
  return {
    date: doc.id,
    topics: Array.isArray(data.trending_topics) ? (data.trending_topics as Topic[]) : [],
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
  date: string,
  category: CarouselCategory,
  styleMode: CarouselStyle,
  topicList: Topic[],
  messaging: DeckMessaging,
  headlineOverrides?: Map<string, string>,
): Slide[] {
  const slides: Slide[] = [];

  topicList.forEach((topic, index) => {
    const topicCategory = inferCategory(topic);
    const topicId = String(topic.id || `topic-${index + 1}`);
    const headline =
      headlineOverrides?.get(topicId) ?? cleanSentence(String(topic.title || `Story ${index + 1}`));
    slides.push({
      id: topicId,
      slideType: 'story',
      style: pickStoryStyle(styleMode, index),
      headline,
      kicker: topicCategory.toUpperCase(),
      body: paragraphize(topic),
      imageUrl: String(topic.thumbnail || ''),
      category: topicCategory,
      sourceNames: sourceNames(topic),
      articleCount: Number(topic.article_count || 0),
      sourceCount: Number(topic.source_count || 0),
      topicId,
      storyUrl: `${origin}/topics/${encodeURIComponent(topicId)}`,
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

    const { date, topics } = await loadLatestTopics();
    if (!topics.length) {
      return NextResponse.json({ error: 'No trending topics available' }, { status: 404 });
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
      const topicMap = new Map(topics.map((t) => [String(t.id || ''), t]));
      selectedTopics = idOrder.map((id) => topicMap.get(id)).filter((t): t is Topic => !!t);
      if (!selectedTopics.length) {
        return NextResponse.json({ error: 'None of the selected topics were found' }, { status: 404 });
      }
      const rewrites = await aiRewriteHeadlines(selectedTopics);
      if (rewrites) headlineOverrides = rewrites;

    } else if (carouselMode === 'smart') {
      const storyCount = slideCount;
      const pool = category !== 'all'
        ? topics.filter((t) => norm(t.title) && inferCategory(t) === category)
        : topics.filter((t) => norm(t.title));
      const aiPicks = await aiSmartPickAndRewrite(pool, storyCount);
      if (aiPicks && aiPicks.length > 0) {
        selectedTopics = aiPicks.map((p) => p.topic);
        headlineOverrides = new Map(
          aiPicks.map((p) => [String(p.topic.id || ''), p.headline]),
        );
      } else {
        selectedTopics = selectTopics(topics, category, storyCount);
      }

    } else {
      // legacy auto mode — original behavior
      selectedTopics = selectTopics(topics, category, slideCount);
    }

    const messaging = buildDeckMessaging(category);
    const rawSlides = buildSlides(origin, date, category, style, selectedTopics, messaging, headlineOverrides);
    const slides = rawSlides.slice(0, carouselMode === 'browse' ? rawSlides.length : slideCount);

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
