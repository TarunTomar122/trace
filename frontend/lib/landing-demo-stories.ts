export type LandingDemoStory = {
  id: string;
  title: string;
  tag: string;
  why: string;
  sources: string[];
  sourceName: string;
  image: string;
  mark: string;
  coverage: { source: string; domain: string; line: string }[];
};

export const LANDING_DEMO_STORIES: LandingDemoStory[] = [
  {
    id: 'gpt5',
    title: 'OpenAI puts GPT-5 in ChatGPT, and GPT-4o is now a paid add-on',
    tag: 'AI',
    why: 'The default model just jumped a generation. Every product that “uses ChatGPT” has to explain what that means now.',
    sources: ['theverge.com', 'techcrunch.com', 'bloomberg.com', 'wired.com'],
    sourceName: 'The Verge',
    image: '/landing/gpt5.jpg',
    mark: 'GPT-5',
    coverage: [
      { source: 'The Verge', domain: 'theverge.com', line: 'OpenAI drops GPT-5 into ChatGPT as the new default' },
      { source: 'TechCrunch', domain: 'techcrunch.com', line: 'GPT-4o is moving behind a paywall' },
      { source: 'Bloomberg', domain: 'bloomberg.com', line: 'Labs now have to match a new floor, not a demo' },
      { source: 'Wired', domain: 'wired.com', line: 'Wrapper apps have to explain what ChatGPT means' },
    ],
  },
  {
    id: 'siri',
    title: 'Apple rebuilds Siri on its own models, and finally lets it act in apps',
    tag: 'AI',
    why: 'On-device agents in a billion pockets is a distribution story Google cannot buy.',
    sources: ['bloomberg.com', 'theverge.com', '9to5mac.com'],
    sourceName: 'Bloomberg',
    image: '/landing/siri.jpg',
    mark: 'Siri',
    coverage: [],
  },
  {
    id: 'gemini',
    title: 'Google puts Gemini in every Android notification',
    tag: 'AI',
    why: 'If the assistant lives in the shade, it does not need a new home screen. It needs a reason to speak.',
    sources: ['theverge.com', 'arstechnica.com', 'reuters.com'],
    sourceName: 'The Verge',
    image: '/landing/gemini.jpg',
    mark: 'Gemini',
    coverage: [],
  },
  {
    id: 'iran-deal',
    title: 'Trump signs peace deal with Iran, and markets rally on the news',
    tag: 'Markets',
    why: 'Oil slipped and stocks jumped within hours. The geopolitical risk premium just got repriced.',
    sources: ['reuters.com', 'bloomberg.com', 'cnbc.com'],
    sourceName: 'Reuters',
    image: '/landing/siri.jpg',
    mark: 'Markets',
    coverage: [],
  },
  {
    id: 'llama5',
    title: 'Meta ships Llama 5 with on-device inference for phones',
    tag: 'AI',
    why: 'Open weights that run offline change who owns the assistant layer on your phone.',
    sources: ['techcrunch.com', 'theverge.com', 'arstechnica.com'],
    sourceName: 'TechCrunch',
    image: '/landing/gemini.jpg',
    mark: 'Llama 5',
    coverage: [],
  },
  {
    id: 'nvidia',
    title: 'Nvidia crosses $6T as AI chip demand keeps climbing',
    tag: 'Markets',
    why: 'The capex cycle behind every frontier lab is still accelerating, not cooling.',
    sources: ['bloomberg.com', 'reuters.com', 'cnbc.com'],
    sourceName: 'Bloomberg',
    image: '/landing/gpt5.jpg',
    mark: 'NVDA',
    coverage: [],
  },
  {
    id: 'eu-ai-act',
    title: 'EU sets enforcement timeline for the AI Act',
    tag: 'Tech',
    why: 'General-purpose models now have a compliance clock. Startups shipping in Europe need a plan.',
    sources: ['reuters.com', 'politico.eu', 'techcrunch.com'],
    sourceName: 'Reuters',
    image: '/landing/siri.jpg',
    mark: 'EU',
    coverage: [],
  },
];
