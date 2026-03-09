import type { FeedItem } from '@/lib/firestore';

let _current: FeedItem | null = null;
let _articleList: FeedItem[] = [];
let _currentIndex: number = 0;

export function setCurrentArticle(item: FeedItem) {
  _current = item;
}

export function getCurrentArticle(): FeedItem | null {
  return _current;
}

export function setArticleList(items: FeedItem[], startIndex: number = 0) {
  _articleList = items;
  _currentIndex = startIndex;
  if (items.length > 0 && startIndex < items.length) {
    _current = items[startIndex];
  }
}

export function getArticleList(): FeedItem[] {
  return _articleList;
}

export function getCurrentIndex(): number {
  return _currentIndex;
}

export function getNextArticle(): FeedItem | null {
  if (_currentIndex < _articleList.length - 1) {
    return _articleList[_currentIndex + 1];
  }
  return null;
}

export function getPreviousArticle(): FeedItem | null {
  if (_currentIndex > 0) {
    return _articleList[_currentIndex - 1];
  }
  return null;
}

export function navigateToNext(): FeedItem | null {
  if (_currentIndex < _articleList.length - 1) {
    _currentIndex++;
    _current = _articleList[_currentIndex];
    return _current;
  }
  return null;
}

export function navigateToPrevious(): FeedItem | null {
  if (_currentIndex > 0) {
    _currentIndex--;
    _current = _articleList[_currentIndex];
    return _current;
  }
  return null;
}

export function clearArticleList() {
  _articleList = [];
  _currentIndex = 0;
}
