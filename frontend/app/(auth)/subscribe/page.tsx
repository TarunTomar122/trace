import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import PricingScreen from '@/components/feed-v2/PricingScreen';

export const metadata: Metadata = {
  title: 'Pricing — Trace',
  description: 'Start free. Pro from $3/mo: the complete ranked daily edition, unlimited summaries, full Pulse and archive.',
};

export default function SubscribePage() {
  return (
    <AuthProvider>
      <PricingScreen />
    </AuthProvider>
  );
}
