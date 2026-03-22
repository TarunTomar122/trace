import { clsx } from 'clsx';

type PulseBetaBadgeProps = {
  /** Use on dark filled buttons (e.g. selected Pulse tab). */
  variant?: 'default' | 'onDark';
  className?: string;
};

export function PulseBetaBadge({ variant = 'default', className }: PulseBetaBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[8px] font-semibold uppercase tracking-wider',
        variant === 'onDark'
          ? 'border-white/40 bg-white/15 text-white/95'
          : 'border-amber-600/30 bg-amber-500/12 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100/90',
        className,
      )}
    >
      Beta
    </span>
  );
}
