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
