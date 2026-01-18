"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Youtube, 
  Github, 
  BookOpen, 
  ThumbsUp,
  ThumbsDown,
  MessageSquare, 
  Bookmark,
  Sparkles,
  ArrowUpRight,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getLatestUserFeed, getUserFeedByDate, getUserFeedDates, getUserProfile } from '@/lib/firestore';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';

type FeedItem = {
  id: string;
  type?: string;
  source?: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string | null;
  view_count?: number | null;
  stars?: number | null;
  tags?: string[];
  metadata?: {
    why_relevant?: string;
  };
};

type InteractionItem = {
  item_id?: string;
  action?: 'upvote' | 'downvote' | 'remove';
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

function FeedCard({ item, onUpvote, onDownvote, onStar, initialVote }: { 
  item: FeedItem; 
  onUpvote: (note?: string) => void;
  onDownvote: (note?: string) => void;
  onStar: () => void;
  initialVote?: 'upvote' | 'downvote';
}) {
  const itemKind = item.type || item.source || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const [upvoted, setUpvoted] = useState(initialVote === 'upvote');
  const [downvoted, setDownvoted] = useState(initialVote === 'downvote');
  const [bookmarked, setBookmarked] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const relevance = item.metadata?.why_relevant;

  useEffect(() => {
    setUpvoted(initialVote === 'upvote');
    setDownvoted(initialVote === 'downvote');
  }, [initialVote]);

  const handleUpvote = () => {
    const newUpvoted = !upvoted;
    setUpvoted(newUpvoted);
    if (newUpvoted) {
      setDownvoted(false);
      onUpvote();
    }
  };

  const handleDownvote = () => {
    const newDownvoted = !downvoted;
    setDownvoted(newDownvoted);
    if (newDownvoted) {
      setUpvoted(false);
      onDownvote();
    }
  };

  const handleFeedbackSubmit = () => {
    if (feedback.trim()) {
      onDownvote(feedback);
      setShowFeedback(false);
      setFeedback('');
    }
  };

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
          {/* Source label and relevance */}
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${config.color}`}>{config.label}</span>
            {relevance && (
              <>
                <span className="text-secondary/20 hidden sm:inline">·</span>
                <span className="text-[10px] font-mono text-secondary/60 truncate hidden sm:inline">{relevance}</span>
              </>
            )}
          </div>
          
          {/* Title - the main focus */}
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group/link block mb-1.5 md:mb-2"
          >
            <h3 className="text-base md:text-lg font-serif leading-snug text-foreground group-hover/link:text-primary transition-colors">
              {item.title}
              <ArrowUpRight 
                size={14} 
                className="inline ml-1 opacity-40 md:opacity-0 group-hover/link:opacity-60 transition-opacity -translate-y-0.5" 
              />
            </h3>
          </a>

          {/* Mobile: Show relevance below title */}
          {relevance && (
            <p className="text-[10px] font-mono text-secondary/60 mb-2 sm:hidden line-clamp-1">
              {relevance}
            </p>
          )}
          
          {/* Description - subtle */}
          {item.description && (
            <p className="text-sm text-secondary/70 leading-relaxed line-clamp-2 mb-3 md:mb-4 font-mono">
              {item.description}
            </p>
          )}
          
          {/* Actions row - compact */}
          <div className="flex items-center gap-1 md:gap-2 -ml-1">
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors active:scale-95 ${
                upvoted 
                  ? 'text-green-500' 
                  : 'text-secondary/40 hover:text-green-500'
              }`}
              title="Upvote"
            >
              <ThumbsUp size={18} className="md:hidden" fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <ThumbsUp size={16} className="hidden md:block" fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
            
            <button
              onClick={handleDownvote}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors active:scale-95 ${
                downvoted 
                  ? 'text-red-500' 
                  : 'text-secondary/40 hover:text-red-500'
              }`}
              title="Downvote"
            >
              <ThumbsDown size={18} className="md:hidden" fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <ThumbsDown size={16} className="hidden md:block" fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
            
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="flex items-center gap-1.5 px-2 py-2 md:py-1.5 text-secondary/40 hover:text-blue-500 transition-colors active:scale-95"
              title="Add feedback"
            >
              <MessageSquare size={18} className="md:hidden" strokeWidth={1.5} />
              <MessageSquare size={16} className="hidden md:block" strokeWidth={1.5} />
            </button>
            
            <button
              onClick={() => { setBookmarked(!bookmarked); onStar(); }}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors ml-auto active:scale-95 ${
                bookmarked 
                  ? 'text-primary' 
                  : 'text-secondary/40 hover:text-primary'
              }`}
              title="Bookmark"
            >
              <Bookmark size={18} className="md:hidden" fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <Bookmark size={16} className="hidden md:block" fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
          </div>
          
          {/* Feedback input - expandable */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 md:mt-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFeedbackSubmit()}
                    placeholder="Why isn't this relevant?"
                    className="flex-1 px-3 md:px-4 py-2.5 md:py-2 text-sm font-mono bg-transparent border border-border focus:border-primary focus:outline-none transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={!feedback.trim()}
                    className="px-6 py-2.5 md:py-2 text-[10px] font-mono uppercase tracking-widest bg-primary text-primary-foreground disabled:opacity-40 transition-opacity active:scale-98"
                  >
                    Send
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

type FilterType = 'all' | 'video' | 'blog' | 'paper' | 'discussion' | 'repo';

export default function FeedPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState<string>('');
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [interactions, setInteractions] = useState<Record<string, 'upvote' | 'downvote'>>({});
  const [feedDates, setFeedDates] = useState<string[]>([]);
  const [selectedFeedDate, setSelectedFeedDate] = useState<string>('');
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);

  const filteredFeed = activeFilter === 'all' 
    ? feed 
    : feed.filter(item => (item.type || item.source) === activeFilter);

  useEffect(() => {
    // Alpha mode check: if not in alpha mode, redirect to waitlist
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
    
    if (user) {
      getUserProfile(user.uid).then(p => {
        if (p && !p.onboarded) {
          router.push('/onboarding');
        }
      });
    }
  }, [user, loading, router]);

  const loadInteractions = useCallback(async (uid: string, feedGenDate: string) => {
    if (!feedGenDate) return;
    
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      // Load interactions for this specific feed (by its generation date)
      const response = await fetch(`/api/interactions?date=${feedGenDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const interactionsMap: Record<string, 'upvote' | 'downvote'> = {};
        
        if (Array.isArray(data.interactions)) {
          data.interactions.forEach((interaction: InteractionItem) => {
            if (
              interaction.item_id &&
              (interaction.action === 'upvote' || interaction.action === 'downvote')
            ) {
              interactionsMap[interaction.item_id] = interaction.action;
            }
          });
        }
        
        setInteractions(interactionsMap);
      }
    } catch (error) {
      console.error('Error loading interactions:', error);
    }
  }, [user]);

  const loadFeed = useCallback(async (uid: string, dateOverride?: string) => {
    setIsFeedLoading(true);
    const feedData = dateOverride
      ? await getUserFeedByDate(uid, dateOverride)
      : await getLatestUserFeed(uid);
    setFeed(Array.isArray(feedData?.items) ? (feedData?.items as FeedItem[]) : []);
    const resolvedDate = dateOverride || feedData?.date || '';
    setFeedDate(resolvedDate);
    setSelectedFeedDate(resolvedDate);
    setIsFeedLoading(false);
    if (resolvedDate) {
      await loadInteractions(uid, resolvedDate);
    }
  }, [loadInteractions]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadFeed(user.uid);
    }
  }, [user, loadFeed]);

  useEffect(() => {
    if (!user) return;
    getUserFeedDates(user.uid).then(dates => {
      setFeedDates(dates);
      if (!selectedFeedDate && dates.length) {
        setSelectedFeedDate(dates[0]);
      }
    });
  }, [user, selectedFeedDate]);

  const recordInteraction = async (itemId: string, action: 'upvote' | 'downvote' | 'remove', note?: string) => {
    if (!user || !feedDate) return;

    const item = feed.find(i => i.id === itemId);
    if (!item) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          action,
          item_metadata: {
            type: item.type || item.source,
            title: item.title,
            url: item.url,
            description: item.description,
            tags: Array.isArray(item.tags) && item.tags.length
              ? item.tags
              : (item.metadata?.why_relevant ? [item.metadata.why_relevant] : []),
          },
          feed_date: feedDate, // Use the feed's generation date, not today
          note,
        }),
      });

      if (!response.ok) {
        console.error('Failed to record interaction:', await response.text());
      }
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };

  const handleUpvote = (itemId: string, note?: string) => {
    console.log('Upvoted:', itemId);
    recordInteraction(itemId, 'upvote', note);
  };

  const handleDownvote = (itemId: string, note?: string) => {
    console.log('Downvoted:', itemId, note ? `with note: ${note}` : '');
    recordInteraction(itemId, 'downvote', note);
  };

  const handleStar = (itemId: string) => {
    console.log('Bookmarked:', itemId);
    // TODO: Implement bookmark functionality if needed
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
      <Header backHref="/" backLabel="Back" />

      <main className="w-full mt-6 md:mt-12">
        {/* Mobile: Feed date with dropdown for history */}
        <div className="md:hidden px-4 mb-4">
          <div className="flex items-center justify-between">
            {feedDate && (
              <span className="text-xs font-mono text-secondary/60">
                Feed: {feedDate}
              </span>
            )}
            {feedDates.length > 1 && (
              <button
                onClick={() => setShowMobileDatePicker(!showMobileDatePicker)}
                className="text-xs font-mono text-primary flex items-center gap-1"
              >
                History
                <svg 
                  className={`w-3 h-3 transition-transform ${showMobileDatePicker ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Mobile date picker dropdown */}
          <AnimatePresence>
            {showMobileDatePicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 py-3 overflow-x-auto scrollbar-hide">
                  {feedDates.map(date => {
                    const isActive = selectedFeedDate === date;
                    return (
                      <button
                        key={date}
                        onClick={() => {
                          user && loadFeed(user.uid, date);
                          setShowMobileDatePicker(false);
                        }}
                        className={`px-3 py-1.5 text-xs font-mono whitespace-nowrap transition-colors border ${
                          isActive 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'border-border text-secondary/70'
                        }`}
                      >
                        {date}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile filters - horizontal scroll */}
        <div className="md:hidden overflow-x-auto mb-4 px-4 scrollbar-hide">
          <div className="flex items-center gap-2 pb-2">
            {[
              { id: 'all', label: 'For you' },
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

        {/* Desktop: Feed date */}
        {feedDate && (
          <div className="hidden md:block max-w-6xl mx-auto mb-4 px-4 md:px-6 lg:px-8 text-xs font-mono text-secondary/60">
            Feed from: {feedDate}
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 md:flex md:gap-12">
          {/* Filters - left sidebar, sticky (desktop only) */}
          <aside className="hidden md:block w-48 shrink-0 sticky top-24 h-fit">
            <nav className="space-y-2">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-4 px-2">
                Filters
              </h2>
              {[
                { id: 'all', label: 'For you' },
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

          {/* Feed content */}
          <div className="flex-1 max-w-2xl mx-auto md:mx-0 w-full">
            {isFeedLoading ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-mono text-secondary">Loading your feed...</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/20">
                  <AnimatePresence>
                    {filteredFeed.map((item) => (
                      <FeedCard 
                        key={item.id} 
                        item={item} 
                        onUpvote={(note) => handleUpvote(item.id, note)}
                        onDownvote={(note) => handleDownvote(item.id, note)}
                        onStar={() => handleStar(item.id)}
                        initialVote={interactions[item.id]}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {filteredFeed.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 md:py-20 px-4"
                  >
                    <div className="w-12 h-12 bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles size={24} className="text-primary" />
                    </div>
                    <p className="text-lg font-serif mb-2">
                      {activeFilter === 'all' ? 'Your feed is empty' : `No ${activeFilter}s yet`}
                    </p>
                    <p className="text-sm font-mono text-secondary mb-4">
                      {activeFilter === 'all' 
                        ? "We're curating content for you. Check back soon!" 
                        : 'Try a different filter'}
                    </p>
                    {activeFilter !== 'all' && (
                      <button 
                        onClick={() => setActiveFilter('all')}
                        className="text-sm font-mono text-primary hover:underline uppercase tracking-wider"
                      >
                        View all content
                      </button>
                    )}
                  </motion.div>
                )}

                {/* End of feed indicator */}
                {filteredFeed.length > 0 && (
                  <div className="py-8 md:py-12 text-center border-t border-border/20">
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary/50">Youre all caught up</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Previous feeds - right sidebar (desktop only) */}
          <aside className="hidden md:block w-48 shrink-0 sticky top-24 h-fit">
            <nav className="space-y-2">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary mb-4 px-2">
                Previous Feeds
              </h2>
              {feedDates.length === 0 && (
                <div className="px-2 text-xs font-mono text-secondary/60">
                  No history yet
                </div>
              )}
              {feedDates.map(date => {
                const isActive = selectedFeedDate === date;
                return (
                  <button
                    key={date}
                    onClick={() => user && loadFeed(user.uid, date)}
                    className={`w-full text-left px-2 py-2 text-sm font-serif transition-colors border ${
                      isActive 
                        ? 'text-primary border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.35)]' 
                        : 'border-transparent text-secondary/70 hover:text-foreground hover:border-border'
                    }`}
                  >
                    {date}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      </main>
    </div>
  );
}
