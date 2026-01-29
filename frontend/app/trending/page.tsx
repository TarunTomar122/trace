import Link from 'next/link';
import { 
  Sparkles,
  ArrowUpRight,
  Zap,
  Palette,
  Bot,
  Rocket,
  Music,
  Code,
} from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';

// Static page - no data fetching needed
export const dynamic = 'force-static';

const TOPICS = [
  {
    id: 'frontend-performance',
    name: 'Frontend Performance',
    description: 'Latest techniques, tools, and best practices for building fast web applications',
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
  },
  {
    id: 'design',
    name: 'Design',
    description: 'UI/UX trends, design systems, and creative inspiration from around the web',
    icon: Palette,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
  },
  {
    id: 'ai-agents',
    name: 'AI Agents',
    description: 'Autonomous AI systems, frameworks, and applications reshaping how we build software',
    icon: Bot,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    id: 'startups',
    name: 'Startups',
    description: 'Founder stories, funding news, and insights from the startup ecosystem',
    icon: Rocket,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  {
    id: 'music-production',
    name: 'Music Production',
    description: 'Production techniques, gear reviews, and creative workflows for music makers',
    icon: Music,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  {
    id: 'vibe-coding',
    name: 'Vibe Coding',
    description: 'Coding techniques, tools, and creative workflows for developers',
    icon: Code,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
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
              Trending Topics
            </h1>
            <p className="text-sm md:text-base text-secondary max-w-2xl">
              Curated topics updated daily with the latest articles, discussions, and videos from across the web
            </p>
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
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* CTA Section */}
          <div className="bg-gray-50 rounded-2xl p-6 md:p-8 text-center mb-12">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={22} className="text-foreground" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-2">
              Want More Than Trending?
            </h2>
            <p className="text-sm text-secondary mb-6 max-w-lg mx-auto">
              Get a personalized feed curated daily based on your unique interests and learning goals.
            </p>
            <Link href="/">
              <button className="bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:bg-foreground/90 transition-all">
                Start Free Trial
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
