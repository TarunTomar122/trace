"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Sparkles, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function WaitlistPage() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground font-serif flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full text-center space-y-8"
      >
        {/* Logo */}
        <div className="text-lg text-foreground uppercase flex items-center justify-center gap-3 tracking-[0.15em] font-serif font-black mb-8">
          <div className="flex flex-col gap-1">
            <div className="w-5 h-[2px] bg-primary"></div>
            <div className="w-6 h-[2px] bg-primary/30"></div>
          </div>
          TRACE
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
              <Mail className="text-primary" size={48} />
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center"
            >
              <Check size={16} className="text-primary-foreground" />
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase">
            You're <span className="text-primary">In</span>
          </h1>
          
          <p className="text-lg text-secondary font-mono max-w-md mx-auto">
            Thanks for joining Trace! We&apos;re putting the finishing touches on your three daily feeds — Trending, For You, and Deep Dives.
          </p>

          <div className="bg-secondary/10 dark:bg-secondary/20 border border-border dark:border-border/50 p-6 space-y-4 text-left max-w-md mx-auto">
            <div className="flex items-start gap-3">
              <Sparkles className="text-primary mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider mb-1">
                  What Happens Next?
                </h3>
                <p className="text-sm text-secondary font-mono">
                  We'sll send you an email at <span className="text-foreground font-semibold">{user?.email}</span> as soon as Trace goes live.
                </p>
              </div>
            </div>
          </div>

          {profile && (
            <div className="text-xs text-secondary/60 font-mono uppercase tracking-widest">
              Welcome, {profile.name || user?.displayName || 'there'}!
            </div>
          )}

          <div className="pt-8 space-y-4">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 bg-primary text-primary-foreground text-sm font-mono uppercase tracking-wider hover:tracking-[0.3em] transition-all"
            >
              Back to Home
            </button>
            
            <div>
              <button
                onClick={signOut}
                className="text-xs font-mono uppercase tracking-widest text-secondary hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

