import test from 'node:test';
import assert from 'node:assert/strict';
import {routeOf,sourceOf} from './normalize.ts';
test('private identifiers, unknown routes, query strings and referrer subdomains never become dimensions',()=>{
  assert.equal(routeOf('/story/private-id?token=private'),'/story/[page]');
  assert.equal(routeOf('/admin/analytics'),null);
  assert.equal(routeOf('/private-id'),null);
  assert.equal(routeOf('/feed?email=private'),'/feed');
  assert.equal(sourceOf('https://private.example.com/a?q=private'),'Other sites');
  assert.equal(sourceOf('https://127.0.0.1'),'Other sites');
  assert.equal(sourceOf('https://www.reddit.com/user/private'),'reddit.com');
});
