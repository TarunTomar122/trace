"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Youtube, 
  Github, 
  BookOpen, 
  Bookmark,
  Sparkles,
  ArrowUpRight,
  MessageCircle,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';

type BookmarkItem = {
  id: string;
  item_id: string;
  item_metadata: {
    type?: string;
    title: string;
    description?: string;
    url: string;
    thumbnail?: string | null;
    tags?: string[];
    why_relevant?: string;
  };
  bookmarked_at: string;
};

const sourceConfig: Record<string, { icon: typeof Youtube; color: string; label: string; accent: string }> = {
  video: { icon: Youtube, color: 'text-red-500', label: 'Video', accent: 'bg-red-500' },
  repo: { icon: Github, color: 'text-violet-500', label: 'Repo', accent: 'bg-violet-500' },
  paper: { icon: BookOpen, color: 'text-blue-500', label: 'Paper', accent: 'bg-blue-500' },
  blog: { icon: BookOpen, color: 'text-emerald-500', label: 'Article', accent: 'bg-emerald-500' },
  discussion: { icon: MessageCircle, color: 'text-amber-500', label: 'Discussion', accent: 'bg-amber-500' },
  tweet: { icon: MessageCircle, color: 'text-sky-500', label: 'Thread', accent: 'bg-sky-500' },
  launch: { icon: Sparkles, color: 'text-fuchsia-500', label: 'Launch', accent: 'bg-fuchsia-500' },
  model: { icon: Sparkles, color: 'text-indigo-500', label: 'Model', accent: 'bg-indigo-500' },
};

function BookmarkCard({ bookmark, onRemove }: { 
  bookmark: BookmarkItem; 
  onRemove: () => void;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const itemKind = bookmark.item_metadata.type || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const relevance = bookmark.item_metadata.why_relevant;
  
  // Check if description is long enough to need expansion
  const descriptionNeedsExpand = bookmark.item_metadata.description && bookmark.item_metadata.description.length > 50;

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="group py-4 md:py-6 hover:bg-foreground/1 transition-colors"
    >
      {/* Top row: icon + source + context */}
      <div className="flex items-start gap-3 md:gap-4">
        {/* Source icon */}
        <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0 ${config.color} bg-current/5 border border-current/10`}>
          <Icon size={16} className={`${config.color} md:hidden`} strokeWidth={1.5} />
          <Icon size={18} className={`${config.color} hidden md:block`} strokeWidth={1.5} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source label */}
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${config.color}`}>{config.label}</span>
          </div>
          
          {/* Title - the main focus */}
          <a 
            href={bookmark.item_metadata.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group/link block mb-1.5 md:mb-2"
          >
            <h3 className="text-base md:text-lg font-serif leading-snug text-foreground group-hover/link:text-primary transition-colors">
              {bookmark.item_metadata.title}
              <ArrowUpRight 
                size={14} 
                className="inline ml-1 opacity-40 md:opacity-0 group-hover/link:opacity-60 transition-opacity -translate-y-0.5" 
              />
            </h3>
          </a>

          {/* Relevance below title (no clamp) */}
          {relevance && (
            <p className="text-[10px] font-mono text-secondary/60 mb-2">
              {relevance}
            </p>
          )}
          
          {/* Description - subtle, with expand option */}
          {bookmark.item_metadata.description && (
            <div className="mb-3 md:mb-4">
              <p className={`text-sm text-secondary/70 leading-relaxed font-mono ${!descriptionExpanded ? 'line-clamp-2' : ''}`}>
                {bookmark.item_metadata.description}
              </p>
              {descriptionNeedsExpand && (
                <button
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  className="text-xs font-mono text-primary hover:text-primary/80 mt-1 transition-colors"
                >
                  {descriptionExpanded ? '← Show less' : 'Read more →'}
                </button>
              )}
            </div>
          )}
          
          {/* Actions row - only remove button */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-secondary/50">
              Saved {new Date(bookmark.bookmarked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 px-2 py-2 md:py-1.5 text-secondary/40 hover:text-red-500 transition-colors active:scale-95"
              title="Remove bookmark"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

type FilterType = 'all' | 'video' | 'blog' | 'paper' | 'discussion' | 'repo';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredBookmarks = activeFilter === 'all' 
    ? bookmarks 
    : bookmarks.filter(bookmark => bookmark.item_metadata.type === activeFilter);

  useEffect(() => {
    // Alpha mode check
    if (!isAlphaMode()) {
      if (user) {
        router.push('/waitlist');
      } else {
        router.push('/');
      }
      return;
    }

    if (!loading && !user) {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/bookmarks', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBookmarks();
    }
  }, [user, loadBookmarks]);

  const handleRemoveBookmark = async (itemId: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/bookmarks?item_id=${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setBookmarks(prev => prev.filter(b => b.item_id !== itemId));
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header backHref="/feed" backLabel="Back to Feed" />

      <main className="w-full mt-6 md:mt-12">
        {/* Mobile filters - horizontal scroll */}
        <div className="md:hidden overflow-x-auto mb-4 px-4 scrollbar-hide">
          <div className="flex items-center gap-2 pb-2">
            {[
              { id: 'all', label: 'All Bookmarks' },
              { id: 'video', label: 'Videos' },
              { id: 'blog', label: 'Articles' },
              { id: 'paper', label: 'Papers' },
              { id: 'discussion', label: 'Discuss' },
              { id: 'repo', label: 'Repos' },
            ].map(filter => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as FilterType)}
                  className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors border ${
                    isActive 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'border-border text-secondary/70 active:bg-foreground/5'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 md:flex md:gap-12">
          {/* Filters - left sidebar, sticky (desktop only) */}
          <aside className="hidden md:block w-48 shrink-0 sticky top-24 h-fit">
            <nav className="space-y-2">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-4 px-2">
                Filters
              </h2>
              {[
                { id: 'all', label: 'All Bookmarks' },
                { id: 'video', label: 'Videos' },
                { id: 'blog', label: 'Articles' },
                { id: 'paper', label: 'Papers' },
                { id: 'discussion', label: 'Discussions' },
                { id: 'repo', label: 'Repos' },
              ].map(filter => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as FilterType)}
                    className={`w-full text-left px-2 py-2 text-sm font-serif transition-colors border ${
                      isActive 
                        ? 'text-primary border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.35)]' 
                        : 'border-transparent text-secondary/70 hover:text-foreground hover:border-border'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Bookmarks content */}
          <div className="flex-1 max-w-2xl mx-auto md:mx-0 w-full">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-mono text-secondary">
                  Loading your bookmarks...
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/20">
                  <AnimatePresence>
                    {filteredBookmarks.map((bookmark) => (
                      <BookmarkCard 
                        key={bookmark.id} 
                        bookmark={bookmark} 
                        onRemove={() => handleRemoveBookmark(bookmark.item_id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {filteredBookmarks.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 md:py-20 px-4"
                  >
                    <div className="w-12 h-12 bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                      <Bookmark size={24} className="text-primary" />
                    </div>
                    <p className="text-lg font-serif mb-2">
                      {activeFilter === 'all' ? 'No bookmarks yet' : `No ${activeFilter}s bookmarked`}
                    </p>
                    <p className="text-sm font-mono text-secondary mb-4">
                      {activeFilter === 'all' 
                        ? 'Start bookmarking content from your feed' 
                        : 'Try a different filter'}
                    </p>
                    {activeFilter !== 'all' && (
                      <button 
                        onClick={() => setActiveFilter('all')}
                        className="text-sm font-mono text-primary hover:underline uppercase tracking-wider"
                      >
                        View all bookmarks
                      </button>
                    )}
                  </motion.div>
                )}

                {/* End of bookmarks indicator */}
                {filteredBookmarks.length > 0 && (
                  <div className="py-8 md:py-12 text-center border-t border-border/20">
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary/50">
                      {filteredBookmarks.length} {filteredBookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Empty right sidebar for layout consistency */}
          <aside className="hidden md:block w-48 shrink-0"></aside>
        </div>
      </main>
    </div>
  );
}

