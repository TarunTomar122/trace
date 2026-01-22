"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type SubQuery = {
  id?: string;
  text?: string;
  user_count?: number;
  last_searched?: string | null;
};

type Umbrella = {
  id: string;
  display_name: string;
  user_count: number;
  sub_queries: SubQuery[];
  sub_query_count: number;
  last_discovery_refresh?: string | null;
};

export default function DevUmbrellasPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [umbrellas, setUmbrellas] = useState<Umbrella[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [cached, setCached] = useState<boolean | null>(null);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    const isDevMode =
      process.env.NODE_ENV === 'development' ||
      window.location.search.includes('dev=true');
    setIsDev(isDevMode);
    if (!isDevMode) {
      router.push('/feed');
    }
  }, [router]);

  const loadUmbrellas = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/dev/umbrellas?limit=200&includeSubqueries=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUmbrellas(data.umbrellas || []);
        setCached(Boolean(data.cached));
      }
    } catch (error) {
      console.error('Error loading umbrellas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !isDev) return;
    loadUmbrellas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDev]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return umbrellas;
    return umbrellas.filter(u => {
      if (u.id.toLowerCase().includes(term)) return true;
      if (u.display_name.toLowerCase().includes(term)) return true;
      return u.sub_queries.some(sq => (sq.text || '').toLowerCase().includes(term));
    });
  }, [umbrellas, query]);

  if (loading || !isDev) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1">
              DEV MODE
            </span>
            <h1 className="text-lg font-serif">Umbrellas</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dev/feeds')}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors"
            >
              Feed Viewer
            </button>
            <button
              onClick={() => router.push('/dev/analytics')}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors"
            >
              Analytics
            </button>
            <button
              onClick={loadUmbrellas}
              className="text-xs font-mono text-secondary hover:text-foreground transition-colors flex items-center gap-2"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search umbrellas or subqueries..."
              className="w-full bg-transparent border border-border pl-8 pr-3 py-2 text-sm font-mono outline-none focus:border-primary"
            />
          </div>
          <span className="text-xs font-mono text-secondary">
            {filtered.length} / {umbrellas.length}
            {cached !== null && (cached ? ' (cached)' : '')}
          </span>
        </div>

        {isLoading ? (
          <div className="text-sm font-mono text-secondary">Loading umbrellas...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <div key={u.id} className="border border-border">
                <button
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-primary/5 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                >
                  <div>
                    <div className="font-serif text-sm">{u.display_name}</div>
                    <div className="text-[10px] font-mono text-secondary mt-1">
                      {u.id} · users {u.user_count} · subqueries {u.sub_query_count}
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-secondary transition-transform ${
                      expanded[u.id] ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expanded[u.id] && (
                  <div className="border-t border-border px-4 py-3 bg-background/50">
                    {u.sub_queries.length === 0 ? (
                      <div className="text-xs font-mono text-secondary">No subqueries</div>
                    ) : (
                      <ul className="space-y-2">
                        {u.sub_queries.map(sq => (
                          <li key={sq.id} className="text-sm font-mono text-secondary">
                            <span className="text-foreground">{sq.text}</span>
                            <span className="text-xs ml-2">
                              ({sq.id}) · users {sq.user_count || 0}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

