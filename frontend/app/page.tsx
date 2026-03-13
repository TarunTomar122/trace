"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type TabId = 'about' | 'how' | 'pricing';

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const isOnboarded = !!user && !!profile?.onboarded;
  const [activeTab, setActiveTab] = useState<TabId>('about');

  // Redirect signed-in users to feed
  useEffect(() => {
    if (!loading && user) {
      if (isOnboarded) {
        router.replace('/feed');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [user, loading, isOnboarded, router]);

  // Show loading while checking auth or redirecting
  if (loading || user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-[0.12em] text-foreground">TRACE</span>
          </Link>
          <button
            onClick={signInWithGoogle}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end mb-0">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-6 py-2.5 text-sm font-medium rounded-tl-lg transition-colors ${
                  activeTab === 'about'
                    ? 'text-foreground bg-surface'
                    : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'
                }`}
                style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)' }}
              >
                About Trace
              </button>
              <button
                onClick={() => setActiveTab('how')}
                className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'how'
                    ? 'text-foreground bg-surface'
                    : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'
                }`}
                style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
              >
                How It Works
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'pricing'
                    ? 'text-foreground bg-surface'
                    : 'text-tab-inactive bg-surface-tertiary hover:text-foreground'
                }`}
                style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
              >
                Pricing
              </button>
              <Link
                href="/trending"
                className="px-6 py-2.5 text-sm font-medium text-tab-inactive bg-surface-tertiary hover:text-foreground transition-colors"
                style={{ clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 100%, 0 100%)', marginLeft: '-6px' }}
              >
                Trending
              </Link>
            </div>

            <div className="bg-surface rounded-tr-lg rounded-b-lg p-8 sm:p-12 lg:p-16">
              {activeTab === 'about' && (
                <div className="max-w-2xl">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground leading-tight mb-6">
                    Stop checking 10 apps every morning
                  </h1>
                  <p className="text-lg text-secondary leading-relaxed mb-8">
                    Trace scans the sources you care about and gives you a short daily brief with links worth opening.
                    Stories are grouped by topic, summarized at the depth you prefer, and ranked by what matters to you.
                  </p>

                  <div className="space-y-4 mb-10">
                    <div className="flex items-start gap-3">
                      <span className="text-secondary/30 font-mono text-sm">01.</span>
                      <div>
                        <h3 className="font-semibold text-foreground">Trending Topics</h3>
                        <p className="text-sm text-secondary">Related stories grouped together from many sources into topic overviews with key points and timelines.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-secondary/30 font-mono text-sm">02.</span>
                      <div>
                        <h3 className="font-semibold text-foreground">For You</h3>
                        <p className="text-sm text-secondary">Personalized high-quality articles to help you grow in your role, matched to your interests and goals.</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors"
                  >
                    Start Reading for Free
                    <ArrowRight size={18} />
                  </button>

                  <p className="text-xs text-secondary/50 mt-4">
                    200+ readers use Trace to catch up faster
                  </p>
                </div>
              )}

              {activeTab === 'how' && (
                <div className="max-w-2xl">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-8">How It Works</h2>
                  <div className="space-y-6">
                    <FeatureCard
                      number="01"
                      title="Set your context"
                      description="Pick your role, interests, and goals. Tell us what you want to learn."
                    />
                    <FeatureCard
                      number="02"
                      title="We cluster stories"
                      description="We group related coverage from many sources into topic overviews with key points and timelines."
                    />
                    <FeatureCard
                      number="03"
                      title="For You ranks what matters"
                      description="From those topics, For You picks the stories most relevant to your interests and goals."
                    />
                    <FeatureCard
                      number="04"
                      title="Read once, stay current"
                      description="Open one feed, understand the full story, and move on. No headline-hopping required."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'pricing' && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-8">Simple Pricing</h2>
                  <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
                    <div className="p-6 rounded-lg bg-surface-secondary">
                      <h3 className="text-lg font-semibold mb-2">Free</h3>
                      <p className="text-sm text-secondary mb-4">Get started with the essentials</p>
                      <ul className="space-y-2 text-sm text-secondary mb-6">
                        <li className="flex items-center gap-2">
                          <Check size={14} className="text-foreground" />
                          3 trending topics per day
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} className="text-foreground" />
                          1 For You article per day
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} className="text-foreground" />
                          Daily newsletter
                        </li>
                      </ul>
                      <button
                        onClick={signInWithGoogle}
                        className="w-full py-2.5 rounded-lg text-sm font-medium bg-surface-tertiary text-foreground hover:bg-border transition-colors"
                      >
                        Get Started
                      </button>
                    </div>

                    <div className="p-6 rounded-lg bg-foreground text-background">
                      <h3 className="text-lg font-semibold mb-2">Pro</h3>
                      <p className="text-sm text-background/70 mb-4">$2.99/month</p>
                      <ul className="space-y-2 text-sm text-background/80 mb-6">
                        <li className="flex items-center gap-2">
                          <Check size={14} />
                          Unlimited trending topics
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} />
                          Unlimited For You articles
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} />
                          Priority access to new features
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} />
                          Save snippets and bookmarks
                        </li>
                      </ul>
                      <button
                        onClick={signInWithGoogle}
                        className="w-full py-2.5 rounded-lg text-sm font-medium bg-background text-foreground hover:bg-background/90 transition-colors"
                      >
                        Start Free Trial
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

        {/* Android App Callout */}
        <section className="px-4 sm:px-6 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface rounded-lg p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-background" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 2.246a.75.75 0 0 0-1.046.177l-1.745 2.444a8.503 8.503 0 0 0-5.464 0L7.523 2.423a.75.75 0 1 0-1.223.869l1.56 2.184A8.472 8.472 0 0 0 3.5 12.5v.5a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-.5a8.472 8.472 0 0 0-4.36-7.024l1.56-2.184a.75.75 0 0 0-.177-1.046zM8.5 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM4 14.5a.5.5 0 0 0-.5.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a.5.5 0 0 0-.5-.5H4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Trace is on Android</h3>
                  <p className="text-sm text-secondary">Swipe through your feed on the go with the native app</p>
                </div>
              </div>
              <a
                href="https://play.google.com/store/apps/details?id=online.yourtrace.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors whitespace-nowrap"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.39 12l2.308-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
                </svg>
                Get on Google Play
              </a>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface-secondary rounded-lg p-8 sm:p-12">
              <NewsletterSignup />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 sm:px-6 py-8 border-t border-border/30">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/trace.webp" alt="Trace" className="h-5 w-auto" />
              <span className="text-xs font-semibold tracking-[0.12em] text-secondary">TRACE</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-secondary">
              <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="p-5 rounded-lg bg-surface-secondary">
      <div className="text-xs font-mono text-secondary/40 mb-2">{number}</div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-secondary">{description}</p>
    </div>
  );
}

function NewsletterSignup() {
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
    <div className="text-center">
      <Mail size={24} className="text-secondary/40 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">Get the Daily Brief</h2>
      <p className="text-sm text-secondary mb-6">
        One daily email with trending topics and personalized For You picks.
      </p>

      {status === 'success' ? (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface rounded-lg">
          <Check size={16} className="text-foreground" />
          <span className="text-sm font-medium">{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
            placeholder="your@email.com"
            required
            className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg bg-surface text-foreground placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-500 mt-2">{message}</p>
      )}
    </div>
  );
}
