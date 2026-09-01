# Medium publishing package

## Title

I Kept Making My News App Cleaner. It Still Felt Exhausting.

## Subtitle

The problem was not the summaries. The feed never told you when you were done.

## SEO description

What redesigning a technology news app taught me about infinite scroll, information overload, and why a useful feed needs an ending.

## Suggested tags

Product Design, Information Overload, UX Design, News, Startups

## Suggested cover image

Use a real screenshot of the Trace feed, ideally one with the daily sections visible. Do not use an AI illustration.

**Alt text:** A clean daily technology news feed showing top reads and community discussions.

**Caption:** One of the many versions of the Trace feed.

---

# I Kept Making My News App Cleaner. It Still Felt Exhausting.

I have rebuilt the Trace feed more times than I want to admit.

Every version looked cleaner. None of them felt calmer.

I shortened the summaries. Removed cards. Added cards back. Moved Top Reads above the social posts. Moved Hacker News out of the side rail. Added images because the page felt too dry, then removed images where they became decoration.

Each change improved something. The typography was easier to scan. The hierarchy made more sense. Fewer titles were cut off halfway through a sentence.

But the page still had the same uncomfortable feeling as every other feed: there was always something else below it.

That was when I realized I had been treating information overload as a layout problem.

## The first wrong answer was better summaries

Trace started from a simple frustration. Keeping up with technology meant checking too many places.

There was the original article, the Hacker News thread about the article, a GitHub project inspired by the article, and whatever people were saying about it on X. A person could spend the morning moving between sources and still feel as if they had missed the important part.

Summaries seemed like the obvious fix.

Take a long article, compress it into a few useful paragraphs, preserve the important names and numbers, and let the reader decide whether the source deserves more time.

That part worked. It also created a new problem.

When every item becomes quick to consume, it becomes easy to add more items.

Ten long articles are intimidating. Ten neat summaries look responsible. Add a section for tools, another for discussions, another for top reads, and suddenly the supposedly calmer product contains as much material as the places it was meant to replace.

The content became shorter. The obligation did not.

## The second wrong answer was a more premium layout

So I focused on presentation.

Maybe the product did not feel valuable because it did not look valuable. Maybe larger images, more breathing room, and a stronger editorial hierarchy would make the experience feel less like a dashboard and more like a publication.

Some of that was true.

A technology article should not be squeezed into a tiny card if the title, description, and image are the reasons someone might care. Hacker News discussions become useless when both the title and the context end in an ellipsis. A paywall shown on an empty page asks people to buy a mystery.

Those were real design problems, and fixing them mattered.

But a premium-looking infinite feed is still an infinite feed.

The polish made each item nicer to consume. It did not answer the question sitting underneath the entire product:

**How much of this am I supposed to read?**

Most feeds refuse to answer that.

They are designed to keep producing. If the user stops, the session ends. If the session ends, the graph goes down. So the product keeps one more story, one more recommendation, and one more notification waiting just beyond the edge of the screen.

The user may have learned enough ten minutes ago. The interface has no reason to say so.

## A feed can be finite on purpose

The shift for me was small: stop thinking of Trace as a better stream and start treating it as an edition.

An edition has boundaries.

It can say: these are the important stories today. These are the discussions worth opening. These are the projects people are paying attention to. Here are a few deeper reads if you have the time.

Then it can end.

This sounds almost trivial. It is not.

A finite feed forces the product to make decisions that an infinite feed can avoid.

If only a few stories fit, duplicate coverage cannot hide as abundance. If three publications are rewriting the same announcement, the product has to recognize that they belong to one storyline.

If a section has no genuinely useful item today, it should be allowed to be short.

If the reader has seen the meaningful updates, the interface should not manufacture urgency to bring them back six minutes later.

An ending changes the job of the product. The goal is no longer to maximize how much content a person consumes. The goal is to help them reach a point where they can leave without feeling behind.

## Missing something is part of the product

This is the uncomfortable tradeoff.

A finite briefing will miss things.

No matter how good the sources, ranking, or personalization become, someone will find a fascinating post that was not included. An exhaustive feed can always point to its size as proof of quality. A curated feed has to defend what it left out.

I used to see that as a weakness.

Now I think it is the whole value.

The internet already provides exhaustive coverage. It is exceptionally good at finding another link. A useful news product should not compete with that abundance by producing a slightly tidier version of it.

It should take responsibility for selection.

That does not mean pretending there is one objectively correct list of stories. A developer, a founder, and a designer may need different briefings. It means being clear that personalization should change what earns a place, not simply make the endless scroll more personally addictive.

## The best state of a news app might be closed

This idea has changed what I notice while designing Trace.

I notice when a card is using length to imitate depth. I notice when a section exists because the information is useful and when it exists because an empty column looks awkward. I notice when a call to action helps the reader continue a thought and when it merely keeps them inside the product.

Most importantly, I notice whether the page offers a natural place to stop.

I am still working through the details. How many stories make a daily briefing feel complete without becoming another inbox? When should a developing story return? How much context belongs in the feed, and when should the product get out of the way and send someone to the original source?

There is no victory-lap answer yet.

But I no longer believe the best news product is the one that helps me read the greatest number of things. I want one that helps me understand what matters, follow anything worth going deeper on, and then close it.

[Trace](https://www.yourtrace.online) is my attempt to build that: a personalized technology briefing with an ending.

Because sometimes the most useful thing a feed can say is:

**You are caught up. Go do something else.**

---

*Disclosure: I am the builder of Trace, the product discussed in this article.*
