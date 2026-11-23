import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProps, cleanUtm, countsAsEvent, isReadPath, keyEventFor, legacyRoute, publicPath, referrerHost, routeOf } from './normalize.ts';
import { isBot, isForgedBrowser } from './ua.ts';

test('only public pages leave the browser: real paths for shared pages, the route for a sponsor, nothing else', () => {
  assert.equal(publicPath('/story/abc123?token=private#x'), '/story/abc123');
  assert.equal(publicPath('/brief/2026-11-20/'), '/brief/2026-11-20');
  assert.equal(publicPath('/brief/customize'), '/brief/customize');
  assert.equal(publicPath('/blog/feedly-alternatives'), '/blog/feedly-alternatives');
  assert.equal(publicPath('/featured/2026-11-20/x1'), '/featured/2026-11-20/x1');
  assert.equal(publicPath('/sponsor/private-sponsor-id'), '/sponsor/[id]');
  assert.equal(publicPath('/sponsor/[id]'), '/sponsor/[id]');
  assert.equal(publicPath('/feed?email=private'), '/feed');
  assert.equal(publicPath('/'), '/');
  for (const path of ['/admin/analytics', '/api/a', '/dev/feed-v2', '/oauth/authorize', '/control-plane', '/private-id', '/feed/private', '//evil.example', 'https://evil.example/', null]) {
    assert.equal(publicPath(path), null, String(path));
  }
});

test('routes name the page a path is an instance of', () => {
  assert.equal(routeOf('/brief/2026-11-20'), '/brief/[date]');
  assert.equal(routeOf('/brief/customize'), '/brief/customize');
  assert.equal(routeOf('/story/abc'), '/story/[id]');
  assert.equal(routeOf('/featured/2026-11-20/x1'), '/featured/[date]/[id]');
  assert.equal(routeOf('/feed'), '/feed');
  assert.equal(legacyRoute('/blog/[page]'), '/blog/[slug]');
  assert.equal(legacyRoute('/feed'), '/feed');
  assert.equal(legacyRoute('__proto__'), '__proto__');
});

test('reads are stories, briefs, featured items and articles', () => {
  assert.equal(isReadPath('/story/abc'), true);
  assert.equal(isReadPath('/brief/2026-11-20'), true);
  assert.equal(isReadPath('/featured/2026-11-20/x'), true);
  assert.equal(isReadPath('/articles/a1'), true);
  assert.equal(isReadPath('/brief/customize'), false);
  assert.equal(isReadPath('/blog/x'), false);
  assert.equal(isReadPath('/brief'), false);
});

test('key events map from the PostHog names and keep one clean property', () => {
  assert.equal(keyEventFor('newsletter_signup'), 'newsletter_signup');
  assert.equal(keyEventFor('user_signed_up'), 'signup_completed');
  assert.equal(keyEventFor('daily_edition_shared'), 'share');
  assert.equal(keyEventFor('feed_item_upvoted'), null);
  assert.equal(keyEventFor('constructor'), null);
  assert.deepEqual(cleanProps('newsletter_signup', { source: 'feed_prompt', email: 'a@b.c' }), { kind: 'feed_prompt' });
  assert.deepEqual(cleanProps('newsletter_signup', { source: 'Has spaces and @' }), {});
  assert.deepEqual(cleanProps('share', {}), { kind: 'link' });
  assert.deepEqual(cleanProps('share', { channel: 'x' }), { kind: 'x' });
  assert.deepEqual(cleanProps('brief_pref', { enabled: false }), { kind: 'off' });
  assert.deepEqual(cleanProps('signin_completed', { method: 'google' }), {});
  assert.equal(countsAsEvent('checkout_started', cleanProps('checkout_started', { source: 'tool_promo' })), true);
  assert.equal(countsAsEvent('checkout_started', cleanProps('checkout_started', { source: 'shared_story_promo' })), false);
  assert.equal(countsAsEvent('share', {}), true);
});

test('referrers keep only their host, and our own site is direct', () => {
  assert.equal(referrerHost('https://www.reddit.com/user/private?x=1', ['www.yourtrace.online']), 'reddit.com');
  assert.equal(referrerHost('https://www.yourtrace.online/feed', ['www.yourtrace.online']), null);
  assert.equal(referrerHost('http://localhost:5001/', []), null);
  assert.equal(referrerHost('javascript:alert(1)', []), null);
  assert.equal(cleanUtm('  Launch Week!! '), 'launch week');
});

test('forged browsers and bots are refused', () => {
  const chrome = (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`;
  const hints = (v, brand = 'Google Chrome') => `"Chromium";v="${v}", "${brand}";v="${v}", "Not.A/Brand";v="99"`;
  assert.equal(isForgedBrowser(chrome(146), hints(146)), false);
  assert.equal(isForgedBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0', null), false);
  assert.equal(isForgedBrowser(chrome(119), hints(146)), true);
  assert.equal(isForgedBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', hints(146)), true);
  assert.equal(isForgedBrowser('Lightpanda/1.0', null), true);
  assert.equal(isBot(chrome(146)), false);
  assert.equal(isBot('curl/8.0'), true);
  assert.equal(isBot('Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'), true);
});
