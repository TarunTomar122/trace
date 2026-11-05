/**
 * Our feeds' names are not outlets ("CNBC Top News" is one of CNBC's feeds,
 * "AI/TLDR Models" a model-release list): readers see the publication.
 * Same mapping as OUTLET_NAMES / LINK_ONLY_FEEDS / DOMAIN_NAMES in
 * backend/v3/flows/send_audience_newsletter.py; keep the two in step.
 */
const OUTLET_NAMES: Record<string, string> = {
  'CNBC Top News': 'CNBC', 'CNBC Technology': 'CNBC', 'CNBC Markets': 'CNBC',
  'CNBC US Markets': 'CNBC', 'CNBC Investing': 'CNBC', 'CNBC Business': 'CNBC',
  'THE DECODER': 'The Decoder', 'The Register Business': 'The Register',
  'WIRED Business': 'Wired', 'TechCrunch Startups': 'TechCrunch',
  'TechCrunch Venture': 'TechCrunch', 'TechCrunch Fintech': 'TechCrunch',
  'TechCrunch Robotics': 'TechCrunch', 'The Verge Robots': 'The Verge',
  'The Verge Autonomous Cars': 'The Verge', 'Yahoo Finance Markets': 'Yahoo Finance',
  'SecurityWeek Malware & Threats': 'SecurityWeek', 'MIT Technology Review AI': 'MIT Technology Review',
  'VentureBeat AI': 'VentureBeat', 'LA Times Business': 'LA Times', 'Time Business': 'Time',
  'Vox Economy': 'Vox', 'The Conversation Business': 'The Conversation',
  'IEEE Spectrum Robotics': 'IEEE Spectrum', 'New Atlas Robotics': 'New Atlas',
  'Bloomberg Technology': 'Bloomberg', 'Hugging Face Blog': 'Hugging Face',
  'Google AI Blog': 'Google', 'DeepMind Blog': 'Google DeepMind', 'OpenAI News': 'OpenAI',
  'Anthropic News': 'Anthropic', 'BBC Technology': 'BBC', 'Waymo Blog': 'Waymo',
  'BLS Economic Releases': 'BLS', 'BEA Economic Releases': 'BEA',
};
const LINK_ONLY_FEEDS = new Set(['AI/TLDR Models']);
const DOMAIN_NAMES: Record<string, string> = {
  'huggingface.co': 'Hugging Face', 'github.com': 'GitHub', 'arxiv.org': 'arXiv',
  'x.com': 'X', 'twitter.com': 'X', 'youtube.com': 'YouTube', 'openai.com': 'OpenAI',
  'anthropic.com': 'Anthropic', 'blog.google': 'Google', 'deepmind.google': 'Google DeepMind',
  'ai.meta.com': 'Meta', 'mistral.ai': 'Mistral', 'qwenlm.github.io': 'Qwen',
};

/** The publication to show for a feed's source name and the article's link. */
export function outletName(source: string | undefined, url: string | undefined): string {
  let domain = '';
  try { domain = new URL(url || '').hostname.replace(/^www\./, ''); } catch { /* not a URL */ }
  const name = (source || '').trim();
  if (name && !LINK_ONLY_FEEDS.has(name)) return OUTLET_NAMES[name] || name;
  // A product subdomain reads as its company (developers.openai.com is OpenAI).
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i += 1) {
    const named = DOMAIN_NAMES[parts.slice(i).join('.')];
    if (named) return named;
  }
  return domain || name;
}
