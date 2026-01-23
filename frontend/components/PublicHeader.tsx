import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PublicHeaderProps {
  backHref?: string;
  backLabel?: string;
  showHome?: boolean;
}

export default function PublicHeader({
  backHref,
  backLabel = "Back",
  showHome = true,
}: PublicHeaderProps) {
  return (
    <header className="border-b border-border/40 sticky top-0 bg-background/95 backdrop-blur-md z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-6xl">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Left side */}
          <div className="flex items-center gap-2 flex-1">
            {backHref && (
              <Link 
                href={backHref} 
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}
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
            {showHome && (
              <Link 
                href="/" 
                className="text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-foreground transition-colors px-4 py-2 border border-border hover:border-primary"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

