"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Youtube,
  Github,
  BookOpen,
  Sparkles,
  Brain,
  ChevronRight,
  Layers,
  User,
  Menu,
  X,
  LogOut,
  Mail,
  Clock,
  Bookmark,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Newspaper,
  ArrowUpRight,
  Lightbulb,
  Search,
  TrendingUp,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Newsletter Signup Section ---
const NewsletterSignupSection = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || "You're in! Check your inbox soon.");
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Try again.');
    }
  };

  return (
    <section className="relative md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto text-center"
        >
            <p className="text-sm text-secondary mb-3 font-sans">
            Get a daily digest of the best reads from across the web — free in your inbox.
          </p>

          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-full"
            >
              <Mail size={15} className="text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-200 font-sans">{message}</span>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                placeholder="your@email.com"
                required
                className="w-full sm:flex-1 px-4 py-2.5 text-sm border border-border rounded-full bg-background text-foreground placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 font-sans"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors disabled:opacity-50 font-sans whitespace-nowrap"
              >
                {status === 'loading' ? (
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Mail size={14} />
                    Subscribe free
                  </>
                )}
              </button>
            </form>
          )}

          {status === 'error' && (
            <p className="text-xs text-red-500 mt-2 font-sans">{message}</p>
          )}
        </motion.div>
      </div>
    </section>
  );
};

// --- Waitlist Banner Component ---
const WaitlistBanner = () => {
  if (isAlphaMode()) return null;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-60 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-sm">
          <Clock className="text-foreground" size={16} />
          <span className="text-sm text-foreground">
            <span className="font-semibold">Early Access</span> — We&apos;re launching soon! Sign up now to secure your spot.
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// --- Nav Component ---
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => setMounted(true), []);

  const showBanner = !isAlphaMode();

  return (
    <nav className={cn(
      "fixed left-0 right-0 z-50 transition-all duration-500",
      showBanner ? "top-[40px]" : "top-0"
    )}>
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "bg-background/95 backdrop-blur-md w-full transition-all duration-500 rounded-2xl mt-4",
            scrolled
              ? "border border-gray-200 dark:border-gray-800 shadow-sm px-4 py-3"
              : "border-transparent px-4 py-5"
          )}
        >
          <div className="flex items-center justify-between w-full">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Desktop Left Nav */}
            <div className="hidden md:flex items-center gap-1 flex-1">
              {!user && (
                <a href="#how" className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  How It Works
                </a>
              )}
              {user ? (
                <>
                  <a href="/feed" className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    Your Feed
                  </a>
                  <Link href="/trending" className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    Trending
                  </Link>
                </>
              ) : (
                <Link href="/trending" className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  Trending
                </Link>
              )}
            </div>

            {/* Logo - Centered */}
            <Link href="/" className="text-lg md:text-xl text-foreground uppercase flex items-center gap-2 tracking-wide font-semibold md:absolute md:left-1/2 md:-translate-x-1/2">
              <Lightbulb size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={1.5} />
              <span>TRACE</span>
            </Link>

            {/* Desktop Right Nav */}
            <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
              {/* Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              {user ? (
                <div className="flex items-center gap-3">
                  <Link href="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    {user.photoURL && (
                      <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                    )}
                    <span className="text-sm font-medium text-secondary">
                      {profile?.name?.split(' ')[0] || user.displayName?.split(' ')[0]}
                    </span>
                  </Link>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-foreground text-background px-6 py-2.5 rounded-full text-sm font-medium hover:bg-foreground/90 transition-all"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile CTA */}
            <div className="md:hidden flex items-center gap-2">
              {/* Mobile Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              {user ? (
                <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                  )}
                </Link>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pt-4 pb-2 flex flex-col gap-1 border-t border-gray-200 dark:border-gray-800 mt-4">
                  {!user && (
                    <a
                      href="#how"
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      How It Works
                    </a>
                  )}
                  {user ? (
                    <a
                      href="/feed"
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Your Feed
                    </a>
                  ) : (
                    <a
                      href="/trending"
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Trending
                    </a>
                  )}
                  {user ? (
                    <button
                      onClick={() => { signOut(); setMobileMenuOpen(false); }}
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  ) : (
                    <button
                      onClick={() => { signInWithGoogle(); setMobileMenuOpen(false); }}
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                    >
                      Sign In with Google
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </nav>
  );
};

// --- Grid Background ---
const GridBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 flex justify-center opacity-20">
    <div className="grid-inner w-full h-full max-w-7xl flex justify-between px-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="w-px h-full bg-border" />
      ))}
    </div>
  </div>
);

// --- Flow Diagram Component ---
const FlowDiagram = () => {
  const sources = [
    { icon: Youtube, name: 'YouTube', color: 'text-red-500' },
    { icon: Github, name: 'GitHub', color: 'text-purple-500' },
    { icon: BookOpen, name: 'Research', color: 'text-blue-500' },
    { icon: Sparkles, name: 'More', color: 'text-amber-500' },
  ];

  return (
    <div className="relative w-full h-full min-h-[300px] md:min-h-[400px] flex items-center justify-center hidden md:block">
      {/* Source Nodes - Stacked vertically on the left */}
      <div className="absolute left-0 top-1/2 -translate-y-3/5 flex flex-col gap-3 md:gap-5">
        {sources.map((source, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div className={cn("w-8 h-8 md:w-12 md:h-12 bg-background border border-border flex items-center justify-center", source.color)}>
                <source.icon size={16} className="md:hidden" strokeWidth={1.5} />
                <source.icon size={22} className="hidden md:block" strokeWidth={1.5} />
              </div>
              <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-secondary">
                {source.name}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Animated Lines */}
      <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ zIndex: 1 }}>
        {/* Source 1 to Agent - Mobile responsive paths */}
        <motion.path
          d="M 80 60 Q 130 60 160 130"
          className="md:hidden text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />
        <motion.path
          d="M 120 85 Q 190 85 230 175"
          className="hidden md:block text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />
        {/* Source 2 to Agent */}
        <motion.path
          d="M 80 95 Q 120 95 160 130"
          className="md:hidden text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
        />
        <motion.path
          d="M 120 145 Q 175 145 230 175"
          className="hidden md:block text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
        />
        {/* Source 3 to Agent */}
        <motion.path
          d="M 80 130 Q 120 130 160 130"
          className="md:hidden text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
        />
        <motion.path
          d="M 120 205 Q 175 205 230 175"
          className="hidden md:block text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
        />
        {/* Source 4 to Agent */}
        <motion.path
          d="M 80 165 Q 130 165 160 130"
          className="md:hidden text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
        />
        <motion.path
          d="M 120 265 Q 190 265 230 175"
          className="hidden md:block text-border"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
        />
        {/* Agent to Feed - Mobile */}
        <motion.line
          x1="220" y1="130" x2="280" y2="130"
          className="md:hidden text-primary"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        />
        <motion.line
          x1="320" y1="175" x2="400" y2="175"
          className="hidden md:block text-primary"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        />
        {/* Arrow head - Mobile */}
        <motion.polygon
          points="275,125 285,130 275,135"
          fill="currentColor"
          className="md:hidden text-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        />
        <motion.polygon
          points="395,170 405,175 395,180"
          fill="currentColor"
          className="hidden md:block text-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        />
      </svg>

      {/* Central Agent Node */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute left-[160px] md:left-[230px] top-1/2 -translate-y-[80%]"
        style={{ zIndex: 2 }}
      >
        <div className="relative">
          <div className="w-14 h-14 md:w-20 md:h-20 bg-primary text-primary-foreground flex items-center justify-center">
            <Brain size={28} className="md:hidden" strokeWidth={1.5} />
            <Brain size={36} className="hidden md:block" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-6 md:-bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-foreground font-bold">
            AI Agent
          </div>
          <motion.div
            className="absolute inset-0 border border-primary"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        </div>
      </motion.div>

      {/* Feed Output */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1.5 }}
        className="absolute left-[290px] md:left-[410px] top-1/2 -translate-y-[90%]"
        style={{ zIndex: 2 }}
      >
        <div className="relative flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-background border-2 border-primary flex items-center justify-center text-primary">
            <Layers size={20} className="md:hidden" strokeWidth={1.5} />
            <Layers size={26} className="hidden md:block" strokeWidth={1.5} />
          </div>
          <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-foreground font-bold">
            Your Feed
          </span>
        </div>
      </motion.div>

      {/* Floating Particles around agent */}
      {[
        { left: '52%', top: '30%', duration: 2.5 },
        { left: '58%', top: '35%', duration: 3 },
        { left: '55%', top: '45%', duration: 2.8 },
      ].map((particle, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 bg-primary/60 rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            y: [0, -8, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: i * 0.3,
          }}
        />
      ))}
    </div>
  );
};

// --- Hero Component ---
const Hero = () => {
  const { user, profile, signInWithGoogle } = useAuth();
  const isLoggedIn = !!user;
  const isOnboarded = !!user && !!profile?.onboarded;
  const heroCtaHref = isLoggedIn && !isOnboarded ? '/onboarding' : null;
  const heroCtaText = isLoggedIn && !isOnboarded ? 'Personalize my feed' : 'Unlock full feed';

  return (
    <section className="relative pt-32 pb-16 md:pt-36 lg:pt-60 md:pb-24 lg:pb-40 overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side - Content */}
          <div className="flex flex-col">
            {isOnboarded ? (
              // Logged-in user view
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight font-semibold tracking-tight text-foreground mb-4 md:mb-6"
                >
                  Your Feed Is{' '}
                  <span className="text-secondary/50">Ready</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-base md:text-lg text-secondary leading-relaxed mb-6 md:mb-8 max-w-lg"
                >
                  Fresh picks from across the web, curated around what you care about.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex items-center gap-2 mb-6 md:mb-8"
                >
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full">
                    <Lightbulb size={14} className="text-primary" />
                    <span className="text-sm font-medium text-primary">Upvote and downvote items to help Trace learn what matters to you.</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <a href="/feed" className="w-full sm:w-auto">
                    <button className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3.5 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors w-full sm:w-auto">
                      View Your Feed
                      <ChevronRight size={16} />
                    </button>
                  </a>
                </motion.div>
              </>
            ) : (
              // New or not-onboarded user view - Clean layout
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight font-serif tracking-tight text-secondary/80 mb-4 md:mb-6"
                >
                  One feed.{' '}
                  <span className="italic text-primary">Every source. Your topics.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-base md:text-lg text-secondary leading-relaxed mb-4 max-w-md"
                >
                  {isAlphaMode()
                    ? "Trace pulls from YouTube, GitHub, Reddit, Hacker News, research papers, blogs, and more — so you never miss what matters in your world."
                    : "Join the waitlist for early access. Trace pulls from hundreds of sources so you never have to check them all yourself."
                  }
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex flex-wrap gap-2 mb-6 md:mb-8"
                >
                  {[
                    "Your RSS for the web",
                  ].map((item) => (
                    <div
                      key={item}
                      className="px-3 py-1.5 rounded-full text-primary text-xs font-medium"
                    >
                      {item}
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex flex-col sm:flex-row gap-3 mb-4"
                >
                  {heroCtaHref ? (
                    <a href={heroCtaHref}>
                      <button className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3.5 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors">
                        {heroCtaText}
                        <ChevronRight size={16} />
                      </button>
                    </a>
                  ) : (
                    <button
                      onClick={signInWithGoogle}
                      className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3.5 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      {heroCtaText}
                      <ChevronRight size={16} />
                    </button>
                  )}
                </motion.div>




                {/* Social Proof */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="flex items-center gap-4"
                >
                  {/* Avatar stack */}
                  <div className="flex -space-x-2">
                    {['Z', 'M', 'S', 'A'].map((initial, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 border-2 border-background flex items-center justify-center text-xs font-medium text-primary"
                      >
                        {initial}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map(i => (
                        <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-secondary">
                      Loved by <span className="font-medium text-foreground">1K+ users</span>
                    </span>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Right Side - Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="block relative"
          >
            {/* Annotation with arrow */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute -top-4 md:-top-14 left-4 md:left-8 flex items-end gap-2"
            >
              <span className="text-secondary/60 text-sm italic font-serif pb-3">This could be your feed</span>
              <img
                src="/arrow.png"
                alt=""
                className="w-6 h-6 opacity-50 pt-1"
              />
            </motion.div>
            <HeroDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- Demo Video Section ---
const DemoVideo = () => {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-serif text-foreground mb-3">
            See Trace in action
          </h2>
          <p className="text-secondary text-base md:text-lg max-w-xl mx-auto">
            One feed from hundreds of sources, personalized to what you care about
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5 bg-background aspect-video"
        >
          <iframe
            src="https://www.youtube.com/embed/ueJC-EZCvr4?autoplay=0&rel=0&modestbranding=1"
            title="Trace Demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </motion.div>
      </div>
    </section>
  );
};

// --- How It Works Section ---
const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      icon: User,
      title: "Choose topics",
      description: "Pick what you care about — AI, product, design, startups, finance, science, or anything else.",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950"
    },
    {
      number: "02",
      icon: Search,
      title: "We find the best stuff",
      description: "Trace scans YouTube, GitHub, Hacker News, Reddit, arXiv, top blogs, and hundreds more sources — daily.",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950"
    },
    {
      number: "03",
      icon: ThumbsUp,
      title: "You steer",
      description: "Upvote what matters, downvote what doesn't. Add notes when you want.",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950"
    },
    {
      number: "04",
      icon: Brain,
      title: "Trace adapts",
      description: "Your feed learns what you like and sharpens itself over time. More signal, less noise.",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950"
    },
    {
      number: "05",
      icon: TrendingUp,
      title: "Never miss what matters",
      description: "Every day, your feed surfaces the most important content from across the web, tailored to your interests.",
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950"
    }
  ];

  return (
    <section id="how" className="py-16 md:py-24 lg:py-32 bg-background relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
            How It <span className="text-secondary/50">Works</span>
          </h2>
          <p className="text-secondary text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Hundreds of sources, one feed that gets smarter every day
          </p>
        </motion.div>

        <div>
          {/* First row - 3 items */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
            {steps.slice(0, 3).map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all"
              >
                {/* Step number */}
                <div className="absolute top-4 right-4 text-2xl font-bold text-secondary/10">
                  {step.number}
                </div>

                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                  step.bgColor
                )}>
                  <step.icon size={24} className={step.color} strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {step.description}
                </p>

                {/* Connector arrow */}
                {index < 2 && (
                  <div className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2 text-secondary/20">
                    <ChevronRight size={24} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Second row - 2 items centered */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center max-w-2xl mx-auto lg:max-w-4xl">
            {steps.slice(3).map((step, index) => (
              <motion.div
                key={index + 3}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index + 3) * 0.1 }}
                className="relative p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all flex-1"
              >
                {/* Step number */}
                <div className="absolute top-4 right-4 text-2xl font-bold text-secondary/10">
                  {step.number}
                </div>

                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                  step.bgColor
                )}>
                  <step.icon size={24} className={step.color} strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {step.description}
                </p>

                {/* Connector arrow */}
                {index === 0 && (
                  <div className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2 text-secondary/20">
                    <ChevronRight size={24} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12 md:mt-16"
        >
          <p className="text-secondary text-sm mb-4">
            Ready to never miss what matters?
          </p>
          <a href="#get-started">
            <button className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors">
              Get Started
              <ChevronRight size={16} />
            </button>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

// --- What Trace Replaces Section ---
const WhatTraceReplaces = () => {
  const habits = [
    {
      icon: "🐦",
      title: "Twitter / X",
      description: "Tech news, AI updates, and threads from the people you actually want to hear from"
    },
    {
      icon: "📱",
      title: "Reddit",
      description: "Discussions across AI, product, engineering, and niche communities"
    },
    {
      icon: "💬",
      title: "Hacker News",
      description: "Launches, deep technical discussions, and Show HN gems"
    },
    {
      icon: "🎥",
      title: "YouTube",
      description: "Tutorials, breakdowns, and the best video content from creators you care about"
    },
    {
      icon: "📰",
      title: "Blogs & Newsletters",
      description: "The best writing from across the web — posts you'd never find on your own"
    },
    {
      icon: "📄",
      title: "Research & GitHub",
      description: "arXiv papers, trending repos, and open-source projects worth knowing about"
    }
  ];

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900 relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-3 md:mb-4"
          >
            What Trace <span className="text-secondary/50">Brings Together</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            All the places you used to check — now in one feed
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {habits.map((habit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all group"
            >
              <div className="text-3xl mb-3">{habit.icon}</div>
              <h3 className="text-base md:text-lg font-semibold text-foreground mb-2 group-hover:text-foreground/80 transition-colors">
                {habit.title}
              </h3>
              <p className="text-sm text-secondary leading-relaxed">
                {habit.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- How People Use Trace Section ---
const HowPeopleUseTrace = () => {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        <div className="text-center mb-10 md:mb-14">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4 md:mb-6"
          >
            How People <span className="text-secondary/50">Actually</span> Use Trace
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary text-base md:text-lg"
          >
            A daily digest pulls the best from everywhere — you just open it and you&apos;re caught up.
          </motion.p>
        </div>

        {/* Email Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg dark:shadow-gray-900/50 mb-10 md:mb-14 overflow-hidden"
        >
          {/* Email Header */}
          <div className="border-b border-gray-100 dark:border-gray-800 px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Mail className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Trace Daily</div>
                <div className="text-xs text-secondary">digest@trace.club</div>
              </div>
            </div>
            <div className="text-sm md:text-base font-medium text-foreground">
              Your Morning Digest — Jan 28, 2025
            </div>
          </div>

          {/* Email Body Preview */}
          <div className="px-4 md:px-6 py-4 md:py-6 space-y-2">
            {[
              { icon: "🎬", title: "A practical AI agent stack for product teams", source: "YouTube" },
              { icon: "💬", title: "Show HN: A calmer way to stay current as a builder", source: "Hacker News" },
              { icon: "📦", title: "open-source: design review checklist for operators", source: "GitHub" },
              { icon: "📄", title: "New research on evaluation for applied AI systems", source: "arXiv" },
              { icon: "📝", title: "How great product teams triage signal vs noise", source: "Blog" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="text-xs text-secondary">{item.source}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center max-w-2xl mx-auto"
        >
          <p className="text-base text-secondary leading-relaxed mb-6">
            Every morning, Trace sends you one brief.<br />
            The best from Reddit, Hacker News, YouTube, blogs, and research —<br />
            filtered for what you care about.
          </p>
          <div className="flex flex-col items-center gap-1 text-sm text-foreground/70">
            <span>Hundreds of sources.</span>
            <span>One feed.</span>
            <span className="font-medium text-foreground">Never miss what matters.</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// --- Source Badge Component ---
const SourceBadge = ({ icon: Icon, name, color }: { icon: React.ElementType; name: string; color: string }) => (
  <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", color)}>
    <Icon size={12} />
    {name}
  </div>
);

// --- Interactive Demo Section ---
const DEMO_FEED_ITEMS = [
  {
    id: '1',
    type: 'youtube',
    title: 'How Figma rebuilt their multiplayer engine from scratch',
    description: 'A deep dive into CRDTs, syncing, and the infra that makes real-time collaboration actually work.',
    source: 'YouTube',
    author: 'Figma Engineering',
    tag: 'design',
    tagLabel: 'From YouTube · matched your design interest',
  },
  {
    id: '2',
    type: 'article',
    title: 'The quiet revolution in solo SaaS: 11 founders hitting $1M ARR alone',
    description: 'How indie builders are using AI, no-code tools, and niche markets to build real businesses.',
    source: 'Blog',
    author: 'Lenny\'s Newsletter',
    tag: 'startups',
    tagLabel: 'From Lenny\'s Newsletter · matched startups',
  },
  {
    id: '3',
    type: 'news',
    title: 'Anthropic releases Claude 4 with 10x context and real-time vision',
    description: 'The new model handles multi-step reasoning and code generation at a level that surprised benchmarks.',
    source: 'arXiv',
    author: 'Anthropic Research',
    tag: 'ai-tools',
    tagLabel: 'From arXiv · matched your AI interest',
  },
  {
    id: '4',
    type: 'discussion',
    title: 'Show HN: I built a local-first Notion alternative in Rust',
    description: '800+ points. Devs discuss offline-first architecture, WASM, and why local-first is making a comeback.',
    source: 'Hacker News',
    author: 'dang',
    tag: 'product',
    tagLabel: 'From Hacker News · matched web dev',
  },
];

const DEMO_FILTERS = [
  { id: 'all', label: 'For You' },
  { id: 'ai-tools', label: 'AI Tools' },
  { id: 'startups', label: 'Startups' },
  { id: 'product', label: 'Product' },
  { id: 'design', label: 'Design' },
];

const DemoFeedCard = ({ item, index, compact = false }: { item: typeof DEMO_FEED_ITEMS[0]; index: number; compact?: boolean }) => {
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showSignupHint, setShowSignupHint] = useState(false);

  const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    youtube: { icon: Youtube, color: 'text-red-500' },
    article: { icon: BookOpen, color: 'text-emerald-500' },
    news: { icon: Newspaper, color: 'text-orange-500' },
    discussion: { icon: MessageCircle, color: 'text-amber-500' },
  };

  const config = typeConfig[item.type] || typeConfig.article;
  const Icon = config.icon;

  const handleInteraction = (action: 'upvote' | 'downvote' | 'bookmark') => {
    if (action === 'upvote') {
      setUpvoted(!upvoted);
      if (downvoted) setDownvoted(false);
    } else if (action === 'downvote') {
      setDownvoted(!downvoted);
      if (upvoted) setUpvoted(false);
    } else {
      setBookmarked(!bookmarked);
    }
    setShowSignupHint(true);
    setTimeout(() => setShowSignupHint(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: compact ? 10 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border-b border-border/30 last:border-0 group ${compact ? 'py-2.5' : 'py-4'}`}
    >
      <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
        {/* Icon */}
        <div className={`flex items-center justify-center shrink-0 bg-border/30 ${config.color} ${compact ? 'w-7 h-7' : 'w-9 h-9'}`}>
          <Icon size={compact ? 12 : 16} strokeWidth={1.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source label */}
          <div className={`flex items-center gap-2 ${compact ? 'mb-1' : 'mb-1.5'}`}>
            <span className={`font-mono uppercase tracking-wider ${config.color} ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
              {item.source}
            </span>
            <span className={`font-mono text-secondary/50 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
              {item.author}
            </span>
          </div>

          {/* Title */}
          <h3 className={`font-serif leading-snug text-foreground group-hover:text-primary transition-colors cursor-pointer ${compact ? 'text-xs mb-1 line-clamp-2' : 'text-sm mb-1.5'}`}>
            {item.title}
            {!compact && <ArrowUpRight size={12} className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />}
          </h3>

          {/* Description - hidden in compact mode */}
          {!compact && (
            <p className="text-xs font-mono text-secondary/70 line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {/* Tag */}
          <p className={`font-mono text-primary/70 ${compact ? 'text-[8px] mb-1.5' : 'text-[10px] mb-3'}`}>
            {item.tagLabel}
          </p>

          {/* Actions */}
          <div className={`flex items-center gap-1 relative ${compact ? '-ml-1' : '-ml-1.5'}`}>
            <button
              onClick={() => handleInteraction('upvote')}
              className={`flex items-center gap-1 transition-colors ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'} ${upvoted ? 'text-green-500' : 'text-secondary/40 hover:text-green-500'
                }`}
            >
              <ThumbsUp size={compact ? 12 : 14} fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>

            <button
              onClick={() => handleInteraction('downvote')}
              className={`flex items-center gap-1 transition-colors ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'} ${downvoted ? 'text-red-500' : 'text-secondary/40 hover:text-red-500'
                }`}
            >
              <ThumbsDown size={compact ? 12 : 14} fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>

            {!compact && (
              <button className="flex items-center gap-1 px-1.5 py-1 text-secondary/40 hover:text-blue-500 transition-colors">
                <MessageSquare size={14} strokeWidth={1.5} />
              </button>
            )}

            <button
              onClick={() => handleInteraction('bookmark')}
              className={`flex items-center gap-1 ml-auto transition-colors ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'} ${bookmarked ? 'text-primary' : 'text-secondary/40 hover:text-primary'
                }`}
            >
              <Bookmark size={compact ? 12 : 14} fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>

            {/* Signup hint */}
            <AnimatePresence>
              {showSignupHint && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute -bottom-8 left-0 px-2 py-1 bg-primary text-primary-foreground text-[10px] font-mono whitespace-nowrap"
                >
                  Sign up to save your preferences!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const InteractiveDemo = () => {
  const { signInWithGoogle } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  const filteredItems = activeFilter === 'all'
    ? DEMO_FEED_ITEMS
    : DEMO_FEED_ITEMS.filter(item => item.tag === activeFilter);

  const handleFilterClick = (filterId: string) => {
    if (filterId === activeFilter) return;
    setIsLoading(true);
    // Small delay to simulate fetching from sources
    setTimeout(() => {
      setActiveFilter(filterId);
      setIsLoading(false);
    }, 450);
  };

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-10 md:mb-14">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary mb-4"
          >
            Interactive Demo
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6"
          >
            Try It <span className="text-secondary/40">Yourself</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary font-mono text-xs md:text-sm leading-relaxed max-w-2xl mx-auto"
          >
            This is what your daily feed could look like — content from across the web, just for you.
          </motion.p>
        </div>

        {/* Browser Frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative max-w-3xl mx-auto"
        >
          {/* Browser Chrome */}
          <div className="bg-[#1c1c28] rounded-t-xl border border-border/50 border-b-0">
            {/* Traffic lights & URL bar */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-[#26263a] rounded-md px-4 py-1.5 text-xs font-mono text-secondary/60 flex items-center gap-2">
                  <span className="text-green-500">🔒</span>
                  trace.club/feed
                </div>
              </div>
              <div className="w-16" /> {/* Spacer for balance */}
            </div>
          </div>

          {/* Feed Content */}
          <div className="bg-background border border-border/50 border-t-0 rounded-b-xl overflow-hidden">
            {/* Feed Header */}
            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm font-serif font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  TRACE
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-secondary/50">Today&apos;s Feed</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-mono">{filteredItems.length} items</span>
              </div>
            </div>

            {/* Filter Pills - Now Interactive */}
            <div className="px-5 py-3 border-b border-border/30 flex gap-2 overflow-x-auto">
              {DEMO_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => handleFilterClick(filter.id)}
                  className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors ${activeFilter === filter.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-secondary/60 hover:border-primary/50'
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Feed Items */}
            <div className="px-5">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 flex flex-col items-center justify-center gap-3"
                  >
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-mono text-secondary/50">Fetching articles...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeFilter}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {filteredItems.map((item, i) => (
                      <DemoFeedCard key={item.id} item={item} index={i} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CTA at bottom */}
            <div className="px-5 py-6 bg-gradient-to-t from-primary/5 to-transparent border-t border-border/30">
              <div className="text-center">
                <p className="text-sm font-mono text-foreground mb-3">
                  Like what you see? Get your own personalized feed from hundreds of sources.
                </p>
                <button
                  onClick={signInWithGoogle}
                  className="px-6 py-3 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  Sign Up Free — 3 Day Trial
                </button>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-primary/40" />
        </motion.div>
      </div>
    </section>
  );
};

// --- Animated Hero Demo (for right side of hero) ---
const heroDelay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const HeroDemo = () => {
  const [view, setView] = useState<'feed' | 'article'>('feed');
  const [cursorPos, setCursorPos] = useState({ x: 80, y: -5 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [thumbsUp, setThumbsUp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        // Reset everything
        setView('feed');
        setCursorVisible(false);
        setHoveredItem(null);
        setScrollY(0);
        setThumbsUp(false);

        // 1. Show feed list
        await heroDelay(2800);
        if (cancelled) return;

        // 2. Cursor enters from top-right, glides to second item (blog)
        setCursorVisible(true);
        setCursorPos({ x: 78, y: -4 });
        await heroDelay(80);
        if (cancelled) return;
        setCursorPos({ x: 42, y: 42 });
        await heroDelay(900);
        if (cancelled) return;

        // 3. Hover highlight on second card (blog)
        setHoveredItem(1);
        await heroDelay(450);
        if (cancelled) return;

        // 4. Click
        setCursorClicking(true);
        await heroDelay(150);
        if (cancelled) return;
        setCursorClicking(false);
        await heroDelay(250);
        if (cancelled) return;

        // 5. Transition to article view
        setView('article');
        setCursorVisible(false);
        setHoveredItem(null);
        await heroDelay(1600);
        if (cancelled) return;

        // 6. Smooth-scroll the article content
        const steps = 90;
        const maxScroll = 200;
        for (let i = 1; i <= steps; i++) {
          if (cancelled) return;
          const t = i / steps;
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          setScrollY(eased * maxScroll);
          await heroDelay(45);
        }
        await heroDelay(700);
        if (cancelled) return;

        // 7. Cursor reappears, moves to thumbs-up button
        setCursorVisible(true);
        setCursorPos({ x: 78, y: 88 });
        await heroDelay(80);
        if (cancelled) return;
        setCursorPos({ x: 14, y: 85 });
        await heroDelay(850);
        if (cancelled) return;

        // 8. Click thumbs-up
        setCursorClicking(true);
        await heroDelay(150);
        if (cancelled) return;
        setCursorClicking(false);
        setThumbsUp(true);
        await heroDelay(2200);
        if (cancelled) return;

        // 9. Fade cursor, pause, loop
        setCursorVisible(false);
        await heroDelay(1200);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const clickedItem = DEMO_FEED_ITEMS[1]; // Blog post

  return (
    <div className="relative w-full mt-6 md:mt-0">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-border/60 overflow-hidden shadow-xl shadow-black/5 dark:shadow-gray-950/20 relative">
        {/* ── Header ── */}
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <AnimatePresence mode="wait">
            {view === 'article' ? (
              <motion.div
                key="back"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5 text-secondary"
              >
                <ChevronRight size={14} className="rotate-180" />
                <span className="text-[11px]">Back to feed</span>
              </motion.div>
            ) : (
              <motion.div
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <img src="/trace.png" alt="Trace" className="h-5 w-auto" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Your Feed</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-secondary/60 font-mono">Today</span>
            {view === 'feed' && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-secondary text-[10px] font-medium">4 new</span>
            )}
          </div>
        </div>

        {/* ── Content area (fixed height) ── */}
        <div className="relative h-[440px] overflow-hidden select-none">
          <AnimatePresence mode="wait">
            {view === 'feed' ? (
              <motion.div
                key="feed-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                {/* Filter pills */}
                <div className="px-4 py-2.5 border-b border-border/40 flex gap-1.5">
                  {DEMO_FILTERS.slice(0, 4).map((filter, i) => (
                    <div
                      key={filter.id}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium ${
                        i === 0 ? 'bg-foreground text-background' : 'bg-gray-100 dark:bg-gray-800 text-secondary'
                      }`}
                    >
                      {filter.label}
                    </div>
                  ))}
                </div>

                {/* Feed items */}
                <div className="divide-y divide-border/30">
                  {DEMO_FEED_ITEMS.map((item, i) => (
                    <HeroDemoCard key={item.id} item={item} index={i} isHovered={hoveredItem === i} />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="article-view"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.3 }}
                className="h-full overflow-hidden"
              >
                {/* Scrollable article body */}
                <div
                  className="px-5 py-4"
                  style={{ transform: `translateY(-${scrollY}px)`, transition: 'transform 0.06s linear' }}
                >
                  {/* Source badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                      <BookOpen size={14} className="text-emerald-600" strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Blog</span>
                    <span className="text-[10px] text-secondary/40">·</span>
                    <span className="text-[10px] text-secondary/50">{clickedItem.author}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-[15px] font-semibold leading-snug text-foreground mb-1.5">
                    {clickedItem.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-[11px] text-secondary italic mb-5">
                    What the most successful indie builders are doing differently — and the playbook behind their growth.
                  </p>

                  {/* Article body */}
                  <div className="space-y-3 text-[11.5px] leading-[1.7] text-foreground/80">
                    <h4 className="text-[12px] font-semibold text-foreground">The $1M Solo Founder Is No Longer Rare</h4>
                    <p>
                      Five years ago, building a million-dollar SaaS alone was a unicorn story. Now Lenny counts
                      11 founders who&apos;ve done it — and the number is accelerating. The common thread
                      isn&apos;t talent or luck. It&apos;s leverage.
                    </p>
                    <p>
                      AI handles the grunt work. No-code tools replaced entire engineering teams. And niche
                      markets turned out to be <strong>far more profitable</strong> than anyone expected.
                    </p>

                    <h4 className="text-[12px] font-semibold text-foreground mt-1">The Playbook That Keeps Showing Up</h4>
                    <p>
                      Nearly every founder in the list followed the same rough sequence — and it&apos;s not
                      what the YC playbook tells you.
                    </p>
                    <ul className="space-y-1 text-[11px] text-foreground/70 ml-3">
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                        <span><strong>Pick a boring niche</strong> — payroll, invoicing, niche CRMs</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                        <span><strong>Ship ugly, iterate fast</strong> — design polish came after $10K MRR</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                        <span><strong>SEO + community &gt; ads</strong> — organic channels compound</span>
                      </li>
                    </ul>

                    <h4 className="text-[12px] font-semibold text-foreground mt-1">Why Now</h4>
                    <p>
                      The cost of building dropped by <strong>10× in two years</strong>. What used to take
                      a 5-person team and $500K now takes one founder, a few AI tools, and a weekend.
                      The golden age of solo SaaS is just getting started.
                    </p>
                  </div>

                  {/* Vote actions */}
                  <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border/30">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                        thumbsUp
                          ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                          : 'text-secondary/40'
                      }`}
                    >
                      <ThumbsUp size={13} fill={thumbsUp ? 'currentColor' : 'none'} strokeWidth={1.5} />
                      <span>Useful</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-secondary/40">
                      <ThumbsDown size={13} strokeWidth={1.5} />
                      <span>Not for me</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-secondary/40 ml-auto">
                      <Bookmark size={13} strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* "Trace learned" nudge after vote */}
                  <AnimatePresence>
                    {thumbsUp && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-900"
                      >
                        <Sparkles size={12} className="text-emerald-500" />
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-200">Trace learned you like startup strategy from newsletters</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Animated cursor ── */}
          <motion.div
            className="absolute pointer-events-none z-50"
            animate={{
              left: `${cursorPos.x}%`,
              top: `${cursorPos.y}%`,
              opacity: cursorVisible ? 1 : 0,
              scale: cursorClicking ? 0.8 : 1,
            }}
            transition={{
              left: { type: 'tween', duration: 0.85, ease: [0.4, 0, 0.2, 1] },
              top: { type: 'tween', duration: 0.85, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.25 },
              scale: { duration: 0.1 },
            }}
          >
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none" className="drop-shadow-md">
              <path
                d="M1 1L1 17.5L5.2 13L9.2 21.5L12 20L8 11.5L14.5 11.5L1 1Z"
                fill="white"
                stroke="#222"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Card for the Hero demo feed list
const HeroDemoCard = ({ item, index, isHovered = false }: { item: typeof DEMO_FEED_ITEMS[0]; index: number; isHovered?: boolean }) => {
  const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    youtube: { icon: Youtube, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950' },
    article: { icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    news: { icon: Newspaper, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950' },
    discussion: { icon: MessageCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  };

  const config = typeConfig[item.type] || typeConfig.article;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 cursor-pointer transition-colors ${isHovered ? 'bg-gray-50 dark:bg-gray-800/60' : 'bg-white dark:bg-gray-950'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={config.color} strokeWidth={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>{item.source}</span>
            <span className="text-[10px] text-secondary/40">·</span>
            <span className="text-[10px] text-secondary/50">{item.author}</span>
          </div>

          <h3 className="text-[13px] font-medium leading-snug text-foreground line-clamp-2">
            {item.title}
          </h3>

          <p className="text-[11px] text-secondary/60 leading-relaxed line-clamp-1 mt-0.5 mb-2">
            {item.description}
          </p>

          <div className="flex items-center gap-1">
            <div className="p-1 text-secondary/30"><ThumbsUp size={13} strokeWidth={1.5} /></div>
            <div className="p-1 text-secondary/30"><ThumbsDown size={13} strokeWidth={1.5} /></div>
            <div className="p-1 text-secondary/30 ml-auto"><Bookmark size={13} strokeWidth={1.5} /></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Product Screenshot Section ---
const DemoFeed = () => {
  return (
    <section id="demo" className="py-16 md:py-24 lg:py-32 bg-background relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-10 md:mb-14">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6"
          >
            Your Feed, <span className="text-secondary/40">Your Way</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary font-mono text-xs md:text-sm leading-relaxed max-w-2xl mx-auto"
          >
            Articles, videos, discussions — pulled from hundreds of sources and filtered by your interests
          </motion.p>
        </div>

        {/* Product Screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="border-2 border-border bg-background shadow-2xl dark:shadow-gray-900/50 overflow-hidden">
            <img
              src="/feed.png"
              alt="Trace Feed - Personalized content from across the web"
              className="w-full h-auto"
            />
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-primary/40" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-10 md:mt-14"
        >
          <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 text-xs md:text-sm font-mono">
            <span className="text-foreground font-semibold">Choose your interests</span>
            <span className="text-primary">→</span>
            <span className="text-foreground font-semibold">Set your skill level</span>
            <span className="text-primary">→</span>
            <span className="text-foreground font-semibold">Get daily feed + newsletter</span>
            <span className="text-primary">→</span>
            <span className="text-foreground font-semibold">Stay ahead</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// --- Testimonials Section ---
const Testimonials = () => {
  const testimonials = [
    {
      quote: "I used to check Twitter, Reddit, and HN separately every morning. Now I open Trace once and I've got everything. It's like RSS but it actually works.",
      name: "Zeba",
      role: "AI Engineer"
    },
    {
      quote: "Trace catches things I would have completely missed — blog posts, threads, papers. It's like having a research assistant who knows exactly what I care about.",
      name: "Monisha",
      role: "Product Designer"
    },
    {
      quote: "I stopped worrying about missing important launches or discussions. If it matters for my interests, Trace finds it. That peace of mind is worth everything.",
      name: "Sebastian",
      role: "Indie Hacker"
    }
  ];

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4 md:mb-6"
          >
            What People <span className="text-secondary/50">Are Saying</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Real people who never miss what matters anymore
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all"
            >
              <blockquote className="text-sm md:text-base text-secondary leading-relaxed mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                <p className="text-xs text-secondary/70">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Feed Card Component ---
const FeedCard = ({ title, source, description, index }: { title: string; source: string; description: string; index: number }) => {
  const sources: Record<string, { icon: React.ElementType; name: string; color: string }> = {
    youtube: { icon: Youtube, name: 'YouTube', color: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' },
    github: { icon: Github, name: 'GitHub', color: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400' },
    arxiv: { icon: BookOpen, name: 'ArXiv', color: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' },
  };

  const sourceConfig = sources[source];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all group relative"
    >
      <div className="absolute top-4 right-4">
        <SourceBadge {...sourceConfig} />
      </div>
      <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-foreground shrink-0">
          <sourceConfig.icon size={18} strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-base md:text-lg font-semibold text-foreground mb-2 md:mb-3 line-clamp-2 pr-16">
        {title}
      </h3>
      <p className="text-sm text-secondary leading-relaxed line-clamp-3">
        {description}
      </p>
    </motion.div>
  );
};

// --- Living Feed Section ---
const LivingFeed = () => {
  const { user, profile } = useAuth();
  const isLoggedIn = !!user && profile?.onboarded;

  const feedItems = [
    {
      title: "How AI is Reshaping UX Design Workflows",
      source: "github",
      description: "Exploring the intersection of artificial intelligence and user experience—from generative design to predictive interfaces."
    },
    {
      title: "Vibecoding: Finding Your Flow State",
      source: "youtube",
      description: "Tips and techniques for creating the perfect coding environment, music, and mindset for deep, productive work sessions."
    },
    {
      title: "Attention Is All You Need",
      source: "arxiv",
      description: "The groundbreaking paper that introduced the transformer architecture, revolutionizing how we think about machine learning."
    },
  ];


  return (
    <section id="feed" className="py-16 md:py-24 lg:py-40 bg-background border-y border-border relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-serif font-light tracking-tighter text-foreground uppercase mb-3 md:mb-4 lg:mb-6 px-4">
            A Feed That <span className="text-secondary/40">Lives</span>
          </h2>
          <p className="text-secondary font-mono text-xs md:text-sm uppercase tracking-wider md:tracking-widest mb-4">
            {isLoggedIn
              ? `Curated for ${profile?.interests.length || 0}+ interests // Updated daily from hundreds of sources`
              : 'Content from across the entire web, curated around your interests and updated every day.'
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-16">
          {feedItems.map((item, i) => (
            <FeedCard key={i} {...item} index={i} />
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8 items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <Youtube size={16} className="md:hidden text-red-500" />
            <Youtube size={20} className="hidden md:block text-red-500" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">Videos</span>
          </div>
          <div className="w-px h-4 md:h-6 bg-border"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <BookOpen size={16} className="md:hidden text-blue-500" />
            <BookOpen size={20} className="hidden md:block text-blue-500" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">Research</span>
          </div>
          <div className="w-px h-4 md:h-6 bg-border"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <Github size={16} className="md:hidden text-purple-500" />
            <Github size={20} className="hidden md:block text-purple-500" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">Projects</span>
          </div>
          <div className="w-px h-4 md:h-6 bg-border"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <Sparkles size={16} className="md:hidden text-primary" />
            <Sparkles size={20} className="hidden md:block text-primary" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">Insights</span>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- Scroll Section Component with Mockups ---
const ScrollSection = ({ step }: { step: number; icon: React.ElementType; title: string; index: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Mockup content for each step
  const getMockup = () => {
    switch (step) {
      case 1: // Create Profile - Clean and spacious
        return (
          <div className="w-full h-full bg-background border-2 border-border p-4 md:p-6 lg:p-8 overflow-hidden flex flex-col justify-between">
            <div>
              <div className="border-b border-border pb-3 md:pb-4 mb-4 md:mb-6">
                <div className="text-[7px] md:text-[9px] font-mono uppercase tracking-widest text-primary mb-1 md:mb-2">STEP 1/4</div>
                <div className="text-base md:text-lg lg:text-xl font-serif font-light">Create Your Profile</div>
              </div>

              <div className="space-y-4 md:space-y-5 lg:space-y-6">
                {/* Interests */}
                <div>
                  <div className="text-[7px] md:text-[8px] lg:text-[9px] font-mono uppercase tracking-wider text-secondary mb-2 md:mb-3">
                    YOUR INTERESTS
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    <div className="px-2 py-1 md:px-3 md:py-1.5 bg-primary text-primary-foreground text-[8px] md:text-[9px] lg:text-[10px] font-mono">AI & ML</div>
                    <div className="px-2 py-1 md:px-3 md:py-1.5 bg-primary text-primary-foreground text-[8px] md:text-[9px] lg:text-[10px] font-mono">UX Design</div>
                    <div className="px-2 py-1 md:px-3 md:py-1.5 bg-primary text-primary-foreground text-[8px] md:text-[9px] lg:text-[10px] font-mono">Frontend</div>
                  </div>
                </div>

                {/* Content Preference Slider */}
                <div>
                  <div className="text-[7px] md:text-[8px] lg:text-[9px] font-mono uppercase tracking-wider text-secondary mb-2 md:mb-3">
                    CONTENT DEPTH
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary">Quick</span>
                      <span className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary">Deep</span>
                    </div>
                    <div className="relative h-1.5 md:h-2 bg-border rounded-full">
                      <div className="absolute top-1/2 -translate-y-1/2 left-[60%] w-3 h-3 md:w-4 md:h-4 bg-primary rounded-full border-2 border-background shadow-lg"></div>
                    </div>
                  </div>
                </div>

                {/* Hobbies */}
                <div>
                  <div className="text-[7px] md:text-[8px] lg:text-[9px] font-mono uppercase tracking-wider text-secondary mb-2 md:mb-3">
                    HOBBIES
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    <div className="px-2 py-1 md:px-3 md:py-1.5 bg-secondary/20 text-foreground text-[8px] md:text-[9px] lg:text-[10px] font-mono">Photography</div>
                    <div className="px-2 py-1 md:px-3 md:py-1.5 bg-secondary/20 text-foreground text-[8px] md:text-[9px] lg:text-[10px] font-mono">Running</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <div className="mt-4 md:mt-6">
              <div className="bg-primary text-primary-foreground py-2 md:py-3 text-[8px] md:text-[9px] font-mono uppercase tracking-wider md:tracking-widest text-center">Continue</div>
            </div>
          </div>
        );

      case 2: // Feed Generation - AI working mockup
        return (
          <div className="w-full h-full bg-background border-2 border-border p-4 md:p-6 flex flex-col items-center justify-center">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary text-primary-foreground flex items-center justify-center mb-3 md:mb-4 relative">
              <Brain size={24} className="md:hidden" />
              <Brain size={32} className="hidden md:block" />
              <motion.div
                className="absolute inset-0 border-2 border-primary"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="text-xs md:text-sm font-mono mb-2">Curating your feed...</div>
            <div className="w-full max-w-[150px] md:max-w-[200px] h-1 bg-border overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
            <div className="mt-4 md:mt-6 space-y-1.5 md:space-y-2 w-full">
              {['YouTube', 'Research Papers', 'Design Articles'].map((source, i) => (
                <div key={i} className="flex items-center gap-1.5 md:gap-2 text-[7px] md:text-[8px] font-mono text-secondary">
                  <Sparkles size={8} className="md:hidden text-primary" />
                  <Sparkles size={10} className="hidden md:block text-primary" />
                  Analyzing {source}
                </div>
              ))}
            </div>
          </div>
        );

      case 3: // Interact & Engage - Beautiful feed cards
        return (
          <div className="w-full h-full bg-background border-2 border-border overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-3 md:px-4 lg:px-6 py-2 md:py-3 lg:py-4 border-b border-border bg-background">
              <div className="text-base md:text-lg lg:text-xl font-serif font-light">Your Feed</div>
              <div className="text-[6px] md:text-[7px] lg:text-[8px] font-mono uppercase tracking-[0.2em] text-secondary hidden md:block">CURATED</div>
            </div>

            <div className="flex-1 p-3 md:p-4 lg:p-6 space-y-2 md:space-y-3 lg:space-y-4 overflow-hidden">
              {/* Feed Card 1 - Video */}
              <motion.div
                className="border border-border bg-background p-3 md:p-4 lg:p-5 hover:border-primary/50 transition-colors relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Bookmark in top right */}
                <button className="absolute top-2 right-2 md:top-3 md:right-3 lg:top-4 lg:right-4 p-1 hover:bg-primary/5 transition-colors">
                  <Bookmark size={12} className="md:hidden text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                  <Bookmark size={14} className="hidden md:block lg:hidden text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                  <Bookmark size={16} className="hidden lg:block text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                </button>

                <div className="flex gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-red-500/10 flex items-center justify-center shrink-0">
                    <Youtube size={16} className="md:hidden text-red-500" />
                    <Youtube size={20} className="hidden md:block lg:hidden text-red-500" />
                    <Youtube size={24} className="hidden lg:block text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-xs md:text-sm lg:text-base font-serif mb-1 line-clamp-1 font-medium">Building AI Agents That Work</div>
                    <div className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary mb-2">24 min • AI Jason</div>
                    <p className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary/80 leading-relaxed line-clamp-2 mb-3">
                      A practical guide to building production-ready AI agents with real-world examples and best practices.
                    </p>
                    <div className="flex gap-1.5 md:gap-2">
                      <button className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] md:text-xs">👍</span>
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] md:text-xs">👎</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Feed Card 2 - Article */}
              <motion.div
                className="border border-border bg-background p-3 md:p-4 lg:p-5 hover:border-primary/50 transition-colors relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {/* Bookmark in top right */}
                <button className="absolute top-2 right-2 md:top-3 md:right-3 lg:top-4 lg:right-4 p-1 hover:bg-primary/5 transition-colors">
                  <Bookmark size={12} className="md:hidden text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                  <Bookmark size={14} className="hidden md:block lg:hidden text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                  <Bookmark size={16} className="hidden lg:block text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                </button>

                <div className="flex gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-blue-500/10 flex items-center justify-center shrink-0">
                    <BookOpen size={16} className="md:hidden text-blue-500" />
                    <BookOpen size={20} className="hidden md:block lg:hidden text-blue-500" />
                    <BookOpen size={24} className="hidden lg:block text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-xs md:text-sm lg:text-base font-serif mb-1 line-clamp-1 font-medium">Modern UX Design Patterns</div>
                    <div className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary mb-2">8 min read • Nielsen Norman</div>
                    <p className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary/80 leading-relaxed line-clamp-2 mb-3">
                      Explore the latest UX patterns that drive engagement and improve user experience across digital products.
                    </p>
                    <div className="flex gap-1.5 md:gap-2">
                      <button className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] md:text-xs">👍</span>
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] md:text-xs">👎</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Feed Card 3 - Repo */}
              <motion.div
                className="border border-border bg-background p-3 md:p-4 lg:p-5 hover:border-primary/50 transition-colors relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {/* Bookmark in top right */}
                <button className="absolute top-2 right-2 md:top-3 md:right-3 lg:top-4 lg:right-4 p-1 hover:bg-primary/5 transition-colors">
                  <Bookmark size={12} className="md:hidden text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                  <Bookmark size={14} className="hidden md:block lg:hidden text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                  <Bookmark size={16} className="hidden lg:block text-foreground/60 hover:text-primary" strokeWidth={1.5} />
                </button>

                <div className="flex gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Github size={16} className="md:hidden text-purple-500" />
                    <Github size={20} className="hidden md:block lg:hidden text-purple-500" />
                    <Github size={24} className="hidden lg:block text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-xs md:text-sm lg:text-base font-serif mb-1 line-clamp-1 font-medium">shadcn/ui</div>
                    <div className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary mb-2">⭐ 45.2k • React Components</div>
                    <p className="text-[7px] md:text-[8px] lg:text-[9px] font-mono text-secondary/80 leading-relaxed line-clamp-2 mb-3">
                      Beautifully designed components built with Radix UI and Tailwind CSS. Copy, paste, and customize.
                    </p>
                    <div className="flex gap-1.5 md:gap-2">
                      <button className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] md:text-xs">👍</span>
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] md:text-xs">👎</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        );

      case 4: // Adaptive Learning - Real AI Intelligence
        return (
          <div className="w-full h-full bg-background border-2 border-border overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-5 border-b border-border bg-background">
              <div className="text-[8px] md:text-[9px] lg:text-xs font-mono uppercase tracking-wider md:tracking-widest text-primary mb-0.5 md:mb-1">STEP 4/4</div>
              <div className="text-base md:text-xl lg:text-2xl font-serif font-light">Adaptive Learning</div>
            </div>

            <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-3 md:space-y-4 lg:space-y-6 overflow-hidden">
              {/* Learning Profile */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="border-2 border-primary/40 bg-primary/5 p-3 md:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3 lg:mb-4">
                  <Brain size={16} className="md:hidden text-primary" />
                  <Brain size={20} className="hidden md:block lg:hidden text-primary" />
                  <Brain size={24} className="hidden lg:block text-primary" />
                  <div>
                    <div className="text-[8px] md:text-[10px] lg:text-sm font-mono uppercase tracking-wider text-primary mb-0.5 md:mb-1">LEARNING PROFILE</div>
                    <div className="text-xs md:text-base lg:text-lg font-serif">building &gt; theory</div>
                  </div>
                </div>
                <div className="text-[7px] md:text-[9px] lg:text-xs font-mono text-secondary leading-relaxed">
                  Prefers hands-on projects over theory
                </div>
              </motion.div>

              {/* Top Interests with Scores */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-[8px] md:text-[10px] lg:text-xs font-mono uppercase tracking-wider text-foreground/70 mb-2 md:mb-3 lg:mb-4">
                  TOP INTERESTS <span className="text-secondary/50 hidden md:inline">(BY ENGAGEMENT)</span>
                </div>
                <div className="space-y-2 md:space-y-2.5 lg:space-y-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-full bg-border h-6 md:h-7 lg:h-8 relative overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/20"
                        initial={{ width: 0 }}
                        animate={{ width: '80%' }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2 md:px-3">
                        <span className="text-[8px] md:text-[10px] lg:text-xs font-mono">LLM & AI</span>
                        <span className="text-[8px] md:text-[10px] lg:text-xs font-mono text-primary font-bold">80</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-full bg-border h-6 md:h-7 lg:h-8 relative overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/20"
                        initial={{ width: 0 }}
                        animate={{ width: '78%' }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2 md:px-3">
                        <span className="text-[8px] md:text-[10px] lg:text-xs font-mono">Memory</span>
                        <span className="text-[8px] md:text-[10px] lg:text-xs font-mono text-primary font-bold">78</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-full bg-border h-6 md:h-7 lg:h-8 relative overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/20"
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2 md:px-3">
                        <span className="text-[8px] md:text-[10px] lg:text-xs font-mono">Infra</span>
                        <span className="text-[8px] md:text-[10px] lg:text-xs font-mono text-primary font-bold">65</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Filtering & Excluding */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-start gap-2 md:gap-3"
              >
                <div className="text-lg md:text-xl lg:text-2xl">🚫 Filtering Out</div>
              </motion.div>

              {/* Source Mix */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <div className="text-[8px] md:text-[10px] lg:text-xs font-mono uppercase tracking-wider text-foreground/70 mb-2 md:mb-3">
                  CONTENT MIX
                </div>
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[8px] md:text-[10px] lg:text-xs font-mono">
                  <div className="flex items-center gap-1 md:gap-1.5">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500"></div>
                    <span>30% Video</span>
                  </div>
                  <div className="text-secondary">•</div>
                  <div className="flex items-center gap-1 md:gap-1.5">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-500"></div>
                    <span>20% Blogs</span>
                  </div>
                  <div className="text-secondary">•</div>
                  <div className="flex items-center gap-1 md:gap-1.5">
                    <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-500"></div>
                    <span>15% Repos</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={ref} className="min-h-[70vh] md:min-h-screen flex items-center justify-center py-12 md:py-20">
      <div className="relative w-full aspect-square max-w-[350px] md:max-w-[500px] shadow-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: isInView ? 1 : 0.5, scale: isInView ? 1 : 0.95 }}
          transition={{ duration: 0.5 }}
          className="w-full h-full"
        >
          {getMockup()}
        </motion.div>

        {/* Step indicator */}
        <div className="absolute -bottom-8 md:-bottom-12 left-0 right-0 text-center">
          <div className="text-[9px] md:text-[10px] font-mono uppercase tracking-[0.25em] md:tracking-[0.3em] text-primary">
            STEP 0{step}/04
          </div>
        </div>
      </div>
    </div>
  );
};

// --- What You Get Section (Outcomes) ---
// const WhatYouGet = () => {
//   const outcomes = [
//     {
//       icon: Clock,
//       title: "Save 2 hours every day.",
//       description: "Instead of checking Twitter, Reddit, HN, YouTube separately—open Trace once. 10-15 items. Done in 5 minutes. Back to building.",
//       stat: "2hrs",
//       statLabel: "Saved daily"
//     },
//     {
//       icon: Sparkles,
//       title: "Never miss viral threads.",
//       description: "Found Claude MCP announcement 2 days before it hit HN front page. The best content, before everyone else sees it.",
//       stat: "24-48h",
//       statLabel: "Ahead of the curve"
//     },
//     {
//       icon: RefreshCw,
//       title: "1,000+ sources. One feed.",
//       description: "We scan Hacker News, r/MachineLearning, r/Programming, top AI researchers on Twitter, arXiv, and 50+ engineering blogs. Every. Single. Day.",
//       stat: "1,000+",
//       statLabel: "Sources scanned daily"
//     },
//     {
//       icon: Brain,
//       title: "After 7 days, it knows you.",
//       description: "Trace learns you prefer hands-on tutorials over theory, code examples over blog posts, practical tools over thought leadership. Gets smarter with every interaction.",
//       stat: "7 days",
//       statLabel: "To personalize"
//     }
//   ];

//   return (
//     <section className="py-16 md:py-24 lg:py-40 bg-background border-y border-border relative overflow-hidden z-10">
//       <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
//         <div className="text-center mb-12 md:mb-16 lg:mb-20">
//           <motion.h2
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6"
//           >
//             What You <span className="text-secondary/40">Get</span>
//           </motion.h2>
//           <motion.p
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ delay: 0.1 }}
//             className="text-secondary font-mono text-xs md:text-sm leading-relaxed max-w-2xl mx-auto"
//           >
//             This isn't about features. It's about getting your time back.
//           </motion.p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 mb-12 md:mb-16">
//           {outcomes.map((outcome, i) => (
//             <motion.div
//               key={i}
//               initial={{ opacity: 0, y: 30 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ delay: i * 0.1 }}
//               className="border-2 border-border bg-background p-6 md:p-8 lg:p-10 hover:border-primary/40 transition-all group"
//             >
//               <div className="flex items-start gap-4 md:gap-5 mb-5 md:mb-6">
//                 <div className="w-12 h-12 md:w-14 md:h-14 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
//                   <outcome.icon size={24} className="md:hidden text-primary" strokeWidth={1.5} />
//                   <outcome.icon size={28} className="hidden md:block text-primary" strokeWidth={1.5} />
//                 </div>
//                 <div className="flex-1">
//                   <div className="text-right">
//                     <div className="text-2xl md:text-3xl font-serif font-light text-primary mb-1">
//                       {outcome.stat}
//                     </div>
//                     <div className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider text-secondary">
//                       {outcome.statLabel}
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <h3 className="text-xl md:text-2xl lg:text-3xl font-serif font-light text-foreground mb-3 md:mb-4 group-hover:text-primary transition-colors">
//                 {outcome.title}
//               </h3>
//               <p className="text-sm md:text-base font-mono text-secondary leading-relaxed">
//                 {outcome.description}
//               </p>
//             </motion.div>
//           ))}
//         </div>

//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           transition={{ delay: 0.4 }}
//           className="border-2 border-primary bg-primary/5 p-6 md:p-8 lg:p-10 max-w-4xl mx-auto"
//         >
//           <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
//             <div className="text-4xl md:text-5xl">⏱️</div>
//             <div className="flex-1">
//               <p className="text-base md:text-lg font-serif font-medium text-foreground mb-2">
//                 Will this actually save me time tomorrow morning?
//               </p>
//               <p className="text-xs md:text-sm font-mono text-secondary leading-relaxed">
//                 Yes. Instead of opening Twitter → Reddit → HN → YouTube → Repeat, you open Trace once. 10-15 curated items. Done in 5 minutes. Back to building.
//               </p>
//             </div>
//           </div>
//         </motion.div>
//       </div>
//     </section>
//   );
// };

// --- How It Works Section ---
// const HowItWorks = () => {
//   const [activeStep, setActiveStep] = useState(0);
//   const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

//   const steps = [
//     {
//       icon: User,
//       title: "Create Your Profile",
//       description: "Tell Trace about your interests, goals, and what you want to learn. Your profile is the foundation of your personalized feed."
//     },
//     {
//       icon: Brain,
//       title: "Feed Generation",
//       description: "Our AI agents curate content from across the web—videos, research, articles, projects, and insights specifically for you. Every item is hand-picked based on your profile."
//     },
//     {
//       icon: Activity,
//       title: "Interact & Engage",
//       description: "Star what you love, skip what you don't. Every interaction teaches Trace more about your preferences and patterns."
//     },
//     {
//       icon: RefreshCw,
//       title: "Adaptive Learning",
//       description: "Your feed evolves with you. As your interests shift and grow, Trace adapts in real-time, ensuring you always get what matters most."
//     }
//   ];

//   useEffect(() => {
//     const observers = sectionsRef.current.map((section, index) => {
//       const observer = new IntersectionObserver(
//         ([entry]) => {
//           if (entry.isIntersecting) {
//             setActiveStep(index);
//           }
//         },
//         { threshold: 0.5 }
//       );

//       if (section) {
//         observer.observe(section);
//       }

//       return observer;
//     });

//     return () => {
//       observers.forEach((observer) => observer.disconnect());
//     };
//   }, []);

//   return (
//     <section id="how" className="py-16 md:py-24 lg:py-40 bg-background relative z-10">
//       <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
//         <div className="mb-12 md:mb-16 lg:mb-20">
//           <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[80px] xl:text-[120px] font-serif font-light leading-[0.85] tracking-tighter text-foreground uppercase mb-4 md:mb-6 lg:mb-8">
//             How It <br /><span className="text-secondary/20">Works</span>
//           </h2>
//           <p className="text-secondary font-mono text-xs md:text-sm leading-relaxed max-w-xl">
//             A simple four-step journey to a feed that actually serves you. Your attention deserves better than algorithmic chaos.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 lg:gap-20">
//           {/* Sticky Left Side */}
//           <div className="lg:sticky lg:top-60 lg:h-fit">
//             <AnimatePresence mode="wait">
//               <motion.div
//                 key={activeStep}
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 exit={{ opacity: 0, y: -20 }}
//                 transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
//               >
//                 <div className="flex items-start gap-4 md:gap-6 mb-6 md:mb-8">
//                   <div className="w-12 h-12 md:w-16 md:h-16 bg-background border-2 border-primary flex items-center justify-center text-primary flex-shrink-0">
//                     {React.createElement(steps[activeStep].icon, { size: 24, strokeWidth: 1.5, className: "md:hidden" })}
//                     {React.createElement(steps[activeStep].icon, { size: 32, strokeWidth: 1.5, className: "hidden md:block" })}
//                   </div>
//                   <div className="font-mono text-xs md:text-sm text-primary pt-2 md:pt-4">
//                     STEP 0{activeStep + 1}/04
//                   </div>
//                 </div>

//                 <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tight text-foreground mb-4 md:mb-6 lg:mb-8 uppercase">
//                   {steps[activeStep].title}
//                 </h3>

//                 <p className="text-secondary font-mono text-sm md:text-base leading-relaxed max-w-lg mb-6 md:mb-8">
//                   {steps[activeStep].description}
//                 </p>

//                 <div className="flex gap-2 md:gap-3">
//                   {steps.map((_, i) => (
//                     <div
//                       key={i}
//                       className={cn(
//                         "h-1 flex-1 transition-all duration-500",
//                         i === activeStep ? "bg-primary" : "bg-border"
//                       )}
//                     />
//                   ))}
//                 </div>
//               </motion.div>
//             </AnimatePresence>
//           </div>

//           {/* Scrolling Right Side */}
//           <div className="space-y-0">
//             {steps.map((step, i) => (
//               <div key={i} ref={(el) => { sectionsRef.current[i] = el; }}>
//                 <ScrollSection
//                   step={i + 1}
//                   icon={step.icon}
//                   title={step.title}
//                   index={i}
//                 />
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// };

// --- Pricing Section ---
const Pricing = () => {
  const { user, profile, signInWithGoogle } = useAuth();
  const pricingCtaHref = user ? (profile?.onboarded ? '/feed' : '/onboarding') : null;
  const pricingCtaText = user
    ? (profile?.onboarded ? 'Go To Your Feed' : 'Personalize my feed')
    : 'Unlock full feed';

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4 md:mb-6">
            Simple <span className="text-secondary/50">Pricing</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl dark:shadow-gray-900/50 p-6 md:p-10 lg:p-12 mb-8"
        >
          <div className="text-center mb-8 md:mb-10">
            <div className="text-5xl md:text-6xl font-semibold text-foreground mb-2">
              $2.99<span className="text-2xl md:text-3xl text-secondary/60">/month</span>
            </div>
            <p className="text-sm text-secondary mb-2">
              after 3-day free trial
            </p>
            <p className="text-xs text-primary font-medium">
              ☕ Less than a single coffee for a whole month
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-8 md:mb-10">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                Daily personalized email digest
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                Content from 1,000+ sources, curated for you
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                Feed that learns and gets better over time
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                Unlimited bookmarks &amp; summaries
              </div>
            </div>
          </div>

          <div className="text-center">
            {pricingCtaHref ? (
              <a href={pricingCtaHref}>
                <button className="bg-accent text-accent-foreground px-10 py-4 rounded-full text-sm font-medium hover:bg-accent/90 transition-all active:scale-[0.98] w-full md:w-auto">
                  {pricingCtaText}
                </button>
              </a>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="bg-accent text-accent-foreground px-10 py-4 rounded-full text-sm font-medium hover:bg-accent/90 transition-all active:scale-[0.98] w-full md:w-auto"
              >
                {pricingCtaText}
              </button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <p className="text-sm text-secondary mb-3">
            Cancel anytime. No credit card charged until day 4.
          </p>
          <p className="text-sm text-secondary">
            Questions? We&apos;re humans: <a href="mailto:yourtrace.online@gmail.com" className="text-primary hover:underline">yourtrace.online@gmail.com</a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

// --- Get Started Section ---
const GetStarted = () => {
  const { user, profile, signInWithGoogle } = useAuth();
  const alphaMode = isAlphaMode();

  const getCtaLink = () => {
    if (!user) return '#';
    if (!alphaMode) return '/waitlist';
    if (!profile?.onboarded) return '/onboarding';
    return '/feed';
  };

  const getCtaText = () => {
    if (!user) return 'Unlock full feed';
    if (!alphaMode) return 'View Waitlist Status';
    if (!profile?.onboarded) return 'Personalize my feed';
    return 'Go To Your Feed';
  };

  const getStatusText = () => {
    if (!user) return '';
    if (!alphaMode) return "✓ You're on the waitlist";
    if (!profile?.onboarded) return 'Tell us 3 topics you care about';
    return '✓ Signed in successfully';
  };

  return (
    <section id="get-started" className="py-16 md:py-24 lg:py-40 bg-background z-10 relative">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 md:mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4 md:mb-6">
              Start Your <span className="text-secondary/50">Free Trial</span>
            </h2>
            <p className="text-secondary text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              {user
                ? profile?.onboarded
                  ? "Your personalized feed awaits."
                  : "30 seconds to set up. Then you'll see your first feed."
                : "Sign in → Tell us 3 topics → See your feed."
              }
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-lg dark:shadow-gray-900/50 p-6 md:p-10 lg:p-12"
          >
            {user ? (
              <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col items-center gap-3 md:gap-4">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="Profile" className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-gray-200 dark:border-gray-800" />
                  )}
                  <div>
                    <p className="text-lg md:text-xl font-semibold text-foreground mb-1">{profile?.name || user.displayName}</p>
                    <p className="text-sm text-secondary">{user.email}</p>
                  </div>
                </div>
                <div className={`py-4 md:py-5 rounded-xl text-sm font-medium ${profile?.onboarded ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'}`}>
                  {getStatusText()}
                </div>
                <a href={getCtaLink()}>
                  <button className="w-full bg-accent text-accent-foreground py-4 md:py-5 rounded-full text-sm font-medium hover:bg-accent/90 transition-all active:scale-[0.98]">
                    {getCtaText()}
                  </button>
                </a>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col items-center gap-4 md:gap-5">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
                    <Sparkles size={32} className="md:hidden" strokeWidth={1.5} />
                    <Sparkles size={40} className="hidden md:block" strokeWidth={1.5} />
                  </div>
                  <p className="text-base text-secondary text-center">
                    3-day free trial. No credit card required.
                  </p>
                </div>
                <button
                  onClick={signInWithGoogle}
                  className="w-full bg-accent text-accent-foreground py-4 md:py-5 rounded-full text-sm font-medium hover:bg-accent/90 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Unlock full feed
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- Footer Component ---
const Footer = () => (
  <footer className="py-12 md:py-16 lg:py-20 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-10 relative">
    <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start gap-10 md:gap-12 lg:gap-16 mb-12 md:mb-16 lg:mb-20">
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="text-xl md:text-2xl text-foreground uppercase flex items-center gap-3 md:gap-4 tracking-[0.1em] font-semibold">
            <img
              src="/trace.png"
              alt="Trace Logo"
              className="h-7 md:h-9 w-auto object-contain"
            />
            TRACE
          </div>
          <p className="text-secondary text-sm leading-relaxed max-w-[240px]">
            Your RSS for the web. One feed with content from hundreds of sources, curated around your interests.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 lg:gap-24 w-full md:w-auto">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4 md:mb-5">Product</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <Link href="#get-started" className="text-sm text-secondary hover:text-foreground transition-colors">Unlock full feed</Link>
              <Link href="/trending" className="text-sm text-secondary hover:text-foreground transition-colors">Trending Topics</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4 md:mb-5">Legal</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <a href="/privacy-policy" className="text-sm text-secondary hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="text-sm text-secondary hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4 md:mb-5">Connect</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="text-sm text-secondary hover:text-foreground transition-colors">Twitter</a>
              <a href="https://github.com/TarunTomar122" target="_blank" rel="noopener noreferrer" className="text-sm text-secondary hover:text-foreground transition-colors">GitHub</a>
              <a href="mailto:yourtrace.online@gmail.com" className="text-sm text-secondary hover:text-foreground transition-colors">Email</a>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 md:pt-10 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
        <div className="text-sm text-secondary text-center md:text-left">
          © 2026 Trace — Built with intention
        </div>
      </div>
    </div>
  </footer>
);

// --- Main Landing Page ---
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-2 selection:bg-primary/20 selection:text-primary font-serif antialiased">
      <GridBackground />
      <WaitlistBanner />
      <Nav />
      <Hero />
      <NewsletterSignupSection />
      {/* <DemoVideo /> */}
      <HowItWorks />
      {/* <InteractiveDemo />
      <DemoFeed /> */}
      <WhatTraceReplaces />
      {/* <HowPeopleUseTrace /> */}
      <Testimonials />
      {/* <WhatYouGet /> */}
      <Pricing />
      <GetStarted />
      <Footer />
    </div>
  );
}
