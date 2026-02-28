import topBooks from './data/top_books_by_interest_enriched.json';
import { DEV_MODE } from './lib/devConfig';
import { loadUserPreferences, loadSeenContent } from './lib/userPreferences';

// --- Book card files ---
import technology from './data/interests/technology.json';
import science from './data/interests/science.json';
import psychology from './data/interests/psychology.json';
import ideas from './data/interests/ideas.json';
import business from './data/interests/business.json';
import money from './data/interests/money.json';
import design from './data/interests/design.json';
import career from './data/interests/career.json';
import selfDevelopment from './data/interests/self-development.json';
import health from './data/interests/health.json';
import cooking from './data/interests/cooking.json';
import culture from './data/interests/culture.json';
import relationships from './data/interests/relationships.json';
import society from './data/interests/society.json';

// --- Article card files ---
import articleBusiness from './data/articles/business.json';
import articleCareer from './data/articles/career.json';
import articleCooking from './data/articles/cooking.json';
import articleCulture from './data/articles/culture.json';
import articleDesign from './data/articles/design.json';
import articleHealth from './data/articles/health.json';
import articleIdeas from './data/articles/ideas.json';
import articleMoney from './data/articles/money.json';
import articlePsychology from './data/articles/psychology.json';
import articleRelationships from './data/articles/relationships.json';
import articleScience from './data/articles/science.json';
import articleSelfDevelopment from './data/articles/self-development.json';
import articleSociety from './data/articles/society.json';
import articleTechnology from './data/articles/technology.json';

// --- Video card files ---
import videoBusiness from './data/videos/business.json';
import videoCareer from './data/videos/career.json';
import videoCooking from './data/videos/cooking.json';
import videoCulture from './data/videos/culture.json';
import videoDesign from './data/videos/design.json';
import videoHealth from './data/videos/health.json';
import videoIdeas from './data/videos/ideas.json';
import videoMoney from './data/videos/money.json';
import videoPsychology from './data/videos/psychology.json';
import videoRelationships from './data/videos/relationships.json';
import videoScience from './data/videos/science.json';
import videoSelfDevelopment from './data/videos/self-development.json';
import videoSociety from './data/videos/society.json';
import videoTechnology from './data/videos/technology.json';

const bookFiles = {
  technology,
  science,
  psychology,
  ideas,
  business,
  money,
  design,
  career,
  'self-development': selfDevelopment,
  health,
  cooking,
  culture,
  relationships,
  society,
};

const articleFiles = {
  business: articleBusiness,
  career: articleCareer,
  cooking: articleCooking,
  culture: articleCulture,
  design: articleDesign,
  health: articleHealth,
  ideas: articleIdeas,
  money: articleMoney,
  psychology: articlePsychology,
  relationships: articleRelationships,
  science: articleScience,
  'self-development': articleSelfDevelopment,
  society: articleSociety,
  technology: articleTechnology,
};

const videoFiles = {
  business: videoBusiness,
  career: videoCareer,
  cooking: videoCooking,
  culture: videoCulture,
  design: videoDesign,
  health: videoHealth,
  ideas: videoIdeas,
  money: videoMoney,
  psychology: videoPsychology,
  relationships: videoRelationships,
  science: videoScience,
  'self-development': videoSelfDevelopment,
  society: videoSociety,
  technology: videoTechnology,
};

export const INTEREST_COLORS = {
  technology: '#2E7DD1',
  science: '#2D8B57',
  psychology: '#D94A7B',
  ideas: '#D4882A',
  business: '#6B5AC9',
  money: '#1F9D5A',
  design: '#D14D8A',
  career: '#0A9A9A',
  'self-development': '#9B6B9B',
  health: '#3D9B5A',
  cooking: '#D9603A',
  culture: '#C9A000',
  relationships: '#D94545',
  society: '#4A8EB8',
};

const TYPE_EMOJI = {
  book: '📖',
  article: '📝',
  video: '🎬',
};

// ─────────────────────────────────────────────────────────────
// Personalization Scoring (see docs/PERSONALIZATION_ALGORITHM.md)
// ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  EXPLICIT_TOPIC: 10,
  FOCUS_DERIVED: 5,
  GOAL_DERIVED: 3,
  SWIPE_LIKE_MATCH: 8,
  SWIPE_DISLIKE_MATCH: -5,
  UNSEEN_BONUS: 15,
};

// Map focus to interests
const FOCUS_INTERESTS = {
  social: ['relationships', 'culture', 'psychology'],
  reading: ['self-development', 'psychology'],
  ideas: ['ideas', 'technology', 'science'],
  growth: ['self-development', 'psychology', 'health'],
};

// Map goals to interests
const GOAL_INTERESTS = {
  productivity: ['self-development', 'technology'],
  career: ['career', 'business'],
  habits: ['self-development', 'health'],
  money: ['money', 'business'],
  smarter: ['science', 'psychology', 'ideas'],
  social: ['relationships', 'culture'],
};

// Cached preferences for scoring
let _cachedPrefs = null;
let _cachedSeen = null;

// Load preferences (call this on app start or after onboarding)
export async function refreshPersonalization() {
  _cachedPrefs = await loadUserPreferences();
  _cachedSeen = await loadSeenContent();
  _allItems = null; // Reset so items get re-sorted
}

// Score a single item based on user preferences
function scoreItem(item, prefs, seen) {
  if (!prefs?.onboarding) return 0;

  let score = 0;
  const { focus, goals, topics, swipeLikes, swipeDislikes } = prefs.onboarding;
  const interest = item.interest;

  // Explicit topic selection (+10)
  if (topics?.includes(interest)) {
    score += WEIGHTS.EXPLICIT_TOPIC;
  }

  // Focus-derived interest (+5)
  if (focus && FOCUS_INTERESTS[focus]?.includes(interest)) {
    score += WEIGHTS.FOCUS_DERIVED;
  }

  // Goal-derived interests (+3 per matching goal)
  if (goals?.length) {
    goals.forEach((goal) => {
      if (GOAL_INTERESTS[goal]?.includes(interest)) {
        score += WEIGHTS.GOAL_DERIVED;
      }
    });
  }

  // Swipe like match (+8)
  if (swipeLikes?.includes(interest)) {
    score += WEIGHTS.SWIPE_LIKE_MATCH;
  }

  // Swipe dislike match (-5)
  if (swipeDislikes?.includes(interest)) {
    score += WEIGHTS.SWIPE_DISLIKE_MATCH;
  }

  // Unseen bonus (+15)
  if (!seen?.seenContent?.includes(item.id)) {
    score += WEIGHTS.UNSEEN_BONUS;
  }

  return score;
}

// Sort items by score with diversity constraint
function sortByPersonalization(items) {
  if (!_cachedPrefs?.onboarding?.completedAt) {
    // No onboarding data yet, return shuffled
    return shuffle(items);
  }

  // Score all items
  const scored = items.map((item) => ({
    ...item,
    _score: scoreItem(item, _cachedPrefs, _cachedSeen),
  }));

  // Sort by score (highest first)
  scored.sort((a, b) => b._score - a._score);

  // Apply diversity constraint: max 2 per topic in final selection
  const result = [];
  const topicCount = {};

  for (const item of scored) {
    const count = topicCount[item.interest] || 0;
    if (count < 2) {
      result.push(item);
      topicCount[item.interest] = count + 1;
    }
  }

  // Clean up internal score property
  return result.map(({ _score, ...item }) => item);
}

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate consistent fallback image using Picsum
function getFallbackImage(interestId, type = 'book') {
  const seed = `${type}-${interestId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const seedNum = Math.abs(hash) % 1000;
  return `https://picsum.photos/seed/${seedNum}/400/600`;
}

function buildBooks() {
  return Object.entries(bookFiles).map(([interestId, data]) => {
    const enrichedBooks = topBooks[interestId] || [];
    const enrichedBook = enrichedBooks.find((b) => b.title === data.book.title);

    return {
      id: `book-${interestId}`,
      type: 'book',
      interest: interestId,
      color: INTEREST_COLORS[interestId] || '#7B68EE',
      title: data.book.title,
      author: data.book.author,
      subtitle: `by ${data.book.author}`,
      cover: enrichedBook?.cover || getFallbackImage(interestId, 'book'),
      cardCount: data.cards.length,
      cards: data.cards,
    };
  });
}

function buildArticles() {
  return Object.entries(articleFiles).map(([interestId, data]) => {
    const articleMeta = data.article || {};
    const author = articleMeta.author || 'Unknown';
    const publication = articleMeta.publication || 'Source';

    return {
      id: `article-${interestId}`,
      type: 'article',
      interest: interestId,
      color: INTEREST_COLORS[interestId] || '#7B68EE',
      title: articleMeta.title || 'Untitled',
      author,
      subtitle: `${author} · ${publication}`,
      cover: articleMeta.image_url || getFallbackImage(interestId, 'article'),
      cardCount: data.cards?.length || 0,
      cards: data.cards || [],
    };
  });
}

function buildVideos() {
  const allVideos = [];
  Object.entries(videoFiles).forEach(([interestId, data]) => {
    // If videos array exists, create an item for each video
    if (data.videos && data.videos.length > 0) {
      data.videos.forEach((video, idx) => {
        allVideos.push({
          id: `video-${interestId}-${idx}`,
          type: 'video',
          interest: interestId,
          color: INTEREST_COLORS[interestId] || '#7B68EE',
          title: video.title,
          author: video.creator,
          subtitle: `${video.creator} · ${video.platform}`,
          cover: video.thumbnail_url || getFallbackImage(interestId, `video-${idx}`),
          cardCount: data.cards?.length || 0,
          cards: data.cards || [],
        });
      });
    }
  });
  return allVideos;
}

// Build personalized list of all content
let _allItems = null;

export function getAllItems() {
  if (!_allItems) {
    const all = [...buildBooks(), ...buildArticles(), ...buildVideos()];
    _allItems = sortByPersonalization(all);
  }
  return _allItems;
}

export const PAGE_SIZE = 10;
export const DAILY_LIMIT = 7; // Daily content limit for production

// Available content types for filtering
export const CONTENT_TYPES = ['all', 'book', 'article', 'video'];

function filterItems(filter) {
  const all = getAllItems();
  let items = (!filter || filter === 'all') ? all : all.filter((item) => item.type === filter);

  // In production, limit to daily allowance
  if (!DEV_MODE) {
    items = items.slice(0, DAILY_LIMIT);
  }

  return items;
}

export function getPage(page, filter = 'all') {
  const items = filterItems(filter);
  return items.slice(0, page * PAGE_SIZE);
}

export function getTotalCount(filter = 'all') {
  return filterItems(filter).length;
}

export function getTypeCount(type) {
  const items = filterItems(type);
  return items.length;
}

export { TYPE_EMOJI };
