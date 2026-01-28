"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Youtube, 
  Github, 
  BookOpen, 
  MessageCircle, 
  Sparkles,
  ArrowUpRight,
  Users,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type FeedItem = {
  id: string;
  type?: string;
  source?: string;
  title: string;
  description?: string;
  url: string;
  metadata?: {
    why_relevant?: string;
  };
};

type UserProfile = {
  uid: string;
  name: string;
  displayName: string;
  email: string;
  interests: string[];
  subscriptionStatus: string;
};

const sourceConfig: Record<string, { icon: typeof Youtube; color: string; label: string }> = {
  video: { icon: Youtube, color: 'text-red-500', label: 'Video' },
  repo: { icon: Github, color: 'text-violet-500', label: 'Repo' },
  paper: { icon: BookOpen, color: 'text-blue-500', label: 'Paper' },
  blog: { icon: BookOpen, color: 'text-emerald-500', label: 'Article' },
  discussion: { icon: MessageCircle, color: 'text-amber-500', label: 'Discussion' },
  tweet: { icon: MessageCircle, color: 'text-sky-500', label: 'Thread' },
  launch: { icon: Sparkles, color: 'text-fuchsia-500', label: 'Launch' },
  model: { icon: Sparkles, color: 'text-indigo-500', label: 'Model' },
};

export default function DevFeedsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isDev, setIsDev] = useState(false);

  // Check if dev mode
  useEffect(() => {
    const isDevMode = process.env.NODE_ENV === 'development' || 
                      window.location.search.includes('dev=true');
    setIsDev(isDevMode);
    
    if (!isDevMode) {
      router.push('/feed');
    }
  }, [router]);

  // Load users
  useEffect(() => {
    if (!user || !isDev) return;
    
    const loadUsers = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/dev/users', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    loadUsers();
  }, [user, isDev]);

  // Load feed for selected user
  const loadUserFeed = async (userId: string) => {
    if (!user || !userId) return;
    
    setIsLoadingFeed(true);
    setSelectedUserId(userId);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/dev/feed?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setFeed(data.items || []);
        setFeedDate(data.date || '');
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  if (loading || !isDev) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedUser = users.find(u => u.uid === selectedUserId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1">
              DEV MODE
            </span>
            <h1 className="text-lg font-serif">Feed Viewer</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dev/analytics')}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors"
            >
              Analytics
            </button>
            <button
              onClick={() => router.push('/feed')}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-[300px_1fr] gap-8">
          {/* User List */}
          <aside className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-primary" />
              <h2 className="text-sm font-mono uppercase tracking-wider">Subscribed Users</h2>
            </div>
            
            {isLoadingUsers ? (
              <div className="text-sm font-mono text-secondary">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-sm font-mono text-secondary">No subscribed users found</div>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => loadUserFeed(u.uid)}
                    className={`w-full text-left p-3 border transition-colors ${
                      selectedUserId === u.uid
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-serif text-sm">{u.name || u.displayName}</div>
                    <div className="text-[10px] font-mono text-secondary mt-1">
                      {u.subscriptionStatus} · {u.interests?.length || 0} interests
                    </div>
                    <div className="text-[10px] font-mono text-secondary/60 mt-1 truncate">
                      {u.interests?.slice(0, 3).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* Feed Content */}
          <div className="min-h-[60vh]">
            {!selectedUserId ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <Users size={48} className="text-secondary/30 mb-4" />
                <p className="text-lg font-serif text-secondary">Select a user to view their feed</p>
              </div>
            ) : isLoadingFeed ? (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <RefreshCw size={24} className="text-primary animate-spin mb-4" />
                <p className="text-sm font-mono text-secondary">Loading feed...</p>
              </div>
            ) : (
              <>
                {/* Feed Header */}
                <div className="mb-6 pb-4 border-b border-border">
                  <h3 className="text-xl font-serif">{selectedUser?.name || selectedUser?.displayName}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs font-mono text-secondary">
                      Feed date: {feedDate || 'N/A'}
                    </span>
                    <span className="text-xs font-mono text-secondary">
                      {feed.length} items
                    </span>
                  </div>
                  {selectedUser?.interests && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedUser.interests.map(interest => (
                        <span 
                          key={interest}
                          className="text-[10px] font-mono px-2 py-1 bg-primary/10 text-primary"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feed Items */}
                {feed.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm font-mono text-secondary">No feed items for this user</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {feed.map((item, index) => {
                      const itemKind = item.type || item.source || 'blog';
                      const config = sourceConfig[itemKind] || sourceConfig.blog;
                      const Icon = config.icon;
                      
                      return (
                        <motion.article
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="py-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${config.color} bg-current/5 border border-current/10`}>
                              <Icon size={14} className={config.color} strokeWidth={1.5} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-mono uppercase tracking-widest ${config.color}`}>
                                  {config.label}
                                </span>
                              </div>
                              
                              <a 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="group block mb-1"
                              >
                                <h4 className="text-sm font-serif leading-snug text-foreground group-hover:text-primary transition-colors">
                                  {item.title}
                                  <ArrowUpRight size={12} className="inline ml-1 opacity-0 group-hover:opacity-60" />
                                </h4>
                              </a>
                              
                              {item.description && (
                                <p className="text-xs text-secondary/60 font-mono line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                              
                              {item.metadata?.why_relevant && (
                                <p className="text-[10px] text-primary/70 font-mono mt-1">
                                  {item.metadata.why_relevant}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

