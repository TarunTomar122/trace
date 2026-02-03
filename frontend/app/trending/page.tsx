import Link from 'next/link';
import type { Metadata } from 'next';
import { 
  Sparkles,
  ArrowUpRight,
  Zap,
  Palette,
  Bot,
  Rocket,
  Music,
  Code,
  Newspaper,
  Brain,
  Radar,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';

// Static page - no data fetching needed
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Trending Topics on Trace — Focus, Wellness, Money, Culture',
  description:
    'Browse trending topics curated daily across life, work, wellness, money, and culture. No doomscrolling, just signal.',
  keywords: [
    'curated topics',
    'focus',
    'wellness',
    'personal finance',
    'learning',
    'culture',
    'Trace trending',
  ],
  alternates: {
    canonical: 'https://www.yourtrace.online/trending',
  },
  openGraph: {
    title: 'Trending Topics on Trace — Focus, Wellness, Money, Culture',
    description:
      'Daily curated topics across life, work, wellness, money, and culture. No doomscrolling required.',
    url: 'https://www.yourtrace.online/trending',
    type: 'website',
    siteName: 'Trace',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending Topics on Trace',
    description:
      'Daily curated topics across life, work, wellness, money, and culture. No doomscrolling required.',
  },
};

const TOPICS = [
  {
    id: 'frontend-performance',
    name: 'Frontend Performance',
    description: 'Latest techniques, tools, and best practices for building fast web applications',
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    for: ['Builders', 'Web teams'],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'UI/UX trends, design systems, and creative inspiration from around the web',
    icon: Palette,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    for: ['Product & Design'],
  },
  {
    id: 'ai-agents',
    name: 'AI Agents',
    description: 'Autonomous AI systems, frameworks, and applications reshaping how we build software',
    icon: Bot,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    for: ['AI builders'],
  },
  {
    id: 'startups',
    name: 'Startups',
    description: 'Founder stories, funding news, and insights from the startup ecosystem',
    icon: Rocket,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    for: ['Indie hackers'],
  },
  {
    id: 'music-production',
    name: 'Music Production',
    description: 'Production techniques, gear reviews, and creative workflows for music makers',
    icon: Music,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    for: ['Creators'],
  },
  {
    id: 'vibe-coding',
    name: 'Vibe Coding',
    description: 'Coding techniques, tools, and creative workflows for developers',
    icon: Code,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    for: ['Builders'],
  },
];

export default function TrendingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showHome={true} backHref="/" backLabel="Back to Home" />

      <main className="w-full mt-6 md:mt-12">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="mb-8 md:mb-12">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-3">
              What&apos;s Actually Worth Your Attention
            </h1>
            <p className="text-sm md:text-base text-secondary max-w-2xl">
              No algorithm trying to keep you hooked. Just topics that matter — across life, work, money, wellness, and culture — curated daily without the brainrot.
            </p>
          </div>

          {/* Value Props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-8">
            {[
              {
                icon: Radar,
                title: 'No engagement tricks',
                description: 'Zero outrage bait. Zero infinite scroll traps. Just signal.',
              },
              {
                icon: Brain,
                title: 'You control it',
                description: 'Your interests decide what shows up. Not some engagement machine.',
              },
              {
                icon: Newspaper,
                title: 'Updated daily',
                description: 'Fresh content without the doomscroll rabbit holes.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-4 md:p-5 rounded-2xl border border-gray-200 bg-white"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <item.icon size={18} className="text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-secondary/70 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Topics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-12">
            {TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <Link
                  key={topic.id}
                  href={`/trending/${topic.id}`}
                  className="group block p-4 md:p-5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${topic.bgColor} flex items-center justify-center shrink-0`}>
                      <Icon size={22} className={topic.color} strokeWidth={1.5} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h2 className="text-base md:text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                          {topic.name}
                        </h2>
                        <ArrowUpRight 
                          size={16} 
                          className="text-secondary/40 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0" 
                          strokeWidth={1.5}
                        />
                      </div>
                      <p className="text-xs text-secondary/70 leading-relaxed line-clamp-2">
                        {topic.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {topic.for.map((label) => (
                          <span
                            key={label}
                            className="text-[10px] uppercase tracking-widest font-medium text-secondary/60 bg-gray-100 px-2 py-0.5 rounded-full"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* SEO Copy */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 mb-12">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-2">
              Take back your attention
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              Social feeds are built to keep you scrolling — outrage, fear, endless loops. Trace is the opposite: a feed you control,
              curated around what you actually care about. No manipulation. No brainrot. Just what matters.
            </p>
          </div>

          {/* CTA Section */}
          <div className="bg-gray-50 rounded-2xl p-6 md:p-8 text-center mb-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={22} className="text-foreground" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-2">
              Ready to escape the algorithm?
            </h2>
            <p className="text-sm text-secondary mb-6 max-w-lg mx-auto">
              Build a feed that works for you, not against you. No manipulation, no brainrot — just what you actually want to see.
            </p>
            <Link href="/">
              <button className="bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:bg-foreground/90 transition-all">
                Build your feed
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
