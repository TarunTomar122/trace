"use client";

import Link from 'next/link';
import { RefreshCw, User, LogOut, ArrowLeft, Bookmark } from 'lucide-react';
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

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
    }
  };

  return (
    <header className="border-b border-border/40 sticky top-0 bg-background/95 backdrop-blur-md z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-6xl">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Left side */}
          <div className="flex items-center gap-2 flex-1">
            {backHref ? (
              <Link 
                href={backHref} 
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : showBackToFeed ? (
              <Link 
                href="/feed" 
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Back to Feed</span>
              </Link>
            ) : showRefresh && onRefresh ? (
              <button
                onClick={onRefresh}
                className="p-2 rounded-full hover:bg-foreground/5 transition-colors text-secondary"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            ) : null}
          </div>

          {/* Center - Logo */}
          <Link 
            href="/" 
            className="text-lg md:text-xl text-foreground uppercase flex items-center gap-3 md:gap-4 tracking-[0.15em] font-serif font-black absolute left-1/2 -translate-x-1/2"
          >
            <img 
              src="/trace.png" 
              alt="Trace" 
              className="h-6 md:h-7 w-auto"
            />
            TRACE
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end">
            {showBackToFeed ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-foreground transition-colors"
              >
                <span className="hidden sm:inline">Sign Out</span>
                <LogOut size={14} />
              </button>
            ) : (
              <>
                {showBookmarks && user && (
                  <Link 
                    href="/bookmarks" 
                    className="p-2 rounded-full hover:bg-foreground/5 transition-colors text-secondary hover:text-foreground"
                    title="Bookmarks"
                  >
                    <Bookmark size={18} strokeWidth={1.5} />
                  </Link>
                )}
                <Link href="/profile" className="p-1 rounded-full hover:bg-foreground/5 transition-colors">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={16} className="text-primary" />
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

