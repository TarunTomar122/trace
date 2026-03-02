"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  ArrowLeft,
  Users,
  UserCheck,
  CreditCard,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type UserData = {
  uid: string;
  name: string;
  email: string;
  onboarded: boolean;
  subscriptionStatus: string;
  createdAt: any;
  onboardedAt: any;
};

type DailyStats = {
  date: string;
  signups: number;
  onboarded: number;
  subscribed: number;
};

type TimeRange = 'week' | 'month' | 'all';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    const isDevMode = process.env.NODE_ENV === 'development' ||
                      window.location.search.includes('dev=true');
    setIsDev(isDevMode);
    if (!isDevMode) router.push('/feed');
  }, [router]);

  useEffect(() => {
    if (!isDev || !user) {
      setIsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/dev/analytics', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [user, isDev]);

  // Calculate daily stats from user data
  const dailyStats = useMemo(() => {
    const stats: Record<string, DailyStats> = {};

    users.forEach(u => {
      // Parse createdAt for signups
      const createdDate = u.createdAt?.seconds
        ? new Date(u.createdAt.seconds * 1000).toISOString().split('T')[0]
        : u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : null;

      if (createdDate) {
        if (!stats[createdDate]) stats[createdDate] = { date: createdDate, signups: 0, onboarded: 0, subscribed: 0 };
        stats[createdDate].signups++;
      }

      // Parse onboardedAt
      const onboardedDate = u.onboardedAt?.seconds
        ? new Date(u.onboardedAt.seconds * 1000).toISOString().split('T')[0]
        : u.onboardedAt ? new Date(u.onboardedAt).toISOString().split('T')[0] : null;

      if (onboardedDate && u.onboarded) {
        if (!stats[onboardedDate]) stats[onboardedDate] = { date: onboardedDate, signups: 0, onboarded: 0, subscribed: 0 };
        stats[onboardedDate].onboarded++;
      }

      // For subscribed, use onboardedAt as proxy (when they likely subscribed)
      if (onboardedDate && ['trial', 'active'].includes(u.subscriptionStatus)) {
        if (!stats[onboardedDate]) stats[onboardedDate] = { date: onboardedDate, signups: 0, onboarded: 0, subscribed: 0 };
        stats[onboardedDate].subscribed++;
      }
    });

    return Object.values(stats).sort((a, b) => a.date.localeCompare(b.date));
  }, [users]);

  // Filter stats by time range
  const filteredStats = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    if (timeRange === 'week') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'month') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      cutoff = new Date(0);
    }

    return dailyStats.filter(s => new Date(s.date) >= cutoff);
  }, [dailyStats, timeRange]);

  // Calculate totals for the selected period
  const totals = useMemo(() => {
    return filteredStats.reduce(
      (acc, s) => ({
        signups: acc.signups + s.signups,
        onboarded: acc.onboarded + s.onboarded,
        subscribed: acc.subscribed + s.subscribed,
      }),
      { signups: 0, onboarded: 0, subscribed: 0 }
    );
  }, [filteredStats]);

  // Search users by name
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [users, searchQuery]);

  const copyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  // Get max value for chart scaling
  const maxValue = Math.max(
    ...filteredStats.map(s => Math.max(s.signups, s.onboarded, s.subscribed)),
    1
  );

  if (loading || !isDev) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1">
              DEV
            </span>
            <h1 className="text-lg font-semibold">Analytics</h1>
          </div>
          <button
            onClick={() => router.push('/feed')}
            className="text-xs text-secondary hover:text-foreground transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <RefreshCw size={24} className="text-primary animate-spin mb-4" />
            <p className="text-sm text-secondary">Loading...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              {(['week', 'month', 'all'] as TimeRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-foreground text-background'
                      : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                  }`}
                >
                  {range === 'week' ? 'Last 7 Days' : range === 'month' ? 'Last 30 Days' : 'All Time'}
                </button>
              ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-border rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Users size={20} className="text-blue-500" />
                  <span className="text-3xl font-bold">{totals.signups}</span>
                </div>
                <p className="text-sm text-secondary">Signups</p>
              </div>
              <div className="border border-border rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <UserCheck size={20} className="text-green-500" />
                  <span className="text-3xl font-bold">{totals.onboarded}</span>
                </div>
                <p className="text-sm text-secondary">Onboarded</p>
              </div>
              <div className="border border-border rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <CreditCard size={20} className="text-amber-500" />
                  <span className="text-3xl font-bold">{totals.subscribed}</span>
                </div>
                <p className="text-sm text-secondary">Subscribed</p>
              </div>
            </div>

            {/* Chart */}
            <div className="border border-border rounded-xl p-6">
              <h2 className="text-sm font-medium text-secondary mb-6">Daily Activity</h2>

              {filteredStats.length === 0 ? (
                <p className="text-center text-secondary py-8">No data for this period</p>
              ) : (
                <div className="space-y-4">
                  {/* Legend */}
                  <div className="flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span>Signups</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500" />
                      <span>Onboarded</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-amber-500" />
                      <span>Subscribed</span>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="flex items-end gap-1 h-48 pt-4">
                    {filteredStats.map((stat) => (
                      <div key={stat.date} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full flex items-end justify-center gap-0.5 h-40">
                          <div
                            className="w-2 bg-blue-500 rounded-t transition-all group-hover:opacity-80"
                            style={{ height: `${(stat.signups / maxValue) * 100}%`, minHeight: stat.signups > 0 ? '4px' : '0' }}
                            title={`Signups: ${stat.signups}`}
                          />
                          <div
                            className="w-2 bg-green-500 rounded-t transition-all group-hover:opacity-80"
                            style={{ height: `${(stat.onboarded / maxValue) * 100}%`, minHeight: stat.onboarded > 0 ? '4px' : '0' }}
                            title={`Onboarded: ${stat.onboarded}`}
                          />
                          <div
                            className="w-2 bg-amber-500 rounded-t transition-all group-hover:opacity-80"
                            style={{ height: `${(stat.subscribed / maxValue) * 100}%`, minHeight: stat.subscribed > 0 ? '4px' : '0' }}
                            title={`Subscribed: ${stat.subscribed}`}
                          />
                        </div>
                        <span className="text-[9px] text-secondary/60 -rotate-45 origin-top-left whitespace-nowrap">
                          {new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Search */}
            <div className="border border-border rounded-xl p-6">
              <h2 className="text-sm font-medium text-secondary mb-4">Find User ID</h2>

              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary/5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 divide-y divide-border/50">
                  {searchResults.map(u => (
                    <div key={u.uid} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-secondary">{u.email}</p>
                      </div>
                      <button
                        onClick={() => copyUid(u.uid)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs bg-secondary/10 hover:bg-secondary/20 rounded-lg transition-colors"
                      >
                        {copiedUid === u.uid ? (
                          <>
                            <Check size={12} className="text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy UID
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <p className="mt-4 text-sm text-secondary text-center">No users found</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
