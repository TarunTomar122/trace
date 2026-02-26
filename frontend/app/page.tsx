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
  Search,
  TrendingUp,
  Flame,
  Crosshair,
  GraduationCap,
} from 'lucide-react';
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

// --- Badge Marquee Component ---
const BadgeMarquee = () => {
  const badges = [
    {
      src: "https://neeed.directory/badges/neeed-badge-light.svg",
      darkSrc: "https://neeed.directory/badges/neeed-badge-dark.svg",
      alt: "Featured on neeed.directory",
      href: "https://neeed.directory/products/trace?utm_source=trace",
      width: 140,
      height: 40,
    },
    {
      src: "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1064894&amp;theme=light&amp;t=1770707483335",
      alt: "Featured on Product Hunt",
      href: "https://www.producthunt.com/products/trace-23/launches/trace-529d0891-421d-450f-8263-879fe3b9370c?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-trace-529d0891-421d-450f-8263-879fe3b9370c",
      width: 190,
      height: 41,
    },
    {
      src: "https://foundrlist.com/api/badge/trace",
      alt: "Live on FoundrList",
      href: "https://foundrlist.com/product/trace",
      width: 106,
      height: 40,
    },
    // Add more badges here as you get featured on more platforms
    // {
    //   src: "https://producthunt.com/badge.svg",
    //   alt: "Featured on Product Hunt",
    //   href: "https://producthunt.com/...",
    //   width: 139,
    // },
  ];

  // Duplicate badges for seamless loop
  const duplicatedBadges = [...badges, ...badges];

  return (
    <div className="overflow-hidden py-6 relative">
      <div className="flex gap-8 animate-marquee">
        {duplicatedBadges.map((badge, idx) => (
          <a
            key={idx}
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <img
              src={badge.src}
              alt={badge.alt}
              width={badge.width}
              height={badge.height}
              className="h-auto dark:hidden"
            />
            {badge.darkSrc && (
              <img
                src={badge.darkSrc}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
                className="h-auto hidden dark:block"
              />
            )}
            {!badge.darkSrc && (
              <img
                src={badge.src}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
                className="h-auto hidden dark:block"
              />
            )}
          </a>
        ))}
      </div>
      {/* Gradient fades on sides */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
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
  const { user, profile, signInWithGoogle, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
                <Link href="#what-trace-replaces" className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  How it works
                </Link>
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
            <Link href="/" className="flex items-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2">
              <img src="/trace.webp" alt="Trace" width={120} height={32} className="h-6 w-auto md:h-7" />
              <span className="text-sm md:text-base font-semibold tracking-[0.12em] text-foreground">TRACE</span>
            </Link>

            {/* Desktop Right Nav */}
            <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
              {user ? (
                <div className="flex items-center gap-3">
                  <Link href="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    {user.photoURL && (
                      <img src={user.photoURL} alt="Profile" width={32} height={32} className="w-8 h-8 rounded-full" loading="lazy" />
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
              {user ? (
                <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="Profile" width={32} height={32} className="w-8 h-8 rounded-full" loading="lazy" />
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
                      href="#what-trace-replaces"
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      How it works
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


// --- Hero Component ---
const Hero = () => {
  const { user, profile, signInWithGoogle } = useAuth();
  const isLoggedIn = !!user;
  const isOnboarded = !!user && !!profile?.onboarded;
  const heroCtaHref = isLoggedIn && !isOnboarded ? '/onboarding' : null;
  const heroCtaText = isLoggedIn && !isOnboarded ? 'Personalize my feed' : 'Start reading for free';

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
                  className="text-base md:text-lg text-secondary leading-relaxed mb-4 max-w-lg"
                >
                  Trending news, personalized articles, and expert deep dives — refreshed daily just for you.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="flex flex-wrap gap-2 mb-6 md:mb-8"
                >
                  {[
                    { label: "Trending", desc: "What's hot today" },
                    { label: "For You", desc: "Matched to your interests" },
                    { label: "Deep Dives", desc: "Worth your time" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30"
                    >
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{item.label}</span>
                      <span className="text-xs text-secondary/60 ml-1.5">{item.desc}</span>
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3 mb-6"
                >
                  <a href="/feed" className="w-full sm:w-auto">
                    <button className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3.5 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors w-full sm:w-auto">
                      View Your Feed
                      <ChevronRight size={16} />
                    </button>
                  </a>
                  <a href="/trending" className="w-full sm:w-auto">
                    <button className="inline-flex items-center justify-center gap-2 bg-transparent border border-border text-foreground px-6 py-3.5 rounded-full text-sm font-medium hover:bg-secondary/5 transition-colors w-full sm:w-auto">
                      Browse Trending
                    </button>
                  </a>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="text-xs text-secondary/50"
                >
                  Updated every morning at 6 AM
                </motion.p>
              </>
            ) : (
              // New or not-onboarded user view - Clean layout
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight font-serif tracking-tight text-foreground mb-4 md:mb-6"
                >
                  Stop checking 10 apps every morning.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-base md:text-lg text-secondary leading-relaxed mb-4 max-w-md"
                >
                  {isAlphaMode()
                    ? "One place for everything worth reading today, tailored to what you actually care about."
                    : "One place for everything worth reading today, tailored to what you actually care about."
                  }
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex flex-wrap gap-2 mb-6 md:mb-8"
                >
                  {[
                    "Trending news",
                    "For You articles",
                    "Expert deep dives",
                    "AI summaries",
                  ].map((item) => (
                    <div
                      key={item}
                      className="px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium"
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
                  <Link
                    href="/tools/digest-preview"
                    className="inline-flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium text-secondary/70 hover:text-foreground transition-colors"
                  >
                    or preview your digest first
                    <ArrowUpRight size={14} />
                  </Link>
                </motion.div>

                {/* Social Proof */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map(i => (
                        <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-secondary">
                      <span className="font-medium text-foreground">200+ readers</span> get their daily brief
                    </span>
                  </div>
                </motion.div>
                <BadgeMarquee />
              </>
            )}
          </div>

          {/* Right Side - Feed Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="block relative"
          >
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
            Three personalized feeds — Trending, For You, and Deep Dives — refreshed daily
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
      title: "Tell us about you",
      description: "Pick your role, interests, and career goals. Choose expert sources you trust for deep dives.",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950"
    },
    {
      number: "02",
      icon: Search,
      title: "We build three feeds",
      description: "Trending news across tech, For You articles matched to your interests, and Deep Dives from expert sources you pick.",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950"
    },
    {
      number: "03",
      icon: Brain,
      title: "AI-powered summaries",
      description: "Every article gets an AI summary in your preferred style — executive brief, practitioner deep-dive, or casual talking points.",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950"
    },
    {
      number: "04",
      icon: TrendingUp,
      title: "Stay ahead, every day",
      description: "Your feeds refresh daily with fresh content. Bookmark what matters, and your feed gets smarter over time.",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950"
    },
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
      icon: "🔥",
      title: "Trending",
      description: "The latest news across tech, AI, design, business — an unfiltered pulse of what's buzzing right now"
    },
    {
      icon: "🎯",
      title: "For You",
      description: "Articles matched to your interests and career goals, with AI summaries in your preferred reading style"
    },
    {
      icon: "🎓",
      title: "Deep Dives",
      description: "In-depth content from expert sources you pick — top blogs, newsletters, and thought leaders in your field"
    },
    {
      icon: "✨",
      title: "AI Summaries",
      description: "Every article gets a smart summary — choose executive brief, practitioner deep-dive, or casual talking points"
    },
    {
      icon: "🔖",
      title: "Bookmarks",
      description: "Save articles to read later. Your bookmarks sync across devices and are always available"
    },
    {
      icon: "⚙️",
      title: "Personalized",
      description: "Pick your role, seniority, interests, and sources. Your feeds are built around who you are"
    }
  ];

  return (
    <section id="what-trace-replaces" className="py-16 md:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900 relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-3 md:mb-4"
          >
            Three Feeds, <span className="text-secondary/50">One App</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Trace scans the web and organizes it into three focused feeds, updated daily
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
              Your Daily Briefing — Feb 17, 2026
            </div>
          </div>

          {/* Feed Preview */}
          <div className="px-4 md:px-6 py-4 md:py-6 space-y-2">
            {[
              { icon: "🔥", title: "OpenAI releases GPT-5 with reasoning capabilities", source: "Trending" },
              { icon: "🎯", title: "How senior designers are using AI in their workflows", source: "For You" },
              { icon: "🎓", title: "Building scalable design systems: a complete guide", source: "Deep Dive" },
              { icon: "🔥", title: "React Server Components: the full mental model", source: "Trending" },
              { icon: "🎯", title: "Career ladder strategies for IC-to-manager transition", source: "For You" },
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
            Every day, Trace builds three feeds just for you.<br />
            Trending news, interest-matched articles, and deep dives from experts —<br />
            all with AI summaries in your preferred reading style.
          </p>
          <div className="flex flex-col items-center gap-1 text-sm text-foreground/70">
            <span>Three focused feeds.</span>
            <span>Refreshed daily.</span>
            <span className="font-medium text-foreground">Stay ahead without the noise.</span>
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
            See how Trace organizes your world into three focused feeds — Trending, For You, and Deep Dives.
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
                  Like what you see? Get Trending, For You, and Deep Dive feeds built for you.
                </p>
                <button
                  onClick={signInWithGoogle}
                  className="px-6 py-3 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  Start Free — 4 Day Trial
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

// --- Live Hero Feed Preview (for right side of hero) ---
type HeroTrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  thumbnail?: string;
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function isValidThumbnail(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 10) return false;
  if (url.includes('placeholder') || url.includes('default')) return false;
  return true;
}

const HeroDemo = () => {
  const [items, setItems] = useState<HeroTrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch('/api/public/trending');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setItems(data.items.slice(0, 4));
          }
        }
      } catch (err) {
        console.error('Failed to fetch trending:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  return (
    <div className="relative w-full mt-6 md:mt-0">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-border/60 overflow-hidden shadow-xl shadow-black/5 dark:shadow-gray-950/20">
        {/* Title + Link */}
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Trending Now</h3>
              <p className="text-[10px] text-secondary/50">Today's top articles</p>
            </div>
            <Link
              href="/trending"
              className="text-[10px] font-medium text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-0.5"
            >
              View all
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="p-3 overflow-hidden">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[16/10] rounded-lg bg-gray-200 dark:bg-gray-800 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-1" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item, i) => {
                const host = item.source || getHostname(item.url);
                const hasImage = isValidThumbnail(item.thumbnail);
                return (
                  <a
                    key={item.id || i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    {/* Image */}
                    <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
                      {hasImage ? (
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                            {host.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      {/* Source badge */}
                      {host && (
                        <div className="absolute top-1.5 left-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <span className="text-[8px] font-medium text-white leading-none">{host}</span>
                        </div>
                      )}
                    </div>
                    {/* Title */}
                    <h4 className="text-[11px] font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-amber-600 transition-colors">
                      {item.title}
                    </h4>
                    {/* Summary */}
                    <p className="text-[9px] text-secondary/50 line-clamp-1 mt-0.5">
                      {item.summary || '\u00A0'}
                    </p>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-secondary/50">Loading today's articles...</p>
            </div>
          )}
        </div>

        {/* CTA footer */}
        <div className="px-4 py-3 bg-amber-50/50 dark:bg-amber-950/20 border-t border-amber-200/30 dark:border-amber-800/20">
          <p className="text-[10px] text-center text-secondary/70">
            <span className="font-medium text-amber-700 dark:text-amber-400">Sign up free</span> to get personalized For You & Deep Dive feeds
          </p>
        </div>
      </div>
    </div>
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
            Trending news, personalized articles, and expert deep dives — three feeds, one app
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
              src="/feed.webp"
              alt="Trace Feed - Trending, For You, and Deep Dives"
              width={1600}
              height={1000}
              className="w-full h-auto"
              loading="lazy"
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

// --- Metrics / Social Proof Section ---
const Testimonials = () => {
  const metrics = [
    {
      value: "200+",
      label: "readers onboarded",
      detail: "Engineers, designers, founders",
    },
    {
      value: "60+",
      label: "sources tracked daily",
      detail: "TechCrunch, HN, arXiv, Lenny's & more",
    },
    {
      value: "3",
      label: "feeds, refreshed every morning",
      detail: "Trending, For You, Deep Dives",
    },
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
            Trace in <span className="text-secondary/50">Numbers</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
          >
            Real usage from real people — no fluff
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 text-center hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all"
            >
              <p className="text-4xl md:text-5xl font-bold text-foreground mb-2 tracking-tight">{metric.value}</p>
              <p className="text-sm md:text-base font-medium text-foreground mb-2">{metric.label}</p>
              <p className="text-xs text-secondary/60">{metric.detail}</p>
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
      title: "Why GPT-5 Changes Everything for Product Teams",
      source: "trending",
      description: "The latest model from OpenAI brings structured reasoning and tool use, with major implications for how product teams build."
    },
    {
      title: "Design Systems at Scale: Lessons from Stripe",
      source: "for_you",
      description: "How Stripe's design team manages consistency across 50+ products with a living design system and shared components."
    },
    {
      title: "The Complete Guide to React Server Components",
      source: "deep_dive",
      description: "A practitioner's deep dive into RSC — mental models, data fetching patterns, and when to use client vs server components."
    },
  ];


  return (
    <section id="feed" className="py-16 md:py-24 lg:py-40 bg-background border-y border-border relative overflow-hidden z-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-serif font-light tracking-tighter text-foreground uppercase mb-3 md:mb-4 lg:mb-6 px-4">
            Built Around <span className="text-secondary/40">You</span>
          </h2>
          <p className="text-secondary font-mono text-xs md:text-sm uppercase tracking-wider md:tracking-widest mb-4">
            {isLoggedIn
              ? `Your ${profile?.interests?.length || 0} interests power three daily feeds // Trending · For You · Deep Dives`
              : 'Three daily feeds — trending news, interest-matched articles, and expert deep dives with AI summaries.'
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
            <Newspaper size={16} className="md:hidden text-amber-500" />
            <Newspaper size={20} className="hidden md:block text-amber-500" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">Trending</span>
          </div>
          <div className="w-px h-4 md:h-6 bg-border"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <Sparkles size={16} className="md:hidden text-blue-500" />
            <Sparkles size={20} className="hidden md:block text-blue-500" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">For You</span>
          </div>
          <div className="w-px h-4 md:h-6 bg-border"></div>
          <div className="flex items-center gap-2 md:gap-3">
            <BookOpen size={16} className="md:hidden text-purple-500" />
            <BookOpen size={20} className="hidden md:block text-purple-500" />
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-widest text-secondary">Deep Dives</span>
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
    : 'Start reading for free';

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
                Three daily feeds: Trending, For You, Deep Dives
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                AI summaries in your preferred reading style
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                Expert deep dives from sources you trust
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
              </div>
              <div className="text-sm text-foreground">
                Unlimited articles, bookmarks &amp; daily refreshes
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
    if (!user) return 'Start reading for free';
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
                  ? "Your three feeds are waiting — Trending, For You, and Deep Dives."
                  : "Pick your role, interests, and sources. Your feeds build in under a minute."
                : "Sign in → Set your preferences → Get three personalized feeds."
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
                    <img src={user.photoURL} alt="Profile" width={80} height={80} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-gray-200 dark:border-gray-800" loading="lazy" />
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
                  Start reading for free
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const SEOContentSection = () => {
  const faqItems = [
    {
      q: "What is Trace?",
      a: "Trace is a personalized reading app that combines three daily feeds: trending news, interest-matched articles, and expert deep dives.",
    },
    {
      q: "How long does onboarding take?",
      a: "Most people complete onboarding in under one minute by selecting a role, interests, and preferred sources.",
    },
    {
      q: "Is there a free trial?",
      a: "Yes. Trace includes a free trial before the monthly plan starts, and you can cancel anytime.",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-background border-t border-border/50 relative z-10" aria-labelledby="trace-faq">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
        <article className="space-y-8">
          <header className="text-center">
            <h2 id="trace-faq" className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-secondary max-w-3xl mx-auto">
              Trace helps professionals stay current without opening dozens of apps. The sections below summarize core product details in a structured format for people and search engines.
            </p>
          </header>

          <section aria-labelledby="key-benefits">
            <h3 id="key-benefits" className="text-lg font-semibold text-foreground mb-3">Key Benefits</h3>
            <ul className="list-disc pl-6 space-y-2 text-secondary">
              <li>One place to review trending topics, personalized recommendations, and long-form deep dives.</li>
              <li>AI-generated summaries tuned to your preferred reading style and depth.</li>
              <li>A daily workflow that reduces information overload and improves signal-to-noise ratio.</li>
            </ul>
          </section>

          <section aria-labelledby="plan-compare">
            <h3 id="plan-compare" className="text-lg font-semibold text-foreground mb-3">Plan Snapshot</h3>
            <div className="overflow-x-auto border border-border/60 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="text-left p-3 font-semibold text-foreground">Feature</th>
                    <th className="text-left p-3 font-semibold text-foreground">Included</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/50">
                    <td className="p-3 text-secondary">Daily Trending feed</td>
                    <td className="p-3 text-secondary">Yes</td>
                  </tr>
                  <tr className="border-t border-border/50">
                    <td className="p-3 text-secondary">Personalized For You feed</td>
                    <td className="p-3 text-secondary">Yes</td>
                  </tr>
                  <tr className="border-t border-border/50">
                    <td className="p-3 text-secondary">Deep Dive summaries</td>
                    <td className="p-3 text-secondary">Yes</td>
                  </tr>
                  <tr className="border-t border-border/50">
                    <td className="p-3 text-secondary">Monthly price after trial</td>
                    <td className="p-3 text-secondary">$2.99</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="faq-list">
            <h3 id="faq-list" className="text-lg font-semibold text-foreground mb-3">Common Questions</h3>
            <ol className="space-y-3 text-secondary">
              {faqItems.map((item) => (
                <li key={item.q}>
                  <p className="text-foreground font-medium">{item.q}</p>
                  <p>{item.a}</p>
                </li>
              ))}
            </ol>
          </section>
        </article>
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
              src="/trace.webp"
              alt="Trace Logo"
              width={160}
              height={50}
              className="h-7 md:h-9 w-auto object-contain"
              loading="lazy"
            />
            TRACE
          </div>
          <p className="text-secondary text-sm leading-relaxed max-w-[240px]">
            Trace scans the sources you care about and gives you a short daily brief with links worth opening.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 lg:gap-24 w-full md:w-auto">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4 md:mb-5">Product</h4>
            <div className="flex flex-col gap-3 md:gap-4">
              <Link href="#get-started" className="text-sm text-secondary hover:text-foreground transition-colors">Start reading for free</Link>
              <Link href="/trending" className="text-sm text-secondary hover:text-foreground transition-colors">Trending Topics</Link>
              <Link href="/tools" className="text-sm text-secondary hover:text-foreground transition-colors">Free Tools</Link>
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
      <header>
        <Nav />
      </header>
      <main>
        <Hero />
        <NewsletterSignupSection />
        {/* <DemoVideo /> */}
        {/* <HowItWorks /> */}
        {/* <InteractiveDemo />
        <DemoFeed /> */}
        <WhatTraceReplaces />
        {/* <HowPeopleUseTrace /> */}
        <Testimonials />
        {/* <WhatYouGet /> */}
        <Pricing />
        <GetStarted />
        <SEOContentSection />
      </main>
      <Footer />
    </div>
  );
}
