"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MessageCircle,
  X,
  Brain,
  RefreshCw,
  Zap,
  ChevronDown,
  Eye,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFeedDates } from '@/lib/firestore';
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
  _seen?: boolean;
  _originalIndex?: number;
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

function FeedCard({ item, onUpvote, onDownvote, onStar, initialVote, disabled, onDisabledClick, onVisible, initialBookmarked }: { 
  item: FeedItem; 
  onUpvote: (note?: string) => void;
  onDownvote: (note?: string) => void;
  onStar: () => void;
  initialVote?: 'upvote' | 'downvote';
  disabled?: boolean;
  onDisabledClick?: () => void;
  onVisible?: (itemId: string) => void;
  initialBookmarked?: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const hasBeenSeen = useRef(false);
  const itemKind = item.type || item.source || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const [upvoted, setUpvoted] = useState(initialVote === 'upvote');
  const [downvoted, setDownvoted] = useState(initialVote === 'downvote');
  const [bookmarked, setBookmarked] = useState(initialBookmarked || false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const relevance = item.metadata?.why_relevant;
  
  // Check if description is long enough to need expansion (roughly > 2 lines worth)
  const descriptionNeedsExpand = item.description && item.description.length > 50;

  // Intersection Observer to track when item becomes visible
  useEffect(() => {
    if (!onVisible || hasBeenSeen.current || item._seen) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenSeen.current) {
            hasBeenSeen.current = true;
            onVisible(item.id);
          }
        });
      },
      { threshold: 0.5 } // Item is 50% visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [item.id, item._seen, onVisible]);

  useEffect(() => {
    setUpvoted(initialVote === 'upvote');
    setDownvoted(initialVote === 'downvote');
  }, [initialVote]);

  useEffect(() => {
    setBookmarked(initialBookmarked || false);
  }, [initialBookmarked]);

  const handleUpvote = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    const newUpvoted = !upvoted;
    setUpvoted(newUpvoted);
    if (newUpvoted) {
      setDownvoted(false);
      onUpvote();
    }
  };

  const handleDownvote = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
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
      ref={cardRef}
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
          
          {/* Description - subtle, with expand option */}
          {item.description && (
            <div className="mb-3 md:mb-4">
              <p className={`text-sm text-secondary/70 leading-relaxed font-mono ${!descriptionExpanded ? 'line-clamp-2' : ''}`}>
                {item.description}
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
          
          {/* Actions row - compact */}
          <div className="flex items-center gap-1 md:gap-2 -ml-1">
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors active:scale-95 ${
                disabled 
                  ? 'text-secondary/20 cursor-not-allowed'
                  : upvoted 
                    ? 'text-green-500' 
                    : 'text-secondary/40 hover:text-green-500'
              }`}
              title={disabled ? "Subscribe to interact" : "Upvote"}
            >
              <ThumbsUp size={18} className="md:hidden" fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <ThumbsUp size={16} className="hidden md:block" fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
            
            <button
              onClick={handleDownvote}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors active:scale-95 ${
                disabled
                  ? 'text-secondary/20 cursor-not-allowed'
                  : downvoted 
                    ? 'text-red-500' 
                    : 'text-secondary/40 hover:text-red-500'
              }`}
              title={disabled ? "Subscribe to interact" : "Downvote"}
            >
              <ThumbsDown size={18} className="md:hidden" fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <ThumbsDown size={16} className="hidden md:block" fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
            
            <button
              onClick={() => {
                if (disabled) {
                  onDisabledClick?.();
                  return;
                }
                setShowFeedback(!showFeedback);
              }}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors active:scale-95 ${
                disabled 
                  ? 'text-secondary/20 cursor-not-allowed'
                  : 'text-secondary/40 hover:text-blue-500'
              }`}
              title={disabled ? "Subscribe to interact" : "Add feedback"}
            >
              <MessageSquare size={18} className="md:hidden" strokeWidth={1.5} />
              <MessageSquare size={16} className="hidden md:block" strokeWidth={1.5} />
            </button>
            
            <button
              onClick={() => {
                if (disabled) {
                  onDisabledClick?.();
                  return;
                }
                setBookmarked(!bookmarked);
                onStar();
              }}
              className={`flex items-center gap-1.5 px-2 py-2 md:py-1.5 transition-colors ml-auto active:scale-95 ${
                disabled
                  ? 'text-secondary/20 cursor-not-allowed'
                  : bookmarked 
                    ? 'text-primary' 
                    : 'text-secondary/40 hover:text-primary'
              }`}
              title={disabled ? "Subscribe to interact" : "Bookmark"}
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
                    placeholder="Notes for Trace?"
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
  const { user, loading, profile } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState<string>('');
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [interactions, setInteractions] = useState<Record<string, 'upvote' | 'downvote'>>({});
  const [feedDates, setFeedDates] = useState<string[]>([]);
  const [selectedFeedDate, setSelectedFeedDate] = useState<string>('');
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [generalFeed, setGeneralFeed] = useState<FeedItem[]>([]);
  const [isLoadingGeneral, setIsLoadingGeneral] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [feedMetadata, setFeedMetadata] = useState<any>(null);
  const cursorRef = useRef(0);
  const isLoadingRef = useRef(false);
  const hasLoadedInitialFeed = useRef(false);
  
  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('general');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  
  // Seen items tracking - batch updates
  const seenItemsBuffer = useRef<Set<string>>(new Set());
  const seenFlushTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Check if user has seen the hint before
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('feed-hint-dismissed');
    if (!hasSeenHint) {
      setShowHint(true);
    }
  }, []);
  
  // DEV MODE: Toggle to see full pool instead of personalized feed
  const [devShowPool, setDevShowPool] = useState(false);
  const [poolItems, setPoolItems] = useState<FeedItem[]>([]);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [showDevToggle, setShowDevToggle] = useState(false);
  
  // Check if dev mode should be shown (dev env or ?dev=true query param)
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const hasDevParam = window.location.search.includes('dev=true');
    setShowDevToggle(isDev || hasDevParam);
  }, []);

  // Use pool items if dev mode is on, personalized feed for onboarded users (subscribed or not), otherwise general feed
  const isOnboarded = profile?.onboarded ?? false;
  const showPersonalizedFeed = isOnboarded; // Show feed for ALL onboarded users
  const currentFeed = devShowPool ? poolItems : (!showPersonalizedFeed ? generalFeed : feed);
  const filteredFeed = activeFilter === 'all' 
    ? currentFeed 
    : currentFeed.filter(item => (item.type || item.source) === activeFilter);

  // Check subscription access
  useEffect(() => {
    if (profile) {
      const subscriptionStatus = profile.subscriptionStatus || 'none';
      
      // Check if they have active/trial status
      let hasValidAccess = ['trial', 'active'].includes(subscriptionStatus);
      
      // If cancelled but still active, check if cancellation date has passed
      if (hasValidAccess && profile.cancelledAt) {
        const now = new Date();
        
        // Helper to convert Firestore Timestamp to Date
        const toDate = (ts: Date | { seconds: number } | null | undefined): Date | null => {
          if (!ts) return null;
          if (ts instanceof Date) return ts;
          if (typeof ts === 'object' && 'seconds' in ts) {
            return new Date(ts.seconds * 1000);
          }
          return null;
        };
        
        const willCancelAt = toDate(profile.willCancelAt);
        const nextBilling = toDate(profile.nextBillingDate);
        
        // Use willCancelAt if available, otherwise nextBillingDate
        const cancelDate = willCancelAt || nextBilling;
        
        // If cancellation date has passed, revoke access
        if (cancelDate && now >= cancelDate) {
          hasValidAccess = false;
        }
      }
      
      setHasAccess(hasValidAccess);
    }
  }, [profile]);

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

  // Flush seen items to server (batched)
  const flushSeenItems = useCallback(async () => {
    if (!user || !feedDate || seenItemsBuffer.current.size === 0) return;
    
    const itemIds = Array.from(seenItemsBuffer.current);
    seenItemsBuffer.current.clear();
    
    try {
      const token = await user.getIdToken();
      await fetch('/api/feed/seen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: feedDate,
          item_ids: itemIds,
        }),
      });
      
      // Update unseen count locally
      setUnseenCount(prev => Math.max(0, prev - itemIds.length));
    } catch (error) {
      console.error('Error marking items as seen:', error);
      // Re-add failed items back to buffer
      itemIds.forEach(id => seenItemsBuffer.current.add(id));
    }
  }, [user, feedDate]);

  // Handle item becoming visible
  const handleItemVisible = useCallback((itemId: string) => {
    seenItemsBuffer.current.add(itemId);
    
    // Update local feed state to mark as seen
    setFeed(prev => prev.map(item => 
      item.id === itemId ? { ...item, _seen: true } : item
    ));
    
    // Debounce flush - wait 2 seconds after last seen item
    if (seenFlushTimeout.current) {
      clearTimeout(seenFlushTimeout.current);
    }
    seenFlushTimeout.current = setTimeout(flushSeenItems, 2000);
  }, [flushSeenItems]);

  // Flush on unmount
  useEffect(() => {
    const timeoutRef = seenFlushTimeout.current;
    const bufferRef = seenItemsBuffer.current;
    
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      // Sync flush on unmount - copy buffer size to avoid ref access in cleanup
      if (bufferRef.size > 0) {
        flushSeenItems();
      }
    };
  }, [flushSeenItems]);

  // Load paginated feed
  const loadFeed = useCallback(async (uid: string, dateOverride?: string, reset = true) => {
    // Prevent concurrent loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    if (reset) {
      setIsFeedLoading(true);
      setFeed([]);
      cursorRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const token = await user?.getIdToken();
      if (!token) {
        isLoadingRef.current = false;
        return;
      }
      
      const params = new URLSearchParams();
      if (dateOverride) params.set('date', dateOverride);
      params.set('cursor', reset ? '0' : String(cursorRef.current));
      params.set('limit', '10');
      
      const response = await fetch(`/api/feed/paginated?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (reset) {
          setFeed(data.items || []);
          setFeedMetadata(data.metadata || null);  // Store feed metadata
        } else {
          setFeed(prev => [...prev, ...(data.items || [])]);
        }
        
        cursorRef.current = data.cursor || 0;
        setHasMore(data.hasMore || false);
        setFeedDate(data.feedDate || '');
        setSelectedFeedDate(data.feedDate || '');
        setTotalItems(data.total || 0);
        setUnseenCount(data.unseenCount || 0);
        
        if (data.feedDate) {
          await loadInteractions(uid, data.feedDate);
        }
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setIsFeedLoading(false);
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [user, loadInteractions]);

  // Load more items
  const loadMore = useCallback(() => {
    if (!user || !hasMore || isLoadingMore) return;
    loadFeed(user.uid, feedDate, false);
  }, [user, hasMore, isLoadingMore, loadFeed, feedDate]);

  // DEV: Load full pool items
  const loadPoolItems = useCallback(async () => {
    if (!user) return;
    setIsLoadingPool(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/feed/pool', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPoolItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (error) {
      console.error('Error loading pool:', error);
    }
    setIsLoadingPool(false);
  }, [user]);

  // Load general feed for unsubscribed users
  // If onboarded: personalized feed from pool (up to 40 items based on interests)
  // If not onboarded: sample feed (diverse mix, 10 items)
  const loadGeneralFeed = useCallback(async () => {
    if (!user) return;
    setIsLoadingGeneral(true);
    try {
      const token = await user.getIdToken();
      const isOnboarded = profile?.onboarded ?? false;
      const mode = isOnboarded ? 'personalized' : 'sample';
      const limit = isOnboarded ? 40 : 10;
      
      const response = await fetch(`/api/feed/pool?mode=${mode}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGeneralFeed(Array.isArray(data.items) ? data.items : []);
      }
    } catch (error) {
      console.error('Error loading general feed:', error);
    }
    setIsLoadingGeneral(false);
  }, [user, profile?.onboarded]);

  // Load bookmarks on mount
  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/bookmarks', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const bookmarkIds = new Set<string>(data.bookmarks.map((b: { item_id: string }) => b.item_id));
        setBookmarkedItems(bookmarkIds);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBookmarks();
    }
  }, [user, loadBookmarks]);

  // Load pool when dev mode is toggled on
  useEffect(() => {
    if (devShowPool && poolItems.length === 0) {
      loadPoolItems();
    }
  }, [devShowPool, poolItems.length, loadPoolItems]);

  useEffect(() => {
    // Load feed for ALL onboarded users (subscribed and unsubscribed)
    // Feed content differs based on subscription (handled by backend)
    if (user && profile?.onboarded && !hasLoadedInitialFeed.current) {
      hasLoadedInitialFeed.current = true;
      loadFeed(user.uid);
    }
  }, [user, profile?.onboarded, loadFeed]);

  // Fallback: Load general pool feed for non-onboarded users only
  useEffect(() => {
    const isNotOnboarded = profile && !profile.onboarded;
    if (user && isNotOnboarded && generalFeed.length === 0 && feed.length === 0) {
      loadGeneralFeed();
    }
  }, [user, profile, generalFeed.length, feed.length, loadGeneralFeed]);

  useEffect(() => {
    // Load feed dates for ALL onboarded users (subscribed and unsubscribed)
    if (!user || !profile?.onboarded) return;
    getUserFeedDates(user.uid).then(dates => {
      setFeedDates(dates);
      if (!selectedFeedDate && dates.length) {
        setSelectedFeedDate(dates[0]);
      }
    });
  }, [user, profile?.onboarded, selectedFeedDate]);

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

  // Submit feedback
  const handleSubmitFeedback = async () => {
    if (!user || !feedbackMessage.trim()) return;
    
    setIsSubmittingFeedback(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: feedbackMessage.trim(),
          type: feedbackType,
        }),
      });

      if (response.ok) {
        setFeedbackSubmitted(true);
        setFeedbackMessage('');
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleStar = async (itemId: string) => {
    if (!user) return;

    const item = feed.find(i => i.id === itemId) || generalFeed.find(i => i.id === itemId);
    if (!item) return;

    const isCurrentlyBookmarked = bookmarkedItems.has(itemId);

    try {
      const token = await user.getIdToken();

      if (isCurrentlyBookmarked) {
        // Remove bookmark
        await fetch(`/api/bookmarks?item_id=${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        setBookmarkedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      } else {
        // Add bookmark
        await fetch('/api/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            item_id: itemId,
            item_metadata: {
              type: item.type || item.source,
              title: item.title,
              description: item.description,
              url: item.url,
              thumbnail: item.thumbnail,
              tags: item.tags || [],
              why_relevant: item.metadata?.why_relevant,
            },
          }),
        });
        setBookmarkedItems(prev => new Set(prev).add(itemId));
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
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
      <Header backHref="/" backLabel="Back" />

      {/* Callout banner - show ONE based on state */}
      {profile && !profile.onboarded ? (
        // Non-onboarded users: Show onboarding callout
        <div className="sticky top-14 md:top-16 z-40 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-violet-500/10 border-b border-violet-500/20 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Brain size={16} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-serif text-foreground">
                    <span className="font-bold">Complete your profile</span> — tell us what you&apos;re into
                  </p>
                  <p className="text-xs font-mono text-secondary/70 mt-0.5">
                    Finish onboarding to get your personalized feed
                  </p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-violet-700 transition-colors shrink-0"
              >
                <Sparkles size={12} />
                Complete Setup
              </Link>
            </div>
          </div>
        </div>
      ) : !hasAccess && profile ? (
        // Onboarded but not subscribed: Show subscribe callout
        <div className="sticky top-14 md:top-16 z-40 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-500/20 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Brain size={16} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-serif text-foreground">
                    <span className="font-bold">Preview mode</span> — here&apos;s what Trace found for you
                  </p>
                  <p className="text-xs font-mono text-secondary/70 mt-0.5">
                    Subscribe to interact with content & help Trace learn better from your feedback
                  </p>
                </div>
              </div>
              <Link
                href="/profile?tab=subscription"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-widest hover:bg-primary/90 transition-colors shrink-0"
              >
                <Zap size={12} />
                Subscribe Now
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subscribe prompt modal */}
      <AnimatePresence>
        {showSubscribePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
            onClick={() => setShowSubscribePrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-border p-6 md:p-8 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                  <Brain size={20} className="text-primary" />
                </div>
                <h3 className="text-lg font-serif">Subscribe to Unlock</h3>
              </div>
              <p className="text-sm font-mono text-secondary mb-6">
                Subscribe to interact with content and help Trace learn from your feedback. Your upvotes, downvotes, and comments help us personalize your daily feed better.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubscribePrompt(false)}
                  className="flex-1 px-4 py-3 border border-border text-[10px] font-mono uppercase tracking-widest hover:border-primary/50 transition-colors"
                >
                  Maybe Later
                </button>
                <Link
                  href="/profile?tab=subscription"
                  className="flex-1 px-4 py-3 bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-widest text-center hover:bg-primary/90 transition-colors"
                >
                  Subscribe
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full mt-6 md:mt-12">
        {/* DEV MODE TOGGLE - visible in development or with ?dev=true */}
        {/* {showDevToggle && (
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 mb-4">
            <button
              onClick={() => setDevShowPool(!devShowPool)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono border transition-colors ${
                devShowPool
                  ? 'bg-amber-500/20 border-amber-500 text-amber-500'
                  : 'border-border text-secondary/60 hover:border-primary hover:text-primary'
              }`}
            >
              {devShowPool ? (
                <>
                  <Database size={14} />
                  DEV: Showing Full Pool ({poolItems.length} items)
                </>
              ) : (
                <>
                  <User size={14} />
                  DEV: Showing Your Feed ({feed.length} items)
                </>
              )}
            </button>
            {devShowPool && isLoadingPool && (
              <span className="ml-2 text-xs text-secondary/60">Loading pool...</span>
            )}
          </div>
        )} */}

        {/* Mobile: Feed date with dropdown for history (only for subscribed AND onboarded users) */}
        {showPersonalizedFeed && (
          <div className="md:hidden px-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {feedDate && (
                  <span className="text-xs font-mono text-secondary/60">
                    Feed: {feedDate}
                  </span>
                )}
                {unseenCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-mono text-primary">
                    <Eye size={10} />
                    {unseenCount} new
                  </span>
                )}
              </div>
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
                            if (user) {
                              loadFeed(user.uid, date);
                            }
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
        )}

        {/* Mobile Feedback Callout - Below date picker */}
        {isOnboarded && !showFeedback && (
          <div className="md:hidden px-4 mb-4">
            <div className="p-4 bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-start gap-2 mb-3">
                <MessageSquare size={16} className="text-blue-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="flex-1">
                  <p className="text-xs font-mono text-foreground font-bold mb-1">
                    💬 Got feedback?
                  </p>
                  <p className="text-[10px] font-mono text-secondary/80 leading-relaxed">
                    Help us improve Trace! Share bugs, feature requests, or feedback.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFeedback(true)}
                className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-mono uppercase tracking-widest transition-colors"
              >
                Send Feedback
              </button>
            </div>
          </div>
        )}

        {/* Mobile Feedback Form */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden px-4 mb-4 overflow-hidden"
            >
              <div className="p-4 bg-background border border-border">
                {feedbackSubmitted ? (
                  <div className="flex items-center gap-3 text-green-500">
                    <Check size={18} />
                    <p className="text-sm font-mono">Thanks! Your feedback has been submitted.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-mono font-bold text-foreground">Send Feedback</h3>
                      <button
                        onClick={() => setShowFeedback(false)}
                        className="text-secondary/60 hover:text-foreground transition-colors"
                        aria-label="Close feedback"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-mono text-secondary/80 mb-2">Type</label>
                      <div className="flex gap-2">
                        {(['bug', 'feature', 'general'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setFeedbackType(type)}
                            className={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
                              feedbackType === type
                                ? 'bg-primary text-white border-primary'
                                : 'bg-transparent text-secondary border-border hover:border-primary'
                            }`}
                          >
                            {type === 'bug' && '🐛 Bug'}
                            {type === 'feature' && '✨ Feature'}
                            {type === 'general' && '💬 General'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-mono text-secondary/80 mb-2">Message</label>
                      <textarea
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Tell us what's on your mind..."
                        className="w-full px-3 py-2 bg-background border border-border text-sm font-mono text-foreground placeholder:text-secondary/40 focus:outline-none focus:border-primary resize-none"
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowFeedback(false)}
                        className="flex-1 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-secondary border border-border hover:border-primary transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitFeedback}
                        disabled={!feedbackMessage.trim() || isSubmittingFeedback}
                        className="flex-1 px-4 py-2 text-[10px] font-mono uppercase tracking-widest bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingFeedback ? 'Sending...' : 'Submit'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile filters - horizontal scroll */}
        <div className="md:hidden overflow-x-auto mb-4 px-4 scrollbar-hide">
          <div className="flex items-center gap-2 pb-2">
            {[
              { id: 'all', label: showPersonalizedFeed ? 'For you' : 'Discover' },
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
                { id: 'all', label: showPersonalizedFeed ? 'For you' : 'Discover' },
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
            {/* Desktop: Feed stats (only for subscribed users) */}
            {/* {hasAccess && feedDate && (
              <div className="hidden md:flex items-center gap-3 text-xs font-mono text-secondary/60 mb-6">
                <span>Feed from: {feedDate}</span>
                {unseenCount > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <Eye size={12} />
                    {unseenCount} new
                  </span>
                )}
                <span className="text-secondary/40">·</span>
                <span>{totalItems} items total</span>
              </div>
            )} */}

            {/* Hint about feedback (only for subscribed AND onboarded users) */}
            <AnimatePresence>
              {showPersonalizedFeed && showHint && !isFeedLoading && filteredFeed.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 md:mb-6 p-4 bg-blue-500/5 border border-blue-500/20 flex items-start gap-3"
                >
                  <MessageSquare size={18} className="text-blue-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-sm font-mono text-foreground mb-1">
                      <span className="font-bold">💡 Pro tip:</span> Vote on content and add feedback to help us personalize your feed better!
                    </p>
                    <p className="text-xs font-mono text-secondary">
                      Your feedback helps us understand what you like and refine tomorrow&apos;s recommendations.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowHint(false);
                      localStorage.setItem('feed-hint-dismissed', 'true');
                    }}
                    className="text-secondary/60 hover:text-foreground transition-colors shrink-0"
                    aria-label="Dismiss hint"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preview Mode Banner - Show upgrade message for unsubscribed users */}
            {feedMetadata?.is_preview && !isFeedLoading && filteredFeed.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 md:mb-6 p-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 flex items-start gap-3"
              >
                <Sparkles size={18} className="text-violet-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="flex-1">
                  <p className="text-sm font-mono text-foreground mb-1">
                    <span className="font-bold text-violet-400">✨ Preview Mode</span>
                  </p>
                  <p className="text-xs font-mono text-secondary">
                    You&apos;re seeing a limited preview feed. Subscribe to unlock personalized AI-powered recommendations, smart signals, and more curated content just for you!
                  </p>
                </div>
                <Link
                  href="/profile"
                  className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-[10px] font-mono uppercase tracking-widest transition-colors shrink-0"
                >
                  Subscribe
                </Link>
              </motion.div>
            )}

            {((showPersonalizedFeed && isFeedLoading) || (devShowPool && isLoadingPool) || (!showPersonalizedFeed && isLoadingGeneral)) ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-mono text-secondary">
                  {devShowPool ? 'Loading pool items...' : (!showPersonalizedFeed ? 'Loading general feed...' : 'Loading your feed...')}
                </p>
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
                        initialBookmarked={bookmarkedItems.has(item.id)}
                        disabled={!hasAccess}
                        onDisabledClick={() => setShowSubscribePrompt(true)}
                        onVisible={showPersonalizedFeed ? handleItemVisible : undefined}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Load More Button */}
                {showPersonalizedFeed && hasMore && filteredFeed.length > 0 && (
                  <div className="py-6 text-center">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-border text-[10px] font-mono uppercase tracking-widest hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {isLoadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          Load More ({totalItems - feed.length} remaining)
                        </>
                      )}
                    </button>
                  </div>
                )}

                {filteredFeed.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 md:py-20 px-4"
                  >
                    {profile?.onboardedAt && activeFilter === 'all' && (() => {
                      const onboardedTimestamp = profile.onboardedAt as { seconds: number } | Date;
                      const onboardedTime = typeof onboardedTimestamp === 'object' && 'seconds' in onboardedTimestamp
                        ? new Date(onboardedTimestamp.seconds * 1000)
                        : new Date(onboardedTimestamp);
                      const now = new Date();
                      const timeSinceOnboarding = now.getTime() - onboardedTime.getTime();
                      const isNewUser = timeSinceOnboarding < 30 * 60 * 1000; // Within 30 minutes
                      
                      if (isNewUser) {
                        return (
                          <>
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 relative">
                              <Brain size={32} className="md:hidden" />
                              <Brain size={40} className="hidden md:block" />
                              <motion.div
                                className="absolute inset-0 border-2 border-primary"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            </div>
                            <p className="text-xl md:text-2xl font-serif mb-3">
                              AI is curating your feed
                            </p>
                            <p className="text-sm font-mono text-secondary mb-6 max-w-md mx-auto leading-relaxed">
                              Our AI agents are analyzing your profile and gathering personalized content from across the web. This usually takes 5-10 minutes.
                            </p>
                            <div className="space-y-3 max-w-sm mx-auto mb-6">
                              {['Analyzing your interests', 'Searching content sources', 'Ranking & filtering'].map((step, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.2 }}
                                  className="flex items-center gap-3 text-sm font-mono text-secondary"
                                >
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                  >
                                    <RefreshCw size={14} className="text-primary" />
                                  </motion.div>
                                  {step}
                                </motion.div>
                              ))}
                            </div>
                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 max-w-md mx-auto">
                              <p className="text-xs font-mono text-secondary leading-relaxed">
                                💡 <span className="text-foreground font-bold">Pro tip:</span> While you wait, you can update your profile or explore your interests to help us curate even better content for you.
                              </p>
                            </div>
                          </>
                        );
                      }
                    })()}
                    
                    {(!profile?.onboardedAt || 
                      (profile?.onboardedAt && (() => {
                        const ts = profile.onboardedAt as { seconds: number } | Date;
                        const time = typeof ts === 'object' && 'seconds' in ts ? new Date(ts.seconds * 1000) : new Date(ts);
                        return new Date().getTime() - time.getTime() >= 30 * 60 * 1000;
                      })()) ||
                      activeFilter !== 'all') && (
                      <>
                        <div className="w-12 h-12 bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                          <Sparkles size={24} className="text-primary" />
                        </div>
                        <p className="text-lg font-serif mb-2">
                          {activeFilter === 'all' ? 'Your Feed is Being Generated!!! Check back soon!' : `No ${activeFilter}s yet`}
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
                      </>
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
            {showPersonalizedFeed ? (
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
            ) : null}

            {/* Feedback Callout - Below previous feeds */}
            {isOnboarded && !showFeedback && (
              <div className="mt-6">
                <div className="p-4 bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1">
                      <p className="text-xs font-mono text-foreground font-bold mb-1 flex items-center gap-2">
                         <MessageSquare size={12} className="text-blue-500 mt-0.5 shrink-0" strokeWidth={1.5} />Feedback/Complaint?
                      </p>
                      <p className="text-[10px] font-mono text-secondary/80 leading-relaxed">
                        Help us improve Trace! Share bugs, feature requests, or general feedback.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFeedback(true)}
                    className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-mono uppercase tracking-widest transition-colors"
                  >
                    Send Feedback
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Form */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="p-4 bg-background border border-border">
                    {feedbackSubmitted ? (
                      <div className="flex items-center gap-3 text-green-500">
                        <Check size={18} />
                        <p className="text-xs font-mono">Thanks! Your feedback has been submitted.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-mono font-bold text-foreground">Send Feedback</h3>
                          <button
                            onClick={() => setShowFeedback(false)}
                            className="text-secondary/60 hover:text-foreground transition-colors"
                            aria-label="Close feedback"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="mb-3">
                          <label className="block text-[10px] font-mono text-secondary/80 mb-2">Type</label>
                          <div className="flex gap-2">
                            {(['bug', 'feature', 'general'] as const).map((type) => (
                              <button
                                key={type}
                                onClick={() => setFeedbackType(type)}
                                className={`flex-1 px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors ${
                                  feedbackType === type
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-transparent text-secondary border-border hover:border-primary'
                                }`}
                              >
                                {type === 'bug' && '🐛'}
                                {type === 'feature' && '✨'}
                                {type === 'general' && '💬'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="block text-[10px] font-mono text-secondary/80 mb-2">Message</label>
                          <textarea
                            value={feedbackMessage}
                            onChange={(e) => setFeedbackMessage(e.target.value)}
                            placeholder="Tell us what's on your mind..."
                            className="w-full px-3 py-2 bg-background border border-border text-xs font-mono text-foreground placeholder:text-secondary/40 focus:outline-none focus:border-primary resize-none"
                            rows={4}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowFeedback(false)}
                            className="flex-1 px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-secondary border border-border hover:border-primary transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSubmitFeedback}
                            disabled={!feedbackMessage.trim() || isSubmittingFeedback}
                            className="flex-1 px-3 py-2 text-[9px] font-mono uppercase tracking-widest bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmittingFeedback ? 'Sending...' : 'Submit'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showPersonalizedFeed && (
              <div className="border border-border p-4">
                <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-3">
                  <Sparkles size={18} className="text-primary" />
                </div>
                <h3 className="text-sm font-serif mb-2">Unlock Your Feed</h3>
                <p className="text-xs font-mono text-secondary/70 mb-4">
                  Get personalized content curated daily for your interests.
                </p>
                <Link
                  href="/profile?tab=subscription"
                  className="block w-full px-3 py-2 bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-widest text-center hover:bg-primary/90 transition-colors"
                >
                  Subscribe
                </Link>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
