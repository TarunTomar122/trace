export type ComparePage = {
  slug: string;
  title: string;
  description: string;
  heroTitle: string;
  heroDescription: string;
  intro: string;
  comparisonTitle: string;
  comparisonRows: Array<{
    label: string;
    trace: string;
    alternative: string;
  }>;
  sections: Array<{
    title: string;
    body: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
};

export const comparePages: ComparePage[] = [
  {
    slug: "feedly-alternative",
    title: "Feedly Alternative For Busy Tech Readers | Trace",
    description:
      "Trace is a Feedly alternative for people who want the point of the story, not another unread queue of links.",
    heroTitle: "A Feedly alternative for people who do not want another reading backlog",
    heroDescription:
      "Feedly is great if you want to manage sources. Trace is better if you want grouped story context, fast summaries, and fewer tabs.",
    intro:
      "Most people do not have an RSS problem. They have a time problem. Feedly helps you collect more sources. Trace helps you understand what actually matters across them.",
    comparisonTitle: "Trace vs Feedly",
    comparisonRows: [
      {
        label: "What you open each morning",
        trace: "A topic page with grouped coverage",
        alternative: "A stream of raw unread articles",
      },
      {
        label: "How duplicate coverage is handled",
        trace: "Related stories are grouped into one topic page",
        alternative: "You still scan multiple items yourself",
      },
      {
        label: "Best for",
        trace: "Busy readers who want signal fast",
        alternative: "Power users who want source control",
      },
    ],
    sections: [
      {
        title: "Why Trace is a better fit for most people",
        body:
          "If your real goal is keeping up with AI, tech, startups, or product news without losing an hour every day, Trace gives you a better default. It starts from the grouped story, not the feed.",
      },
      {
        title: "What Feedly still does better",
        body:
          "If you care deeply about custom source management, foldering, or reading every post from a specific set of blogs, Feedly is still stronger. Trace is intentionally lighter and more opinionated.",
      },
    ],
    faq: [
      {
        question: "Is Trace an RSS reader?",
        answer:
          "Not really. Trace is closer to a daily signal layer built on top of many sources. The point is not collecting feeds. The point is understanding them faster.",
      },
      {
        question: "Will Trace replace Feedly for everyone?",
        answer:
          "No. Heavy RSS users may still prefer Feedly. Trace is a better fit for people who want less inbox energy and more editorial clarity.",
      },
    ],
  },
  {
    slug: "rss-reader-alternative",
    title: "RSS Reader Alternative That Does The Reading For You | Trace",
    description:
      "Trace is an RSS reader alternative for people who want grouped story summaries instead of another endless unread list.",
    heroTitle: "An RSS reader alternative that starts with the story, not the unread count",
    heroDescription:
      "Traditional RSS readers are good at collecting links. Trace is built for understanding fast-moving stories without maintaining your own reading system.",
    intro:
      "A lot of people install an RSS reader hoping it will simplify their information habit. Then it becomes another inbox. Trace takes the opposite approach: fewer items, more context, faster catch-up.",
    comparisonTitle: "Trace vs a traditional RSS reader",
    comparisonRows: [
      {
        label: "Primary unit",
        trace: "Topic pages with grouped source coverage",
        alternative: "Individual feed items",
      },
      {
        label: "Daily effort",
        trace: "Skim in a few minutes",
        alternative: "Manage and process a queue",
      },
      {
        label: "Best use case",
        trace: "Keeping up without doomscrolling",
        alternative: "Monitoring lots of sources manually",
      },
    ],
    sections: [
      {
        title: "What you trade away",
        body:
          "Trace is not trying to expose every single post from every single feed. That is a feature, not a bug. You trade source-level control for less noise and faster comprehension.",
      },
      {
        title: "What you gain",
        body:
          "You gain grouped topic pages, condensed takeaways, and a reading experience that does not ask you to become your own editor before breakfast.",
      },
    ],
    faq: [
      {
        question: "Can I still see original sources?",
        answer:
          "Yes. Trace links back to the original source when you want to go deeper. It just does not make you start there.",
      },
      {
        question: "Who should not use Trace instead of RSS?",
        answer:
          "If you need a full research inbox or you track dozens of niche blogs manually, a traditional RSS reader may still be the better tool.",
      },
    ],
  },
  {
    slug: "best-tech-news-app",
    title: "Best Tech News App For People Who Are Busy | Trace",
    description:
      "Trace helps busy people keep up with tech news using grouped topics, summaries, and source links instead of endless scrolling.",
    heroTitle: "The best tech news app is the one that respects your time",
    heroDescription:
      "Most tech news apps still reward volume. Trace is built around one question: can you understand the important story before your coffee gets cold?",
    intro:
      "If you follow AI, big tech, startups, developer tools, and product shifts, the real problem is not access. It is overload. Trace is designed to shrink that overload into a short daily habit.",
    comparisonTitle: "What makes a better tech news app",
    comparisonRows: [
      {
        label: "Signal extraction",
        trace: "Grouped topics with source counts, summaries, and timelines",
        alternative: "More headlines and more links",
      },
      {
        label: "Reading behavior",
        trace: "Skim first, dive deeper only when needed",
        alternative: "Open tabs and hope you finish them",
      },
      {
        label: "Ideal reader",
        trace: "Professionals who want to stay current fast",
        alternative: "People who enjoy browsing for its own sake",
      },
    ],
    sections: [
      {
        title: "What Trace is optimized for",
        body:
          "Trace is optimized for the person who wants to stay sharp on tech without building a complex media workflow. You get the big move, the relevant context, and the source trail in one place.",
      },
      {
        title: "Why this matters more in AI and tech",
        body:
          "In AI and tech, the same story gets fragmented across blogs, product updates, social posts, and reaction threads. Grouping is the only sane default if you want to keep up without wasting time.",
      },
    ],
    faq: [
      {
        question: "Is Trace only for AI news?",
        answer:
          "No. Trace is strongest anywhere coverage is fragmented: AI, big tech, startups, product, and adjacent industry shifts.",
      },
      {
        question: "Is Trace free?",
        answer:
          "There is a limited free experience, but the main value is designed as a paid product. The public site is meant to show the workflow, not replace the app.",
      },
    ],
  },
  {
    slug: "hacker-news-digest",
    title: "Hacker News Digest Without The Noise | Trace",
    description:
      "Trace surfaces the best Hacker News discussions alongside related coverage so you get the signal without refreshing the front page all day.",
    heroTitle: "A Hacker News digest that gives you context, not just links",
    heroDescription:
      "HN is great for discovery. Trace is better when you want the top threads grouped with the stories they reference — without spending an hour on the front page.",
    intro:
      "Hacker News rewards curiosity, but it also rewards constant checking. Trace pulls the highest-signal discussions and groups them with the original coverage so you see the full picture in minutes.",
    comparisonTitle: "Trace vs browsing Hacker News directly",
    comparisonRows: [
      {
        label: "How you catch up",
        trace: "Grouped stories with community reactions attached",
        alternative: "Scroll the front page and click into each thread",
      },
      {
        label: "Time investment",
        trace: "A few minutes to scan the day",
        alternative: "Multiple check-ins throughout the day",
      },
      {
        label: "Best for",
        trace: "Busy people who still want HN signal",
        alternative: "People who enjoy the browsing ritual",
      },
    ],
    sections: [
      {
        title: "What Trace adds to HN",
        body:
          "Trace does not replace Hacker News. It layers HN discussions on top of coverage from other sources so you see what people are saying and what actually happened in one view.",
      },
      {
        title: "When HN alone is enough",
        body:
          "If you love reading deep comment threads and discovering links organically, HN is still unmatched. Trace is for the days when you just want the digest.",
      },
    ],
    faq: [
      {
        question: "Does Trace pull all HN threads?",
        answer:
          "No. Trace focuses on high-signal discussions — threads with meaningful debate, not every Show HN or Ask HN post.",
      },
      {
        question: "Can I still click through to HN?",
        answer:
          "Yes. Trace links back to the original thread so you can dive into comments when you want to.",
      },
    ],
  },
  {
    slug: "techmeme-alternative",
    title: "Techmeme Alternative With Grouped Context | Trace",
    description:
      "Trace is a Techmeme alternative that groups stories with community discussion and product launches instead of just headlines and source links.",
    heroTitle: "A Techmeme alternative that shows you the conversation, not just the headline",
    heroDescription:
      "Techmeme is fast for headlines. Trace adds what people are saying and what shipped alongside the story — so you get context, not just links.",
    intro:
      "Techmeme does one thing very well: surface the lead story fast. But if you also want to know what developers think, what products launched, and how the conversation is evolving, you need more than a headline aggregator.",
    comparisonTitle: "Trace vs Techmeme",
    comparisonRows: [
      {
        label: "Coverage scope",
        trace: "Stories + community reactions + product launches",
        alternative: "Headlines and related source links",
      },
      {
        label: "Personalization",
        trace: "Tailored to your role and interests",
        alternative: "One feed for everyone",
      },
      {
        label: "Best for",
        trace: "Professionals who want the full picture",
        alternative: "People who just need the headline fast",
      },
    ],
    sections: [
      {
        title: "What Trace does differently",
        body:
          "Trace groups the same story from multiple angles: the original reporting, the Reddit and HN threads reacting to it, and any products or tools that shipped alongside it. You get one topic page instead of ten tabs.",
      },
      {
        title: "What Techmeme still does well",
        body:
          "If you want a pure headline river with zero friction, Techmeme is still strong. It has been doing that longer than almost anyone. Trace is for the reader who wants more depth in fewer clicks.",
      },
    ],
    faq: [
      {
        question: "Is Trace a news aggregator like Techmeme?",
        answer:
          "Trace is closer to a daily briefing tool. It aggregates and groups, but adds AI summaries, community signal, and launch tracking — not just links.",
      },
      {
        question: "Does Trace cover the same stories as Techmeme?",
        answer:
          "There is significant overlap on big tech stories. Trace also covers product launches and community discussions that Techmeme does not typically surface.",
      },
    ],
  },
  {
    slug: "morning-brew-tech-alternative",
    title: "Morning Brew For Tech People | Trace",
    description:
      "Trace is a tech-focused alternative to Morning Brew — deeper coverage, community signal, and product launches instead of general business headlines.",
    heroTitle: "A Morning Brew alternative built specifically for people in tech",
    heroDescription:
      "Morning Brew is great for general business. Trace is built for the person who cares about AI, developer tools, product launches, and what the tech community is actually debating.",
    intro:
      "Morning Brew helped normalize the idea of a daily brief. But if your world is tech — AI, infrastructure, developer tools, startups — you need signal from different sources. Trace is that brief.",
    comparisonTitle: "Trace vs Morning Brew",
    comparisonRows: [
      {
        label: "Focus area",
        trace: "Tech, AI, developer tools, startups",
        alternative: "General business and finance",
      },
      {
        label: "Sources",
        trace: "50+ tech sources including HN, Reddit, Product Hunt, GitHub",
        alternative: "Mainstream business publications",
      },
      {
        label: "Best for",
        trace: "Engineers, PMs, founders, and tech-adjacent roles",
        alternative: "General business professionals",
      },
    ],
    sections: [
      {
        title: "Why tech people need a different brief",
        body:
          "In tech, the important story might break on a GitHub repo, a Show HN post, or a Reddit thread before any publication covers it. Trace watches those sources so you do not have to.",
      },
      {
        title: "When Morning Brew is still the right fit",
        body:
          "If you need a quick scan of markets, macro, and business headlines, Morning Brew is still solid. Trace is not trying to cover earnings calls or IPO filings.",
      },
    ],
    faq: [
      {
        question: "Is Trace an email newsletter?",
        answer:
          "Trace has a daily email, but the core product is a web and mobile app with grouped topics, community signal, and product launches — more than a newsletter can carry.",
      },
      {
        question: "Can I use both Trace and Morning Brew?",
        answer:
          "Absolutely. Many readers use Morning Brew for business context and Trace for deeper tech signal. They complement each other.",
      },
    ],
  },
  {
    slug: "ai-news-aggregator",
    title: "AI News Aggregator With Real Context | Trace",
    description:
      "Trace aggregates AI news from research papers, product launches, and community discussions into grouped daily topics instead of an endless link feed.",
    heroTitle: "An AI news aggregator that groups the chaos into context",
    heroDescription:
      "AI moves fast. Trace groups coverage from research, product, and community sources into one daily view so you can follow the important shifts without drowning.",
    intro:
      "The AI space generates more content than any single person can follow. New models, new benchmarks, new tools, new debates — every day. Trace is built to compress that into signal you can actually use.",
    comparisonTitle: "Trace vs other AI news sources",
    comparisonRows: [
      {
        label: "Coverage model",
        trace: "Grouped topics across papers, products, threads, and launches",
        alternative: "Individual articles or feeds",
      },
      {
        label: "Community signal",
        trace: "HN, Reddit, and X discussions layered into stories",
        alternative: "Usually absent or separate",
      },
      {
        label: "Best for",
        trace: "Practitioners who want to stay sharp on AI without doomscrolling",
        alternative: "Researchers who need exhaustive coverage",
      },
    ],
    sections: [
      {
        title: "Why AI needs better aggregation",
        body:
          "A single model release might generate a paper, three blog posts, five Reddit threads, a Product Hunt launch, and a Twitter discourse cycle — all in 24 hours. Trace groups all of that into one topic page.",
      },
      {
        title: "What Trace does not cover",
        body:
          "Trace is not a research index. If you need arxiv-level exhaustiveness or citation graphs, specialized tools are better. Trace is for the practitioner who wants the shape of the day, not every paper.",
      },
    ],
    faq: [
      {
        question: "Does Trace cover AI research papers?",
        answer:
          "Trace surfaces research when it becomes part of the broader tech conversation — papers that get discussed on HN, Reddit, or that ship as products. It is not an arxiv mirror.",
      },
      {
        question: "How often is AI content updated?",
        answer:
          "Daily. Trace generates a fresh pulse every day with the latest AI stories, discussions, and launches grouped by topic.",
      },
    ],
  },
];

export function getComparePage(slug: string): ComparePage | undefined {
  return comparePages.find((page) => page.slug === slug);
}
