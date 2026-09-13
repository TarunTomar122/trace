import assert from 'node:assert/strict';
import test from 'node:test';
import { imageUrlHasPlaceholderToken } from './media-url.ts';

test('YouTube stills are real images, not placeholders', () => {
  for (const url of [
    'https://i1.ytimg.com/vi/XWcXwnysmpY/hqdefault.jpg',
    'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
    'https://i.ytimg.com/vi/abc/mqdefault.jpg',
    'https://i.ytimg.com/vi/abc/sddefault.jpg',
    'https://i1.ytimg.com/vi/abc/hqdefault_live.jpg',
  ]) {
    assert.equal(imageUrlHasPlaceholderToken(url), false, url);
  }
});

test('real placeholder filenames are rejected', () => {
  for (const url of [
    'https://example.com/default.jpg',
    'https://example.com/img/default.png',
    'https://example.com/og-default.png',
    'https://example.com/default/cover.png',
    'https://example.com/image-placeholder.png',
    'https://example.com/cover?size=default',
    'https://example.com/cover?size=default&quality=high',
    'https://example.com/cover?default=true',
    'https://example.com/DEFAULT.png',
  ]) {
    assert.equal(imageUrlHasPlaceholderToken(url), true, url);
  }
});
