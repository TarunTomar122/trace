"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Construction, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WIPPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background text-foreground font-serif flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-xl w-full text-center space-y-8"
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
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <Construction className="text-primary" size={48} />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-serif font-light tracking-tight uppercase">
            Work <span className="text-primary">In</span> Progress
          </h1>
          
          <p className="text-lg text-secondary font-mono max-w-md mx-auto">
            This feature is currently being built. Check back soon!
          </p>

          <div className="pt-8">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 bg-primary text-primary-foreground text-sm font-mono uppercase tracking-wider hover:tracking-[0.3em] transition-all flex items-center gap-2 mx-auto"
            >
              <Home size={16} />
              Back to Home
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

