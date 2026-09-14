"use client";

import Image from 'next/image';
import Link from 'next/link';
import { User, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  showBackToFeed?: boolean;
  backHref?: string;
  backLabel?: string;
}

export default function Header({
  showBackToFeed = false,
  backHref,
  backLabel = "Back",
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="bg-background border-b border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {backHref ? (
            <Link
              href={backHref}
              className="flex items-center gap-2 text-sm text-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </Link>
          ) : showBackToFeed ? (
            <a
              href="/feed"
              className="flex items-center gap-2 text-sm text-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Feed</span>
            </a>
          ) : (
            <a href="/feed" className="flex items-center gap-2">
              <Image src="/trace.webp" alt="Trace" width={24} height={24} className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-[0.12em] text-foreground">TRACE</span>
            </a>
          )}

          <div className="flex items-center gap-3">
            {user && (
              <Link href="/feed?tab=profile" className="p-1">
                {user.photoURL ? (
                    <Image src={user.photoURL} alt="Profile" width={32} height={32} className="w-8 h-8 rounded-full" unoptimized />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center">
                    <User size={16} className="text-secondary/40" />
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
