import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachRelated,
  flattenRows,
  headlineGrounded,
  layoutFeed,
  omitStoryFromRows,
  packHeadlines,
  parseHeadlines,
  resolveHeadlines,
  takeFeedRows,
} from './story-headlines.ts';

function topic(id, title) {
  return { id, title };
}

test('packs a real storyline from the titles and leaves unrelated cards flat', () => {
  const packed = packHeadlines([
    topic('a', 'OpenAI publishes new model safety evals'),
    topic('b', 'Hugging Face ships a safety eval suite for jailbreaks'),
    topic('c', 'Apple Plans AI-Focused Enterprise Server'),
    topic('d', 'TSMC raises prices on advanced chips'),
    topic('e', 'Nvidia delays a data-center GPU'),
  ]);
  const safety = packed.find((h) => h.topicIds.includes('a') && h.topicIds.includes('b'));
  assert.ok(safety, 'safety + jailbreak evals should share a headline');
  assert.equal(packed.some((h) => h.topicIds.includes('c')), false);
  assert.equal(
    packed.some((h) => h.topicIds.includes('d') && h.topicIds.includes('e')),
    false,
    'two unrelated chip mentions are not a supply story',
  );
});

test('does not invent a headline for unrelated Apple news', () => {
  const packed = packHeadlines([
    topic('a', 'Apple Plans AI-Focused Enterprise Server'),
    topic('b', 'Apple Unveils iOS 27.2 Beta with Major Updates'),
    topic('c', 'Apple Unveils Photo Verification Feature for iPhone 18 Pro'),
    topic('d', 'Anthropic Enhances Claude with Integrated Cowork Features'),
  ]);
  assert.deepEqual(packed, []);
});

test('a new storyline becomes a bucket without being in a catalog', () => {
  const packed = packHeadlines([
    topic('a', 'Helios lab demonstrates room-temperature quantum encryption'),
    topic('b', 'Researchers intercept a quantum encryption key over fiber'),
    topic('c', 'A bakery in Lisbon starts accepting lightning payments'),
  ]);
  assert.equal(packed.length, 1);
  assert.deepEqual(packed[0].topicIds, ['a', 'b']);
  assert.match(packed[0].label.toLowerCase(), /quantum|encryption/);
});

test('same-company fundraising cards group; unrelated raises do not', () => {
  const packed = packHeadlines([
    topic('a', 'OpenAI Explores New $1.2 Trillion Funding Round'),
    topic('b', 'OpenAI eyes a $1.5tn private round'),
    topic('c', 'Hackuity Secures $19 Million for Cybersecurity Expansion'),
    topic('d', 'Brighteye Ventures Secures $72M for Fund III'),
  ]);
  const openai = packed.find((h) => h.topicIds.includes('a') && h.topicIds.includes('b'));
  assert.ok(openai);
  assert.equal(packed.some((h) => h.topicIds.includes('c') && h.topicIds.includes('d')), false);
});

test('rejects a pipeline costume that the titles cannot support', () => {
  const topics = [
    topic('a', 'Apple Plans AI-Focused Enterprise Server'),
    topic('b', 'Apple Unveils iOS 27.2 Beta with Major Updates'),
    topic('c', 'Apple Unveils Photo Verification Feature for iPhone 18 Pro'),
    topic('d', 'Anthropic Enhances Claude with Integrated Cowork Features'),
    topic('e', "Meta's New Smart Glasses Will Lack Cameras"),
  ];
  const packed = resolveHeadlines(topics, [
    { id: 'hb1', label: 'Chip supply', story_ids: ['a', 'b', 'c'] },
    { id: 'hb2', label: 'Collaborative Streamlines', story_ids: ['d', 'e'] },
  ]);
  assert.deepEqual(packed, []);
});

test('drops punctuated leftover buckets', () => {
  assert.deepEqual(
    parseHeadlines([
      { label: 'Also today.', topic_ids: ['a', 'b'] },
      { label: 'Also today', leftover: true, topic_ids: ['c', 'd'] },
    ]),
    [],
  );
  assert.equal(
    headlineGrounded('Also today.', [
      'Google also delays Gemini rollout',
      'Apple also expands on-device Apple Intelligence',
    ]),
    false,
  );
});

test('one shared weak verb is not a storyline', () => {
  const packed = packHeadlines([
    topic('a', 'EU Proposes Social Media Ban for Children Under 13'),
    topic('b', 'Oil Prices Surge Amid Supply Concerns and Potential Export Ban'),
    topic('c', 'Apple Revives Server Production with AI Focus'),
    topic('d', 'Boeing CEO Warns of 737 Max Production Delays'),
  ]);
  assert.deepEqual(packed, []);
  assert.equal(
    headlineGrounded('Ban', [
      'EU Proposes Social Media Ban for Children Under 13',
      'Oil Prices Surge Amid Supply Concerns and Potential Export Ban',
    ]),
    false,
  );
  assert.deepEqual(
    resolveHeadlines(
      [
        topic('a', 'EU Proposes Social Media Ban for Children Under 13'),
        topic('b', 'Oil Prices Surge Amid Supply Concerns and Potential Export Ban'),
      ],
      [{ id: 'h1', label: 'Ban', topicIds: ['a', 'b'] }],
    ),
    [],
  );
});

test('job titles like chief are not a storyline', () => {
  const packed = packHeadlines([
    topic('a', "Microsoft's AI Chief Critiques Anthropic's Claude Model"),
    topic('b', 'Netflix content chief Bela Bajaria defines event strategy as streamer eyes more live sports'),
  ]);
  assert.deepEqual(packed, []);
});

test('Google plus a pronoun is not a storyline', () => {
  const packed = packHeadlines([
    topic('a', "Google 'AI contribution pilot' tests paying websites when they're used in AI results"),
    topic('b', 'Baltro fan claims they trained Google fruit fly brain simulation to beat the game'),
  ]);
  assert.deepEqual(packed, []);
});

test('does not name a Jobs heading from Steve Jobs plus hiring news', () => {
  const packed = packHeadlines([
    topic('a', 'Apple honors Steve Jobs with a new film'),
    topic('b', 'Microsoft announces more jobs in AI'),
  ]);
  assert.deepEqual(packed, []);
});

test('union labels that splice two different stories are not grounded', () => {
  assert.equal(
    headlineGrounded('Jobs chips', [
      'Google cuts jobs in search ads',
      'TSMC raises prices on advanced chips',
    ]),
    false,
  );
});

test('layout pulls headline members together and leaves the rest as cards', () => {
  const stories = [
    topic('a', 'OpenAI publishes new model safety evals'),
    topic('c', 'Apple Plans AI-Focused Enterprise Server'),
    topic('b', 'Hugging Face ships a safety eval suite for jailbreaks'),
  ];
  const rows = layoutFeed(stories, resolveHeadlines(stories));
  assert.equal(rows[0].kind, 'headline');
  if (rows[0].kind !== 'headline') throw new Error('expected headline');
  assert.deepEqual(rows[0].stories.map((s) => s.id), ['a', 'b']);
  assert.equal(rows[1].kind, 'story');
  if (rows[1].kind !== 'story') throw new Error('expected story');
  assert.equal(rows[1].story.id, 'c');
  assert.deepEqual(flattenRows(rows).map((s) => s.id), ['a', 'b', 'c']);
});

test('a headline in a filtered tab collapses when only one topic remains', () => {
  const ai = [topic('a', 'OpenAI tightens model-release safety rules')];
  const rows = layoutFeed(ai, [{ id: 'hl1', label: 'AI safety', topicIds: ['a', 'b'] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'story');
});

test('takeFeedRows keeps a storyline together instead of splitting it at the cap', () => {
  const stories = [
    topic('a', 'Helios lab demonstrates room-temperature quantum encryption'),
    topic('b', 'A bakery in Lisbon starts accepting lightning payments'),
    topic('c', 'Researchers intercept a quantum encryption key over fiber'),
  ];
  const rows = layoutFeed(stories, packHeadlines(stories));
  const taken = takeFeedRows(rows, 2);
  const flat = flattenRows(taken);
  assert.ok(flat.some((s) => s.id === 'a') && flat.some((s) => s.id === 'c'));
});

test('packed headlines read like titles, not one-word tags', () => {
  const packed = packHeadlines([
    topic('a', 'OpenAI publishes new model safety evals'),
    topic('b', 'Hugging Face ships a safety eval suite for jailbreaks'),
  ]);
  assert.equal(packed.length, 1);
  assert.ok(packed[0].label.trim().split(/\s+/).length >= 4);
  assert.match(packed[0].label.toLowerCase(), /safety|eval/);
  assert.equal(headlineGrounded('Ban', [
    'EU Proposes Social Media Ban for Children Under 13',
    'Oil Prices Surge Amid Supply Concerns and Potential Export Ban',
  ]), false);
  assert.equal(headlineGrounded('Charles King', [
    'King Charles Warns of AI Existential Dangers',
    'King Charles to press Nvidia OpenAI Anthropic at safety summit',
  ]), false);
  assert.equal(
    headlineGrounded('Labs race to ship new model safety evals', [
      'OpenAI publishes new model safety evals',
      'Hugging Face ships a safety eval suite for jailbreaks',
    ]),
    true,
  );
});

test('a matching conversation can sit under the same headline', () => {
  const stories = [
    topic('a', 'Federal Reserve Raises Interest Rates for First Time in Three Years'),
    topic('b', 'Trump Calls for Interest Rate Cuts Following Fed Hike'),
  ];
  const related = [
    topic('p1', 'HN discusses the Fed hike and what it means for mortgages'),
    topic('p2', 'A photo essay about Lisbon bakeries'),
  ];
  const packed = attachRelated(packHeadlines(stories), stories, related);
  assert.ok(packed[0]?.relatedIds?.includes('p1'));
  assert.equal(packed[0]?.relatedIds?.includes('p2'), false);
});

test('a single shared word is not a storyline', () => {
  const packed = packHeadlines([
    topic('a', 'OpenAI Unveils Alarming AI Model Incidents'),
    topic('b', "Warsh spooks investors, OpenAI's 'concerning' incidents, Boeing's production problems and more in Morning Squawk"),
    topic('c', 'Flock Camera Hacked, Exposing Sensitive Data'),
    topic('d', 'Meta Unveils Camera-Free Smart Glasses Luna Amid Privacy Concerns'),
    topic('e', 'Trump Warns EU of Tariffs Over Canada Membership Plan'),
    topic('f', 'Trump Calls for Interest Rate Cuts Following Fed Hike'),
    topic('g', 'Sovereign Wealth Funds Warn of US Stock Decline'),
    topic('h', "King Charles warns of 'existential danger' of AI falling into wrong hands"),
    topic('i', "Strutt's Awesome Powered Wheelchair is Not a Wheelchair (For Legal Reasons)"),
    topic('j', 'Lunacy Audio Nova is a place to build and sell your own AI-powered music plugins'),
    topic('k', 'Adaptive raises $30m in funding for agentic construction accounting'),
    topic('l', "IBM's quantum chip foundry locks in $1 billion in U.S. government funding"),
  ]);
  assert.deepEqual(packed, []);
});

test('omitStoryFromRows drops a pinned story and flattens a leftover pair', () => {
  const stories = [
    topic('a', 'OpenAI publishes new model safety evals'),
    topic('b', 'Hugging Face ships a safety eval suite for jailbreaks'),
    topic('c', 'Apple Plans AI-Focused Enterprise Server'),
  ];
  const rows = layoutFeed(stories, packHeadlines(stories));
  const withoutLead = omitStoryFromRows(rows, 'a');
  assert.equal(withoutLead.some((row) => {
    if (row.kind === 'story') return row.story.id === 'a';
    return row.stories.some((story) => story.id === 'a');
  }), false);
  const leftover = withoutLead.find((row) => row.kind === 'story' && row.story.id === 'b');
  assert.ok(leftover, 'a 2-story headline should flatten to the remaining card');
  assert.deepEqual(omitStoryFromRows(rows, 'c').map((row) => (
    row.kind === 'story' ? row.story.id : row.stories.map((story) => story.id).join(',')
  )), ['a,b']);
  assert.deepEqual(flattenRows(omitStoryFromRows(rows, ['a', 'b'])).map((s) => s.id), ['c']);
});
