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
    <header className="sticky top-0 bg-background/95 backdrop-blur-md z-50 border-b border-border/10">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center justify-between h-14">
          {backHref ? (
            <Link
              href={backHref}
              className="flex items-center gap-1.5 -ml-2 px-2 py-1.5 rounded-lg text-sm font-medium text-secondary/60 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </Link>
          ) : showBackToFeed ? (
            <Link
              href="/feed"
              className="flex items-center gap-1.5 -ml-2 px-2 py-1.5 rounded-lg text-sm font-medium text-secondary/60 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Feed</span>
            </Link>
          ) : (
            <Link href="/feed" className="flex items-center gap-2.5">
              <img src="/trace.webp" alt="Trace" width={120} height={32} className="h-7 w-auto" />
              <span className="text-base font-semibold tracking-[0.12em] text-foreground">TRACE</span>
            </Link>
          )}

          <div className="flex items-center gap-1">
            {showBackToFeed ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-secondary/50 hover:text-foreground transition-colors"
              >
                Sign Out
                <LogOut size={15} />
              </button>
            ) : (
              <>
                {showBookmarks && user && (
                  <Link
                    href="/bookmarks"
                    className="p-2 rounded-lg text-secondary/40 hover:text-foreground transition-colors"
                    title="Bookmarks"
                  >
                    <Bookmark size={18} strokeWidth={1.5} />
                  </Link>
                )}
                <Link href="/profile" className="p-1 rounded-lg transition-colors">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" width={32} height={32} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center">
                      <User size={16} className="text-secondary/40" />
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
