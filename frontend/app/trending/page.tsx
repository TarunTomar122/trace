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
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader showHome={true} backHref="/" backLabel="Back to Home" />

      <main className="w-full mt-6 md:mt-12">
        <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 md:mb-16">
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tight text-foreground uppercase">
                Trending
              </h1>
            </div>
            <p className="text-sm md:text-base font-mono text-secondary/70 max-w-2xl">
              Curated topics updated daily with the latest articles, discussions, and videos from across the web
            </p>
          </div>

          {/* Topics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-12">
            {TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <Link
                  key={topic.id}
                  href={`/trending/${topic.id}`}
                  className="group block border-2 border-border hover:border-primary transition-all duration-300"
                >
                  <div className={`p-6 md:p-8 ${topic.bgColor} group-hover:bg-primary/5 transition-colors`}>
                    {/* Icon and Title */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 ${topic.bgColor} ${topic.borderColor} border-2 flex items-center justify-center`}>
                        <Icon size={24} className={topic.color} strokeWidth={1.5} />
                      </div>
                      <ArrowUpRight 
                        size={20} 
                        className="text-secondary opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" 
                        strokeWidth={1.5}
                      />
                    </div>

                    {/* Content */}
                    <h2 className="text-xl md:text-2xl font-serif font-light text-foreground mb-2 uppercase tracking-tight">
                      {topic.name}
                    </h2>
                    <p className="text-xs md:text-sm font-mono text-secondary/70 leading-relaxed">
                      {topic.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* CTA Section */}
          <div className="border-2 border-primary bg-primary/5 p-8 md:p-12 text-center mb-12">
            <Sparkles size={32} className="text-primary mx-auto mb-6" strokeWidth={1.5} />
            <h2 className="text-2xl md:text-3xl font-serif font-light text-foreground mb-4 uppercase">
              Want More Than Trending?
            </h2>
            <p className="text-sm md:text-base font-mono text-secondary/70 mb-8 max-w-2xl mx-auto">
              Get a personalized feed curated daily based on your unique interests and learning goals. 
              No algorithms, no distractions—just the content that matters to you.
            </p>
            <Link href="/">
              <button className="bg-primary text-primary-foreground px-8 py-4 text-[10px] md:text-xs font-mono font-bold uppercase tracking-[0.25em] hover:bg-primary/90 transition-all active:scale-95">
                Start Free Trial
              </button>
            </Link>
          </div>

          {/* Bottom spacer */}
          <div className="h-12" />
        </div>
      </main>
    </div>
  );
}
