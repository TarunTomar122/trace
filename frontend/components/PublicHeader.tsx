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
    <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-6xl">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Left side */}
          <div className="flex items-center gap-2 flex-1">
            {backHref && (
              <Link 
                href={backHref} 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}
          </div>

          {/* Center - Logo */}
          <Link 
            href="/" 
            className="text-lg md:text-xl text-foreground uppercase flex items-center gap-3 md:gap-4 tracking-[0.1em] font-semibold absolute left-1/2 -translate-x-1/2"
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
                className="px-4 py-2 rounded-full text-sm font-medium text-secondary border border-gray-200 hover:border-foreground hover:text-foreground transition-all"
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

