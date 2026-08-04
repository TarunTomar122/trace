import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentBrief } from './agent-brief.ts';

test('buildAgentBrief separates news, builds, and conversations and caps output', () => {
  const item = (id, title) => ({
    id,
    title,
    url: `https://example.com/${id}`,
    summary: {
      short_article: {
        subtitle: `${title} summary`,
        key_takeaways: ['one', 'two'],
        why_it_matters: `${title} matters`,
      },
    },
  });
  const brief = buildAgentBrief({
    date: '2026-08-01',
    for_you: [],
    trending: [item('news-1', 'News one'), item('news-2', 'News two')],
    build_pulse: [item('build-1', 'Build one')],
    daily_pulse: {
      tools: [item('build-1', 'Build duplicate'), item('build-2', 'Build two')],
      blogs: [],
      discussions: [item('chat-1', 'Conversation one')],
    },
    community_pulse: [item('chat-2', 'Conversation two')],
  }, 1);

  assert.equal(brief.feed_date, '2026-08-01');
  assert.deepEqual(brief.top_news.map(({ id }) => id), ['news-1']);
  assert.deepEqual(brief.builds.map(({ id }) => id), ['build-1']);
  assert.deepEqual(brief.conversations.map(({ id }) => id), ['chat-2']);
  assert.equal(brief.builds[0].why_it_matters, 'Build one matters');
});

test('buildAgentBrief gives the agent the first three grouped topics', () => {
  const topics = Array.from({ length: 4 }, (_, index) => ({
    id: `topic-${index + 1}`,
    topic_key: `topic-${index + 1}`,
    title: `Topic ${index + 1}`,
    summary: `Summary ${index + 1}`,
  }));

  const brief = buildAgentBrief({
    date: '2026-08-04',
    for_you: [],
    trending: [],
    trending_topics: topics,
  }, 3);

  assert.deepEqual(brief.top_news.map(({ id }) => id), ['topic-1', 'topic-2', 'topic-3']);
});

test('buildAgentBrief fills a partial topic list with current news', () => {
  const newsItem = (id) => ({
    id,
    title: id,
    url: `https://example.com/${id}`,
    summary: { short_article: { subtitle: `${id} summary` } },
  });

  const brief = buildAgentBrief({
    date: '2026-08-04',
    for_you: [newsItem('news-3')],
    trending: [newsItem('news-1'), newsItem('news-2')],
    trending_topics: [{
      id: 'topic-1',
      topic_key: 'topic-1',
      title: 'Topic 1',
      summary: 'Topic 1 summary',
    }],
  }, 3);

  assert.deepEqual(brief.top_news.map(({ id }) => id), ['topic-1', 'news-1', 'news-2']);
});
