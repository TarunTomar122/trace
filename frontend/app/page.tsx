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
  Activity,
  Layers,
  User,
  RefreshCw,
  Menu,
  X,
  LogOut,
  Mail,
  Clock,
  Bookmark,
  MessageCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Waitlist Banner Component ---
const WaitlistBanner = () => {
  if (isAlphaMode()) return null;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-60 bg-primary/10 border-b border-primary/20 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-sm">
          <Clock className="text-primary" size={16} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-foreground">
            <span className="text-primary font-bold">Early Access</span> — We're launching soon! Sign up now to secure your spot.
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
  const { user, profile, signInWithGoogle, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showBanner = !isAlphaMode();

  return (
    <nav className={cn(
      "fixed left-0 right-0 z-50 transition-all duration-700 ease-in-out",
      showBanner ? "top-[40px]" : "top-0",
      scrolled || showBanner ? "translate-y-0" : "md:translate-y-4"
    )}>
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "bg-background/95 backdrop-blur-md w-full transition-all duration-700 ease-in-out",
            scrolled
              ? "border-x border-b border-border shadow-sm p-4 py-3 rounded-none"
              : "border-transparent py-6 md:py-8 rounded-sm p-4"
          )}
        >
          <div className="flex items-center justify-between w-full">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Desktop Left Nav */}
            <div className="hidden md:flex items-center gap-1 flex-1">
              {!user && (
                <a href="#how" className="hover:text-primary hover:border-b px-4 py-2 text-[10px] tracking-[0.3em] uppercase transition-colors text-secondary font-mono">
                  How It Works
                </a>
              )}
              {user ? (
                <a href="/feed" className="hover:text-primary hover:border-b px-4 py-2 text-[10px] tracking-[0.3em] uppercase transition-colors text-secondary font-mono">
                  Your Feed
                </a>
              ) : (
                <>
                  <a href="/trending" className="hover:text-primary hover:border-b px-4 py-2 text-[10px] tracking-[0.3em] uppercase transition-colors text-secondary font-mono">
                    Trending Topics
                  </a>
                </>
              )}
            </div>

            {/* Logo - Centered */}
            <div className="text-lg md:text-xl text-foreground uppercase flex items-center gap-3 md:gap-4 tracking-[0.15em] font-serif font-black group cursor-default md:absolute md:left-1/2 md:-translate-x-1/2">
              <img
                src="/trace.png"
                alt="Trace Logo"
                className="h-6 md:h-7 w-auto object-contain"
              />
              TRACE
            </div>

            {/* Desktop Right Nav */}
            <div className="hidden md:flex items-center gap-4 flex-1 justify-end">
              {user ? (
                <div className="flex items-center gap-4">
                  <Link href="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    {user.photoURL && (
                      <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                    )}
                    <span className="text-[10px] tracking-[0.2em] uppercase font-mono text-secondary">
                      {profile?.name?.split(' ')[0] || user.displayName?.split(' ')[0]}
                    </span>
                  </Link>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 border border-border text-foreground px-6 py-3 text-[10px] tracking-[0.25em] uppercase font-mono font-bold transition-all hover:border-primary active:scale-95"
                  >
                    <LogOut size={12} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-primary text-primary-foreground px-8 py-3 text-[10px] tracking-[0.25em] uppercase font-mono font-bold transition-all hover:tracking-[0.4em] active:scale-95"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile CTA */}
            <div className="md:hidden">
              {user ? (
                <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full" />
                  )}
                </Link>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[9px] tracking-[0.2em] uppercase font-mono font-bold"
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
                transition={{ duration: 0.3 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pt-6 pb-2 flex flex-col gap-4 border-t border-border mt-4">
                  {!user && (
                    <a
                      href="#how"
                      className="text-[10px] tracking-[0.3em] uppercase text-secondary font-mono hover:text-primary transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      How It Works
                    </a>
                  )}
                  {user ? (
                    <a
                      href="/feed"
                      className="text-[10px] tracking-[0.3em] uppercase text-secondary font-mono hover:text-primary transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Your Feed
                    </a>
                  ) : (
                    <>
                      <a
                        href="/trending"
                        className="text-[10px] tracking-[0.3em] uppercase text-secondary font-mono hover:text-primary transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Trending
                      </a>
                    </>
                  )}
                  {user ? (
                    <button
                      onClick={() => { signOut(); setMobileMenuOpen(false); }}
                      className="text-[10px] tracking-[0.3em] uppercase text-secondary font-mono hover:text-primary transition-colors text-left flex items-center gap-2"
                    >
                      <LogOut size={12} />
                      Sign Out
                    </button>
                  ) : (
                    <button
                      onClick={() => { signInWithGoogle(); setMobileMenuOpen(false); }}
                      className="text-[10px] tracking-[0.3em] uppercase text-secondary font-mono hover:text-primary transition-colors text-left"
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
  const heroCtaText = isLoggedIn && !isOnboarded ? 'Complete Setup' : 'Start Free Trial';

  return (
    <section className="relative pt-28 pb-16 md:pt-36 lg:pt-60 md:pb-24 lg:pb-40 overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side - Content */}
          <div className="flex flex-col sm:mt-4">
            {isOnboarded ? (
              // Logged-in user view
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[0.9] font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6 lg:mb-8"
                >
                  Your Feed <br />
                  <span className="text-secondary/40 italic">Awaits</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="text-sm md:text-base lg:text-lg text-secondary font-mono leading-relaxed mb-6 md:mb-8 lg:mb-10 max-w-lg"
                >
                  Your personalized feed curated from across the web is ready.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="flex flex-col sm:flex-row gap-3 md:gap-4"
                >
                  <a href="/feed" className="w-full sm:w-auto">
                    <button className="group relative bg-primary text-primary-foreground px-8 py-3.5 md:px-10 md:py-4 text-[9px] md:text-[10px] font-semibold tracking-[0.2em] md:tracking-[0.25em] uppercase transition-all overflow-hidden font-mono w-full">
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        View Your Feed
                        <ChevronRight size={12} />
                      </span>
                      <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-primary/20 transition-transform duration-300" />
                    </button>
                  </a>
                </motion.div>
              </>
            ) : (
              // New or not-onboarded user view
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[0.9] font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6 lg:mb-8"
                >
                  Fu*k The Algorithms <br />
                  <span className="text-secondary/40 italic text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">Build Your Own Feed</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="text-sm md:text-base lg:text-lg text-secondary font-mono leading-relaxed mb-2 max-w-lg"
                >
                  {isAlphaMode()
                    ? "Every morning, we scan Hacker News, Reddit, Twitter, YouTube, arXiv, and 50+ blogs. You get the 10-15 things that actually matter."
                    : "Join the waitlist to get early access. We scan 1,000+ sources daily so you don't have to."
                  }
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.45 }}
                  className="mt-2 mb-6 md:mb-8 p-3 md:p-4 bg-primary/5 border border-primary/20 inline-flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-primary/20 flex items-center justify-center shrink-0">
                    <Mail className="text-primary" size={16} />
                  </div>
                  <div className="text-xs md:text-sm font-mono">
                    <span className="text-primary font-semibold">Now delivered as a daily email.</span>
                    <span className="text-foreground/70 block sm:inline"> Read it. Close it. Done.</span>
                  </div>
                </motion.div>

                {!isAlphaMode() && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="mb-4 md:mb-6 p-3 md:p-4 bg-primary/5 border border-primary/20 rounded-sm"
                  >
                    <div className="flex items-start gap-2 md:gap-3">
                      <Mail className="text-primary mt-0.5 shrink-0" size={14} />
                      <div className="text-xs font-mono text-secondary leading-relaxed">
                        <span className="text-foreground font-semibold">Early signups welcome!</span> We'll notify you via email as soon as Trace goes live. No spam, just one email when we're ready.
                      </div>
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="flex flex-col sm:flex-row gap-3 md:gap-4"
                >
                  {heroCtaHref ? (
                    <a href={heroCtaHref} className="w-full sm:w-auto">
                      <button className="group relative bg-primary text-primary-foreground px-8 py-3.5 md:px-10 md:py-4 text-[9px] md:text-[10px] font-semibold tracking-[0.2em] md:tracking-[0.25em] uppercase transition-all overflow-hidden font-mono w-full">
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {heroCtaText}
                          <ChevronRight size={12} />
                        </span>
                        <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-primary/20 transition-transform duration-300" />
                      </button>
                    </a>
                  ) : (
                    <button
                      onClick={signInWithGoogle}
                      className="group relative bg-primary text-primary-foreground px-8 py-3.5 md:px-10 md:py-4 text-[9px] md:text-[10px] font-semibold tracking-[0.2em] md:tracking-[0.25em] uppercase transition-all overflow-hidden font-mono w-full sm:w-auto"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {heroCtaText}
                        <ChevronRight size={12} />
                      </span>
                      <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-primary/20 transition-transform duration-300" />
                    </button>
                  )}
                  <a href="/trending" className="w-full sm:w-auto">
                    <button className="flex items-center justify-center gap-2 text-foreground hover:text-primary transition-colors text-[9px] md:text-[10px] font-mono uppercase tracking-[0.2em] md:tracking-[0.25em] px-8 py-3.5 md:px-10 md:py-4 border border-border hover:border-primary w-full">
                      See Trending Topics <ChevronRight size={12} />
                    </button>
                  </a>
                </motion.div>
              </>
            )}
          </div>

          {/* Right Side - Flow Diagram */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="block"
          >
            <FlowDiagram />
            <div className="flex flex-row justify-center items-center gap-2">
              <a href="https://www.producthunt.com/products/trace-23?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-trace-529d0891-421d-450f-8263-879fe3b9370c" target="_blank" rel="noopener noreferrer">
                <img alt="Trace - Trace brings content from across the web into one quiet feed | Product Hunt" style={{ width: 'auto', height: '42px' }} src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1064894&amp;theme=light&amp;t=1768817161765" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- What Trace Replaces Section ---
const WhatTraceReplaces = () => {
  const habits = [
    {
      icon: "🔄",
      title: "Doomscrolling Twitter/X",
      description: "for tech news and AI updates"
    },
    {
      icon: "📱",
      title: "Checking Reddit 5x/day",
      description: "/r/MachineLearning, /r/Programming, /r/WebDev..."
    },
    {
      icon: "💬",
      title: "Missing good HN discussions",
      description: "You see it 2 days late in your group chat"
    },
    {
      icon: "🎥",
      title: "YouTube rabbit holes",
      description: "Looking for that one tutorial, losing 2 hours"
    },
    {
      icon: "📰",
      title: "Forgetting your favorite blogs",
      description: "You mean to check them... but never do"
    },
    {
      icon: "⏰",
      title: "The 'I should check...' loop",
      description: "Twitter → Reddit → HN → Repeat"
    }
  ];

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background border-y border-border relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-3 md:mb-4"
          >
            What Trace <span className="text-secondary/40">Replaces</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary font-mono text-xs md:text-sm leading-relaxed max-w-2xl mx-auto"
          >
            If you recognize these habits, Trace is for you
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {habits.map((habit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border bg-background p-5 md:p-6 hover:border-primary/40 transition-all group"
            >
              <div className="text-3xl mb-3">{habit.icon}</div>
              <h3 className="text-base md:text-lg font-serif font-medium text-foreground mb-2 group-hover:text-primary transition-colors">
                {habit.title}
              </h3>
              <p className="text-xs md:text-sm font-mono text-secondary leading-relaxed">
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
    <section className="py-16 md:py-24 lg:py-32 bg-background border-t border-border relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
        <div className="text-center mb-10 md:mb-14">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6"
          >
            How People <span className="text-secondary/40 italic">Actually</span> Use Trace
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary font-mono text-sm md:text-base"
          >
            Most people don&apos;t open another app. They open their inbox.
          </motion.p>
        </div>

        {/* Email Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="border border-border bg-background mb-10 md:mb-14"
        >
          {/* Email Header */}
          <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs md:text-sm font-mono text-foreground font-medium">Trace Daily</div>
                <div className="text-[10px] md:text-xs font-mono text-secondary">digest@trace.club</div>
              </div>
            </div>
            <div className="text-sm md:text-base font-serif text-foreground">
              Your Morning Digest — Jan 28, 2025
            </div>
          </div>

          {/* Email Body Preview */}
          <div className="px-4 md:px-6 py-4 md:py-6 space-y-3">
            {[
              { icon: "🎬", title: "Building AI agents with LangGraph", source: "YouTube" },
              { icon: "💬", title: "Show HN: Minimal MCP server for Postgres", source: "Hacker News" },
              { icon: "📦", title: "anthropics/courses: Prompt engineering tutorial", source: "GitHub" },
              { icon: "📄", title: "New research on transformer architectures", source: "arXiv" },
              { icon: "📝", title: "How Stripe builds reliable systems", source: "Blog" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <div className="text-sm font-mono text-foreground">{item.title}</div>
                  <div className="text-[10px] font-mono text-secondary uppercase tracking-wider">{item.source}</div>
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
          <p className="text-sm md:text-base font-mono text-secondary leading-relaxed mb-6">
            Every morning, Trace sends you one email.<br />
            The best things from Reddit, Hacker News, YouTube, blogs, and research —<br />
            filtered for your interests and skill level.
          </p>
          <div className="flex flex-col items-center gap-1 text-xs md:text-sm font-mono text-foreground/70">
            <span>No scrolling.</span>
            <span>No notifications.</span>
            <span className="text-primary">5 minutes. You&apos;re done.</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// --- Source Badge Component ---
const SourceBadge = ({ icon: Icon, name, color }: { icon: React.ElementType; name: string; color: string }) => (
  <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest", color)}>
    <Icon size={10} />
    {name}
  </div>
);

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
            Articles, videos, discussions — all filtered by your interests and skill level
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
          <div className="border-2 border-border bg-background shadow-2xl overflow-hidden">
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
      quote: "Trace has become the first thing I open every morning. The daily newsletter is incredibly useful — it helps me make the most of my mornings and stay up to date with what's happening in tech, all in one quick email.",
      name: "Zeba",
      role: "AI Engineer @ Dell"
    },
    {
      quote: "As a designer, I'm not an engineer — but Trace shows me AI releases and tech updates at a level I can actually understand. It's helping me learn and stay relevant without feeling overwhelmed.",
      name: "Monisha",
      role: "Designer"
    },
    {
      quote: "I'm constantly finding useful blogs and videos about my interests and hobbies through Trace. It's saving me hours of searching and helping me upskill in ways I didn't expect.",
      name: "Sebastian",
      role: "Indie Developer"
    }
  ];

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background border-t border-border relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6"
          >
            What People <span className="text-secondary/40">Say</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary font-mono text-xs md:text-sm leading-relaxed max-w-2xl mx-auto"
          >
            Builders, makers, and curious minds who use Trace daily
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-border bg-background p-6 md:p-8 hover:border-primary/30 transition-all group"
            >
              <blockquote className="text-sm md:text-base font-mono text-secondary leading-relaxed mb-6 italic">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-serif font-medium text-foreground">{testimonial.name}</p>
                <p className="text-xs font-mono text-secondary/70">{testimonial.role}</p>
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
    youtube: { icon: Youtube, name: 'YouTube', color: 'bg-red-500/10 text-red-600 border border-red-500/20' },
    github: { icon: Github, name: 'GitHub', color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20' },
    arxiv: { icon: BookOpen, name: 'ArXiv', color: 'bg-blue-500/10 text-blue-600 border border-blue-500/20' },
  };

  const sourceConfig = sources[source];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="bg-background border border-border p-5 md:p-6 lg:p-8 hover:border-primary/40 transition-all duration-500 group relative"
    >
      <div className="absolute top-3 right-3 md:top-4 md:right-4">
        <SourceBadge {...sourceConfig} />
      </div>
      <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-background border border-border flex items-center justify-center text-foreground group-hover:border-primary/20 transition-colors flex-shrink-0">
          <sourceConfig.icon size={16} className="md:hidden" strokeWidth={1.5} />
          <sourceConfig.icon size={20} className="hidden md:block" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-base md:text-lg lg:text-xl font-serif tracking-tight text-foreground mb-2 md:mb-3 line-clamp-2 pr-16">
        {title}
      </h3>
      <p className="text-xs md:text-sm font-mono text-secondary leading-relaxed line-clamp-3">
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
              ? `Curated for ${profile?.interests.length || 0}+ interests // Real-time adaptation`
              : 'It learns from your interactions, understands your patterns, and updates itself daily.'
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
    ? (profile?.onboarded ? 'Go To Your Feed' : 'Complete Setup')
    : 'Start Free Trial';

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background border-y border-border relative z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6">
            Simple <span className="text-secondary/40">Pricing</span>
          </h2>
          <p className="text-secondary font-mono text-sm md:text-base leading-relaxed mb-8 md:mb-12">
            Try free for 3 days. Then $2.99/month. Cancel anytime.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="border-2 border-primary bg-primary/5 p-6 md:p-8 lg:p-10 mb-8"
        >
          <div className="text-center mb-6 md:mb-8">
            <div className="text-4xl md:text-5xl font-serif font-light text-foreground mb-2">
              $2.99<span className="text-xl md:text-2xl text-secondary">/month</span>
            </div>
            <p className="text-xs md:text-sm font-mono text-secondary">
              after 3-day free trial
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="text-sm font-mono text-foreground">
                Daily personalized email digest
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="text-sm font-mono text-foreground">
                AI learns from your interactions
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="text-sm font-mono text-foreground">
                Unlimited bookmarks
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              <div className="text-sm font-mono text-foreground">
                All 1,000+ sources included
              </div>
            </div>
          </div>

          <div className="text-center">
            {pricingCtaHref ? (
              <a href={pricingCtaHref}>
                <button className="bg-primary text-primary-foreground px-10 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.3em] hover:bg-primary/90 transition-all active:scale-[0.98] w-full md:w-auto">
                  {pricingCtaText}
                </button>
              </a>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="bg-primary text-primary-foreground px-10 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.3em] hover:bg-primary/90 transition-all active:scale-[0.98] w-full md:w-auto"
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
          <p className="text-xs font-mono text-secondary mb-4">
            Cancel anytime before trial ends. No credit card charged until day 4.
          </p>
          <p className="text-xs font-mono text-secondary">
            Questions? We&apos;re humans: <a href="mailto:tomartarun2001@gmail.com" className="text-primary hover:underline">tomartarun2001@gmail.com</a>
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
    if (!user) return 'Start Free Trial';
    if (!alphaMode) return 'View Waitlist Status';
    if (!profile?.onboarded) return 'Complete Setup';
    return 'Go To Your Feed';
  };

  const getStatusText = () => {
    if (!user) return '';
    if (!alphaMode) return "✓ YOU'RE ON THE WAITLIST";
    if (!profile?.onboarded) return 'TELL US 3 TOPICS YOU CARE ABOUT';
    return '✓ SIGNED IN SUCCESSFULLY';
  };

  return (
    <section id="get-started" className="py-16 md:py-24 lg:py-40 bg-background border-t border-border z-10 relative">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 md:mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tighter text-foreground uppercase mb-4 md:mb-6">
              Start Your <span className="text-secondary/40">Free Trial</span>
            </h2>
            <p className="text-secondary font-mono text-sm md:text-base leading-relaxed max-w-xl mx-auto">
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
            className="bg-background border-2 border-border p-6 md:p-10 lg:p-12"
          >
            {user ? (
              <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col items-center gap-3 md:gap-4">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="Profile" className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-primary" />
                  )}
                  <div>
                    <p className="text-lg md:text-xl font-serif text-foreground mb-1">{profile?.name || user.displayName}</p>
                    <p className="text-[9px] md:text-[10px] font-mono uppercase tracking-widest text-secondary">{user.email}</p>
                  </div>
                </div>
                <div className={`py-4 md:py-5 border font-mono text-xs md:text-sm tracking-wider ${profile?.onboarded ? 'border-primary bg-primary/5 text-primary' : 'border-amber-500 bg-amber-500/5 text-amber-600'}`}>
                  {getStatusText()}
                </div>
                <a href={getCtaLink()}>
                  <button className="w-full bg-primary text-primary-foreground py-4 md:py-5 text-[10px] font-mono font-bold uppercase tracking-[0.3em] hover:bg-primary/90 transition-all active:scale-[0.98]">
                    {getCtaText()}
                  </button>
                </a>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                <div className="flex flex-col items-center gap-4 md:gap-5">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Sparkles size={32} className="md:hidden" strokeWidth={1.5} />
                    <Sparkles size={40} className="hidden md:block" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm md:text-base font-mono text-secondary text-center">
                    3-day free trial. No credit card required.
                  </p>
                </div>
                <button
                  onClick={signInWithGoogle}
                  className="w-full bg-primary text-primary-foreground py-4 md:py-6 text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[0.3em] md:tracking-[0.4em] hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 md:gap-3"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Start Free Trial
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
  <footer className="py-12 md:py-16 lg:py-20 bg-background border-t border-border z-10 relative">
    <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start gap-10 md:gap-12 lg:gap-16 mb-12 md:mb-16 lg:mb-20">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="text-xl md:text-2xl text-foreground uppercase flex items-center gap-3 md:gap-4 tracking-[0.15em] font-serif font-black">
            <img
              src="/trace.png"
              alt="Trace Logo"
              className="h-7 md:h-9 w-auto object-contain"
            />
            TRACE
          </div>
          <p className="text-secondary font-mono text-[9px] md:text-[10px] uppercase tracking-wider md:tracking-widest leading-relaxed max-w-[200px] md:max-w-[240px]">
            Build your own feed with content from across the web
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 lg:gap-24 w-full md:w-auto">
          <div>
            <h4 className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-foreground mb-4 md:mb-6">Product</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <a href="#demo" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">See Example Feed</a>
              <a href="#get-started" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">Start Free Trial</a>
              <a href="/trending" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">Trending Topics</a>
            </div>
          </div>
          <div>
            <h4 className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-foreground mb-4 md:mb-6">Legal</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <a href="/privacy-policy" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">Privacy Policy</a>
              <a href="/terms" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">Terms of Service</a>
            </div>
          </div>
          <div>
            <h4 className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-foreground mb-4 md:mb-6">Connect</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">Twitter</a>
              <a href="https://github.com/TarunTomar122" target="_blank" rel="noopener noreferrer" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">GitHub</a>
              <a href="mailto:tomartarun2001@gmail.com" className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary hover:text-primary transition-colors">Email</a>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 md:pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
        <div className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary text-center md:text-left">
          © 2026 TRACE // BUILT WITH INTENTION
        </div>
        <div className="flex gap-4">
          <div className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            ALPHA - v0.1.0
          </div>
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
      <DemoFeed />
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
