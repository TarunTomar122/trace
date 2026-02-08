import topBooks from '../data/top_books_by_interest_enriched.json';

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

const interestFiles = {
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

export function getAllBooks() {
  return Object.entries(interestFiles).map(([interestId, data]) => {
    const enrichedBooks = topBooks[interestId] || [];
    const enrichedBook = enrichedBooks.find((b) => b.title === data.book.title);

    return {
      id: interestId,
      interest: interestId,
      color: INTEREST_COLORS[interestId] || '#7B68EE',
      title: data.book.title,
      author: data.book.author,
      cover: enrichedBook?.cover || null,
      cardCount: data.cards.length,
      cards: data.cards,
    };
  });
}

