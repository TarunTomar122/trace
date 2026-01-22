"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Sparkles,
  ArrowRight,
  Zap,
  Palette,
  Bot,
  Rocket,
  Music,
  Code,
} from 'lucide-react';
import Header from '@/components/Header';

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
    description: 'Building intelligent agents, LLM applications, and the future of AI interactions',
    icon: Bot,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    id: 'startups',
    name: 'Startups',
    description: 'Founder stories, growth strategies, and insights from the startup ecosystem',
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
] as const;

function TopicCard({ topic, index }: { topic: typeof TOPICS[number]; index: number }) {
  const Icon = topic.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Link href={`/trending/${topic.id}`}>
        <div className={`group border ${topic.borderColor} ${topic.bgColor} p-6 md:p-8 hover:border-opacity-60 transition-all cursor-pointer h-full`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 md:w-14 md:h-14 ${topic.bgColor} border ${topic.borderColor} flex items-center justify-center shrink-0`}>
              <Icon size={24} className={`${topic.color} md:hidden`} strokeWidth={1.5} />
              <Icon size={28} className={`${topic.color} hidden md:block`} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg md:text-xl font-serif text-foreground group-hover:text-primary transition-colors mb-2">
                {topic.name}
              </h3>
              <p className="text-sm font-mono text-secondary/70 leading-relaxed">
                {topic.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-secondary/60">
              Explore topic
            </span>
            <ArrowRight 
              size={16} 
              className="text-secondary/40 group-hover:text-primary group-hover:translate-x-1 transition-all" 
              strokeWidth={1.5}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function TrendingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header backHref="/" backLabel="Back to Home" />

      <main className="w-full mt-6 md:mt-12">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="mb-12 md:mb-16 text-center">

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-light tracking-tight text-foreground uppercase mb-6"
            >
              Discover <span className="text-secondary/40">What&apos;s New</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-base md:text-lg font-mono text-secondary max-w-2xl mx-auto leading-relaxed"
            >
              Curated content from across the web. Updated regularly with the latest articles, discussions, and videos.
            </motion.p>
          </div>

          {/* Topics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16">
            {TOPICS.map((topic, index) => (
              <TopicCard key={topic.id} topic={topic} index={index} />
            ))}
          </div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="border-2 border-primary bg-primary/5 p-8 md:p-12 text-center mb-16"
          >
            <div className="w-16 h-16 bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Sparkles size={32} className="text-primary" strokeWidth={1.5} />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-serif font-light text-foreground mb-4">
              Want a <span className="text-primary">Personalized</span> Feed?
            </h2>
            
            <p className="text-sm md:text-base font-mono text-secondary mb-8 max-w-xl mx-auto leading-relaxed">
              Get daily content curated specifically for your interests. AI learns what you like and delivers the perfect mix every morning.
            </p>
            
            <Link href="/">
              <button className="group relative bg-primary text-primary-foreground px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.25em] transition-all overflow-hidden hover:tracking-[0.35em]">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Start Free Trial
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-primary/20 transition-transform duration-300" />
              </button>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

