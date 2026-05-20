export type ResourceCategory = {
  slug: string;
  title: string;
  description: string;
  href: string;
};

export const resourcesContent: ResourceCategory[] = [
  {
    slug: "comparisons",
    title: "Comparisons",
    description: "Trace vs every alternative — RSS readers, aggregators, newsletters, and manual workflows. See how we stack up.",
    href: "/compare",
  },
  {
    slug: "use-cases",
    title: "Use Cases",
    description: "How founders, PMs, developers, and more use Trace to stay ahead without the noise. Find your workflow.",
    href: "/use-cases",
  },
  {
    slug: "tools",
    title: "Tools & Templates",
    description: "Free frameworks and templates for building your own signal-first reading workflow. Practical, not theoretical.",
    href: "/tools",
  },
  {
    slug: "newsletters",
    title: "Newsletter Reviews",
    description: "Honest reviews of the best tech newsletters — rated, compared, and ranked. Know what's worth your inbox space.",
    href: "/newsletters",
  },
  {
    slug: "blog",
    title: "Blog & Guides",
    description: "Deep dives into information overload, reading workflows, and building better habits. Long-form, research-backed.",
    href: "/blog",
  },
  {
    slug: "how-it-works",
    title: "How Trace Works",
    description: "A visual walkthrough of how Trace turns scattered sources into a clean daily brief. From sources to signal.",
    href: "/how-it-works",
  },
];
