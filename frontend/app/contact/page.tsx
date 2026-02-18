"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Twitter, Github, MessageCircle } from 'lucide-react';

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="flex items-center justify-between py-4">
                        <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            <ArrowLeft size={16} />
                            Back to Home
                        </Link>
                        <div className="text-lg text-foreground uppercase flex items-center gap-3 tracking-[0.1em] font-semibold">
                            <img
                                src="/trace.png"
                                alt="Trace Logo"
                                className="h-6 w-auto object-contain"
                            />
                            TRACE
                        </div>
                        <div className="w-24"></div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-32 pb-20">
                <div className="container mx-auto px-4 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                                <MessageCircle className="text-primary" size={24} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                                    Contact Us
                                </h1>
                            </div>
                        </div>
                        <p className="text-secondary text-base leading-relaxed">
                            Have a question, feedback, or need help with your subscription? We&apos;re here to help.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="space-y-4"
                    >
                        {/* Email */}
                        <a
                            href="mailto:yourtrace.online@gmail.com"
                            className="flex items-center gap-4 p-5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 transition-all group"
                        >
                            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                                <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Email</p>
                                <p className="text-sm text-secondary">yourtrace.online@gmail.com</p>
                            </div>
                        </a>

                        {/* Twitter */}
                        <a
                            href="https://x.com/tarat_211"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 transition-all group"
                        >
                            <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0">
                                <Twitter size={20} className="text-gray-700 dark:text-gray-300" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Twitter / X</p>
                                <p className="text-sm text-secondary">@tarat_211</p>
                            </div>
                        </a>

                        {/* GitHub */}
                        <a
                            href="https://github.com/TarunTomar122"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-300 dark:hover:border-gray-700 transition-all group"
                        >
                            <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0">
                                <Github size={20} className="text-gray-700 dark:text-gray-300" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">GitHub</p>
                                <p className="text-sm text-secondary">TarunTomar122</p>
                            </div>
                        </a>

                        {/* Subscription support note */}
                        <div className="mt-8 p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                            <p className="text-sm font-semibold text-foreground mb-2">Subscription & Billing Support</p>
                            <p className="text-sm text-secondary leading-relaxed">
                                For subscription cancellations or billing issues on Android, you can manage your subscription directly via{' '}
                                <strong>Google Play &gt; Account &gt; Subscriptions</strong>.
                                For web subscriptions, visit your{' '}
                                <Link href="/profile" className="text-primary hover:underline">profile page</Link>.
                                For anything else, email us at{' '}
                                <a href="mailto:yourtrace.online@gmail.com" className="text-primary hover:underline">yourtrace.online@gmail.com</a>.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 bg-background border-t border-gray-100 dark:border-gray-800">
                <div className="container mx-auto px-4 max-w-2xl text-center">
                    <p className="text-sm text-secondary">
                        © 2026 Trace — Built with intention
                    </p>
                </div>
            </footer>
        </div>
    );
}
