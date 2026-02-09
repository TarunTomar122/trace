"use client";

import Link from 'next/link';
import { RefreshCw, User, LogOut, ArrowLeft, Bookmark, Sun, Moon, Lightbulb } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onRefresh?: () => void;
  showRefresh?: boolean;
  showBackToFeed?: boolean;
  backHref?: string;
  backLabel?: string;
  onSignOut?: () => void;
  showBookmarks?: boolean;
}

export default function Header({
  onRefresh,
  showRefresh = false,
  showBackToFeed = false,
  backHref,
  backLabel = "Back",
  onSignOut,
  showBookmarks = true,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
    }
  };

  return (
    <header className="border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/95 dark:bg-[#101014]/95 backdrop-blur-md z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-6xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-14 md:h-16">
          {/* Left side */}
          <div className="flex items-center gap-2 min-w-0">
            {backHref ? (
              <Link 
                href={backHref} 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : showBackToFeed ? (
              <Link 
                href="/feed" 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Back to Feed</span>
              </Link>
            ) : showRefresh && onRefresh ? (
              <button
                onClick={onRefresh}
                className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            ) : null}
          </div>

          {/* Center - Logo */}
          <Link 
            href="/" 
            className="justify-self-center text-lg md:text-xl text-foreground uppercase flex items-center gap-2 tracking-[0.1em] font-semibold"
          >
            <Lightbulb size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={1.5} />
            TRACE
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-1 md:gap-2 justify-end min-w-0">
            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 md:p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={16} className="md:w-[18px] md:h-[18px]" /> : <Moon size={16} className="md:w-[18px] md:h-[18px]" />}
              </button>
            )}

            {showBackToFeed ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <span className="hidden sm:inline">Sign Out</span>
                <LogOut size={16} />
              </button>
            ) : (
              <>
                {showBookmarks && user && (
                  <Link 
                    href="/bookmarks" 
                    className="p-1.5 md:p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                    title="Bookmarks"
                  >
                    <Bookmark size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={1.5} />
                  </Link>
                )}
                <Link href="/profile" className="p-1 md:p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-7 h-7 md:w-8 md:h-8 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={14} className="md:w-4 md:h-4 text-primary" />
                    </div>
                  )}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
