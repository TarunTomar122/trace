export type MockStory = {
  id: string;
  title: string;
  overview: string;
  sourceName: string;
  timeAgo: string;
  metaLine: string;
  /** Remote URL or filename in public/ */
  image: string;
};

export const MOCK_STORIES: MockStory[] = [
  {
    id: "gpt5",
    title: "OpenAI ships GPT-5 with real-time reasoning for developers",
    overview:
      "The new model cuts latency on coding tasks and adds a dedicated API tier for agent workflows. Early benchmarks show a 40% jump on SWE-bench without extra fine-tuning.",
    sourceName: "The Verge",
    timeAgo: "12m ago",
    metaLine: "4 sources · 6 updates",
    image: "stories/ai.jpg",
  },
  {
    id: "apple-ai",
    title: "Apple puts on-device AI at the center of iOS 20",
    overview:
      "Summaries, search, and Siri actions now run locally on A19 chips. Privacy-first design keeps prompts off the cloud unless users opt in.",
    sourceName: "TechCrunch",
    timeAgo: "28m ago",
    metaLine: "3 sources · 4 updates",
    image: "stories/tech.jpg",
  },
  {
    id: "yc-w26",
    title: "YC W26 batch is 70% AI — record funding week for infra startups",
    overview:
      "Founders are pitching vertical agents for legal, finance, and devtools. Investors say distribution, not models, is the new moat.",
    sourceName: "Hacker News",
    timeAgo: "1h ago",
    metaLine: "5 sources · 8 updates",
    image: "stories/startup.jpg",
  },
  {
    id: "nvidia",
    title: "Nvidia unveils Blackwell Ultra for trillion-parameter training",
    overview:
      "Cloud providers are already reserving capacity. The chip targets frontier labs racing to ship multimodal agents before year-end.",
    sourceName: "Bloomberg",
    timeAgo: "2h ago",
    metaLine: "6 sources · 9 updates",
    image: "stories/chips.jpg",
  },
];

export const ROLES = ["Developer", "Founder", "Designer", "PM", "Student"] as const;
export const TOPICS = ["AI", "Startups", "Business", "World", "Science"] as const;