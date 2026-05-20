/**
 * Generates a fallback image URL based on article title/topic.
 * Uses Unsplash's free image URLs with relevant search terms.
 */

// Curated high-quality Unsplash images by category
const CATEGORY_IMAGES: Record<string, string[]> = {
  tech: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop', // circuit board
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=500&fit=crop', // laptop purple
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=500&fit=crop', // code screen
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=500&fit=crop', // cybersecurity
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=500&fit=crop', // matrix code
  ],
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=500&fit=crop', // AI brain
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=500&fit=crop', // robot face
    'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&h=500&fit=crop', // neural network
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=500&fit=crop', // robot hand
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&h=500&fit=crop', // AI concept
  ],
  business: [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop', // analytics
    'https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=500&fit=crop', // meeting
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=500&fit=crop', // office
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop', // team
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=500&fit=crop', // presentation
  ],
  startup: [
    'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=500&fit=crop', // rocket
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=500&fit=crop', // team coding
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&h=500&fit=crop', // modern office
    'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=800&h=500&fit=crop', // whiteboard
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=500&fit=crop', // laptops team
  ],
  design: [
    'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=500&fit=crop', // figma style
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=500&fit=crop', // design tools
    'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&h=500&fit=crop', // UI screens
    'https://images.unsplash.com/photo-1545235617-9465d2a55698?w=800&h=500&fit=crop', // phone mockup
    'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&h=500&fit=crop', // design desk
  ],
  productivity: [
    'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=500&fit=crop', // checklist
    'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&h=500&fit=crop', // calendar
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=500&fit=crop', // notebook
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=500&fit=crop', // desk coffee
    'https://images.unsplash.com/photo-1483058712412-4245e9b90334?w=800&h=500&fit=crop', // minimal desk
  ],
  reading: [
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=500&fit=crop', // books study
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=500&fit=crop', // open book
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=500&fit=crop', // library
    'https://images.unsplash.com/photo-1474366521946-c3d4b507abf2?w=800&h=500&fit=crop', // reading
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=500&fit=crop', // bookshelf
  ],
  science: [
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=500&fit=crop', // lab
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&h=500&fit=crop', // microscope
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop', // earth space
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&h=500&fit=crop', // DNA
    'https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=800&h=500&fit=crop', // chemistry
  ],
  finance: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=500&fit=crop', // stocks chart
    'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800&h=500&fit=crop', // trading
    'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?w=800&h=500&fit=crop', // money
    'https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?w=800&h=500&fit=crop', // crypto
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=500&fit=crop', // calculator
  ],
  general: [
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=500&fit=crop', // abstract blue
    'https://images.unsplash.com/photo-1557683316-973673bdar25?w=800&h=500&fit=crop', // gradient
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=500&fit=crop', // purple gradient
    'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=500&fit=crop', // pink gradient
    'https://images.unsplash.com/photo-1557682260-96773eb01377?w=800&h=500&fit=crop', // blue gradient
  ],
};

// Keywords that map to categories
const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  // Tech
  'code': 'tech', 'coding': 'tech', 'programming': 'tech', 'developer': 'tech',
  'software': 'tech', 'engineering': 'tech', 'api': 'tech', 'database': 'tech',
  'cloud': 'tech', 'devops': 'tech', 'javascript': 'tech', 'python': 'tech',
  'react': 'tech', 'node': 'tech', 'typescript': 'tech', 'rust': 'tech',

  // AI
  'ai': 'ai', 'artificial': 'ai', 'intelligence': 'ai', 'machine': 'ai',
  'learning': 'ai', 'gpt': 'ai', 'llm': 'ai', 'chatgpt': 'ai', 'openai': 'ai',
  'anthropic': 'ai', 'claude': 'ai', 'neural': 'ai', 'deep': 'ai', 'model': 'ai',

  // Business
  'business': 'business', 'company': 'business', 'enterprise': 'business',
  'corporate': 'business', 'management': 'business', 'strategy': 'business',
  'leadership': 'business', 'executive': 'business', 'ceo': 'business',

  // Startup
  'startup': 'startup', 'founder': 'startup', 'entrepreneur': 'startup',
  'vc': 'startup', 'funding': 'startup', 'investor': 'startup', 'saas': 'startup',
  'growth': 'startup', 'scale': 'startup', 'product': 'startup', 'launch': 'startup',

  // Design
  'design': 'design', 'ui': 'design', 'ux': 'design', 'figma': 'design',
  'interface': 'design', 'visual': 'design', 'creative': 'design', 'graphic': 'design',

  // Productivity
  'productivity': 'productivity', 'workflow': 'productivity', 'efficiency': 'productivity',
  'habit': 'productivity', 'routine': 'productivity', 'time': 'productivity',
  'focus': 'productivity', 'work': 'productivity',

  // Reading/Writing
  'read': 'reading', 'reading': 'reading', 'write': 'reading', 'writing': 'reading',
  'book': 'reading', 'essay': 'reading', 'blog': 'reading', 'article': 'reading',
  'think': 'reading', 'thinking': 'reading',

  // Science
  'science': 'science', 'research': 'science', 'study': 'science', 'biology': 'science',
  'physics': 'science', 'chemistry': 'science', 'space': 'science', 'health': 'science',
  'medical': 'science', 'brain': 'science',

  // Finance
  'finance': 'finance', 'money': 'finance', 'invest': 'finance', 'investing': 'finance',
  'stock': 'finance', 'market': 'finance', 'crypto': 'finance', 'bitcoin': 'finance',
  'trading': 'finance', 'economy': 'finance', 'economic': 'finance',
};

/**
 * Simple hash function for consistent image selection
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Detect category from title keywords
 */
function detectCategory(title: string): string {
  const words = title.toLowerCase().split(/\s+/);

  for (const word of words) {
    // Remove punctuation
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (KEYWORD_CATEGORY_MAP[cleanWord]) {
      return KEYWORD_CATEGORY_MAP[cleanWord];
    }
  }

  return 'general';
}

/**
 * Get a fallback image URL based on article title.
 * Returns consistent image for same title (deterministic).
 */
export function getFallbackImage(title: string): string {
  const category = detectCategory(title);
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.general;
  const index = hashString(title) % images.length;
  return images[index];
}

/**
 * Check if a thumbnail URL is valid
 */
export function isValidThumbnail(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 10) return false;
  if (url.includes('placeholder') || url.includes('default')) return false;
  return true;
}

/**
 * Get the best available image for an article
 */
export function getArticleImage(thumbnail: string | undefined | null, title: string): string {
  if (isValidThumbnail(thumbnail)) {
    return thumbnail!;
  }
  return getFallbackImage(title);
}

/**
 * Deterministic placeholder from picsum.photos (no API key).
 * Used when the primary thumbnail and curated Unsplash fallback both fail to load.
 */
export function getPicsumFallbackImage(title: string, width = 800, height = 500): string {
  return `https://picsum.photos/seed/${hashString(title)}/${width}/${height}`;
}

/**
 * Ordered image candidates: real thumbnail (if any), curated Unsplash, then picsum.
 */
export function getArticleImageCandidates(
  thumbnail: string | undefined | null,
  title: string,
  width = 800,
  height = 500,
): string[] {
  const candidates: string[] = [];
  if (isValidThumbnail(thumbnail)) candidates.push(thumbnail!);
  candidates.push(getFallbackImage(title));
  candidates.push(getPicsumFallbackImage(title, width, height));
  return candidates;
}
