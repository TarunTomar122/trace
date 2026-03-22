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
];

export function getComparePage(slug: string): ComparePage | undefined {
  return comparePages.find((page) => page.slug === slug);
}
