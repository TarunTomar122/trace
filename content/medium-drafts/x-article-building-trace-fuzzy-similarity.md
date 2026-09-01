# While Building Trace, I Had to Teach It When Two Headlines Were the Same Story

*A small fuzzy matcher fixed most of our duplicate news problem.*

While building [Trace](https://www.yourtrace.online), I ran into a boring problem that made the whole feed feel broken.

Whenever a big technology story dropped, Trace would show it several times.

There would be the original announcement, two rewritten articles, a Hacker News submission, and sometimes a GitHub project connected to the same news.

The summaries were fine. The feed was not.

It looked as if Trace had found six stories when it had really found one.

## Exact matching failed immediately

Comparing URLs only catches literal duplicates. It does nothing when five publications cover the same announcement.

Comparing titles exactly was not much better. Publishers rarely use the same headline.

These two titles should probably be grouped:

> Acme releases Orion 2 for developers

> Why Acme’s new Orion 2 release matters

These should not:

> Acme releases Orion 2

> Acme faces a lawsuit over Orion training data

Both pairs share words. Only the first pair describes the same event.

I did not need a system that understood the entire article. I needed a cheap first pass that could remove the obvious repeats without hiding different stories.

## The matcher we used

The approach was simple:

1. Normalize each title.
2. Remove punctuation and common words.
3. Ignore broad technology words.
4. Compare the meaningful tokens left behind.

Here is the core of it:

```ts
const STOPWORDS = new Set([
  "a", "an", "and", "for", "from", "how",
  "in", "is", "of", "on", "the", "to", "with"
]);

const BROAD_WORDS = new Set([
  "war", "conflict", "crisis", "election",
  "politics", "government", "military",
  "market", "markets", "stocks", "economy"
]);

function storyTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 4)
    .filter(word => !STOPWORDS.has(word))
    .filter(word => !BROAD_WORDS.has(word));

  return new Set(words);
}
```

Removing broad words mattered more than I expected.

Words like “market,” “conflict,” and “government” appear across unrelated stories. They make two titles look similar without identifying the event.

Names, product versions, actions, and numbers are much stronger signals.

The production matcher also checks character-sequence similarity. The token rule below is the easier part to explain and debug.

## Scoring the overlap

Once both titles are reduced to meaningful tokens, I count how many they share.

The score is:

```txt
shared tokens / size of the smaller token set
```

Using the smaller set helps when one publisher adds extra framing to a short original headline.

The implementation requires at least two shared tokens, then uses `0.5` as the match threshold:

```ts
function isSameStory(a: string, b: string): boolean {
  const left = storyTokens(a);
  const right = storyTokens(b);

  if (!left.size || !right.size) return false;

  const shared = [...left]
    .filter(word => right.has(word))
    .length;

  if (shared < 2) return false;

  const overlap =
    shared / Math.min(left.size, right.size);

  return overlap >= 0.5;
}
```

One shared company name is not enough. That guardrail prevents a lot of bad merges.

## False merges were worse than duplicates

The threshold was not chosen to make the feed perfectly tidy.

Leaving one duplicate is annoying. Merging two different stories can hide an important update.

For Trace, the safer failure is keeping an extra card.

That is also why broad subjects are removed before scoring. “Apple AI” is a topic, not an event.

Version numbers help, but they expose a weakness in this small matcher.

“Orion 2 launches” and “Orion 3 launches” can still score highly if the other words match. A hard check for conflicting numbers is the next guardrail, not something I want to pretend is already solved.

The matcher is deliberately conservative.

## Where it sits in the feed

For a small ordered list, the deduplication pass walks through each item and keeps the first title that does not match something already selected.

```ts
const kept = [];

for (const item of items) {
  const duplicate = kept.some(existing =>
    isSameStory(item.title, existing.title)
  );

  if (!duplicate) kept.push(item);
}
```

This is pairwise comparison, but a daily edition contains a small number of candidates. The simple version is fast enough and easy to inspect when it makes a bad decision.

If the pool grows much larger, I would bucket candidates by date, company, product, or version before running fuzzy comparison.

## What this fixed

It does not catch every paraphrase. Two headlines can describe the same event without sharing enough words.

That is fine for now.

The matcher removed the obvious duplicate coverage while staying deterministic. When it groups the wrong stories, I can inspect the tokens and threshold instead of guessing why a model made the decision.

That was enough to make the Trace feed feel like a set of stories instead of a pile of links.

The code was small. The product difference was not.

*Disclosure: I build Trace. The code here is a shortened version of its title-matching logic.*
