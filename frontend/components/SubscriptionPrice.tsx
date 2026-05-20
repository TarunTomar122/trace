import { SUBSCRIPTION_COMPARE_AT_DEFAULT } from '@/lib/subscription-pricing';

type SubscriptionPriceProps = {
  price: string;
  compareAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  className?: string;
};

const sizeClasses = {
  sm: { compare: 'text-[12px]', price: 'text-[12px]' },
  md: { compare: 'text-[13px]', price: 'text-[14px]' },
  lg: { compare: 'text-[15px]', price: 'text-[2.25rem]' },
} as const;

const toneClasses = {
  light: {
    compare: 'text-[#9ca3af] decoration-[#9ca3af]',
    price: 'text-[#111827]',
    priceHighlight: 'text-[#2563eb]',
  },
  dark: {
    compare: 'text-white/40 decoration-white/40',
    price: 'text-white',
    priceHighlight: 'text-white',
  },
} as const;

export default function SubscriptionPrice({
  price,
  compareAt = SUBSCRIPTION_COMPARE_AT_DEFAULT,
  size = 'md',
  tone = 'light',
  className = '',
}: SubscriptionPriceProps) {
  const sizes = sizeClasses[size];
  const colors = toneClasses[tone];

  if (!compareAt) {
    return <span className={`font-semibold ${colors.price} ${sizes.price} ${className}`}>{price}</span>;
  }

  const priceColor = size === 'lg' ? colors.priceHighlight : colors.price;

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-2 ${className}`}>
      <span
        className={`font-medium line-through decoration-2 decoration-solid ${colors.compare} ${sizes.compare}`}
      >
        {compareAt}
      </span>
      <span className={`font-bold tracking-[-0.02em] ${priceColor} ${sizes.price}`}>{price}</span>
    </span>
  );
}
