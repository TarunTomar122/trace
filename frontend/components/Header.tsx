"use client";

import Link from 'next/link';
import { User, LogOut, ArrowLeft, Bookmark } from 'lucide-react';
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
    <header className="sticky top-0 bg-white/95 dark:bg-[#101014]/95 backdrop-blur-md z-50">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center justify-between h-16">
          {/* Left - Logo or Back */}
          {backHref ? (
            <Link
              href={backHref}
              className="flex items-center gap-2 -ml-2 px-2 py-1.5 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </Link>
          ) : showBackToFeed ? (
            <Link
              href="/feed"
              className="flex items-center gap-2 -ml-2 px-2 py-1.5 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <ArrowLeft size={16} />
              <span>Feed</span>
            </Link>
          ) : (
            <Link href="/feed" className="flex items-center gap-2.5">
              <img src="/trace.webp" alt="Trace" width={120} height={32} className="h-8 w-auto" />
              <span className="text-lg font-semibold tracking-[0.12em] text-foreground">TRACE</span>
            </Link>
          )}

          {/* Right */}
          <div className="flex items-center gap-1">
            {showBackToFeed ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                Sign Out
                <LogOut size={15} />
              </button>
            ) : (
              <>
                {showBookmarks && user && (
                  <Link
                    href="/bookmarks"
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                    title="Bookmarks"
                  >
                    <Bookmark size={18} strokeWidth={1.5} />
                  </Link>
                )}
                <Link href="/profile" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" width={32} height={32} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <User size={16} className="text-secondary" />
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
