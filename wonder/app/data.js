import topBooks from '../data/top_books_by_interest_enriched.json';

// --- Book card files ---
import technology from '../data/interests/technology.json';
import science from '../data/interests/science.json';
import psychology from '../data/interests/psychology.json';
import ideas from '../data/interests/ideas.json';
import business from '../data/interests/business.json';
import money from '../data/interests/money.json';
import design from '../data/interests/design.json';
import career from '../data/interests/career.json';
import selfDevelopment from '../data/interests/self-development.json';
import health from '../data/interests/health.json';
import cooking from '../data/interests/cooking.json';
import culture from '../data/interests/culture.json';
import relationships from '../data/interests/relationships.json';
import society from '../data/interests/society.json';

// --- Article card files ---
import articleBusiness from '../data/articles/business.json';
import articleCareer from '../data/articles/career.json';
import articleCooking from '../data/articles/cooking.json';
import articleCulture from '../data/articles/culture.json';
import articleDesign from '../data/articles/design.json';
import articleHealth from '../data/articles/health.json';
import articleIdeas from '../data/articles/ideas.json';
import articleMoney from '../data/articles/money.json';
import articlePsychology from '../data/articles/psychology.json';
import articleRelationships from '../data/articles/relationships.json';
import articleScience from '../data/articles/science.json';
import articleSelfDevelopment from '../data/articles/self-development.json';
import articleSociety from '../data/articles/society.json';
import articleTechnology from '../data/articles/technology.json';

// --- Video card files ---
import videoBusiness from '../data/videos/business.json';
import videoCareer from '../data/videos/career.json';
import videoCooking from '../data/videos/cooking.json';
import videoCulture from '../data/videos/culture.json';
import videoDesign from '../data/videos/design.json';
import videoHealth from '../data/videos/health.json';
import videoIdeas from '../data/videos/ideas.json';
import videoMoney from '../data/videos/money.json';
import videoPsychology from '../data/videos/psychology.json';
import videoRelationships from '../data/videos/relationships.json';
import videoScience from '../data/videos/science.json';
import videoSelfDevelopment from '../data/videos/self-development.json';
import videoSociety from '../data/videos/society.json';
import videoTechnology from '../data/videos/technology.json';

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
  technology: '#4A9DFF',
  science: '#50C878',
  psychology: '#FF6B9D',
  ideas: '#FFB347',
  business: '#7B68EE',
  money: '#2ECC71',
  design: '#FF69B4',
  career: '#00CED1',
  'self-development': '#DDA0DD',
  health: '#98FB98',
  cooking: '#FF7F50',
  culture: '#FFD700',
  relationships: '#FF6347',
  society: '#87CEEB',
};

const TYPE_EMOJI = {
  book: '📖',
  article: '📝',
  video: '🎬',
};

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
      cover: enrichedBook?.cover || null,
      cardCount: data.cards.length,
      cards: data.cards,
    };
  });
}

function buildArticles() {
  return Object.entries(articleFiles).map(([interestId, data]) => ({
    id: `article-${interestId}`,
    type: 'article',
    interest: interestId,
    color: INTEREST_COLORS[interestId] || '#7B68EE',
    title: data.article.title,
    author: data.article.author,
    subtitle: `${data.article.author} · ${data.article.publication}`,
    cover: data.article.image_url || null,
    cardCount: data.cards.length,
    cards: data.cards,
  }));
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
          cover: video.thumbnail_url || null,
          cardCount: data.cards?.length || 0,
          cards: data.cards || [],
        });
      });
    }
  });
  return allVideos;
}

// Build one shuffled master list of all content
let _allItems = null;

export function getAllItems() {
  if (!_allItems) {
    _allItems = shuffle([...buildBooks(), ...buildArticles(), ...buildVideos()]);
  }
  return _allItems;
}

export const PAGE_SIZE = 10;

// Available content types for filtering
export const CONTENT_TYPES = ['all', 'book', 'article', 'video'];

function filterItems(filter) {
  const all = getAllItems();
  if (!filter || filter === 'all') return all;
  return all.filter((item) => item.type === filter);
}

export function getPage(page, filter = 'all') {
  return filterItems(filter).slice(0, page * PAGE_SIZE);
}

export function getTotalCount(filter = 'all') {
  return filterItems(filter).length;
}

export function getTypeCount(type) {
  if (type === 'all') return getAllItems().length;
  return getAllItems().filter((item) => item.type === type).length;
}

export { TYPE_EMOJI };
