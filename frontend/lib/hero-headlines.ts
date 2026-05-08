import { unstable_cache } from 'next/cache';
import OpenAI from 'openai';
import { getTodaysFeed } from '@/lib/daily-archive';

export type HeroHeadline = { text: string; company: string; domain: string };

async function _getHeroHeadlines(): Promise<HeroHeadline[]> {
  const feed = await getTodaysFeed();
  if (!feed || feed.trending.length === 0) return [];

  const articles = feed.trending
    .slice(0, 12)
    .filter((item) => item.title)
    .map((item) => ({
      title: item.title,
      summary: typeof item.description === 'string' ? item.description : '',
    }));

  if (articles.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey });
  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title}${a.summary ? ` - ${a.summary}` : ''}`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `You are picking headlines for a tech news homepage. Prioritize concrete launches, releases, and product announcements from AI and tech companies over opinion pieces, analysis, or market commentary.

Here are today's stories:
${articleList}

Pick the 3 best ones (launches and releases first). For each, write a punchy one-liner under 12 words. Rules:
- Be concrete and specific (name the product/company/feature)
- No em dashes, no hyphens mid-sentence
- No exclamation marks
- No phrases like "sounds like" or "apparently"
- Write like a smart friend texting you the news

Return JSON: { "headlines": [ { "text": "...", "company": "CompanyName", "domain": "company.com" } ] }`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.headlines) ? parsed.headlines.slice(0, 3) : [];
}

// Cache for 1 hour — OpenAI only gets called once per deploy/revalidation cycle
export const getHeroHeadlines = unstable_cache(
  _getHeroHeadlines,
  ['hero-headlines'],
  { revalidate: 3600 }
);
