import Link from 'next/link';
import { X } from 'lucide-react';
import { TraceInsights } from '@/lib/traceInsights';

type TraceInsightCardProps = {
  insights: TraceInsights;
  variant?: 'full' | 'compact';
  onDismiss?: () => void;
  showCta?: boolean;
};

export default function TraceInsightCard({
  insights,
  variant = 'full',
  onDismiss,
  showCta = false,
}: TraceInsightCardProps) {
  const isCompact = variant === 'compact';

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div>
            <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-secondary/70 mt-1`}>
              {insights.summary}
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-secondary/60 hover:text-foreground transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Dismiss Trace insight"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showCta && (
        <div className="mt-4">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
          >
            Tune your preferences
          </Link>
        </div>
      )}
    </div>
  );
}
