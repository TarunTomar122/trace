"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  ArrowLeft,
  Users,
  UserCheck,
  Zap,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

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

// Custom Tooltip Component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const date = new Date(label);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-lg border border-black/10 dark:border-white/10">
      <p className="text-sm font-semibold mb-2">{formattedDate}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-secondary/70">{entry.name}:</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visitorStats, setVisitorStats] = useState<{
    dailyStats: { date: string; pageviews: number; visitors: number }[];
    totals: { pageviews: number; visitors: number };
  } | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Load preferences from localStorage
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('analytics_timeRange') as TimeRange) || 'week';
    }
    return 'week';
  });
  const [showSignups, setShowSignups] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('analytics_showSignups');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showOnboarded, setShowOnboarded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('analytics_showOnboarded');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showSubscribed, setShowSubscribed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('analytics_showSubscribed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showVisitors, setShowVisitors] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('analytics_showVisitors');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });
  const [chartType, setChartType] = useState<'line' | 'bar'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('analytics_chartType') as 'line' | 'bar') || 'line';
    }
    return 'line';
  });

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('analytics_timeRange', timeRange);
  }, [timeRange]);
  useEffect(() => {
    localStorage.setItem('analytics_showSignups', String(showSignups));
  }, [showSignups]);
  useEffect(() => {
    localStorage.setItem('analytics_showOnboarded', String(showOnboarded));
  }, [showOnboarded]);
  useEffect(() => {
    localStorage.setItem('analytics_showSubscribed', String(showSubscribed));
  }, [showSubscribed]);
  useEffect(() => {
    localStorage.setItem('analytics_showVisitors', String(showVisitors));
  }, [showVisitors]);
  useEffect(() => {
    localStorage.setItem('analytics_chartType', chartType);
  }, [chartType]);

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
        // Check cached Firebase analytics data
        const cachedUsers = localStorage.getItem('analytics_firebase_users');
        const cachedTime = localStorage.getItem('analytics_firebase_time');
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

        if (cachedUsers && cachedTime && parseInt(cachedTime) > sixHoursAgo) {
          // Use cached Firebase data
          setUsers(JSON.parse(cachedUsers));
          setLastFetched(new Date(parseInt(cachedTime)));
        } else {
          // Fetch fresh Firebase data
          const token = await user.getIdToken();
          await fetchFirebaseData(token);
        }

        // Check cached PostHog stats
        const cachedStats = localStorage.getItem('analytics_posthog_stats');
        const cachedPosthogTime = localStorage.getItem('analytics_posthog_time');

        if (cachedStats && cachedPosthogTime && parseInt(cachedPosthogTime) > sixHoursAgo) {
          setVisitorStats(JSON.parse(cachedStats));
        } else {
          const token = await user.getIdToken();
          await fetchVisitorStats(token);
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [user, isDev]);

  // Safe date parser - converts any date format to YYYY-MM-DD in UTC
  const parseDate = (val: any): string | null => {
    try {
      if (!val) return null;
      // Firestore timestamp with seconds
      if (val.seconds) return new Date(val.seconds * 1000).toISOString().split('T')[0];
      if (val._seconds) return new Date(val._seconds * 1000).toISOString().split('T')[0];
      // String date (ISO or RFC format like "Sat, 01 Mar 2026 05:30:00 GMT")
      if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
      // Numeric timestamp
      if (typeof val === 'number') {
        return new Date(val).toISOString().split('T')[0];
      }
      return null;
    } catch {
      return null;
    }
  };

  // Calculate daily stats from user data (only 2026 onwards)
  // Onboarded/subscribed are counted on the SIGNUP date (cohort view)
  const dailyStats = useMemo(() => {
    const stats: Record<string, DailyStats> = {};
    const cutoffYear = '2026'; // Only count this year's data

    users.forEach(u => {
      const createdDate = parseDate(u.createdAt);
      const isNewUser = createdDate && createdDate >= cutoffYear;

      if (isNewUser) {
        if (!stats[createdDate]) stats[createdDate] = { date: createdDate, signups: 0, onboarded: 0, subscribed: 0 };
        stats[createdDate].signups++;

        // Count onboarded/subscribed on their SIGNUP date (not onboarded date)
        // This shows: "of X signups on this day, Y have onboarded"
        if (u.onboarded) {
          stats[createdDate].onboarded++;
        }

        if (['trial', 'active'].includes(u.subscriptionStatus)) {
          stats[createdDate].subscribed++;
        }
      }
    });

    return Object.values(stats).sort((a, b) => a.date.localeCompare(b.date));
  }, [users]);

  // Filter stats by time range and fill in missing dates
  const filteredStats = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    let days: number;

    if (timeRange === 'week') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      days = 7;
    } else if (timeRange === 'month') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      days = 30;
    } else {
      // For "all", just return existing data without filling gaps
      return dailyStats;
    }

    // Create a map of existing stats
    const statsMap = new Map(dailyStats.map(s => [s.date, s]));

    // Fill in all dates in the range
    const filledStats: DailyStats[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const existing = statsMap.get(dateStr);
      filledStats.push(existing || { date: dateStr, signups: 0, onboarded: 0, subscribed: 0 });
    }

    return filledStats;
  }, [dailyStats, timeRange]);

  // Format chart data with readable dates and merge visitor stats
  const chartData = useMemo(() => {
    // Create a map of visitor stats by date
    const visitorMap = new Map<string, number>();
    visitorStats?.dailyStats?.forEach(v => {
      visitorMap.set(v.date, v.visitors);
    });

    return filteredStats.map(s => ({
      ...s,
      visitors: visitorMap.get(s.date) || 0,
      displayDate: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));
  }, [filteredStats, visitorStats]);

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

  // All time totals
  const allTimeTotals = useMemo(() => ({
    signups: users.length,
    onboarded: users.filter(u => u.onboarded).length,
    subscribed: users.filter(u => ['trial', 'active'].includes(u.subscriptionStatus)).length,
  }), [users]);

  // Search users by name
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [users, searchQuery]);

  const copyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  // Fetch Firebase user data (with caching)
  const fetchFirebaseData = async (token?: string) => {
    try {
      setIsFetchingData(true);
      const authToken = token || (user ? await user.getIdToken() : null);
      if (!authToken) return;

      const response = await fetch('/api/dev/analytics', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setLastFetched(new Date());
        // Cache the data
        localStorage.setItem('analytics_firebase_users', JSON.stringify(data.users || []));
        localStorage.setItem('analytics_firebase_time', String(Date.now()));
      }
    } catch (error) {
      console.error('Error fetching Firebase data:', error);
    } finally {
      setIsFetchingData(false);
    }
  };

  // Fetch PostHog visitor stats (with caching)
  const fetchVisitorStats = async (token?: string) => {
    try {
      const authToken = token || (user ? await user.getIdToken() : null);
      if (!authToken) return;

      const posthogResponse = await fetch('/api/dev/posthog-stats?days=30', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (posthogResponse.ok) {
        const posthogData = await posthogResponse.json();
        setVisitorStats(posthogData);
        // Cache the data
        localStorage.setItem('analytics_posthog_stats', JSON.stringify(posthogData));
        localStorage.setItem('analytics_posthog_time', String(Date.now()));
      }
    } catch (error) {
      console.error('Error fetching PostHog stats:', error);
    }
  };

  if (loading || !isDev) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/trace.png" alt="Trace" className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
              <p className="text-xs text-secondary/50">
                {lastFetched ? `Updated ${Math.round((Date.now() - lastFetched.getTime()) / 60000)}m ago` : 'Dev Dashboard'}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const token = user ? await user.getIdToken() : null;
              if (token) {
                fetchFirebaseData(token);
                fetchVisitorStats(token);
              }
            }}
            disabled={isFetchingData}
            className="text-sm text-secondary/60 hover:text-foreground transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetchingData ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/feed')}
            className="text-sm text-secondary/60 hover:text-foreground transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <RefreshCw size={24} className="text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-secondary/60">Loading analytics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* All-Time Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary/60 mb-1">Total Signups</p>
                    <p className="text-4xl font-bold tracking-tight">{allTimeTotals.signups}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users size={20} className="text-blue-500" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <span className="text-xs text-secondary/50">
                    +{totals.signups} in selected period
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary/60 mb-1">Onboarded</p>
                    <p className="text-4xl font-bold tracking-tight">{allTimeTotals.onboarded}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <UserCheck size={20} className="text-green-500" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <span className="text-xs text-secondary/50">
                    {allTimeTotals.signups > 0 ? Math.round((allTimeTotals.onboarded / allTimeTotals.signups) * 100) : 0}% conversion rate
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-secondary/60 mb-1">Subscribed</p>
                    <p className="text-4xl font-bold tracking-tight">{allTimeTotals.subscribed}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Zap size={20} className="text-amber-500" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <span className="text-xs text-secondary/50">
                    {allTimeTotals.onboarded > 0 ? Math.round((allTimeTotals.subscribed / allTimeTotals.onboarded) * 100) : 0}% of onboarded
                  </span>
                </div>
              </div>

              </div>

            {/* Conversion Funnel */}
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 dark:border-white/5">
                <h2 className="font-semibold">Conversion Funnel</h2>
                <p className="text-xs text-secondary/50 mt-0.5">Based on selected time range ({timeRange === 'week' ? '7 days' : timeRange === 'month' ? '30 days' : 'all time'})</p>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  {/* Visitors */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-purple-500">{chartData.reduce((sum, d) => sum + (d.visitors || 0), 0)}</p>
                    <p className="text-xs text-secondary/50 mt-1">Visitors</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-secondary/40">→</span>
                    <span className="text-xs font-semibold text-purple-500">
                      {(() => {
                        const visitors = chartData.reduce((sum, d) => sum + (d.visitors || 0), 0);
                        return visitors > 0 ? `${((totals.signups / visitors) * 100).toFixed(1)}%` : '—';
                      })()}
                    </span>
                  </div>

                  {/* Signups */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-blue-500">{totals.signups}</p>
                    <p className="text-xs text-secondary/50 mt-1">Signups</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-secondary/40">→</span>
                    <span className="text-xs font-semibold text-blue-500">
                      {totals.signups > 0 ? `${((totals.onboarded / totals.signups) * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>

                  {/* Onboarded */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-green-500">{totals.onboarded}</p>
                    <p className="text-xs text-secondary/50 mt-1">Onboarded</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-secondary/40">→</span>
                    <span className="text-xs font-semibold text-green-500">
                      {totals.onboarded > 0 ? `${((totals.subscribed / totals.onboarded) * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>

                  {/* Subscribed */}
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-amber-500">{totals.subscribed}</p>
                    <p className="text-xs text-secondary/50 mt-1">Subscribed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Growth Over Time</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-blue-500 font-medium">{totals.signups} signups</span>
                    <span className="text-xs text-green-500 font-medium">{totals.onboarded} onboarded</span>
                    <span className="text-xs text-amber-500 font-medium">{totals.subscribed} subscribed</span>
                    <span className="text-xs text-secondary/40">in selected period</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Chart type toggle */}
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        chartType === 'line'
                          ? 'bg-white dark:bg-white/10 text-foreground shadow-sm'
                          : 'text-secondary/60 hover:text-foreground'
                      }`}
                    >
                      Line
                    </button>
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        chartType === 'bar'
                          ? 'bg-white dark:bg-white/10 text-foreground shadow-sm'
                          : 'text-secondary/60 hover:text-foreground'
                      }`}
                    >
                      Bar
                    </button>
                  </div>
                  {/* Time range toggle */}
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg p-1">
                    {(['week', 'month', 'all'] as TimeRange[]).map(range => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          timeRange === range
                            ? 'bg-white dark:bg-white/10 text-foreground shadow-sm'
                            : 'text-secondary/60 hover:text-foreground'
                        }`}
                      >
                        {range === 'week' ? '7D' : range === 'month' ? '30D' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Toggle buttons */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setShowSignups(!showSignups)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      showSignups
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-black/5 dark:bg-white/5 text-secondary/50'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${showSignups ? 'bg-blue-500' : 'bg-secondary/30'}`} />
                    Signups
                  </button>
                  <button
                    onClick={() => setShowOnboarded(!showOnboarded)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      showOnboarded
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-black/5 dark:bg-white/5 text-secondary/50'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${showOnboarded ? 'bg-green-500' : 'bg-secondary/30'}`} />
                    Onboarded
                  </button>
                  <button
                    onClick={() => setShowSubscribed(!showSubscribed)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      showSubscribed
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-black/5 dark:bg-white/5 text-secondary/50'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${showSubscribed ? 'bg-amber-500' : 'bg-secondary/30'}`} />
                    Subscribed
                  </button>
                  <button
                    onClick={() => setShowVisitors(!showVisitors)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      showVisitors
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : 'bg-black/5 dark:bg-white/5 text-secondary/50'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${showVisitors ? 'bg-purple-500' : 'bg-secondary/30'}`} />
                    Visitors
                  </button>
                </div>

                {chartData.length === 0 ? (
                  <div className="text-center text-secondary/50 py-12">No data for this period</div>
                ) : chartType === 'line' ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis
                        dataKey="displayDate"
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {showSignups && (
                        <Line
                          type="linear"
                          dataKey="signups"
                          name="Signups"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: '#3b82f6' }}
                        />
                      )}
                      {showOnboarded && (
                        <Line
                          type="linear"
                          dataKey="onboarded"
                          name="Onboarded"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ fill: '#22c55e', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: '#22c55e' }}
                        />
                      )}
                      {showSubscribed && (
                        <Line
                          type="linear"
                          dataKey="subscribed"
                          name="Subscribed"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: '#f59e0b' }}
                        />
                      )}
                      {showVisitors && (
                        <Line
                          type="linear"
                          dataKey="visitors"
                          name="Visitors"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: '#a855f7' }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis
                        dataKey="displayDate"
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {showSignups && <Bar dataKey="signups" name="Signups" fill="#3b82f6" radius={[4, 4, 0, 0]} />}
                      {showOnboarded && <Bar dataKey="onboarded" name="Onboarded" fill="#22c55e" radius={[4, 4, 0, 0]} />}
                      {showSubscribed && <Bar dataKey="subscribed" name="Subscribed" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
                      {showVisitors && <Bar dataKey="visitors" name="Visitors" fill="#a855f7" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 dark:border-white/5">
                <h2 className="font-semibold">Recent Activity</h2>
                <p className="text-xs text-secondary/50 mt-0.5">Daily breakdown for the last 7 days</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/5">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-secondary/60">Date</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-blue-500">Signups</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-green-500">Onboarded</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-amber-500">Subscribed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStats.slice(-7).reverse().map((day, idx) => {
                      const date = new Date(day.date);
                      const isToday = day.date === new Date().toISOString().split('T')[0];
                      const isYesterday = day.date === new Date(Date.now() - 86400000).toISOString().split('T')[0];
                      return (
                        <tr key={day.date} className={`border-b border-black/5 dark:border-white/5 last:border-0 ${isToday ? 'bg-blue-500/5' : ''}`}>
                          <td className="px-6 py-3 text-sm">
                            <span className="font-medium">
                              {isToday ? 'Today' : isYesterday ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`text-sm font-semibold ${day.signups > 0 ? 'text-blue-500' : 'text-secondary/30'}`}>
                              {day.signups}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`text-sm font-semibold ${day.onboarded > 0 ? 'text-green-500' : 'text-secondary/30'}`}>
                              {day.onboarded}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`text-sm font-semibold ${day.subscribed > 0 ? 'text-amber-500' : 'text-secondary/30'}`}>
                              {day.subscribed}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Search */}
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 dark:border-white/5">
                <h2 className="font-semibold">Find User</h2>
                <p className="text-xs text-secondary/50 mt-0.5">Search by name or email to get user ID</p>
              </div>

              <div className="p-6">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary/30" />
                  <input
                    type="text"
                    placeholder="Type a name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-black/[0.02] dark:bg-white/5 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-secondary/30"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map(u => (
                      <div
                        key={u.uid}
                        className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-semibold">
                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.name}</p>
                            <p className="text-xs text-secondary/50">{u.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => copyUid(u.uid)}
                          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                            copiedUid === u.uid
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-secondary/70'
                          }`}
                        >
                          {copiedUid === u.uid ? (
                            <>
                              <Check size={14} />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              Copy ID
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && (
                  <div className="mt-6 text-center">
                    <p className="text-sm text-secondary/50">No users found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
