export type NewsletterPage = {
  slug: string;
  name: string;
  description: string;
  url: string;
  frequency: string;
  topics: string[];
  rating: number;
  pros: string[];
  cons: string[];
};

export const newslettersContent: NewsletterPage[] = [
  {
    slug: "tldr-tech",
    name: "TLDR",
    description: "Daily tech newsletter covering startups, engineering, and big tech with a witty, no-nonsense tone. One of the most popular tech digests for a reason.",
    url: "https://tldr.tech",
    frequency: "Daily",
    topics: ["Startups", "Engineering", "Big Tech"],
    rating: 4,
    pros: ["Consistently high-quality curation", "Covers under-the-radar stories alongside big headlines", "Quick 5-minute read", "Well-organized sections"],
    cons: ["Limited depth on complex topics", "US-centric coverage", "Sponsored content can feel native"],
  },
  {
    slug: "the-hustle",
    name: "The Hustle",
    description: "Business and tech news with personality. Known for its conversational tone and ability to make dry topics engaging.",
    url: "https://thehustle.co",
    frequency: "Daily",
    topics: ["Business", "Tech", "Startups"],
    rating: 4,
    pros: ["Entertaining writing style", "Covers business angles other newsletters miss", "Strong weekend edition", "Good for non-technical readers"],
    cons: ["Less technical depth than alternatives", "Some stories feel stretched for entertainment", "Heavy on US business news"],
  },
  {
    slug: "morning-brew-tech",
    name: "Morning Brew (Tech Brew)",
    description: "The tech-focused arm of Morning Brew's media empire. Broad tech coverage with a polished, accessible approach.",
    url: "https://www.morningbrew.com/techbrew",
    frequency: "Daily",
    topics: ["Big Tech", "Startups", "Policy"],
    rating: 3,
    pros: ["Clean, professional curation", "Good policy and regulatory coverage", "Accessible for non-technical readers", "Well-established brand with editorial resources"],
    cons: ["Can feel surface-level for industry insiders", "Slower to cover breaking stories", "Broad coverage means less depth per topic"],
  },
  {
    slug: "strictlyvc",
    name: "StrictlyVC",
    description: "Venture capital and startup funding news. The go-to for who raised what and what it means for the ecosystem.",
    url: "https://www.strictlyvc.com",
    frequency: "Daily",
    topics: ["VC", "Fundraising", "Startups"],
    rating: 4,
    pros: ["Deep funding and deal coverage", "Strong network for scoops", "Concise format", "Good investor perspective"],
    cons: ["Narrow focus on funding news", "Less coverage of product and tech details", "Paywalled deeper analysis"],
  },
  {
    slug: "techcrunch-daily",
    name: "TechCrunch Daily",
    description: "The daily newsletter from TechCrunch covering the day's biggest startup and tech stories with original reporting.",
    url: "https://techcrunch.com/newsletters",
    frequency: "Daily",
    topics: ["Startups", "VC", "Big Tech"],
    rating: 3,
    pros: ["Original reporting and scoops", "Comprehensive startup coverage", "Strong event and launch tracking", "Well-known, trusted brand"],
    cons: ["Can be overwhelming in volume", "Mixed signal-to-noise on slower news days", "Heavy on PR-driven stories"],
  },
  {
    slug: "hacker-newsletter",
    name: "Hacker Newsletter",
    description: "A weekly hand-curated roundup of the best Hacker News posts. Perfect if you want HN's signal without the daily scroll.",
    url: "https://hackernewsletter.com",
    frequency: "Weekly",
    topics: ["Programming", "Startups", "Tech"],
    rating: 4,
    pros: ["Excellent curation of HN's best", "Weekly format is manageable", "Covers niche programming topics well", "No algorithm — human-curated"],
    cons: ["Weekly means you're behind on breaking news", "Only covers HN — misses other platforms", "Can be programming-heavy"],
  },
  {
    slug: "product-hunt-daily",
    name: "Product Hunt Daily",
    description: "The daily roundup of top Product Hunt launches. Essential for anyone tracking new products and tools.",
    url: "https://www.producthunt.com/newsletters",
    frequency: "Daily",
    topics: ["Product Launches", "Tools", "Startups"],
    rating: 3,
    pros: ["Comprehensive launch coverage", "Community-voted rankings", "Good for discovering new tools", "Includes maker stories"],
    cons: ["Rankings can be gamed", "Heavy on low-signal launches on slow days", "Limited context beyond the launch itself"],
  },
  {
    slug: "ben-evans",
    name: "Ben Evans",
    description: "Deep, analytical essays on tech trends and strategy from the former a16z partner. Not a typical newsletter — more like short research papers.",
    url: "https://www.ben-evans.com/newsletter",
    frequency: "Weekly",
    topics: ["Tech Strategy", "Trends", "Analysis"],
    rating: 5,
    pros: ["Exceptional depth and original analysis", "Data-driven arguments with great charts", "No hot takes — carefully researched", "Influential in venture and strategy circles"],
    cons: ["Weekly cadence means less coverage of daily news", "Heavy — not a quick read", "Narrow focus on high-level strategy"],
  },
  {
    slug: "stratechery",
    name: "Stratechery",
    description: "Ben Thompson's influential analysis of tech strategy and business models. Widely read by executives and investors.",
    url: "https://stratechery.com",
    frequency: "Daily",
    topics: ["Tech Strategy", "Business Models", "Big Tech"],
    rating: 5,
    pros: ["Industry-defining analysis", "Unique frameworks for thinking about tech", "Consistent quality over years", "Strong subscriber community"],
    cons: ["Paywalled ($12/month for full access)", "Can be abstract for casual readers", "Focused on business strategy over product"],
  },
  {
    slug: "pragmatic-engineer",
    name: "The Pragmatic Engineer",
    description: "Deep dives into engineering culture, practices, and the business of software. Written by a former Uber and Stripe engineer.",
    url: "https://newsletter.pragmaticengineer.com",
    frequency: "Weekly",
    topics: ["Engineering", "Tech Industry", "Career"],
    rating: 4,
    pros: ["Practical, experience-backed advice", "Covers engineering org and culture deeply", "Good compensation and market data", "Relevant for senior engineers and managers"],
    cons: ["Not a news source — analysis-focused", "Less relevant for non-engineering roles", "Long-form can be time-consuming"],
  },
];
