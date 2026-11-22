import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelOf, signupAttribution } from './first-touch.ts';

const own = 'www.yourtrace.online';

test('tags win, then a share code, then the referring site', () => {
  assert.equal(channelOf('?utm_source=youtube', 'https://www.google.com/', own), 'youtube');
  assert.equal(channelOf('?from=email-share&via=abcdefgh', '', own), 'email-share');
  assert.equal(channelOf('?via=abcdefgh', '', own), 'referral');
  assert.equal(channelOf('?via=NOTACODE', '', own), 'direct');
  assert.equal(channelOf('?utm_source=<script>', '', own), 'other');
  assert.equal(channelOf('', '', own), 'direct');
});

test('referring sites are named, our own pages are not a first touch', () => {
  assert.equal(channelOf('', 'https://t.co/abc', own), 'x');
  assert.equal(channelOf('', 'https://www.google.co.uk/', own), 'google');
  assert.equal(channelOf('', 'https://gemini.google.com/app', own), 'gemini');
  assert.equal(channelOf('', 'https://chatgpt.com/', own), 'chatgpt');
  assert.equal(channelOf('', 'https://mail.google.com/', own), 'gmail');
  assert.equal(channelOf('', 'android-app://com.google.android.gm/', own), 'gmail');
  assert.equal(channelOf('', 'https://news.ycombinator.com/item?id=1', own), 'hackernews');
  assert.equal(channelOf('', 'https://m.youtube.com/', own), 'youtube');
  assert.equal(channelOf('', 'https://someblog.example/post', own), 'someblog.example');
  assert.equal(channelOf('', 'https://www.yourtrace.online/blog', own), null);
  assert.equal(channelOf('', 'https://notgoogle.com/', own), 'notgoogle.com');
});

test('the server keeps only well-formed fields', () => {
  assert.deepEqual(signupAttribution({ channel: 'tiktok', ref: 'abcdefgh' }), { channel: 'tiktok', referredBy: 'abcdefgh' });
  assert.deepEqual(signupAttribution({ channel: 'Bad Channel', ref: 'abc' }), {});
  assert.deepEqual(signupAttribution(null), {});
});
