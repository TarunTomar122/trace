"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  UserCheck, 
  CreditCard,
  FileText,
  MousePointerClick,
  TrendingUp,
  Calendar,
  Clock,
  BarChart3,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type UserData = {
  uid: string;
  name: string;
  email: string;
  onboarded: boolean;
  subscriptionStatus: string;
  willCancelAt?: any;
  subscriptionId?: string | null;
  trialEndDate?: any;
  feedItemCount: number;
  latestFeedDate: string | null;
  interactionCount: number;
  totalInteractionCount: number;
  lastInteractionDate: string | null;
  createdAt: any;
  onboardedAt: any;
  interests: string[];
};

type AnalyticsSummary = {
  totalUsers: number;
  onboardedUsers: number;
  subscribedUsers: number;
  trialUsers: number;
  paidSubscribers: number;
  giftedSubscriptions: number;
  onboardedWithNoFeed: number;
  subscribedWithNoFeed: number;
  subscribedWithInteractions: number;
  scheduledCancellations: number;
  avgFeedItems: string;
  avgTodayInteractions: string;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'onboarded' | 'no-feed'>('all');

  // Check if dev mode
  useEffect(() => {
    const isDevMode = process.env.NODE_ENV === 'development' || 
                      window.location.search.includes('dev=true');
    console.log('[Analytics] Dev mode check:', { 
      NODE_ENV: process.env.NODE_ENV, 
      search: window.location.search,
      isDevMode 
    });
    setIsDev(isDevMode);
    
    if (!isDevMode) {
      console.log('[Analytics] Not dev mode, redirecting to feed');
      router.push('/feed');
    }
  }, [router]);

  // Load analytics data
  useEffect(() => {
    console.log('[Analytics] useEffect triggered', { isDev, user: !!user, loading });
    
    if (!isDev || !user) {
      // Stop loading if not in dev mode or no user
      console.log('[Analytics] Stopping - isDev:', isDev, 'user:', !!user);
      setIsLoading(false);
      return;
    }
    
    const loadAnalytics = async () => {
      console.log('[Analytics] Starting loadAnalytics...');
      try {
        const token = await user.getIdToken();
        console.log('[Analytics] Got token, fetching...');
        const response = await fetch('/api/dev/analytics', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        console.log('[Analytics] Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Analytics] Data received:', { 
            summaryExists: !!data.summary, 
            usersCount: data.users?.length || 0 
          });
          setSummary(data.summary);
          setUsers(data.users || []);
        } else {
          const errorText = await response.text();
          console.error('[Analytics] API error:', response.status, errorText);
        }
      } catch (error) {
        console.error('[Analytics] Error loading analytics:', error);
      } finally {
        setIsLoading(false);
        console.log('[Analytics] Loading complete');
      }
    };
    
    loadAnalytics();
  }, [user, isDev, loading]);

  if (loading || !isDev) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter users based on selected filter
  const filteredUsers = users.filter(u => {
    if (filter === 'subscribed') return ['trial', 'active'].includes(u.subscriptionStatus);
    if (filter === 'onboarded') return u.onboarded;
    if (filter === 'no-feed') return u.onboarded && u.feedItemCount === 0;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10';
      case 'trial': return 'text-blue-500 bg-blue-500/10';
      case 'cancelled': return 'text-amber-500 bg-amber-500/10';
      case 'expired': return 'text-red-500 bg-red-500/10';
      default: return 'text-secondary/60 bg-secondary/10';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1">
              DEV MODE
            </span>
            <h1 className="text-lg font-serif">Analytics Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dev/feeds')}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors flex items-center gap-2"
            >
              <FileText size={14} />
              Feed Viewer
            </button>
            <button
              onClick={() => router.push('/feed')}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={14} />
              Back to Feed
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <RefreshCw size={24} className="text-primary animate-spin mb-4" />
            <p className="text-sm font-mono text-secondary">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-border p-5 bg-background hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Users size={20} className="text-primary" />
                    <span className="text-2xl font-serif">{summary.totalUsers}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">Total Users</h3>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="border border-border p-5 bg-background hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <UserCheck size={20} className="text-blue-500" />
                    <span className="text-2xl font-serif">{summary.onboardedUsers}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">Onboarded</h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    {summary.onboardedWithNoFeed} with no feed
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="border border-border p-5 bg-background hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <CreditCard size={20} className="text-green-500" />
                    <span className="text-2xl font-serif">{summary.subscribedUsers}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">Subscribed (Total)</h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    Trial + Paid + Gifted
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="border border-border p-5 bg-blue-50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Clock size={20} className="text-blue-600" />
                    <span className="text-2xl font-serif">{summary.trialUsers}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">
                    Trial Users
                  </h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    In active trial period
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                  className="border border-border p-5 bg-green-50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <CreditCard size={20} className="text-green-600" />
                    <span className="text-2xl font-serif">{summary.paidSubscribers}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">
                    Paid Subscribers
                  </h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    Active + has sub ID + not cancelled
                  </p>
                </motion.div>

                {/* <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 }}
                  className="border border-border p-5 bg-emerald-50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <CheckCircle size={20} className="text-emerald-600" />
                    <span className="text-2xl font-serif">{summary.giftedSubscriptions}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">
                    Gifted Subs
                  </h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    Active + (no sub ID OR trial expired)
                  </p>
                </motion.div> */}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="border border-border p-5 bg-background hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Calendar size={20} className="text-amber-500" />
                    <span className="text-2xl font-serif">{summary.scheduledCancellations}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">
                    Scheduled Cancellations
                  </h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    Active/trial with willCancelAt
                  </p>
                </motion.div>

                {/* <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="border border-border p-5 bg-background hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Activity size={20} className="text-purple-500" />
                    <span className="text-2xl font-serif">{summary.subscribedWithInteractions}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">Active Today</h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">
                    Avg {summary.avgTodayInteractions} interactions
                  </p>
                </motion.div> */}

                {/* Additional metrics */}
                {/* <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                  className="border border-border p-5 bg-primary/5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <FileText size={20} className="text-primary" />
                    <span className="text-2xl font-serif">{summary.avgFeedItems}</span>
                  </div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-secondary">Avg Feed Items</h3>
                  <p className="text-[10px] font-mono text-secondary/60 mt-1">Per subscribed user</p>
                </motion.div> */}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <BarChart3 size={16} className="text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-secondary mr-4">Filter:</span>
              {['all', 'subscribed', 'onboarded', 'no-feed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`text-xs font-mono px-3 py-1.5 transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
                </button>
              ))}
              <span className="text-xs font-mono text-secondary/60 ml-auto">
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>

            {/* User Table */}
            <div className="border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary/5 border-b border-border">
                    <tr>
                      <th className="text-left text-[10px] font-mono uppercase tracking-wider text-secondary p-3">User</th>
                      <th className="text-left text-[10px] font-mono uppercase tracking-wider text-secondary p-3">Status</th>
                      <th className="text-center text-[10px] font-mono uppercase tracking-wider text-secondary p-3">Onboarded</th>
                      <th className="text-center text-[10px] font-mono uppercase tracking-wider text-secondary p-3">Feed Items</th>
                      <th className="text-center text-[10px] font-mono uppercase tracking-wider text-secondary p-3">Latest Feed</th>
                      <th className="text-center text-[10px] font-mono uppercase tracking-wider text-secondary p-3">Today / Total</th>
                      <th className="text-center text-[10px] font-mono uppercase tracking-wider text-secondary p-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filteredUsers.map((u, idx) => (
                      <motion.tr
                        key={u.uid}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-secondary/5 transition-colors"
                      >
                        <td className="p-3">
                          <div className="font-serif text-sm">{u.name}</div>
                          <div className="text-[10px] font-mono text-secondary/60 mt-0.5">{u.email}</div>
                          <div className="text-[10px] font-mono text-secondary/40">{u.uid}</div>
                          {u.interests.length > 0 && (
                            <div className="text-[9px] font-mono text-secondary/40 mt-1 truncate max-w-xs">
                              {u.interests.slice(0, 3).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-mono uppercase px-2 py-1 ${getStatusColor(u.subscriptionStatus)}`}>
                            {u.subscriptionStatus}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {u.onboarded ? (
                            <CheckCircle size={16} className="text-green-500 inline" />
                          ) : (
                            <XCircle size={16} className="text-secondary/30 inline" />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-sm font-mono ${u.feedItemCount === 0 ? 'text-red-500' : 'text-foreground'}`}>
                            {u.feedItemCount}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-[10px] font-mono text-secondary">
                            {u.latestFeedDate || '-'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`text-sm font-mono ${u.interactionCount > 0 ? 'text-green-500' : 'text-secondary/30'}`}>
                              {u.interactionCount}
                            </span>
                            <span className="text-[10px] font-mono text-secondary/40">/</span>
                            <span className={`text-sm font-mono ${u.totalInteractionCount > 0 ? 'text-foreground' : 'text-secondary/30'}`}>
                              {u.totalInteractionCount}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-[10px] font-mono text-secondary">
                            {u.lastInteractionDate || '-'}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm font-mono text-secondary">No users match the selected filter</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

