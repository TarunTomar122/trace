export type FeedItem = {
  id: string;
  type: string;
  title: string;
  url: string;
  description?: string;
  tags?: string[];
  metadata?: {
    why_relevant?: string;
  };
};

export const sampleArticles: FeedItem[] = [
  {
    id: "1",
    type: "video",
    title: "GPT-4 Vision: Complete Tutorial & Use Cases",
    url: "https://youtube.com/watch?v=example",
    tags: ["ai-machine-learning"],
    metadata: {
      why_relevant:
        "Comprehensive guide to multimodal AI matching your interests in machine learning and computer vision.",
    },
  },
  {
    id: "2",
    type: "repo",
    title: "remotion/remotion - Create videos programmatically in React",
    url: "https://github.com/remotion-dev/remotion",
    tags: ["web-development"],
    metadata: {
      why_relevant:
        "Popular React library for programmatic video creation. Aligns with your interest in creative coding and modern web tools.",
    },
  },
  {
    id: "3",
    type: "paper",
    title: "Attention Is All You Need - Transformer Architecture Explained",
    url: "https://arxiv.org/abs/1706.03762",
    tags: ["research"],
    metadata: {
      why_relevant:
        "Foundational paper on transformers that revolutionized NLP. Essential reading for understanding modern AI architectures.",
    },
  },
  {
    id: "4",
    type: "blog",
    title: "How We Built Trace: Architecture of an AI Feed Curator",
    url: "https://trace.blog/architecture",
    tags: ["product-engineering"],
    metadata: {
      why_relevant:
        "Deep dive into building personalized AI systems. Relevant to your interests in product development and ML infrastructure.",
    },
  },
  {
    id: "5",
    type: "discussion",
    title: "Next.js 15: What's New and Breaking Changes Discussion",
    url: "https://news.ycombinator.com/item?id=example",
    tags: ["web-development"],
    metadata: {
      why_relevant:
        "Active discussion on the latest Next.js release. Important for staying current with React ecosystem developments.",
    },
  },
  {
    id: "6",
    type: "launch",
    title: "Claude 3.5 Sonnet - Anthropic's Most Intelligent Model Yet",
    url: "https://www.producthunt.com/posts/claude-3-5-sonnet",
    tags: ["ai-machine-learning"],
    metadata: {
      why_relevant:
        "Major AI model launch with breakthrough reasoning capabilities. Directly relevant to your AI research interests.",
    },
  },
];
